from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import UserProfile

User = get_user_model()


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(
        write_only=True,
        trim_whitespace=False,
    )


class CurrentUserSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()
    lms_user_id = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "role",
            "lms_user_id",
        )

    def get_role(self, user):
        try:
            return user.profile.role
        except UserProfile.DoesNotExist:
            return None

    def get_lms_user_id(self, user):
        try:
            return user.profile.lms_user_id
        except UserProfile.DoesNotExist:
            return ""