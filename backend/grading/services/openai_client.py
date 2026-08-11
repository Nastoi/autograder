import json

from django.conf import settings


def request_assessment(
    *,
    system_prompt: str,
    user_prompt: str,
    model: str = "gpt-4o",          # Default: GPT-4o
    max_tokens: int = 4096,
    temperature: float = 0.0,
    top_p: float = 1.0,
    timeout: int = 120,
) -> dict:
    from openai import OpenAI

    client = OpenAI(
        api_key=settings.OPENAI_API_KEY,
        timeout=timeout,
    )

    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        max_tokens=max_tokens,
        temperature=temperature,
        top_p=top_p,
        response_format={"type": "json_object"},  # Forces valid JSON output
    )

    try:
        output_text = response.choices[0].message.content
    except (AttributeError, IndexError):
        output_text = json.dumps(
            response.model_dump(),
            ensure_ascii=False,
            indent=2,
        )

    try:
        return json.loads(output_text)
    except json.JSONDecodeError as exc:
        raise ValueError(
            f"Unable to parse OpenAI response as JSON: {exc}\n"
            f"Raw output: {output_text[:500]}"
        )
