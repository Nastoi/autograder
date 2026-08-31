
from urllib.parse import urlencode

from django.core import signing
from django.http import HttpResponseRedirect
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from django.contrib.auth import login
from django.shortcuts import redirect

from django.conf import settings

from django.core.cache import cache
import logging
from ..services import (
    get_lti_assessment_mapping,
    get_or_create_lti_user,
    verify_lti_launch,
)
from lms.models import AssessmentMapping
import hashlib
from urllib.parse import urlparse


logger = logging.getLogger(__name__)



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

