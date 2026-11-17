
from decimal import Decimal

from rest_framework import serializers

from .models import PaymentRequest


class PaymentRequestSerializer(serializers.ModelSerializer):
    amount_paid = serializers.DecimalField(
        max_digits=14,
        decimal_places=2,
        read_only=True,
    )

    outstanding_amount = serializers.DecimalField(
        max_digits=14,
        decimal_places=2,
        read_only=True,
    )

    class Meta:
        model = PaymentRequest

        fields = [
            "id",
            "public_id",
            "reference",
            "business",
            "customer",
            "description",
            "total_amount",
            "currency",
            "due_date",
            "status",
            "amount_paid",
            "outstanding_amount",
            "created_at",
        ]

        read_only_fields = [
            "id",
            "public_id",
            "reference",
            "status",
            "amount_paid",
            "outstanding_amount",
            "created_at",
        ]

    def validate_total_amount(self, value):
        if value <= Decimal("0.00"):
            raise serializers.ValidationError(
                "Payment amount must be greater than zero."
            )

        return value

    def validate_currency(self, value):
        value = value.strip().upper()

        if len(value) != 3 or not value.isalpha() or not value.isascii():
            raise serializers.ValidationError(
                "Currency must be a valid three-letter currency code."
            )

        return value

    def validate(self, attrs):
        request = self.context.get("request")

        if request is None or not request.user.is_authenticated:
            raise serializers.ValidationError(
                "Authentication is required to manage payment requests."
            )

        business = attrs.get(
            "business",
            getattr(self.instance, "business", None),
        )

        customer = attrs.get(
            "customer",
            getattr(self.instance, "customer", None),
        )

        if business is None:
            raise serializers.ValidationError({
                "business": "A business is required."
            })

        if business.owner_id != request.user.id:
            raise serializers.ValidationError({
                "business": "You do not own this business."
            })

        if customer is None:
            raise serializers.ValidationError({
                "customer": "A customer is required."
            })

        if customer.business_id != business.id:
            raise serializers.ValidationError({
                "customer": (
                    "This customer does not belong to this business."
                )
            })

        if self.instance and self.instance.transactions.exists():
            raise serializers.ValidationError(
                "A payment request with payment attempts cannot be edited."
            )

        return attrs
