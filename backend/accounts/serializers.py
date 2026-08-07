from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import serializers

from .models import UserProfile

User = get_user_model()


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(
        write_only=True,
        trim_whitespace=False,
    )


class LearnerRegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True,
        style={"input_type": "password"},
    )
    role = serializers.ChoiceField(
        choices=UserProfile.Role.choices,
        default=UserProfile.Role.LEARNER,
        required=False,
    )
    lms_user_id = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
    )

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "password",
            "role",
            "lms_user_id",
        )

    def create(self, validated_data):
        lms_user_id = validated_data.pop("lms_user_id", "")
        role = validated_data.pop("role", UserProfile.Role.LEARNER)
        password = validated_data.pop("password")

        with transaction.atomic():
            user = User.objects.create_user(**validated_data)
            user.set_password(password)
            user.save()

            UserProfile.objects.create(
                user=user,
                role=role,
                lms_user_id=lms_user_id,
            )

        return user


class LearnerListSerializer(serializers.ModelSerializer):
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
            "is_active",
            "date_joined",
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