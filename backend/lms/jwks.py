import os
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from django.http import JsonResponse
from jwt.algorithms import RSAAlgorithm
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView


class LtiJwksView(APIView):
    """Expose AutoGrad3r's LTI 1.3 public signing key as a JWKS."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        public_key_path = os.environ.get(
            "LTI_TOOL_PUBLIC_KEY_PATH",
            "",
        ).strip()

        key_id = os.environ.get(
            "LTI_TOOL_KEY_ID",
            "autograd3r-1",
        ).strip() or "autograd3r-1"

        if not public_key_path:
            return JsonResponse(
                {
                    "detail": (
                        "LTI tool public key is not configured. "
                        "Set LTI_TOOL_PUBLIC_KEY_PATH."
                    )
                },
                status=503,
            )

        key_path = Path(public_key_path)

        try:
            public_key_bytes = key_path.read_bytes()
        except OSError:
            return JsonResponse(
                {
                    "detail": "LTI tool public key could not be read."
                },
                status=503,
            )

        try:
            public_key = serialization.load_pem_public_key(
                public_key_bytes
            )
        except (ValueError, TypeError):
            return JsonResponse(
                {
                    "detail": "LTI tool public key PEM could not be parsed."
                },
                status=503,
            )

        if not isinstance(public_key, rsa.RSAPublicKey):
            return JsonResponse(
                {
                    "detail": "LTI tool public key is not an RSA public key."
                },
                status=503,
            )

        try:
            jwk = RSAAlgorithm.to_jwk(
                public_key,
                as_dict=True,
            )
        except Exception as exc:
            return JsonResponse(
                {
                    "detail": f"Could not convert RSA key to JWK: {exc}"
                },
                status=503,
            )

        jwk.update(
            {
                "kid": key_id,
                "use": "sig",
                "alg": "RS256",
            }
        )

        response = JsonResponse(
            {
                "keys": [jwk]
            }
        )
        response["Cache-Control"] = "public, max-age=3600"

        return response