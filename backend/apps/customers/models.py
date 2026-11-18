
from django.db import models


class Customer(models.Model):
    business = models.ForeignKey(
        "businesses.Business",
        on_delete=models.CASCADE,
        related_name="customers",
    )

    full_name = models.CharField(max_length=150)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=30, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.full_name
