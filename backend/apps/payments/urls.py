
from django.urls import path

from .views import (
    PaymentVerificationView,
    PublicPaymentRequestView,
    PaymentInitiationView,
)

urlpatterns = [
    path(
        "public/payment-requests/<uuid:public_id>/",
        PublicPaymentRequestView.as_view(),
        name="public-payment-request",
    ),
    path(
        "public/payment-requests/<uuid:public_id>/attempts/",
        PaymentInitiationView.as_view(),
        name="public-payment-initiation",
    ),
    path(
        "public/payment-transactions/<uuid:transaction_key>/verify/",
        PaymentVerificationView.as_view(),
        name="payment-verification",
    ),
]
