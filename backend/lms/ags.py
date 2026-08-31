import os
import time
import uuid
from datetime import datetime, timezone

import jwt
import requests


AGS_SCORE_SCOPE = "https://purl.imsglobal.org/spec/lti-ags/scope/score"
AGS_LINEITEM_SCOPE = "https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly"


def get_lti_access_token(
    *,
    client_id: str,
    token_url: str,
    scope: str = AGS_SCORE_SCOPE,
) -> str:
    private_key_path = os.environ.get(
        "LTI_TOOL_PRIVATE_KEY_PATH",
        "",
    ).strip()

    key_id = os.environ.get(
        "LTI_TOOL_KEY_ID",
        "autograd3r-1",
    ).strip() or "autograd3r-1"

    if not private_key_path:
        raise RuntimeError(
            "LTI_TOOL_PRIVATE_KEY_PATH is not configured."
        )

    with open(private_key_path, "rb") as key_file:
        private_key = key_file.read()

    now = int(time.time())

    assertion = jwt.encode(
        {
            "iss": client_id,
            "sub": client_id,
            "aud": token_url,
            "iat": now,
            "exp": now + 300,
            "jti": str(uuid.uuid4()),
        },
        private_key,
        algorithm="RS256",
        headers={"kid": key_id},
    )

    response = requests.post(
        token_url,
        data={
            "grant_type": "client_credentials",
            "client_assertion_type": (
                "urn:ietf:params:oauth:"
                "client-assertion-type:jwt-bearer"
            ),
            "client_assertion": assertion,
            "scope": scope,
        },
        timeout=15,
    )
    response.raise_for_status()

    payload = response.json()
    access_token = payload.get("access_token")

    if not access_token:
        raise RuntimeError(
            f"No access_token returned by LTI platform: {payload}"
        )

    return access_token




def send_ags_score(
    *,
    client_id: str,
    token_url: str,
    lineitem_url: str,
    lti_user_id: str,
    score: float,
    maximum_score: float = 100.0,
) -> dict:
    """Send one fully-graded score to an LTI AGS line item."""
    if not lineitem_url:
        raise ValueError("AGS line item URL is missing.")

    if maximum_score <= 0:
        raise ValueError("maximum_score must be greater than zero.")

    access_token = get_lti_access_token(
        client_id=client_id,
        token_url=token_url,
    )

    score_url = f"{lineitem_url.rstrip('/')}/scores"

    payload = {
        "userId": lti_user_id,
        "scoreGiven": float(score),
        "scoreMaximum": float(maximum_score),
        "activityProgress": "Completed",
        "gradingProgress": "FullyGraded",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    response = requests.post(
        score_url,
        json=payload,
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/vnd.ims.lis.v1.score+json",
        },
        timeout=15,
    )
    response.raise_for_status()

    return {
        "status_code": response.status_code,
        "response": response.text,
    }


def clear_ags_score(
    *,
    client_id: str,
    token_url: str,
    lineitem_url: str,
    lti_user_id: str,
):
    access_token = get_lti_access_token(
        client_id=client_id,
        token_url=token_url,
    )

    score_url = f"{lineitem_url.rstrip('/')}/scores"

    payload = {
        "userId": lti_user_id,
        "activityProgress": "Initialized",
        "gradingProgress": "NotReady",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    response = requests.post(
        score_url,
        json=payload,
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/vnd.ims.lis.v1.score+json",
        },
        timeout=15,
    )

    response.raise_for_status()

    return {
        "status_code": response.status_code,
        "response": response.text,
    }

