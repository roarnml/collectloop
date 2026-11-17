
from rest_framework.routers import DefaultRouter

from .views import PaymentRequestViewSet

router = DefaultRouter()
router.register(
    "",
    PaymentRequestViewSet,
    basename="payment-request",
)

urlpatterns = router.urls
