
from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from .serializers import RegisterSerializer


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]


class CurrentUserView(APIView):
    def get(self, request):
        return Response({
            "id": request.user.id,
            "email": request.user.email,
            "full_name": request.user.full_name,
            "date_joined": request.user.date_joined,
        })
