import json
from typing import Any

from django.conf import settings


def request_assessment(
    *,
    system_prompt: str,
    user_prompt: str,
    model: str = "gpt-4o-mini",
    max_tokens: int = 1500,
    temperature: float = 0.0,
    top_p: float = 1.0,
    timeout: int = 60,
) -> dict:
    from openai import OpenAI

    client = OpenAI(api_key=settings.OPENAI_API_KEY)

    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        max_tokens=max_tokens,
        temperature=temperature,
        top_p=top_p,
    )

    try:
        output_text = response.choices[0].message.content
    except (AttributeError, IndexError) as e:
        output_text = json.dumps(
            response.model_dump(),
            ensure_ascii=False,
            indent=2,
        )

    try:
        return json.loads(output_text)
    except json.JSONDecodeError as exc:
        raise ValueError(
            f"Unable to parse OpenAI response as JSON: {exc}"
        )
