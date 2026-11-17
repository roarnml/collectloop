
from rest_framework import serializers

from .models import Business


class BusinessSerializer(serializers.ModelSerializer):
    class Meta:
        model = Business

        fields = [
            "id",
            "name",
            "description",
            "email",
            "phone",
            "address",
            "created_at",
        ]

        read_only_fields = [
            "id",
            "created_at",
        ]

        extra_kwargs = {
            "name": {"required": True},
        }
