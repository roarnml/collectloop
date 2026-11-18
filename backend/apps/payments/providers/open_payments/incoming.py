
import re
from decimal import Decimal, InvalidOperation

from rest_framework.exceptions import ValidationError

from apps.payments.models import PaymentTransaction
from apps.payments.providers.open_payments.client import (
    get_wallet,
    get_incoming_payment,
)
from apps.payments.services import mark_transaction_succeeded


def _get_asset_scale(value):
    """Validate and return a supported Open Payments asset scale."""

    if isinstance(value, bool):
        raise ValidationError("Provider returned an invalid asset scale.")

    if not isinstance(value, int) or not 0 <= value <= 18:
        raise ValidationError("Provider returned an invalid asset scale.")

    return value


def _to_minor_units(value, scale, field_name, allow_zero=True):
    """Convert a decimal amount into validated integer minor units."""

    try:
        amount = Decimal(str(value))

        if not amount.is_finite():
            raise ValueError("Amount must be finite.")

        if amount < 0 or (not allow_zero and amount == 0):
            raise ValueError("Amount is outside the permitted range.")

        minor_amount = amount * (Decimal(10) ** scale)

        if minor_amount != minor_amount.to_integral_value():
            raise ValueError("Amount has unsupported decimal precision.")

        return int(minor_amount)

    except (InvalidOperation, TypeError, ValueError):
        raise ValidationError(
            f"Provider returned an invalid {field_name} amount."
        )


def _validate_asset_amount(amount_data, asset_code, asset_scale, field_name):
    """Validate an amount object's currency, scale and value."""

    if not isinstance(amount_data, dict):
        raise ValidationError(
            f"Provider returned an invalid {field_name} amount."
        )

    returned_asset_code = str(
        amount_data.get("assetCode", "")
    ).upper()

    if returned_asset_code != asset_code:
        raise ValidationError(
            f"{field_name} currency does not match the configured wallet."
        )

    returned_scale = amount_data.get("assetScale")

    if (
        isinstance(returned_scale, bool)
        or not isinstance(returned_scale, int)
        or returned_scale != asset_scale
    ):
        raise ValidationError(
            f"{field_name} scale does not match the configured wallet."
        )

    if "value" not in amount_data:
        raise ValidationError(
            f"Provider did not return the {field_name} amount value."
        )

    return _to_minor_units(
        amount_data["value"],
        asset_scale,
        field_name,
    )


def inspect_incoming_payment(payment):
    """
    Retrieve an Open Payments incoming-payment resource and verify
    its received amount against the expected Django transaction.

    A transaction succeeds only when the provider confirms receipt
    of the full expected amount.
    """

    if not payment.incoming_payment_url:
        raise ValidationError(
            "This transaction has no incoming-payment resource."
        )

    if payment.status == PaymentTransaction.Status.SUCCEEDED:
        return {
            "status": "succeeded",
            "message": "This transaction is already verified.",
        }

    if payment.status in [
        PaymentTransaction.Status.FAILED,
        PaymentTransaction.Status.CANCELLED,
    ]:
        return {
            "status": payment.status,
            "message": "This transaction cannot be verified further.",
        }

    # Retrieve the authoritative provider resource.
    resource = get_incoming_payment(payment.incoming_payment_url)

    if not isinstance(resource, dict):
        raise ValidationError(
            "The provider returned an invalid incoming-payment resource."
        )

    incoming_amount = resource.get("incomingAmount")
    received_amount = resource.get("receivedAmount")

    wallet = get_wallet()

    if not isinstance(wallet, dict):
        raise ValidationError(
            "The configured payment wallet returned an invalid response."
        )

    asset_code = str(wallet.get("assetCode", "")).upper()

    if not asset_code:
        raise ValidationError(
            "The configured wallet has no valid asset code."
        )

    asset_scale = _get_asset_scale(wallet.get("assetScale"))

    # Validate the original amount requested from the provider.
    provider_expected = _validate_asset_amount(
        incoming_amount,
        asset_code,
        asset_scale,
        "incoming-payment",
    )

    # Convert the expected Django transaction amount to minor units.
    expected_minor = _to_minor_units(
        payment.amount,
        asset_scale,
        "transaction",
        allow_zero=False,
    )

    if provider_expected != expected_minor:
        raise ValidationError(
            "Provider incoming-payment amount does not match "
            "the Django transaction."
        )

    # An absent receivedAmount means no funds have been reported yet.
    if received_amount is None:
        provider_received = 0
    else:
        provider_received = _validate_asset_amount(
            received_amount,
            asset_code,
            asset_scale,
            "received",
        )

    # No funds received.
    if provider_received == 0:
        return {
            "status": "pending",
            "received": "0",
            "expected": str(expected_minor),
            "message": "The provider has not reported any received funds.",
        }

    # Partial payment: do not mark the transaction successful.
    if provider_received < expected_minor:
        return {
            "status": "partially_received",
            "received": str(provider_received),
            "expected": str(expected_minor),
            "message": "The payment is only partially received.",
        }

    # Overpayment: flag for reconciliation.
    if provider_received > expected_minor:
        return {
            "status": "overpayment_review",
            "received": str(provider_received),
            "expected": str(expected_minor),
            "message": (
                "Received amount exceeds the expected transaction amount."
            ),
        }

    provider_reference = resource.get("id")

    if not isinstance(provider_reference, str) or not provider_reference:
        raise ValidationError(
            "Provider did not return a valid payment reference."
        )

    # The exact expected amount has been received.
    verified_amount = (
        Decimal(provider_received) / (Decimal(10) ** asset_scale)
    )

    mark_transaction_succeeded(
        transaction_id=payment.id,
        provider_reference=provider_reference,
        verified_amount=verified_amount,
        verified_currency=asset_code,
        provider_status="received",
        sanitized_payload={
            "id": provider_reference,
            "incomingAmount": incoming_amount,
            "receivedAmount": received_amount,
            "completed": resource.get("completed"),
            "expiresAt": resource.get("expiresAt"),
        },
    )

    return {
        "status": "succeeded",
        "received": str(provider_received),
        "expected": str(expected_minor),
        "message": "Payment receipt verified with Open Payments.",
    }
