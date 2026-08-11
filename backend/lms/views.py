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
from django.shortcuts import redirect
from submissions.models import SubmissionContext
from rest_framework.permissions import IsAuthenticated

from django.conf import settings

from django.core.cache import cache
import logging
from .services import (
    get_lti_assessment_mapping,
    get_or_create_lti_user,
    verify_lti_launch,
)

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
        serializer.save(
            created_by=self.request.user,
            updated_by=self.request.user,
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
            )
        )

    def perform_update(self, serializer):
        serializer.save(
            updated_by=self.request.user,
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

        contexts = SubmissionContext.objects.filter(
            learner=request.user,
            cohort=mapping.cohort,
            assignment=mapping.assignment,
        )

        # Prefer a context already linked to this mapping.
        context = contexts.filter(
            assessment_mapping=mapping
        ).first()

        # Otherwise reuse one of the existing contexts.
        if context is None:
            context = contexts.first()

        # Only create one if none exists at all.
        if context is None:
            context = SubmissionContext.objects.create(
                learner=request.user,
                cohort=mapping.cohort,
                assignment=mapping.assignment,
                assessment_mapping=mapping,
                is_active=True,
            )

        # Ensure the selected context is linked to this mapping.
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

        return Response(
            {
                "context_id": str(context.id),
                "mapping_id": str(mapping.id),
                "cohort": {
                    "id": mapping.cohort.id,
                    "code": mapping.cohort.cohort_code,
                    "name": mapping.cohort.cohort_name,
                },
                "assignment": {
                    "id": str(mapping.assignment.id),
                    "code": mapping.assignment.code,
                    "title": mapping.assignment.title,
                    "maximum_score": str(
                        mapping.assignment.maximum_score
                    ),
                },
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

        if client_id != settings.LTI_CLIENT_ID:
            return Response(
                {"detail": "Invalid LTI client ID."},
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
            "target_link_uri": target_link_uri,
            "nonce": nonce,
        })
        cache.set(
            f"lti_state:{state}",
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

        issuer = claims.get("iss")

        deployment_id = claims.get(
            "https://purl.imsglobal.org/spec/lti/claim/deployment_id"
        )

        lti_user_id = claims.get("sub")

        user = get_or_create_lti_user(
            issuer=issuer,
            deployment_id=deployment_id,
            lti_user_id=lti_user_id,
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

        return redirect(
            f"{settings.AUTOGRADER_PUBLIC_URL}"
            f"/submit/mapping/{mapping.id}"
        )

