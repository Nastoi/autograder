from django.contrib.auth import get_user_model
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed


User = get_user_model()


class LtiSessionAuthentication(BaseAuthentication):
    """
    Authenticate an LTI-launched user without replacing the
    normal Django portal login session.
    """

    def authenticate(self, request):
        lti_user_id = request.session.get("lti_user_id")

        if not lti_user_id:
            return None

        session_mapping_id = request.session.get(
            "lti_mapping_id"
        )

        parser_context = getattr(
            request,
            "parser_context",
            None,
        ) or {}

        kwargs = parser_context.get("kwargs") or {}
        requested_mapping_id = kwargs.get("mapping_id")

        if (
            requested_mapping_id
            and session_mapping_id
            and str(requested_mapping_id)
            != str(session_mapping_id)
        ):
            raise AuthenticationFailed(
                "This LTI session does not match "
                "the requested assessment."
            )

        user = User.objects.filter(
            id=lti_user_id,
            is_active=True,
        ).first()

        if user is None:
            raise AuthenticationFailed(
                "The LTI user session is no longer valid."
            )

        return user, None