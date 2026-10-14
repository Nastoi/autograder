"""Bounded image payload utilities for multimodal grading.

The provider applies a request-level image limit, while data-URI/base64
encoding expands binary images by roughly 4/3.  This module therefore budgets
*wire bytes* rather than only the stored binary size and provides a final
pre-flight guard before an API call.
"""

from __future__ import annotations

import base64
import io
import logging
import math
from dataclasses import dataclass

from billiard.exceptions import SoftTimeLimitExceeded
from django.conf import settings
from PIL import Image, ImageOps

logger = logging.getLogger(__name__)

_MB = 1024 * 1024
_DEFAULT_WIRE_BUDGET_MB = 32.0
_DEFAULT_MAX_SIDE = 1800
_DEFAULT_MAX_IMAGE_MB = 3.0
_DEFAULT_WEBP_METHOD = 3
_MIN_SIDE = 720
_DATA_URI_PREFIX_BYTES = 32


def _setting_float(name: str, default: float) -> float:
    try:
        return float(getattr(settings, name, default))
    except (TypeError, ValueError):
        return default


def _setting_int(name: str, default: int) -> int:
    try:
        return int(getattr(settings, name, default))
    except (TypeError, ValueError):
        return default


def _base64_size(raw_size: int) -> int:
    """Return encoded base64 bytes without materialising the encoded value."""
    return 4 * math.ceil(max(0, int(raw_size)) / 3)


def _wire_size_for_payload(payload: bytes, mime_type: str) -> int:
    return (
        len(f"data:{mime_type};base64,".encode("ascii"))
        + _base64_size(len(payload))
    )


def _raw_target_for_wire_budget(wire_bytes: int) -> int:
    """Approximate max raw bytes that fit inside a base64 data URI budget."""
    available = max(0, int(wire_bytes) - _DATA_URI_PREFIX_BYTES)
    return max(0, (available * 3) // 4)


@dataclass
class ImagePayloadBudget:
    """Tracks estimated encoded/wire image bytes for one model request."""

    stage: str
    limit_bytes: int
    used_bytes: int = 0  # encoded data-URI / wire bytes
    binary_bytes_sent: int = 0
    raw_bytes_seen: int = 0
    included_images: int = 0
    omitted_images: int = 0
    recompressed_images: int = 0
    passthrough_images: int = 0

    @classmethod
    def for_stage(cls, stage: str) -> "ImagePayloadBudget":
        budget_mb = _setting_float(
            "OPENAI_IMAGE_PAYLOAD_BUDGET_MB",
            _DEFAULT_WIRE_BUDGET_MB,
        )
        return cls(stage=stage, limit_bytes=max(1, int(budget_mb * _MB)))

    @property
    def remaining_bytes(self) -> int:
        return max(0, self.limit_bytes - self.used_bytes)

    def target_for_remaining(self, remaining_images: int) -> int:
        """Fair-share raw target derived from remaining encoded/wire budget."""
        remaining_images = max(1, int(remaining_images or 1))
        fair_wire_share = self.remaining_bytes // remaining_images
        fair_raw_share = _raw_target_for_wire_budget(fair_wire_share)
        per_image_cap = int(
            _setting_float(
                "OPENAI_IMAGE_MAX_PER_IMAGE_MB",
                _DEFAULT_MAX_IMAGE_MB,
            )
            * _MB
        )
        return max(48 * 1024, min(fair_raw_share, per_image_cap))

    def log_summary(self) -> None:
        logger.info(
            "AI image payload stage=%s raw=%.2fMB binary=%.2fMB wire=%.2fMB "
            "included=%s passthrough=%s recompressed=%s omitted=%s "
            "budget=%.2fMB",
            self.stage,
            self.raw_bytes_seen / _MB,
            self.binary_bytes_sent / _MB,
            self.used_bytes / _MB,
            self.included_images,
            self.passthrough_images,
            self.recompressed_images,
            self.omitted_images,
            self.limit_bytes / _MB,
        )


def _encode_webp(image: Image.Image, quality: int) -> bytes:
    buffer = io.BytesIO()
    image.save(
        buffer,
        format="WEBP",
        quality=quality,
        method=_setting_int("OPENAI_IMAGE_WEBP_METHOD", _DEFAULT_WEBP_METHOD),
    )
    return buffer.getvalue()


def compress_image_for_model(
    raw_bytes: bytes,
    *,
    target_bytes: int,
    max_side: int | None = None,
) -> tuple[bytes, str, bool]:
    """Compress one image with a bounded number of encode passes."""
    if not raw_bytes:
        return raw_bytes, "image/webp", False

    target_bytes = max(48 * 1024, int(target_bytes))
    if len(raw_bytes) <= target_bytes:
        return raw_bytes, "image/webp", False

    max_side = max_side or _setting_int("OPENAI_IMAGE_MAX_SIDE_PX", _DEFAULT_MAX_SIDE)

    try:
        with Image.open(io.BytesIO(raw_bytes)) as source:
            image = ImageOps.exif_transpose(source)
            if image.mode not in ("RGB", "RGBA"):
                image = image.convert("RGB")
            elif image.mode == "RGBA":
                background = Image.new("RGB", image.size, "white")
                background.paste(image, mask=image.getchannel("A"))
                image = background
            else:
                image = image.copy()

        if max(image.size) > max_side:
            image.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)

        if len(raw_bytes) > target_bytes * 1.20:
            ratio = math.sqrt(target_bytes / max(1, len(raw_bytes))) * 1.05
            ratio = min(1.0, max(0.62, ratio))
            if ratio < 0.98 and max(image.size) > _MIN_SIDE:
                image = image.resize(
                    (
                        max(_MIN_SIDE, int(image.width * ratio)),
                        max(_MIN_SIDE, int(image.height * ratio)),
                    ),
                    Image.Resampling.LANCZOS,
                )

        best = raw_bytes
        for quality in (70, 52, 40):
            candidate = _encode_webp(image, quality)
            if len(candidate) < len(best):
                best = candidate
            if len(candidate) <= target_bytes:
                return candidate, "image/webp", candidate != raw_bytes

            if quality != 40 and max(image.size) > _MIN_SIDE:
                shrink_ratio = math.sqrt(target_bytes / max(1, len(candidate))) * 0.94
                shrink_ratio = min(0.88, max(0.68, shrink_ratio))
                new_size = (
                    max(_MIN_SIDE, int(image.width * shrink_ratio)),
                    max(_MIN_SIDE, int(image.height * shrink_ratio)),
                )
                if new_size != image.size:
                    image = image.resize(new_size, Image.Resampling.LANCZOS)

        return best, "image/webp", best != raw_bytes
    except SoftTimeLimitExceeded:
        raise
    except Exception:
        logger.exception("Unable to recompress grading image; using original bytes.")
        return raw_bytes, "image/webp", False


