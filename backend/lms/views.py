# Create your views here.
from rest_framework import generics

from .models import AssessmentMapping, LtiUserIdentity
from .permissions import IsMappingAdmin
from .serializers import AssessmentMappingSerializer

from urllib.parse import urlencode

from django.core import signing
from django.http import HttpResponseRedirect
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

import jwt

from django.contrib.auth import login
from django.shortcuts import redirect, get_object_or_404
from submissions.models import SubmissionContext, LearnerSubmission
from rest_framework.permissions import IsAuthenticated

from django.conf import settings
from django.utils import timezone

from django.core.cache import cache
import logging
from .services import (
    get_lti_assessment_mapping,
    get_or_create_lti_user,
    verify_lti_launch,
)
from courses.models import AssignmentLevel
from lms.models import AssessmentMapping
from accounts.audit import record_portal_activity
from accounts.models import PortalActivity
import hashlib

logger = logging.getLogger(__name__)

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

from rest_framework import status
from rest_framework.response import Response
from .services import (
    get_lti_assessment_mapping,
    get_or_create_lti_user,
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
        mapping = serializer.save(
            updated_by=self.request.user,
        )

        record_portal_activity(
            user=self.request.user,
            action=PortalActivity.Action.UPDATED,
            object_type="assessment_mapping",
            object_id=mapping.id,
            object_label=mapping.name,
        )

    def destroy(self, request, *args, **kwargs):
        mapping = self.get_object()

        has_submissions = mapping.submission_contexts.filter(
            submissions__isnull=False,
        ).exists()

        if has_submissions:
            return Response(
                {
                    "detail": (
                        "This mapping cannot be deleted because "
                        "one or more submissions are linked to it. "
                        "Deactivate it instead."
                    )
                },
                status=status.HTTP_409_CONFLICT,
            )

        record_portal_activity(
            user=request.user,
            action=PortalActivity.Action.DELETED,
            object_type="assessment_mapping",
            object_id=mapping.id,
            object_label=mapping.name,
        )

        return super().destroy(
            request,
            *args,
            **kwargs,
        )
    
from rest_framework.permissions import AllowAny


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

        return Response(
            {
                "context_id": str(context.id) if context else None,
                "mapping_id": str(mapping.id),

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
                    mapping.due_date.isoformat()
                    if mapping.due_date
                    else None
                ),
                "deadline_passed": (
                    mapping.due_date is not None
                    and timezone.now() > mapping.due_date
                ),
                "is_instructor": (
                    request.session.get("lti_is_instructor", False)
                    and request.session.get("lti_mapping_id")
                    == str(mapping.id)
                ),
            }
        )



class LtiLoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        issuer = request.query_params.get("iss")
        client_id = request.query_params.get("client_id")
        login_hint = request.query_params.get("login_hint")
        lti_message_hint = request.query_params.get("lti_message_hint")
        target_link_uri = request.query_params.get("target_link_uri")
        try:
            mapping_id = target_link_uri.rstrip("/").split("/")[-1]

            mapping = AssessmentMapping.objects.get(
                id=mapping_id
            )
        except (AssessmentMapping.DoesNotExist, ValueError, AttributeError):
            return Response(
                {"detail": "Invalid assessment mapping."},
                status=400,
            )

        if not all([
            issuer,
            client_id,
            login_hint,
            target_link_uri,
        ]):
            return Response(
                {"detail": "Missing required LTI login parameters."},
                status=400,
            )

        if issuer != settings.LTI_PLATFORM_ISSUER:
            return Response(
                {"detail": "Invalid LTI issuer."},
                status=400,
            )

        if not all([
            mapping.lti_client_id,
            mapping.lti_deployment_id,
            mapping.lti_jwks_url,
            mapping.lti_access_token_url,
        ]):
            return Response(
                {
                    "detail": (
                        "LTI configuration is incomplete "
                        "for this assessment mapping."
                    )
                },
                status=400,
            )

        if client_id != mapping.lti_client_id:
            return Response(
                {
                    "detail": (
                        "Invalid LTI client ID "
                        "for this mapping."
                    )
                },
                status=400,
            )

        expected_prefix = (
            f"{settings.AUTOGRADER_PUBLIC_URL}"
            "/api/lms/lti/launch/"
        )

        if not target_link_uri.startswith(expected_prefix):
            return Response(
                {"detail": "Invalid LTI target link URI."},
                status=400,
            )
        
        nonce = signing.dumps({
            "client_id": client_id,
            "login_hint": login_hint,
        })

        state = signing.dumps({
            "issuer": issuer,
            "client_id": client_id,
            "mapping_id": str(mapping.id),
            "target_link_uri": target_link_uri,
            "nonce": nonce,
        })
        state_cache_key = (
            "lti_state:"
            + hashlib.sha256(
                state.encode("utf-8")
            ).hexdigest()
        )

        cache.set(
            state_cache_key,
            True,
            timeout=600,
        )

        params = {
            "scope": "openid",
            "response_type": "id_token",
            "response_mode": "form_post",
            "prompt": "none",
            "client_id": client_id,
            "redirect_uri": target_link_uri,
            "login_hint": login_hint,
            "state": state,
            "nonce": nonce,
        }

        if lti_message_hint:
            params["lti_message_hint"] = lti_message_hint

        platform_login_url = settings.LTI_LOGIN_URL

        return HttpResponseRedirect(
            f"{platform_login_url}?{urlencode(params)}"
        )

