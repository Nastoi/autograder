import base64
from django.shortcuts import get_object_or_404
from .models import ExtractedEvidence


def build_ai_multimodal_payload(submission_id):
    """Fetches all evidence objects for a submission and converts page images

    into a single Base64-encoded multimodal payload for LLM API calls.
    """
    evidences = ExtractedEvidence.objects.filter(
        submission_id=submission_id
    ).order_by("page_number")

    message_content = [
        {
            "type": "text",
            "text": f"Evaluate the following evidence pages for Submission ID: {submission_id}",
        }
    ]

    for ev in evidences:
        # Add page text content
        if ev.content_text:
            message_content.append(
                {
                    "type": "text",
                    "text": f"--- Page {ev.page_number} Text ---\n{ev.content_text}",
                }
            )

        # Resolve image from SubmissionPage via FK or page_number and convert to Base64
        if ev.submission_id and ev.page_number:
            from submissions.models import SubmissionPage

            page = SubmissionPage.objects.filter(
                submission_id=ev.submission_id, page_number=ev.page_number
            ).first()

            if page and page.image_data:
                b64_img = base64.b64encode(page.image_data).decode("utf-8")
                mime_type = getattr(page, "image_mime_type", "image/webp")

                message_content.append(
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{mime_type};base64,{b64_img}"
                        },
                    }
                )

    return message_content