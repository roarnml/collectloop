
from django.db import transaction

from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from .models import PaymentRequest
from .serializers import PaymentRequestSerializer


class PaymentRequestViewSet(viewsets.ModelViewSet):
    serializer_class = PaymentRequestSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = PaymentRequest.objects.filter(
            business__owner=self.request.user
        )

        # Lock the payment request during modifications.
        # This coordinates updates/deletions with payment initiation.
        if self.action in ["update", "partial_update", "destroy"]:
            return queryset.select_for_update()

        return queryset.select_related(
            "business",
            "customer",
        ).prefetch_related("transactions")

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        return super().update(request, *args, **kwargs)

    @transaction.atomic
    def partial_update(self, request, *args, **kwargs):
        return super().partial_update(request, *args, **kwargs)

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        return super().destroy(request, *args, **kwargs)
