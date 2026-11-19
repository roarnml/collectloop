
import uuid

from django.shortcuts import get_object_or_404

from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.payment_requests.models import PaymentRequest
from apps.payments.models import PaymentTransaction
from apps.payments.providers.open_payments.incoming import (
    inspect_incoming_payment,
)
from apps.payments.providers.open_payments.service import (
    provision_incoming_payment,
)
from apps.payments.providers.open_payments.client import (
    OpenPaymentsAdapterError,
)

from .serializers import (
    PublicPaymentRequestSerializer,
    PaymentAttemptSerializer,
    CreatePaymentAttemptSerializer,
)
from .services import create_payment_attempt, mark_transaction_failed


class PublicPaymentRequestView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, public_id):
        payment_request = get_object_or_404(
            PaymentRequest.objects.select_related("business"),
            public_id=public_id,
        )

        return Response(
            PublicPaymentRequestSerializer(payment_request).data,
            status=status.HTTP_200_OK,
        )


class PaymentInitiationView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, public_id):
        serializer = CreatePaymentAttemptSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        key = request.headers.get("Idempotency-Key")

        if not key:
            return Response(
                {"detail": "Idempotency-Key header is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            key = uuid.UUID(key)
        except (ValueError, TypeError, AttributeError):
            return Response(
                {"detail": "Idempotency-Key must be a valid UUID."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        payment = create_payment_attempt(
            payment_public_id=public_id,
            amount=serializer.validated_data["amount"],
            idempotency_key=key,
        )

        # A retry with the key of an attempt that has already finished.
        if payment.status == PaymentTransaction.Status.SUCCEEDED:
            return Response(
                {
                    "message": "This payment has already been completed.",
                    "payment": PaymentAttemptSerializer(payment).data,
                    "incoming_payment_url": payment.incoming_payment_url,
                    "next_step": "none",
                },
                status=status.HTTP_200_OK,
            )

        if payment.status != PaymentTransaction.Status.PENDING:
            return Response(
                {
                    "detail": (
                        payment.failure_reason
                        or "This payment attempt can no longer be completed. "
                        "Please start a new payment."
                    ),
                    "payment": PaymentAttemptSerializer(payment).data,
                    "next_step": "start_new_attempt",
                },
                status=status.HTTP_409_CONFLICT,
            )

        try:
            incoming_payment_url = provision_incoming_payment(payment)

        except ValidationError as exc:
            # Not retryable (e.g. currency mismatch): fail the attempt so it
            # stops reserving part of the outstanding balance.
            detail = exc.detail
            reason = str(detail[0] if isinstance(detail, list) and detail else detail)
            mark_transaction_failed(
                payment.id,
                reason=reason,
                provider_status="provisioning_failed",
            )
            raise

        except OpenPaymentsAdapterError:
            # Possibly temporary: keep the attempt so a retry with the same
            # Idempotency-Key can finish setup. If setup never completes,
            # services.release_stale_attempts frees its reserved balance.
            return Response(
                {
                    "message": (
                        "Your payment attempt has been recorded, "
                        "but payment setup is temporarily unavailable."
                    ),
                    "payment": PaymentAttemptSerializer(payment).data,
                    "next_step": "retry_with_same_idempotency_key",
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response(
            {
                "message": "Payment attempt created.",
                "payment": PaymentAttemptSerializer(payment).data,
                "incoming_payment_url": incoming_payment_url,
                "next_step": "payer_authorization_required",
            },
            status=status.HTTP_201_CREATED,
        )


class PaymentVerificationView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, transaction_key):
        try:
            transaction_key = uuid.UUID(str(transaction_key))
        except (ValueError, TypeError, AttributeError):
            return Response(
                {"detail": "Invalid transaction reference."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        payment = get_object_or_404(
            PaymentTransaction,
            idempotency_key=transaction_key,
        )

        # Finished attempts need no provider call (and a failed one may have
        # no incoming-payment resource at all).
        if payment.status in [
            PaymentTransaction.Status.FAILED,
            PaymentTransaction.Status.CANCELLED,
        ]:
            return Response(
                {
                    "message": payment.failure_reason or "This payment did not complete.",
                    "verification": {
                        "status": payment.status,
                        "message": payment.failure_reason or "This payment did not complete.",
                    },
                    "transaction": PaymentAttemptSerializer(payment).data,
                },
                status=status.HTTP_200_OK,
            )

        try:
            result = inspect_incoming_payment(payment)

        except OpenPaymentsAdapterError:
            payment.refresh_from_db()

            return Response(
                {
                    "message": "Unable to verify payment with the provider.",
                    "status": payment.status,
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        except ValidationError as exc:
            return Response(
                {"message": exc.detail},
                status=status.HTTP_400_BAD_REQUEST,
            )

        payment.refresh_from_db()

        return Response(
            {
                "message": result["message"],
                "verification": result,
                "transaction": PaymentAttemptSerializer(payment).data,
            },
            status=status.HTTP_200_OK,
        )
