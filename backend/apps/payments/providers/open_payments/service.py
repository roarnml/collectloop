
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.core.exceptions import ObjectDoesNotExist
from rest_framework.exceptions import ValidationError

from apps.payments.models import PaymentTransaction
from apps.payments.providers.open_payments.client import (
    get_wallet,
    create_incoming_payment,
)


def provision_incoming_payment(payment):
    """
    Create an Open Payments incoming-payment resource for a pending
    Django transaction and persist its resource URL.

    This does not initiate or settle a transfer of funds.
    """

    with transaction.atomic():
        # Lock the transaction so concurrent requests cannot both
        # provision a resource for the same payment transaction.
        try:
            locked_payment = (
                PaymentTransaction.objects
                .select_for_update()
                .select_related("payment_request")
                .get(pk=payment.pk)
            )
        except ObjectDoesNotExist as exc:
            raise ValidationError(
                "Payment transaction could not be found."
            ) from exc

        # Reuse an existing provider resource.
        if locked_payment.incoming_payment_url:
            payment.incoming_payment_url = (
                locked_payment.incoming_payment_url
            )
            return locked_payment.incoming_payment_url

        if locked_payment.status != PaymentTransaction.Status.PENDING:
            raise ValidationError(
                "Only pending transactions can be provisioned."
            )

        wallet = get_wallet()

        if not isinstance(wallet, dict):
            raise ValidationError(
                "The payment wallet returned an invalid response."
            )

        try:
            wallet_currency = str(wallet["assetCode"]).upper()
            asset_scale = wallet["assetScale"]
        except (KeyError, TypeError) as exc:
            raise ValidationError(
                "The payment wallet configuration is incomplete."
            ) from exc

        payment_currency = str(locked_payment.currency).upper()

        if payment_currency != wallet_currency:
            raise ValidationError(
                f"Currency mismatch. This wallet supports {wallet_currency}, "
                f"but this payment uses {payment_currency}."
            )

        try:
            if (
                isinstance(asset_scale, bool)
                or not isinstance(asset_scale, int)
                or asset_scale < 0
                or asset_scale > 18
            ):
                raise ValueError("Unsupported wallet asset scale.")

            amount = Decimal(str(locked_payment.amount))

            if not amount.is_finite() or amount <= 0:
                raise ValueError("Invalid payment amount.")

            multiplier = Decimal(10) ** asset_scale
            minor_amount = amount * multiplier

            if minor_amount != minor_amount.to_integral_value():
                raise ValidationError(
                    "Payment amount has more decimal places than "
                    "the wallet supports."
                )

            minor_amount = int(minor_amount)

        except (InvalidOperation, TypeError, ValueError) as exc:
            raise ValidationError(
                "Could not convert the payment amount for this wallet."
            ) from exc

        if minor_amount <= 0:
            raise ValidationError(
                "Payment amount must be greater than zero."
            )

        payment_request = locked_payment.payment_request

        description = (
            f"PayTrain payment {payment_request.reference}"
        )

        incoming_payment = create_incoming_payment(
            amount=minor_amount,
            description=description,
            expires_in_minutes=60,
        )

        if not isinstance(incoming_payment, dict):
            raise ValidationError(
                "The Open Payments adapter returned an invalid response."
            )

        incoming_payment_url = incoming_payment.get("id")

        if (
            not isinstance(incoming_payment_url, str)
            or not incoming_payment_url.strip()
        ):
            raise ValidationError(
                "The Open Payments adapter did not return "
                "a valid incoming-payment resource URL."
            )

        locked_payment.incoming_payment_url = incoming_payment_url
        locked_payment.save(
            update_fields=["incoming_payment_url"]
        )

        # Keep the caller's object synchronized.
        payment.incoming_payment_url = incoming_payment_url

        return incoming_payment_url
