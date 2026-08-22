# Create your views here.
from rest_framework import generics

from .models import AssessmentMapping, LtiUserIdentity
from .permissions import IsMappingAdmin
from .serializers import AssessmentMappingSerializer

from urllib.parse import urlencode

from django.core import signing
from django.http import FileResponse, HttpResponseRedirect
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

import jwt

from django.contrib.auth import login
from django.shortcuts import redirect, get_object_or_404
from submissions.models import SubmissionContext, LearnerSubmission
from submissions.audit import serialize_grading_audit, serialize_process_logs
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
from urllib.parse import urlparse
import uuid

from django.utils.dateparse import parse_datetime

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
    
from rest_framework.permissions import AllowAny


def get_lms_due_date(mapping):
    """Return the LMS due date cached from the live LMS Blocks API.

    The AGS line-item endDateTime is intentionally not used here because
    this LMS can leave that value stale after an instructor extends a due
    date. The cache is refreshed only by an authenticated instructor LTI
    session after the browser reads the live LMS Blocks API.
    """
    return mapping.due_date


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



class LtiLoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        issuer = request.query_params.get("iss")
        client_id = request.query_params.get("client_id")
        login_hint = request.query_params.get("login_hint")
        lti_message_hint = request.query_params.get(
            "lti_message_hint"
        )
        target_link_uri = request.query_params.get(
            "target_link_uri"
        )

        # ---------------------------------------------------------
        # 1. Make sure the LMS supplied all required parameters.
        # ---------------------------------------------------------
        if not all([
            issuer,
            client_id,
            login_hint,
            target_link_uri,
        ]):
            return Response(
                {
                    "detail": (
                        "Missing required LTI login parameters."
                    )
                },
                status=400,
            )

        # ---------------------------------------------------------
        # 2. Extract AssessmentMapping UUID from target_link_uri.
        #
        # Example:
        # https://ag.claas2saas.com/api/lms/lti/launch/
        # 26d33f8c-6e5f-4508-8441-5f2edac337bb/
        #
        # becomes:
        # 26d33f8c-6e5f-4508-8441-5f2edac337bb
        # ---------------------------------------------------------
        try:
            parsed_target = urlparse(target_link_uri)

            path_parts = [
                part
                for part in parsed_target.path.split("/")
                if part
            ]

            mapping_id = path_parts[-1]

            logger.info(
                "LTI login target_link_uri=%r mapping_id=%r",
                target_link_uri,
                mapping_id,
            )

            mapping = AssessmentMapping.objects.get(
                id=mapping_id
            )

        except AssessmentMapping.DoesNotExist:
            logger.warning(
                "LTI login mapping does not exist. "
                "target_link_uri=%r mapping_id=%r",
                target_link_uri,
                locals().get("mapping_id"),
            )

            return Response(
                {
                    "detail": (
                        "Invalid assessment mapping. "
                        "Mapping does not exist."
                    )
                },
                status=400,
            )

        except (
            ValueError,
            AttributeError,
            IndexError,
            TypeError,
        ) as exc:
            logger.warning(
                "Unable to parse LTI mapping. "
                "target_link_uri=%r error=%r",
                target_link_uri,
                exc,
            )

            return Response(
                {
                    "detail": (
                        "Invalid assessment mapping URL."
                    )
                },
                status=400,
            )

        # ---------------------------------------------------------
        # 3. Verify mapping is active.
        # ---------------------------------------------------------
        if not mapping.is_active:
            return Response(
                {
                    "detail": (
                        "This assessment mapping is inactive."
                    )
                },
                status=400,
            )

        # ---------------------------------------------------------
        # 4. Verify LMS issuer.
        # ---------------------------------------------------------
        if issuer != settings.LTI_PLATFORM_ISSUER:
            return Response(
                {
                    "detail": "Invalid LTI issuer."
                },
                status=400,
            )

        # ---------------------------------------------------------
        # 5. Verify this mapping has complete LTI configuration.
        # ---------------------------------------------------------
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

        # ---------------------------------------------------------
        # 6. Client ID from LMS must match this mapping.
        # ---------------------------------------------------------
        if client_id != mapping.lti_client_id:
            logger.warning(
                "LTI client mismatch mapping=%s "
                "received=%s expected=%s",
                mapping.id,
                client_id,
                mapping.lti_client_id,
            )

            return Response(
                {
                    "detail": (
                        "Invalid LTI client ID "
                        "for this mapping."
                    )
                },
                status=400,
            )

        # ---------------------------------------------------------
        # 7. Verify the target URL belongs to AutoGrad3r.
        # ---------------------------------------------------------
        expected_prefix = (
            f"{settings.AUTOGRADER_PUBLIC_URL}"
            "/api/lms/lti/launch/"
        )

        if not target_link_uri.startswith(
            expected_prefix
        ):
            logger.warning(
                "Invalid LTI target URI. "
                "received=%r expected_prefix=%r",
                target_link_uri,
                expected_prefix,
            )

            return Response(
                {
                    "detail": "Invalid LTI target link URI."
                },
                status=400,
            )

        # ---------------------------------------------------------
        # 8. Generate nonce.
        # ---------------------------------------------------------
        nonce = signing.dumps({
            "client_id": client_id,
            "login_hint": login_hint,
        })

        # ---------------------------------------------------------
        # 9. Generate LTI state.
        # ---------------------------------------------------------
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

        # ---------------------------------------------------------
        # 10. Redirect user back to LMS OpenID endpoint.
        # ---------------------------------------------------------
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
            params[
                "lti_message_hint"
            ] = lti_message_hint

        platform_login_url = settings.LTI_LOGIN_URL     
        return HttpResponseRedirect(
            f"{platform_login_url}"
            f"?{urlencode(params)}"
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

        if mapping_error is not None:
            return mapping_error

        # Capture the verified LMS course/resource identifiers from the
        # LTI launch. These are later used by the instructor browser-side
        # Blocks API due-date refresh.
        context_claim = claims.get(
            "https://purl.imsglobal.org/spec/lti/claim/context",
            {},
        )
        resource_link_claim = claims.get(
            "https://purl.imsglobal.org/spec/lti/claim/resource_link",
            {},
        )

        external_context_id = (
            context_claim.get("id")
            if isinstance(context_claim, dict)
            else None
        )
        external_resource_link_id = (
            resource_link_claim.get("id")
            if isinstance(resource_link_claim, dict)
            else None
        )

        launch_identifier_update_fields = []

        if (
            external_context_id
            and mapping.external_context_id != external_context_id
        ):
            mapping.external_context_id = external_context_id
            launch_identifier_update_fields.append(
                "external_context_id"
            )

        if (
            external_resource_link_id
            and mapping.external_resource_link_id
            != external_resource_link_id
        ):
            mapping.external_resource_link_id = (
                external_resource_link_id
            )
            launch_identifier_update_fields.append(
                "external_resource_link_id"
            )

        if launch_identifier_update_fields:
            launch_identifier_update_fields.append("updated_at")
            mapping.save(
                update_fields=launch_identifier_update_fields
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

        lms_due_date = mapping.due_date

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
                "criterion_results__rubric_criterion",
                "process_logs",
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
                    "has_submitted_file": bool(
                        submission.submitted_file
                    ),
                    "submitted_at": (
                        submission.submitted_at
                    ),
                    "completed_at": (
                        submission.completed_at
                    ),
                    "grading_audit": serialize_grading_audit(
                        submission
                    ),
                    "process_logs": serialize_process_logs(
                        submission
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
                            "maximum_score": str(
                                result.rubric_criterion.maximum_score
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
                        lms_due_date.isoformat()
                        if lms_due_date
                        else None
                    ),
                    "deadline_passed": (
                        lms_due_date is not None
                        and timezone.now() > lms_due_date
                    ),
                    "lms_platform_url": settings.LTI_PLATFORM_ISSUER.rstrip("/"),
                    "lms_course_id": mapping.external_context_id,
                    "lms_resource_link_id": mapping.external_resource_link_id,
                },
                "learners": list(learners.values()),
            }
        )

    def patch(self, request, mapping_id):
        """Cache the live LMS block due date for this mapping.

        The browser is allowed to read the LMS Blocks API because it is
        running in the authenticated instructor LMS session. This endpoint
        only accepts the sync from the matching instructor LTI session and
        verifies that the supplied course/resource identifiers match the
        identifiers captured from the verified LTI launch.
        """
        mapping, error_response = self._get_mapping(
            request,
            mapping_id,
        )

        if error_response is not None:
            return error_response

        course_id = request.data.get("course_id")
        resource_link_id = request.data.get("resource_link_id")

        if not mapping.external_context_id or not mapping.external_resource_link_id:
            return Response(
                {
                    "detail": (
                        "This mapping does not yet have LMS launch identifiers. "
                        "Open the assessment from the LMS and try again."
                    )
                },
                status=status.HTTP_409_CONFLICT,
            )

        if course_id != mapping.external_context_id:
            return Response(
                {"detail": "LMS course identifier does not match this mapping."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if resource_link_id != mapping.external_resource_link_id:
            return Response(
                {"detail": "LMS resource identifier does not match this mapping."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        due_date_value = request.data.get("due_date")
        parsed_due_date = None

        if due_date_value not in (None, ""):
            if not isinstance(due_date_value, str):
                return Response(
                    {"detail": "LMS due date must be an ISO-8601 string or null."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            parsed_due_date = parse_datetime(due_date_value)
            if parsed_due_date is None:
                return Response(
                    {"detail": "Unable to parse the LMS due date."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if timezone.is_naive(parsed_due_date):
                parsed_due_date = timezone.make_aware(parsed_due_date)

        if mapping.due_date != parsed_due_date:
            mapping.due_date = parsed_due_date
            mapping.updated_by = request.user
            mapping.save(
                update_fields=[
                    "due_date",
                    "updated_by",
                    "updated_at",
                ]
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


class InstructorSubmissionDownloadView(
    InstructorMappingDashboardView
):
    """Download only the latest retained learner submission file."""

    http_method_names = ["get", "head", "options"]

    def get(self, request, mapping_id, submission_id):
        mapping, error_response = self._get_mapping(
            request,
            mapping_id,
        )

        if error_response is not None:
            return error_response

        submission = get_object_or_404(
            LearnerSubmission.objects.select_related(
                "learner",
                "context",
                "assignment_level",
            ),
            id=submission_id,
            context__cohort=mapping.cohort,
            assignment_level__assignment=mapping.assignment,
        )

        latest_submission = (
            LearnerSubmission.objects
            .filter(
                learner=submission.learner,
                context__cohort=mapping.cohort,
                assignment_level__assignment=mapping.assignment,
            )
            .order_by(
                "-attempt_number",
                "-submitted_at",
            )
            .first()
        )

        if (
            latest_submission is None
            or latest_submission.id != submission.id
        ):
            return Response(
                {
                    "detail": (
                        "Only the learner's latest submission "
                        "file is available for download."
                    )
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        if not submission.submitted_file:
            return Response(
                {
                    "detail": (
                        "The latest submission file is no longer "
                        "available."
                    )
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            file_handle = submission.submitted_file.open("rb")
        except (FileNotFoundError, OSError):
            return Response(
                {
                    "detail": (
                        "The latest submission file could not be found."
                    )
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        return FileResponse(
            file_handle,
            as_attachment=True,
            filename=(
                submission.original_filename
                or f"submission-{submission.id}"
            ),
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