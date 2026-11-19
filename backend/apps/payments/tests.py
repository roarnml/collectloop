import uuid
from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from apps.businesses.models import Business
from apps.customers.models import Customer
from apps.payment_requests.models import PaymentRequest
from apps.payments.models import PaymentTransaction
from apps.payments.providers.open_payments.client import OpenPaymentsAdapterError
from apps.payments.services import PROVISION_GRACE, PROVISIONING_FAILED_REASON

PROVISION = "apps.payments.views.provision_incoming_payment"
INCOMING_URL = "https://wallet.example.test/incoming-payments/abc"


def _provision_ok(payment):
    PaymentTransaction.objects.filter(pk=payment.pk).update(incoming_payment_url=INCOMING_URL)
    payment.incoming_payment_url = INCOMING_URL
    return INCOMING_URL


class PaymentAttemptReservationTests(TestCase):
    """Attempts whose payment setup never completed must not block the balance."""

    def setUp(self):
        owner = get_user_model().objects.create_user(
            email="owner@example.test", password="unused-test-pass", full_name="Owner"
        )
        business = Business.objects.create(owner=owner, name="Test Studio")
        customer = Customer.objects.create(business=business, full_name="Customer")
        self.request = PaymentRequest.objects.create(
            business=business,
            customer=customer,
            description="Test request",
            total_amount=Decimal("1000.00"),
            currency="NGN",
        )
        self.client = APIClient()
        self.attempts_url = f"/api/v1/public/payment-requests/{self.request.public_id}/attempts/"

    def attempt(self, amount, key=None):
        key = key or str(uuid.uuid4())
        response = self.client.post(
            self.attempts_url, {"amount": amount}, format="json", HTTP_IDEMPOTENCY_KEY=key
        )
        return response, key

    def age(self, key, by=PROVISION_GRACE + timedelta(seconds=1)):
        PaymentTransaction.objects.filter(idempotency_key=key).update(
            created_at=timezone.now() - by
        )

    def txn(self, key):
        return PaymentTransaction.objects.get(idempotency_key=key)

    def test_adapter_outage_reserves_balance_during_grace(self):
        with patch(PROVISION, side_effect=OpenPaymentsAdapterError("down")):
            response, key = self.attempt("500.00")
        self.assertEqual(response.status_code, 503)
        self.assertEqual(self.txn(key).status, PaymentTransaction.Status.PENDING)

        # Setup may still be retried, so the 500 stays reserved for now.
        with patch(PROVISION, side_effect=_provision_ok):
            response, _ = self.attempt("1000.00")
        self.assertEqual(response.status_code, 400)

    def test_retry_with_same_key_within_grace_finishes_setup(self):
        with patch(PROVISION, side_effect=OpenPaymentsAdapterError("down")):
            _, key = self.attempt("500.00")
        with patch(PROVISION, side_effect=_provision_ok):
            response, _ = self.attempt("500.00", key=key)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["incoming_payment_url"], INCOMING_URL)

    def test_stale_unprovisioned_attempt_is_released(self):
        with patch(PROVISION, side_effect=OpenPaymentsAdapterError("down")):
            _, stale_key = self.attempt("500.00")
        self.age(stale_key)

        with patch(PROVISION, side_effect=_provision_ok):
            response, _ = self.attempt("1000.00")

        self.assertEqual(response.status_code, 201)
        stale = self.txn(stale_key)
        self.assertEqual(stale.status, PaymentTransaction.Status.FAILED)
        self.assertEqual(stale.failure_reason, PROVISIONING_FAILED_REASON)

    def test_retry_of_released_attempt_asks_for_new_attempt(self):
        with patch(PROVISION, side_effect=OpenPaymentsAdapterError("down")):
            _, key = self.attempt("500.00")
        self.age(key)

        with patch(PROVISION, side_effect=_provision_ok) as provision:
            response, _ = self.attempt("500.00", key=key)

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data["next_step"], "start_new_attempt")
        provision.assert_not_called()

    def test_provisioned_attempt_keeps_reserving_after_grace(self):
        with patch(PROVISION, side_effect=_provision_ok):
            _, key = self.attempt("500.00")
        self.age(key)

        # The payer can still pay this incoming payment, so its 500 stays reserved.
        with patch(PROVISION, side_effect=_provision_ok):
            response, _ = self.attempt("1000.00")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.txn(key).status, PaymentTransaction.Status.PENDING)

    def test_non_retryable_setup_error_fails_attempt_immediately(self):
        with patch(PROVISION, side_effect=ValidationError("Currency mismatch.")):
            response, key = self.attempt("500.00")

        self.assertEqual(response.status_code, 400)
        failed = self.txn(key)
        self.assertEqual(failed.status, PaymentTransaction.Status.FAILED)
        self.assertEqual(failed.failure_reason, "Currency mismatch.")

        with patch(PROVISION, side_effect=_provision_ok):
            response, _ = self.attempt("1000.00")
        self.assertEqual(response.status_code, 201)

    def test_verify_failed_attempt_reports_status_without_provider_call(self):
        with patch(PROVISION, side_effect=ValidationError("Currency mismatch.")):
            _, key = self.attempt("500.00")

        with patch("apps.payments.views.inspect_incoming_payment") as inspect:
            response = self.client.post(f"/api/v1/public/payment-transactions/{key}/verify/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["verification"]["status"], "failed")
        self.assertEqual(response.data["transaction"]["status"], "failed")
        inspect.assert_not_called()