def append_page_image(
    content: list[dict],
    page,
    budget: ImagePayloadBudget,
    *,
    remaining_images: int = 1,
) -> bool:
    """Append one inline page image only when its encoded form fits safely."""
    raw_bytes = getattr(page, "image_data", None)

    if raw_bytes:
        raw_bytes = bytes(raw_bytes)
        budget.raw_bytes_seen += len(raw_bytes)
        if budget.remaining_bytes <= 0:
            budget.omitted_images += 1
            return False

        target = budget.target_for_remaining(remaining_images)
        mime_type = getattr(page, "image_mime_type", None) or "image/webp"

        if (
            len(raw_bytes) <= target
            and _wire_size_for_payload(raw_bytes, mime_type) <= budget.remaining_bytes
        ):
            payload = raw_bytes
            changed = False
            budget.passthrough_images += 1
        else:
            payload, mime_type, changed = compress_image_for_model(
                raw_bytes,
                target_bytes=target,
            )

        wire_size = _wire_size_for_payload(payload, mime_type)
        if wire_size > budget.remaining_bytes:
            budget.omitted_images += 1
            logger.warning(
                "Skipping page image in stage=%s because encoded size %.2fMB "
                "exceeds remaining wire budget %.2fMB.",
                budget.stage,
                wire_size / _MB,
                budget.remaining_bytes / _MB,
            )
            return False

        b64_image = base64.b64encode(payload).decode("ascii")
        content.append(
            {
                "type": "image_url",
                "image_url": {"url": f"data:{mime_type};base64,{b64_image}"},
            }
        )
        budget.used_bytes += wire_size
        budget.binary_bytes_sent += len(payload)
        budget.included_images += 1
        if changed:
            budget.recompressed_images += 1
        return True

    # SubmissionPage currently stores images in image_data.  Retain remote URL
    # support for compatibility, but count the URL itself only; a final request
    # guard below still protects inline payloads.
    remote_url = getattr(page, "image_url", None)
    if remote_url:
        encoded_url_size = len(str(remote_url).encode("utf-8"))
        if encoded_url_size > budget.remaining_bytes:
            budget.omitted_images += 1
            return False
        content.append({"type": "image_url", "image_url": {"url": remote_url}})
        budget.used_bytes += encoded_url_size
        budget.included_images += 1
        return True

    return False


def enforce_message_image_budget(messages: list[dict], *, stage: str) -> None:
    """Final defence: ensure inline data-URI image wire size is under budget.

    This catches any future code path that accidentally bypasses
    :func:`append_page_image`.  Images are removed from the end of the request
    until it is safely under the configured encoded payload budget.
    """
    limit = max(
        1,
        int(
            _setting_float(
                "OPENAI_IMAGE_PAYLOAD_BUDGET_MB",
                _DEFAULT_WIRE_BUDGET_MB,
            )
            * _MB
        ),
    )

    refs: list[tuple[list, int, int]] = []
    total = 0
    for message in messages:
        content = message.get("content") if isinstance(message, dict) else None
        if not isinstance(content, list):
            continue
        for idx, item in enumerate(content):
            if not isinstance(item, dict) or item.get("type") != "image_url":
                continue
            url = (item.get("image_url") or {}).get("url")
            if not isinstance(url, str) or not url.startswith("data:"):
                continue
            size = len(url.encode("ascii", errors="ignore"))
            refs.append((content, idx, size))
            total += size

    if total <= limit:
        logger.info(
            "AI image preflight stage=%s inline_wire=%.2fMB budget=%.2fMB removed=0",
            stage,
            total / _MB,
            limit / _MB,
        )
        return

    removed = 0
    # Remove by object identity from the end so earlier evidence is preserved.
    for content, idx, size in reversed(refs):
        if total <= limit:
            break
        if idx < len(content) and isinstance(content[idx], dict) and content[idx].get("type") == "image_url":
            del content[idx]
            total -= size
            removed += 1

    logger.warning(
        "AI image preflight trimmed stage=%s inline_wire=%.2fMB budget=%.2fMB removed=%s",
        stage,
        total / _MB,
        limit / _MB,
        removed,
    )
