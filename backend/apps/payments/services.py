
from decimal import Decimal, InvalidOperation

from django.db import IntegrityError, transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.payment_requests.models import PaymentRequest
from .models import PaymentTransaction


ZERO = Decimal("0.00")


def _normalise_amount(value):
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise ValidationError("Invalid payment amount.")

    if not amount.is_finite() or amount <= ZERO:
        raise ValidationError("Payment amount must be greater than zero.")

    return amount


def _validate_idempotent_transaction(existing, payment_request, amount):
    if (
        existing.payment_request_id != payment_request.id
        or existing.amount != amount
    ):
        raise ValidationError(
            "Idempotency key has already been used for another request."
        )

    return existing


def _get_locked_payment(transaction_id):
    """
    Always lock the payment request before its transaction.
    This keeps lock ordering consistent across payment operations.
    """
    payment_request_id = (
        PaymentTransaction.objects
        .filter(id=transaction_id)
        .values_list("payment_request_id", flat=True)
        .first()
    )

    if payment_request_id is None:
        raise ValidationError("Payment transaction not found.")

    payment_request = (
        PaymentRequest.objects
        .select_for_update()
        .filter(id=payment_request_id)
        .first()
    )

    if payment_request is None:
        raise ValidationError("Payment request not found.")

    payment = (
        PaymentTransaction.objects
        .select_for_update()
        .filter(id=transaction_id)
        .first()
    )

    if payment is None:
        raise ValidationError("Payment transaction not found.")

    return payment_request, payment


@transaction.atomic
def create_payment_attempt(payment_public_id, amount, idempotency_key):
    amount = _normalise_amount(amount)

    payment_request = (
        PaymentRequest.objects
        .select_for_update()
        .filter(public_id=payment_public_id)
        .first()
    )

    if not payment_request:
        raise ValidationError("Payment request not found.")

    # An idempotent retry should return the original transaction.
    existing = PaymentTransaction.objects.filter(
        idempotency_key=idempotency_key
    ).first()

    if existing:
        return _validate_idempotent_transaction(
            existing,
            payment_request,
            amount,
        )

    if payment_request.status in [
        PaymentRequest.Status.CANCELLED,
        PaymentRequest.Status.EXPIRED,
        PaymentRequest.Status.PAID,
    ]:
        raise ValidationError("This payment request is not payable.")

    if (
        payment_request.due_date
        and payment_request.due_date < timezone.localdate()
    ):
        raise ValidationError("This payment request has expired.")

    outstanding = payment_request.outstanding_amount

    # Pending transactions reserve part of the outstanding balance.
    pending_total = (
        PaymentTransaction.objects
        .filter(
            payment_request=payment_request,
            status=PaymentTransaction.Status.PENDING,
        )
        .aggregate(total=Sum("amount"))["total"]
        or ZERO
    )

    available_balance = outstanding - pending_total

    if available_balance <= ZERO:
        raise ValidationError(
            "The outstanding balance is already reserved by pending payments."
        )

    if amount > available_balance:
        raise ValidationError(
            f"Amount exceeds the available payment balance of "
            f"{available_balance}."
        )

    try:
        # A savepoint allows us to recover cleanly from a concurrent
        # idempotency-key collision without breaking the outer transaction.
        with transaction.atomic():
            return PaymentTransaction.objects.create(
                payment_request=payment_request,
                idempotency_key=idempotency_key,
                amount=amount,
                currency=payment_request.currency,
                status=PaymentTransaction.Status.PENDING,
            )

    except IntegrityError:
        existing = PaymentTransaction.objects.filter(
            idempotency_key=idempotency_key
        ).first()

        if existing:
            return _validate_idempotent_transaction(
                existing,
                payment_request,
                amount,
            )

        raise ValidationError(
            "Unable to create payment attempt. Please try again."
        )


@transaction.atomic
def mark_transaction_succeeded(
    transaction_id,
    provider_reference,
    verified_amount,
    verified_currency,
    provider_status,
    sanitized_payload=None,
):
    request, payment = _get_locked_payment(transaction_id)

    if payment.status == PaymentTransaction.Status.SUCCEEDED:
        return payment

    if payment.status in [
        PaymentTransaction.Status.FAILED,
        PaymentTransaction.Status.CANCELLED,
    ]:
        raise ValidationError(
            "A failed or cancelled transaction cannot be completed."
        )

    verified_amount = _normalise_amount(verified_amount)

    if verified_amount != payment.amount:
        raise ValidationError(
            "Verified amount does not match the payment."
        )

    if (
        not isinstance(verified_currency, str)
        or verified_currency.upper() != payment.currency.upper()
    ):
        raise ValidationError(
            "Verified currency does not match the request."
        )

    # Recalculate the balance while holding the payment request lock.
    # Exclude the current transaction from pending reservations.
    outstanding = request.outstanding_amount

    other_pending_total = (
        PaymentTransaction.objects
        .filter(
            payment_request=request,
            status=PaymentTransaction.Status.PENDING,
        )
        .exclude(id=payment.id)
        .aggregate(total=Sum("amount"))["total"]
        or ZERO
    )

    available_balance = outstanding - other_pending_total

    if verified_amount > available_balance:
        raise ValidationError(
            "The payment would exceed the remaining request balance."
        )

    if provider_reference:
        payment.provider_reference = provider_reference

    payment.provider_status = provider_status
    payment.status = PaymentTransaction.Status.SUCCEEDED
    payment.verified_at = timezone.now()
    payment.raw_payload = sanitized_payload or {}

    payment.save(update_fields=[
        "provider_reference",
        "provider_status",
        "status",
        "verified_at",
        "raw_payload",
    ])

    request.refresh_status()

    return payment


@transaction.atomic
def mark_transaction_failed(
    transaction_id,
    reason,
    provider_status="failed",
):
    _, payment = _get_locked_payment(transaction_id)

    if payment.status == PaymentTransaction.Status.SUCCEEDED:
        raise ValidationError(
            "A successful transaction cannot be changed to failed."
        )

    if payment.status == PaymentTransaction.Status.CANCELLED:
        return payment

    payment.status = PaymentTransaction.Status.FAILED
    payment.provider_status = provider_status
    payment.failure_reason = reason

    payment.save(update_fields=[
        "status",
        "provider_status",
        "failure_reason",
    ])

    return payment