class LtiLaunchView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []


    def post(
        self,
        request,
        mapping_id,
    ):
        id_token = request.data.get("id_token")
        state = request.data.get("state")

        claims, launch_error = verify_lti_launch(
            id_token=id_token,
            state=state,
        )

        if launch_error is not None:
            return launch_error

        ags_endpoint = claims.get(
            "https://purl.imsglobal.org/spec/lti-ags/claim/endpoint"
        )

        
        print(
            "LTI AGS CLAIM:",
            ags_endpoint,
            flush=True,
        )

        issuer = claims.get("iss")

        deployment_id = claims.get(
            "https://purl.imsglobal.org/spec/lti/claim/deployment_id"
        )

        lti_user_id = claims.get("sub")

        user = get_or_create_lti_user(
            issuer=issuer,
            deployment_id=deployment_id,
            lti_user_id=lti_user_id,
            preferred_username=claims.get("preferred_username", ""),
            email=claims.get("email", ""),
            given_name=claims.get("given_name", ""),
            family_name=claims.get("family_name", ""),
            full_name=claims.get("name", ""),
        )

        login(request, user)

        mapping, mapping_error = (
            get_lti_assessment_mapping(
                claims,
                mapping_id,
            )
        )

        if ags_endpoint:
            mapping.lti_ags_lineitem_url = ags_endpoint.get(
                "lineitem",
                "",
            )

            mapping.lti_ags_lineitems_url = ags_endpoint.get(
                "lineitems",
                "",
            )

            mapping.save(
                update_fields=[
                    "lti_ags_lineitem_url",
                    "lti_ags_lineitems_url",
                ]
            )
            
        if mapping_error is not None:
            return mapping_error

        roles = claims.get(
            "https://purl.imsglobal.org/spec/lti/claim/roles",
            [],
        )

        if isinstance(roles, str):
            roles = [roles]

        is_instructor = any(
            str(role).lower().endswith("#instructor")
            or str(role).lower().endswith("/instructor")
            for role in roles
        )

        request.session["lti_mapping_id"] = str(mapping.id)
        request.session["lti_is_instructor"] = is_instructor

        return redirect(
            f"{settings.AUTOGRADER_PUBLIC_URL}"
            f"/submit/mapping/{mapping.id}"
        )


class InstructorMappingDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_mapping(self, request, mapping_id):
        mapping = get_object_or_404(
            AssessmentMapping.objects.select_related(
                "cohort",
                "assignment",
            ),
            id=mapping_id,
            is_active=True,
        )

        session_mapping_id = request.session.get(
            "lti_mapping_id"
        )
        is_instructor = request.session.get(
            "lti_is_instructor",
            False,
        )

        if (
            not request.user.is_superuser
            and (
                not is_instructor
                or session_mapping_id != str(mapping.id)
            )
        ):
            return None, Response(
                {
                    "detail": (
                        "Instructor access is required "
                        "for this assessment."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        return mapping, None

    def get(self, request, mapping_id):
        mapping, error_response = self._get_mapping(
            request,
            mapping_id,
        )

        if error_response is not None:
            return error_response

        submissions = (
            LearnerSubmission.objects
            .filter(
                context__cohort=mapping.cohort,
                assignment_level__assignment=mapping.assignment,
            )
            .select_related(
                "learner",
                "assignment_level",
            )
            .prefetch_related(
                "criterion_results",
            )
            .order_by(
                "learner__username",
                "-attempt_number",
            )
        )

        learners = {}

        for submission in submissions:
            learner = submission.learner
            learner_key = str(learner.id)

            if learner_key not in learners:
                learners[learner_key] = {
                    "id": learner_key,
                    "learner_id": learner.username,
                    "name": (
                        learner.get_full_name()
                        or learner.username
                    ),
                    "email": learner.email,
                    "attempts": [],
                }

            if submission.status in (
                LearnerSubmission.Status.COMPLETED,
            ):
                display_status = "Graded"
            elif submission.status in (
                LearnerSubmission.Status.ERROR,
            ):
                display_status = "Not Graded"
            elif submission.status in (
                LearnerSubmission.Status.UPLOADED,
                LearnerSubmission.Status.PROCESSING,
            ):
                display_status = "Processing"
            elif submission.status == "manual_review":
                display_status = "Manual Review"
            else:
                display_status = (
                    submission.get_status_display()
                )

            learners[learner_key]["attempts"].append(
                {
                    "id": str(submission.id),
                    "attempt_number": submission.attempt_number,
                    "level_code": (
                        submission.assignment_level.level_code
                    ),
                    "level_name": (
                        submission.assignment_level.display_name
                    ),
                    "status": submission.status,
                    "status_display": display_status,
                    "final_score": (
                        str(submission.final_score)
                        if submission.final_score is not None
                        else None
                    ),
                    "maximum_score": (
                        str(submission.maximum_score)
                        if submission.maximum_score is not None
                        else None
                    ),
                    "achieved_band": submission.achieved_band,
                    "feedback": submission.feedback,
                    "original_filename": (
                        submission.original_filename
                    ),
                    "submitted_at": (
                        submission.submitted_at
                    ),
                    "completed_at": (
                        submission.completed_at
                    ),
                    "criterion_results": [
                        {
                            "id": str(result.id),
                            "rubric_criterion": str(
                                result.rubric_criterion_id
                            ),
                            "awarded_marks": str(
                                result.awarded_marks
                            ),
                            "achievement_band": (
                                result.achievement_band
                            ),
                            "feedback": result.feedback,
                        }
                        for result
                        in submission.criterion_results.all()
                    ],
                }
            )

        return Response(
            {
                "mapping": {
                    "id": str(mapping.id),
                    "cohort_code": (
                        mapping.cohort.cohort_code
                    ),
                    "cohort_name": (
                        mapping.cohort.cohort_name
                    ),
                    "assignment_code": (
                        mapping.assignment.assignment_code
                    ),
                    "assignment_title": (
                        mapping.assignment.assignment_title
                    ),
                    "due_date": (
                        mapping.due_date.isoformat()
                        if mapping.due_date
                        else None
                    ),
                    "deadline_passed": (
                        mapping.due_date is not None
                        and timezone.now() > mapping.due_date
                    ),
                },
                "learners": list(learners.values()),
            }
        )

    def patch(self, request, mapping_id):
        mapping, error_response = self._get_mapping(
            request,
            mapping_id,
        )

        if error_response is not None:
            return error_response

        serializer = AssessmentMappingSerializer(
            mapping,
            data={
                "due_date": request.data.get("due_date"),
            },
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        mapping = serializer.save(
            updated_by=request.user,
        )

        return Response(
            {
                "id": str(mapping.id),
                "due_date": (
                    mapping.due_date.isoformat()
                    if mapping.due_date
                    else None
                ),
                "deadline_passed": (
                    mapping.due_date is not None
                    and timezone.now() > mapping.due_date
                ),
            }
        )

import re

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from .models import AssessmentMapping


class AssessmentMappingLtiRegistrationView(APIView):
    def post(self, request, mapping_id):
        registration_text = request.data.get(
            "registration_text",
            "",
        )

        if not registration_text.strip():
            return Response(
                {"detail": "Registration info is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        client_match = re.search(
            r"Client ID:\s*([^\s]+)",
            registration_text,
            re.IGNORECASE,
        )

        deployment_match = re.search(
            r"Deployment ID:\s*([^\s]+)",
            registration_text,
            re.IGNORECASE,
        )

        jwks_match = re.search(
            r"Keyset URL:\s*(https?://[^\s]+)",
            registration_text,
            re.IGNORECASE,
        )

        access_token_match = re.search(
            r"Access Token URL:\s*(https?://[^\s]+)",
            registration_text,
            re.IGNORECASE,
        )
        
        if not all([
            client_match,
            deployment_match,
            jwks_match,
            access_token_match,
        ]):
            return Response(
                {
                    "detail": (
                        "Could not find Client ID, "
                        "Deployment ID, and Keyset URL."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            mapping = AssessmentMapping.objects.get(
                id=mapping_id
            )
        except AssessmentMapping.DoesNotExist:
            return Response(
                {"detail": "Assessment mapping not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        mapping.lti_client_id = client_match.group(1)
        mapping.lti_deployment_id = deployment_match.group(1)
        mapping.lti_jwks_url = jwks_match.group(1)

        mapping.lti_access_token_url = (
            access_token_match.group(1)
        )
        
        mapping.save(
            update_fields=[
                "lti_client_id",
                "lti_deployment_id",
                "lti_jwks_url",
                "lti_access_token_url",
                "updated_at",
            ]
        )

        return Response(
            {
                "mapping_id": str(mapping.id),
                "lti_client_id": mapping.lti_client_id,
                "lti_deployment_id": mapping.lti_deployment_id,
                "lti_jwks_url": mapping.lti_jwks_url,
                "lti_access_token_url": mapping.lti_access_token_url,
            }
        )