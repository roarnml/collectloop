
from decimal import Decimal

from rest_framework import serializers

from apps.payment_requests.models import PaymentRequest
from .models import PaymentTransaction


class PublicPaymentRequestSerializer(serializers.ModelSerializer):
    business_name = serializers.CharField(
        source="business.name",
        read_only=True,
    )

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
            "public_id",
            "reference",
            "business_name",
            "description",
            "total_amount",
            "currency",
            "due_date",
            "status",
            "amount_paid",
            "outstanding_amount",
        ]
        read_only_fields = fields


class PaymentAttemptSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentTransaction
        fields = [
            "idempotency_key",
            "amount",
            "currency",
            "status",
            "created_at",
        ]
        read_only_fields = fields


class CreatePaymentAttemptSerializer(serializers.Serializer):
    amount = serializers.DecimalField(
        max_digits=14,
        decimal_places=2,
        min_value=Decimal("0.01"),
    )
