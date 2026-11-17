
import uuid
from decimal import Decimal

from django.core.validators import RegexValidator
from django.db import models
from django.db.models import Q, Sum


currency_validator = RegexValidator(
    regex=r"^[A-Z]{3}$",
    message="Currency must be a three-letter uppercase code.",
)


class PaymentRequest(models.Model):

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PARTIALLY_PAID = "partially_paid", "Partially Paid"
        PAID = "paid", "Paid"
        EXPIRED = "expired", "Expired"
        CANCELLED = "cancelled", "Cancelled"

    public_id = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        editable=False,
    )

    reference = models.CharField(
        max_length=30,
        unique=True,
        editable=False,
    )

    business = models.ForeignKey(
        "businesses.Business",
        on_delete=models.CASCADE,
        related_name="payment_requests",
    )

    customer = models.ForeignKey(
        "customers.Customer",
        on_delete=models.PROTECT,
        related_name="payment_requests",
    )

    description = models.CharField(max_length=255)

    total_amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
    )

    currency = models.CharField(
        max_length=3,
        validators=[currency_validator],
    )

    due_date = models.DateField(
        null=True,
        blank=True,
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

        indexes = [
            models.Index(
                fields=["business", "status"],
                name="payreq_business_status_idx",
            ),
        ]

        constraints = [
            models.CheckConstraint(
                condition=Q(total_amount__gt=0),
                name="payment_request_amount_positive",
            ),
            models.CheckConstraint(
                condition=Q(
                    status__in=[
                        "pending",
                        "partially_paid",
                        "paid",
                        "expired",
                        "cancelled",
                    ]
                ),
                name="payment_request_status_valid",
            ),
        ]

    def save(self, *args, **kwargs):
        if not self.reference:
            self.reference = f"PT-{uuid.uuid4().hex[:12].upper()}"

        super().save(*args, **kwargs)

    def __str__(self):
        return self.reference

    @property
    def amount_paid(self):
        """
        Total amount received from successfully verified transactions.
        """
        total = self.transactions.filter(
            status=PaymentTransactionStatus.SUCCEEDED
        ).aggregate(
            total=Sum("amount")
        )["total"]

        return total if total is not None else Decimal("0.00")

    @property
    def outstanding_amount(self):
        """
        Amount still owed by the customer.
        """
        outstanding = self.total_amount - self.amount_paid

        return max(outstanding, Decimal("0.00"))

    def refresh_status(self):
        """
        Recalculate payment request status after a verified payment.
        """
        if self.status in [
            self.Status.CANCELLED,
            self.Status.EXPIRED,
        ]:
            return self.status

        paid = self.amount_paid

        if paid >= self.total_amount:
            new_status = self.Status.PAID
        elif paid > Decimal("0.00"):
            new_status = self.Status.PARTIALLY_PAID
        else:
            new_status = self.Status.PENDING

        if self.status != new_status:
            self.status = new_status
            self.save(update_fields=["status", "updated_at"])

        return self.status


class PaymentTransactionStatus:
    """
    Avoid importing the payments model here and creating
    a circular model dependency.
    """
    SUCCEEDED = "succeeded"
