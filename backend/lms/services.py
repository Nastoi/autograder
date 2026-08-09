from django.contrib.auth import get_user_model
from rest_framework.response import Response

from .models import AssessmentMapping, LtiUserIdentity
import jwt

from django.conf import settings
from django.core import signing
from django.core.cache import cache

def get_or_create_lti_user(
    issuer,
    deployment_id,
    lti_user_id,
):
    User = get_user_model()

    username = f"lti_{lti_user_id}"

    user, _ = User.objects.get_or_create(
        username=username,
        defaults={
            "is_active": True,
        },
    )

    identity, _ = LtiUserIdentity.objects.get_or_create(
        issuer=issuer,
        deployment_id=deployment_id,
        lti_user_id=lti_user_id,
        defaults={
            "user": user,
        },
    )

    return identity.user


def get_lti_assessment_mapping(claims):
    resource_link = claims.get(
        "https://purl.imsglobal.org/spec/lti/claim/resource_link",
        {},
    )

    resource_link_id = resource_link.get("id")

    if not resource_link_id:
        return None, Response(
            {"detail": "Missing LTI resource link ID."},
            status=400,
        )

    try:
        mapping = AssessmentMapping.objects.get(
            external_resource_link_id=resource_link_id,
            is_active=True,
        )
    except AssessmentMapping.DoesNotExist:
        return None, Response(
            {
                "detail": (
                    "This LMS activity is not linked to an "
                    "AutoGrad3r assessment mapping."
                )
            },
            status=404,
        )

    return mapping, None


def verify_lti_launch(id_token, state):
    if not id_token or not state:
        return None, Response(
            {"detail": "Missing id_token or state."},
            status=400,
        )

    try:
        state_data = signing.loads(
            state,
            max_age=600,
        )
    except signing.SignatureExpired:
        return None, Response(
            {"detail": "LTI state expired."},
            status=400,
        )
    except signing.BadSignature:
        return None, Response(
            {"detail": "Invalid LTI state."},
            status=400,
        )

    state_cache_key = f"lti_state:{state}"

    if not cache.get(state_cache_key):
        return None, Response(
            {
                "detail": (
                    "LTI state is invalid, expired, "
                    "or has already been used."
                )
            },
            status=400,
        )

    try:
        jwks_client = jwt.PyJWKClient(
            settings.LTI_JWKS_URL
        )

        signing_key = (
            jwks_client.get_signing_key_from_jwt(
                id_token
            )
        )

        claims = jwt.decode(
            id_token,
            signing_key.key,
            algorithms=["RS256"],
            audience=settings.LTI_CLIENT_ID,
            issuer=settings.LTI_PLATFORM_ISSUER,
        )

    except Exception:
        return None, Response(
            {"detail": "LTI token verification failed."},
            status=400,
        )

    message_type = claims.get(
        "https://purl.imsglobal.org/spec/lti/claim/message_type"
    )

    version = claims.get(
        "https://purl.imsglobal.org/spec/lti/claim/version"
    )

    deployment_id = claims.get(
        "https://purl.imsglobal.org/spec/lti/claim/deployment_id"
    )

    issuer = claims.get("iss")
    lti_user_id = claims.get("sub")

    if message_type != "LtiResourceLinkRequest":
        return None, Response(
            {"detail": "Unsupported LTI message type."},
            status=400,
        )

    if version != "1.3.0":
        return None, Response(
            {"detail": "Unsupported LTI version."},
            status=400,
        )

    if deployment_id != settings.LTI_DEPLOYMENT_ID:
        return None, Response(
            {"detail": "Invalid LTI deployment."},
            status=400,
        )

    if state_data.get("issuer") != issuer:
        return None, Response(
            {"detail": "LTI issuer does not match state."},
            status=400,
        )

    if (
        state_data.get("client_id")
        != settings.LTI_CLIENT_ID
    ):
        return None, Response(
            {"detail": "LTI client ID does not match state."},
            status=400,
        )

    expected_nonce = state_data.get("nonce")
    received_nonce = claims.get("nonce")

    if (
        not expected_nonce
        or received_nonce != expected_nonce
    ):
        return None, Response(
            {"detail": "Invalid LTI nonce."},
            status=400,
        )

    if not all([
        issuer,
        deployment_id,
        lti_user_id,
    ]):
        return None, Response(
            {
                "detail": (
                    "Missing required LTI identity claims."
                )
            },
            status=400,
        )

    cache.delete(state_cache_key)

    return claims, None