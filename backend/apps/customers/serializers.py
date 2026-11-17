
from rest_framework import serializers
from .models import Customer


class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = [
            "id",
            "business",
            "full_name",
            "email",
            "phone",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def validate_business(self, business):
        if business.owner_id != self.context["request"].user.id:
            raise serializers.ValidationError(
                "You cannot add customers to another business."
            )
        return business
