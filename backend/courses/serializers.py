from rest_framework import serializers

from .models import Qualification


class QualificationSerializer(serializers.ModelSerializer):
    can_delete = serializers.SerializerMethodField()

    class Meta:
        model = Qualification
        fields = (
            "id",
            "code",
            "name",
            "description",
            "is_active",
            "can_delete",
            "created_at",
            "updated_at",
        )

        read_only_fields = (
            "id",
            "can_delete",
            "created_at",
            "updated_at",
        )

    def get_can_delete(
        self,
        obj: Qualification,
    ) -> bool:
        return not obj.modules.exists()

    def validate_code(self, value: str) -> str:
        normalized = value.strip().upper()

        queryset = Qualification.objects.filter(
            code__iexact=normalized,
        )

        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)

        if queryset.exists():
            raise serializers.ValidationError(
                "A qualification with this code already exists."
            )

        return normalized