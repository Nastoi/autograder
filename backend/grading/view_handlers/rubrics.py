
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response as DRFResponse


from django.shortcuts import get_object_or_404
from courses.configuration_locks import require_lock_owner

from lms.permissions import IsMappingAdmin

from courses.configuration_status import (
    refresh_assignment_level_configuration_status,
)

from ..models import (
 
    RubricBand,
    RubricCriterion,
    
)

from ..serializers import (
  
    RubricBandSerializer,
    RubricCriterionSerializer,
    
)


def _sync_level_band_definitions(criterion):
    level = criterion.assignment_level

    criterion_bands = (
        RubricBand.objects
        .filter(rubric_criterion=criterion)
        .order_by("sequence")
    )

    existing_definitions = {
        str(band.get("band_code", "")).lower(): band
        for band in (level.band_definitions or [])
    }
        
    level.band_definitions = [
        {
            "band_code": band.band_code,
            "display_name": band.display_name,
            "minimum_percentage": float(
                band.minimum_percentage
            ),
            "maximum_percentage": float(
                band.maximum_percentage
            ),
            "csv_band_code": (
                existing_definitions
                .get(
                    band.band_code.lower(),
                    {},
                )
                .get("csv_band_code")
            ),
        }
        for band in criterion_bands
    ]
    
    level.save(
        update_fields=[
            "band_definitions",
            "updated_at",
        ]
    )

class RubricCriterionListCreateView(
    generics.ListCreateAPIView
):
    serializer_class = RubricCriterionSerializer
    permission_classes = [IsAuthenticated, IsMappingAdmin]

    def perform_create(self, serializer):
        level_id = self.request.data.get(
            "assignment_level"
        )

        require_lock_owner(
            level_id,
            self.request.user,
        )

        criterion = serializer.save()

        refresh_assignment_level_configuration_status(
            criterion.assignment_level
        )

    def get_queryset(self):
        queryset = RubricCriterion.objects.select_related(
            "assignment_level",
        ).order_by(
            "assignment_level__assignment__assignment_code",
            "sequence",
        )

        assignment_level_id = self.request.query_params.get(
            "assignment_level_id",
        )

        if assignment_level_id:
            queryset = queryset.filter(
                assignment_level_id=assignment_level_id,
            )

        return queryset


class RubricCriterionDetailView(
    generics.RetrieveUpdateDestroyAPIView
):
    serializer_class = RubricCriterionSerializer
    permission_classes = [IsAuthenticated, IsMappingAdmin]
    lookup_field = "id"

    def perform_update(self, serializer):
        criterion = self.get_object()

        require_lock_owner(
            criterion.assignment_level_id,
            self.request.user,
        )

        updated_criterion = serializer.save()

        refresh_assignment_level_configuration_status(
            updated_criterion.assignment_level
        )

    def get_queryset(self):
        return RubricCriterion.objects.select_related(
            "assignment_level",
        ).order_by(
            "assignment_level__assignment__assignment_code",
            "sequence",
        )

    def destroy(self, request, *args, **kwargs):
        criterion = self.get_object()

        require_lock_owner(
            criterion.assignment_level_id,
            request.user,
        )

        if criterion.bands.exists():
            return DRFResponse(
                {
                    "detail": (
                        "This rubric criterion cannot be deleted "
                        "because it already has rubric bands."
                    )
                },
                status=status.HTTP_409_CONFLICT,
            )

        level = criterion.assignment_level

        response = super().destroy(
            request,
            *args,
            **kwargs,
        )

        refresh_assignment_level_configuration_status(
            level
        )

        return response


class RubricBandListCreateView(
    generics.ListCreateAPIView
):
    serializer_class = RubricBandSerializer
    permission_classes = [IsAuthenticated, IsMappingAdmin]

    def perform_create(self, serializer):
        criterion = get_object_or_404(
            RubricCriterion,
            id=self.request.data.get(
                "rubric_criterion"
            ),
        )

        require_lock_owner(
            criterion.assignment_level_id,
            self.request.user,
        )

        serializer.save()

        _sync_level_band_definitions(
            criterion
        )

        refresh_assignment_level_configuration_status(
            criterion.assignment_level
        )

    def get_queryset(self):
        queryset = RubricBand.objects.select_related(
            "rubric_criterion",
            "rubric_criterion__assignment_level",
        ).order_by(
            "rubric_criterion__assignment_level__assignment__assignment_code",
            "rubric_criterion__sequence",
            "sequence",
        )

        rubric_criterion_id = self.request.query_params.get(
            "rubric_criterion_id",
        )

        assignment_level_id = self.request.query_params.get(
            "assignment_level_id",
        )

        if rubric_criterion_id:
            queryset = queryset.filter(
                rubric_criterion_id=rubric_criterion_id,
            )

        if assignment_level_id:
            queryset = queryset.filter(
                rubric_criterion__assignment_level_id=
                    assignment_level_id,
            )

        return queryset


class RubricBandDetailView(
    generics.RetrieveUpdateDestroyAPIView
):
    serializer_class = RubricBandSerializer
    permission_classes = [IsAuthenticated, IsMappingAdmin]
    lookup_field = "id"

    def perform_update(self, serializer):
        band = self.get_object()

        require_lock_owner(
            band.rubric_criterion.assignment_level_id,
            self.request.user,
        )

        updated_band = serializer.save()

        _sync_level_band_definitions(
            updated_band.rubric_criterion
        )

        refresh_assignment_level_configuration_status(
            updated_band.rubric_criterion.assignment_level
        )

    def perform_destroy(self, instance):
        require_lock_owner(
            instance.rubric_criterion.assignment_level_id,
            self.request.user,
        )

        level = (
            instance
            .rubric_criterion
            .assignment_level
        )

        criterion = instance.rubric_criterion

        instance.delete()

        _sync_level_band_definitions(
            criterion
        )

        refresh_assignment_level_configuration_status(
            level
        )

    def get_queryset(self):
        return RubricBand.objects.select_related(
            "rubric_criterion",
            "rubric_criterion__assignment_level",
        ).order_by(
            "rubric_criterion__assignment_level__assignment__assignment_code",
            "rubric_criterion__sequence",
            "sequence",
        )
