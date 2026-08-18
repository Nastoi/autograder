from django.contrib.auth import get_user_model
from rest_framework.response import Response

from .models import AssessmentMapping, LtiUserIdentity
import jwt

from django.conf import settings
from django.core import signing
from django.core.cache import cache
import hashlib

def get_or_create_lti_user(
    issuer,
    deployment_id,
    lti_user_id,
    *,
    preferred_username="",
    email="",
    given_name="",
    family_name="",
    full_name="",
):
    """
    Resolve an LTI learner by the stable LTI identity.

    The LTI subject remains the identity key in LtiUserIdentity.
    The LMS username/email/name are profile attributes and are refreshed
    when the platform shares them.
    """
    User = get_user_model()

    identity = (
        LtiUserIdentity.objects
        .select_related("user")
        .filter(
            issuer=issuer,
            deployment_id=deployment_id,
            lti_user_id=lti_user_id,
        )
        .first()
    )

    clean_preferred_username = (preferred_username or "").strip()

    if identity is not None:
        user = identity.user
    else:
        # Use the human-readable LMS username when Open edX shares it.
        # The stable LTI subject is stored separately in LtiUserIdentity.
        username = clean_preferred_username or f"lti_{lti_user_id}"

        # Avoid accidentally attaching an LTI identity to an unrelated local
        # account if that username already exists. A collision falls back to
        # the stable generated username instead.
        if User.objects.filter(username=username).exists():
            username = f"lti_{lti_user_id}"

        user = User.objects.create_user(
            username=username,
            is_active=True,
        )

        identity = LtiUserIdentity.objects.create(
            issuer=issuer,
            deployment_id=deployment_id,
            lti_user_id=lti_user_id,
            user=user,
        )

    clean_email = (email or "").strip()
    clean_given_name = (given_name or "").strip()
    clean_family_name = (family_name or "").strip()
    clean_full_name = (full_name or "").strip()

    # Some platforms provide only the standard `name` claim. Use it as
    # a conservative fallback without changing the stable local username.
    if clean_full_name and not clean_given_name and not clean_family_name:
        name_parts = clean_full_name.split(maxsplit=1)
        clean_given_name = name_parts[0]
        if len(name_parts) > 1:
            clean_family_name = name_parts[1]

    changed_fields = []

    # Existing LTI users created by older code may still have an lti_<sub>
    # username. Replace it with the LMS username when it is available and
    # not already owned by another local account.
    if (
        clean_preferred_username
        and user.username != clean_preferred_username
        and not User.objects.filter(
            username=clean_preferred_username
        ).exclude(pk=user.pk).exists()
    ):
        user.username = clean_preferred_username
        changed_fields.append("username")

    if clean_email and user.email != clean_email:
        user.email = clean_email
        changed_fields.append("email")

    if clean_given_name and user.first_name != clean_given_name:
        user.first_name = clean_given_name
        changed_fields.append("first_name")

    if clean_family_name and user.last_name != clean_family_name:
        user.last_name = clean_family_name
        changed_fields.append("last_name")

    if changed_fields:
        user.save(update_fields=changed_fields)

    return user


def get_lti_assessment_mapping(
    claims,
    mapping_id,
):
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
            id=mapping_id,
            is_active=True,
        )
    except AssessmentMapping.DoesNotExist:
        return None, Response(
            {
                "detail": (
                    "This AutoGrad3r assessment mapping "
                    "does not exist or is inactive."
                )
            },
            status=404,
        )

    # First launch from this LMS activity:
    # automatically bind it to the mapping.
    if not mapping.external_resource_link_id:
        mapping.external_resource_link_id = resource_link_id
        
        mapping.save(
            update_fields=[
                "external_resource_link_id",
                "updated_at",
            ]
        )

        return mapping, None

    # Mapping is already linked.
    # The LMS activity must still match.
    if (
        mapping.external_resource_link_id
        != resource_link_id
    ):
        return None, Response(
            {
                "detail": (
                    "This AutoGrad3r mapping is already "
                    "linked to a different LMS activity."
                )
            },
            status=409,
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

    state_cache_key = (
        "lti_state:"
        + hashlib.sha256(
            state.encode("utf-8")
        ).hexdigest()
    )

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

    mapping_id = state_data.get("mapping_id")

    if not mapping_id:
        return None, Response(
            {
                "detail": (
                    "Missing assessment mapping "
                    "in LTI state."
                )
            },
            status=400,
        )

    try:
        mapping = AssessmentMapping.objects.get(
            id=mapping_id,
            is_active=True,
        )
    except AssessmentMapping.DoesNotExist:
        return None, Response(
            {"detail": "Assessment mapping not found."},
            status=400,
        )

    if not mapping.lti_jwks_url:
        return None, Response(
            {
                "detail": (
                    "LTI JWKS URL is not configured "
                    "for this mapping."
                )
            },
            status=400,
        )

    if not mapping.lti_client_id:
        return None, Response(
            {
                "detail": (
                    "LTI client ID is not configured "
                    "for this mapping."
                )
            },
            status=400,
        )

    try:
        jwks_client = jwt.PyJWKClient(
            mapping.lti_jwks_url
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
            audience=mapping.lti_client_id,
            issuer=settings.LTI_PLATFORM_ISSUER,
        )

    except Exception as exc:
        print(
            "LTI TOKEN VERIFY ERROR:",
            repr(exc),
        )

        return None, Response(
            {
                "detail": (
                    "LTI token verification failed."
                )
            },
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
            {
                "detail": (
                    "Unsupported LTI message type."
                )
            },
            status=400,
        )

    if version != "1.3.0":
        return None, Response(
            {"detail": "Unsupported LTI version."},
            status=400,
        )

    if not mapping.lti_deployment_id:
        return None, Response(
            {
                "detail": (
                    "LTI deployment ID is not configured "
                    "for this mapping."
                )
            },
            status=400,
        )

    if deployment_id != mapping.lti_deployment_id:
        return None, Response(
            {"detail": "Invalid LTI deployment."},
            status=400,
        )

    if state_data.get("issuer") != issuer:
        return None, Response(
            {
                "detail": (
                    "LTI issuer does not match state."
                )
            },
            status=400,
        )

    if (
        state_data.get("client_id")
        != mapping.lti_client_id
    ):
        return None, Response(
            {
                "detail": (
                    "LTI client ID does not "
                    "match state."
                )
            },
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
                    "Missing required LTI "
                    "identity claims."
                )
            },
            status=400,
        )

    cache.delete(state_cache_key)

    return claims, None