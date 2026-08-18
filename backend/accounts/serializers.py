from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import serializers

from .models import (
    PortalActivity,
    UserProfile,
)

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
    must_change_password = serializers.SerializerMethodField()
    can_access_user_management = serializers.SerializerMethodField()
    can_create_users = serializers.SerializerMethodField()
    can_reset_passwords = serializers.SerializerMethodField()
    can_toggle_users = serializers.SerializerMethodField()
    can_view_logs = serializers.SerializerMethodField()

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
            "must_change_password",
            "is_superuser",
            "can_access_user_management",
            "can_create_users",
            "can_reset_passwords",
            "can_toggle_users",
            "can_view_logs",
        )

    def get_must_change_password(self, user):
        try:
            return user.profile.must_change_password
        except UserProfile.DoesNotExist:
            return False
        
    def _profile_flag(self, user, field_name):
        if user.is_superuser:
            return True
        try:
            return bool(getattr(user.profile, field_name))
        except UserProfile.DoesNotExist:
            return False

    def get_can_access_user_management(self, user):
        return self._profile_flag(user, "can_access_user_management")

    def get_can_create_users(self, user):
        return self._profile_flag(user, "can_create_users")

    def get_can_reset_passwords(self, user):
        return self._profile_flag(user, "can_reset_passwords")

    def get_can_toggle_users(self, user):
        return self._profile_flag(user, "can_toggle_users")

    def get_can_view_logs(self, user):
        return self._profile_flag(user, "can_view_logs")

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


class ManagedUserSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()
    must_change_password = serializers.SerializerMethodField()
    can_access_user_management = serializers.SerializerMethodField()
    can_create_users = serializers.SerializerMethodField()
    can_reset_passwords = serializers.SerializerMethodField()
    can_toggle_users = serializers.SerializerMethodField()
    can_view_logs = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "role",
            "is_active",
            "is_superuser",
            "must_change_password",
            "can_access_user_management",
            "can_create_users",
            "can_reset_passwords",
            "can_toggle_users",
            "can_view_logs",
            "date_joined",
        )

    def get_role(self, user):
        try:
            return user.profile.role
        except UserProfile.DoesNotExist:
            return None

    def get_must_change_password(self, user):
        try:
            return user.profile.must_change_password
        except UserProfile.DoesNotExist:
            return False

    def _profile_flag(self, user, field_name):
        try:
            return bool(getattr(user.profile, field_name))
        except UserProfile.DoesNotExist:
            return False

    def get_can_access_user_management(self, user):
        return self._profile_flag(user, "can_access_user_management")

    def get_can_create_users(self, user):
        return self._profile_flag(user, "can_create_users")

    def get_can_reset_passwords(self, user):
        return self._profile_flag(user, "can_reset_passwords")

    def get_can_toggle_users(self, user):
        return self._profile_flag(user, "can_toggle_users")

    def get_can_view_logs(self, user):
        return self._profile_flag(user, "can_view_logs")


class ManagedUserPermissionSerializer(serializers.Serializer):
    can_access_user_management = serializers.BooleanField()
    can_create_users = serializers.BooleanField()
    can_reset_passwords = serializers.BooleanField()
    can_toggle_users = serializers.BooleanField()
    can_view_logs = serializers.BooleanField()


class ManagedUserCreateSerializer(serializers.Serializer):
    username = serializers.CharField()
    email = serializers.EmailField(required=False, allow_blank=True)
    first_name = serializers.CharField(required=False, allow_blank=True)
    last_name = serializers.CharField(required=False, allow_blank=True)

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError(
                "A user with this username already exists."
            )

        return value


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(
        write_only=True,
        trim_whitespace=False,
    )
    new_password = serializers.CharField(
        write_only=True,
        trim_whitespace=False,
        min_length=8,
    )


class PortalActivitySerializer(serializers.ModelSerializer):
    username = serializers.SerializerMethodField()

    class Meta:
        model = PortalActivity
        fields = (
            "id",
            "action",
            "object_type",
            "object_id",
            "object_label",
            "username",
            "created_at",
        )

    def get_username(self, obj):
        return obj.user.username if obj.user else None

