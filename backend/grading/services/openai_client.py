import os
import json
import logging
from typing import Any

from django.conf import settings
from openai import OpenAI

logger = logging.getLogger(__name__)


def request_assessment(
    *,
    system_prompt: str,
    user_prompt: str,
    model: str = "gpt-4o",
    max_tokens: int = 4096,
    temperature: float = 0.0,
    top_p: float = 1.0,
    timeout: int = 120,
) -> dict[str, Any]:
    api_key = getattr(settings, "OPENAI_API_KEY", None)
    if not api_key:
        raise ValueError("OPENAI_API_KEY is not set in Django settings.")

    # Temporarily remove proxy env vars that break OpenAI SDK v1.0+
    for proxy_var in ["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy"]:
        os.environ.pop(proxy_var, None)

    client = OpenAI(
        api_key=api_key,
        timeout=timeout,
    )

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=max_tokens,
            temperature=temperature,
            top_p=top_p,
            response_format={"type": "json_object"},
        )
    except Exception as exc:
        logger.error("OpenAI Chat Completion API call failed: %s", exc)
        raise RuntimeError(f"OpenAI API call failed: {exc}") from exc

    raw_content = response.choices[0].message.content
    if not raw_content:
        raise ValueError("OpenAI returned an empty response.")

    try:
        return json.loads(raw_content)
    except json.JSONDecodeError as exc:
        logger.error("Failed to parse JSON response from OpenAI: %s", raw_content)
        raise ValueError(
            f"Unable to parse OpenAI response as JSON: {exc}\n"
            f"Raw output: {raw_content[:500]}"
        ) from exc