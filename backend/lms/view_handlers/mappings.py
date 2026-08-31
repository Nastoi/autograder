from rest_framework import generics, status

from ..models import AssessmentMapping
from ..permissions import IsMappingAdmin
from ..serializers import AssessmentMappingSerializer


from rest_framework.response import Response


from submissions.models import SubmissionContext
from rest_framework.permissions import IsAuthenticated

from django.conf import settings
from django.utils import timezone

from django.core.cache import cache
import logging
from courses.models import AssignmentLevel
from lms.models import AssessmentMapping
from accounts.audit import record_portal_activity
from accounts.models import PortalActivity


class AssessmentMappingListCreateView(
    generics.ListCreateAPIView
):
    serializer_class = AssessmentMappingSerializer
    permission_classes = [IsMappingAdmin]

    def get_queryset(self):
        return (
            AssessmentMapping.objects
                .select_related(
                    "cohort",
                    "cohort__module",
                    "assignment",
                )
            .order_by("name")
        )

    def perform_create(self, serializer):
        mapping = serializer.save(
            created_by=self.request.user,
            updated_by=self.request.user,
        )

        record_portal_activity(
            user=self.request.user,
            action=PortalActivity.Action.CREATED,
            object_type="assessment_mapping",
            object_id=mapping.id,
            object_label=mapping.name,
        )

class AssessmentMappingDetailView(
    generics.RetrieveUpdateDestroyAPIView
):
    serializer_class = AssessmentMappingSerializer
    permission_classes = [IsMappingAdmin]
    lookup_url_kwarg = "mapping_id"

    def get_queryset(self):
        return (
            AssessmentMapping.objects
            .select_related(
                "cohort",
                "cohort__module",
                "assignment",
                "assignment__module",
            )
        )

    def perform_update(self, serializer):
        mapping = self.get_object()

        old_client_id = mapping.lti_client_id
        old_deployment_id = mapping.lti_deployment_id
        old_jwks_url = mapping.lti_jwks_url
        old_token_url = mapping.lti_access_token_url

        updated_mapping = serializer.save(
            updated_by=self.request.user,
        )

        lti_registration_changed = any([
            old_client_id != updated_mapping.lti_client_id,
            old_deployment_id != updated_mapping.lti_deployment_id,
            old_jwks_url != updated_mapping.lti_jwks_url,
            old_token_url != updated_mapping.lti_access_token_url,
        ])

        if lti_registration_changed:
            updated_mapping.external_platform_id = ""
            updated_mapping.external_context_id = ""
            updated_mapping.external_resource_link_id = ""
            updated_mapping.lti_ags_lineitem_url = ""
            updated_mapping.lti_ags_lineitems_url = ""

            updated_mapping.save(
                update_fields=[
                    "external_platform_id",
                    "external_context_id",
                    "external_resource_link_id",
                    "lti_ags_lineitem_url",
                    "lti_ags_lineitems_url",
                    "updated_at",
                ]
            )

        record_portal_activity(
            user=self.request.user,
            action=PortalActivity.Action.UPDATED,
            object_type="assessment_mapping",
            object_id=updated_mapping.id,
            object_label=updated_mapping.name,
        )

    def destroy(self, request, *args, **kwargs):
        mapping = self.get_object()

        submission_contexts = mapping.submission_contexts.all()

        has_submissions = submission_contexts.filter(
            submissions__isnull=False,
        ).exists()

        if has_submissions:
            return Response(
                {
                    "detail": (
                        "This mapping cannot be deleted because "
                        "one or more learner submissions are linked to it. "
                        "Remove the submissions first or deactivate the mapping."
                    )
                },
                status=status.HTTP_409_CONFLICT,
            )

        # Safe to remove empty contexts that are blocking PROTECT.
        submission_contexts.filter(
            submissions__isnull=True,
        ).delete()

        record_portal_activity(
            user=request.user,
            action=PortalActivity.Action.DELETED,
            object_type="assessment_mapping",
            object_id=mapping.id,
            object_label=mapping.name,
        )

        mapping.delete()

        return Response(
            status=status.HTTP_204_NO_CONTENT,
        )


class AssessmentMappingSubmissionView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticated]
    lookup_url_kwarg = "mapping_id"

    def get_queryset(self):
        return (
            AssessmentMapping.objects
            .select_related(
                "cohort",
                "cohort__module",
                "assignment",
            )
            .filter(is_active=True)
        )

    def retrieve(self, request, *args, **kwargs):
        mapping = self.get_object()

        # Find any existing context for this learner/cohort/assignment.
        contexts = SubmissionContext.objects.filter(
            learner=request.user,
            cohort=mapping.cohort,
            assignment_level__assignment=mapping.assignment,
        )

        # Prefer one already linked to this mapping.
        context = contexts.filter(
            assessment_mapping=mapping,
        ).first()

        # Otherwise reuse an existing context if one exists.
        if context is None:
            context = contexts.first()

        # If a context exists, make sure it is linked and active.
        if context is not None:
            if context.assessment_mapping_id != mapping.id:
                context.assessment_mapping = mapping
                context.save(
                    update_fields=[
                        "assessment_mapping",
                        "updated_at",
                    ]
                )

            if not context.is_active:
                context.is_active = True
                context.save(
                    update_fields=[
                        "is_active",
                        "updated_at",
                    ]
                )

        # Return both Basic and Advanced options.
        # Do NOT create a context here because the learner
        # has not chosen the new submission level yet.
        assignment_levels = AssignmentLevel.objects.filter(
            assignment=mapping.assignment,
            is_active=True,
        ).order_by("level_code")

        lms_due_date = mapping.due_date
        is_instructor = (
            request.session.get("lti_is_instructor", False)
            and request.session.get("lti_mapping_id")
            == str(mapping.id)
        )

        return Response(
            {
                "context_id": str(context.id) if context else None,
                "mapping_id": str(mapping.id),
                "show_result_to_learner": mapping.show_result_to_learner,
                
                "cohort": {
                    "id": str(mapping.cohort.id),
                    "code": mapping.cohort.cohort_code,
                    "name": mapping.cohort.cohort_name,
                },

                "assignment": {
                    "id": str(mapping.assignment.id),
                    "code": mapping.assignment.assignment_code,
                    "title": mapping.assignment.assignment_title,
                    "maximum_score": str(
                        mapping.assignment.maximum_score
                    ),
                },

                "assignment_levels": [
                    {
                        "id": str(level.id),
                        "level_code": level.level_code,
                        "display_name": level.display_name,
                        "title": level.title,
                    }
                    for level in assignment_levels
                ],

                "due_date": (
                    lms_due_date.isoformat()
                    if lms_due_date
                    else None
                ),
                "deadline_passed": (
                    lms_due_date is not None
                    and timezone.now() > lms_due_date
                ),
                "is_instructor": is_instructor,
                # Only instructors need the LMS identifiers used by the
                # browser-side live due-date refresh.
                "lms_platform_url": (
                    settings.LTI_PLATFORM_ISSUER.rstrip("/")
                    if is_instructor
                    else None
                ),
                "lms_course_id": (
                    mapping.external_context_id
                    if is_instructor
                    else None
                ),
                "lms_resource_link_id": (
                    mapping.external_resource_link_id
                    if is_instructor
                    else None
                ),
            }
        )


