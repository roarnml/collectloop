
import uuid

from django.core.validators import RegexValidator
from django.db import models
from django.db.models import Q


currency_validator = RegexValidator(
    regex=r"^[A-Z]{3}$",
    message="Currency must be a valid three-letter uppercase code.",
)


class PaymentTransaction(models.Model):

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        SUCCEEDED = "succeeded", "Succeeded"
        FAILED = "failed", "Failed"
        CANCELLED = "cancelled", "Cancelled"

    payment_request = models.ForeignKey(
        "payment_requests.PaymentRequest",
        on_delete=models.PROTECT,
        related_name="transactions",
    )

    idempotency_key = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        editable=False,
    )

    provider = models.CharField(
        max_length=80,
        default="open_payments",
    )

    provider_reference = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        unique=True,
    )

    # Open Payments resource URLs: internal use only.
    incoming_payment_url = models.URLField(
        max_length=1000,
        blank=True,
    )

    quote_url = models.URLField(
        max_length=1000,
        blank=True,
    )

    outgoing_payment_url = models.URLField(
        max_length=1000,
        blank=True,
    )

    payer_wallet_address = models.URLField(
        max_length=1000,
        blank=True,
    )

    amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
    )

    currency = models.CharField(
        max_length=3,
        validators=[currency_validator],
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )

    provider_status = models.CharField(
        max_length=50,
        blank=True,
    )

    failure_reason = models.TextField(blank=True)

    # Store sanitized provider data only.
    raw_payload = models.JSONField(
        default=dict,
        blank=True,
    )

    created_at = models.DateTimeField(auto_now_add=True)

    verified_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ["-created_at"]

        indexes = [
            models.Index(
                fields=["payment_request", "status"],
                name="payment_req_status_idx",
            ),
        ]

        constraints = [
            models.CheckConstraint(
                condition=Q(amount__gt=0),
                name="payment_amount_positive",
            ),
            models.CheckConstraint(
                condition=Q(
                    status__in=[
                        "pending",
                        "succeeded",
                        "failed",
                        "cancelled",
                    ]
                ),
                name="payment_status_valid",
            ),
        ]

    def __str__(self):
        return f"{self.payment_request.reference} - {self.status}"
