"""
task_mapper.py
--------------
Service that calls OpenAI to produce a Task → Criteria → Weightage mapping
for a given ModuleAssignment, then persists the results into TaskCriteriaMapping.

Usage
-----
    from grading.services.task_mapper import map_tasks_to_criteria

    result = map_tasks_to_criteria(assignment=module_assignment_instance)
    # returns {"created": int, "updated": int, "mappings": [...]}
"""
from __future__ import annotations

import json
import logging
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

from django.conf import settings
from django.db import transaction

logger = logging.getLogger(__name__)

PROMPTS_DIR = Path(settings.BASE_DIR) / "prompts"


# ---------------------------------------------------------------------------
# Prompt helpers
# ---------------------------------------------------------------------------

def _load_system_prompt() -> str:
    path = PROMPTS_DIR / "task_criteria_mapping_prompt.txt"
    return path.read_text(encoding="utf-8")


def _build_user_prompt(
    *,
    assignment_code: str,
    assignment_title: str,
    assignment_level: str,
    objective: str,
    tasks: list[dict],
    criteria: list[dict],
) -> str:
    """
    Build a structured user prompt that gives the model everything it needs
    to produce an accurate Task-Criteria-Weightage mapping.
    """
    tasks_block = "\n".join(
        f"  {i + 1}. [{t['task_code']}] {t['title']}\n"
        f"     Instructions: {t['instructions'] or '(none provided)'}"
        for i, t in enumerate(tasks)
    )

    criteria_block = "\n".join(
        f"  {i + 1}. [{c['criterion_code']}] {c['title']}\n"
        f"     Description : {c['description'] or '(none provided)'}\n"
        f"     Maximum Marks: {c['maximum_score']}"
        for i, c in enumerate(criteria)
    )

    return (
        f"=== ASSIGNMENT CONTEXT ===\n"
        f"Assignment Code : {assignment_code}\n"
        f"Assignment Title: {assignment_title}\n"
        f"Level           : {assignment_level}\n"
        f"Objective       : {objective or '(none provided)'}\n\n"
        f"=== TASKS ({len(tasks)} total) ===\n"
        f"{tasks_block}\n\n"
        f"=== RUBRIC CRITERIA ({len(criteria)} total) ===\n"
        f"{criteria_block}\n\n"
        f"=== YOUR TASK ===\n"
        f"Map each task to the criteria it evidences. Assign inferred weights "
        f"so that, for every criterion, weights across all tasks sum to exactly 1.00.\n"
        f"Return valid JSON only — conforming to the schema in your system prompt."
    )


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

def _validate_response(data: dict, tasks: list[dict], criteria: list[dict]) -> list[str]:
    """
    Return a list of validation error strings. Empty list means OK.
    Checks:
      - All task_codes appear in mappings
      - All criterion_codes appear in at least one mapping
      - Weights per criterion sum to ~1.00 (±0.01 tolerance)
      - inferred_weight is in [0.01, 1.00]
    """
    errors: list[str] = []
    valid_task_codes = {t["task_code"] for t in tasks}
    valid_criterion_codes = {c["criterion_code"] for c in criteria}

    mapped_task_codes: set[str] = set()
    mapped_criterion_codes: set[str] = set()
    criterion_weight_totals: dict[str, float] = {}

    mappings = data.get("mappings", [])
    if not isinstance(mappings, list):
        return ["'mappings' field is missing or not a list"]

    for mapping in mappings:
        tc = mapping.get("task_code", "")
        if tc not in valid_task_codes:
            errors.append(f"Unknown task_code in response: {tc!r}")
            continue
        mapped_task_codes.add(tc)

        criteria_list = mapping.get("criteria", [])
        if not criteria_list:
            errors.append(f"Task {tc!r} has no criteria mappings")

        for cm in criteria_list:
            cc = cm.get("criterion_code", "")
            if cc not in valid_criterion_codes:
                errors.append(f"Unknown criterion_code in response: {cc!r}")
                continue
            mapped_criterion_codes.add(cc)

            w = cm.get("inferred_weight")
            if not isinstance(w, (int, float)) or not (0.01 <= float(w) <= 1.00):
                errors.append(
                    f"Invalid inferred_weight {w!r} for task={tc} criterion={cc}"
                )
                continue
            criterion_weight_totals[cc] = (
                criterion_weight_totals.get(cc, 0.0) + float(w)
            )

    # All tasks must appear
    missing_tasks = valid_task_codes - mapped_task_codes
    if missing_tasks:
        errors.append(f"Tasks not mapped: {missing_tasks}")

    # All criteria must appear
    missing_criteria = valid_criterion_codes - mapped_criterion_codes
    if missing_criteria:
        errors.append(f"Criteria not mapped: {missing_criteria}")

    # Weight sums must be ~1.00
    for cc, total in criterion_weight_totals.items():
        if abs(total - 1.0) > 0.02:  # 2% tolerance
            errors.append(
                f"Criterion {cc!r} weights sum to {total:.4f} (expected 1.00)"
            )

    return errors


# ---------------------------------------------------------------------------
# Persistence
# ---------------------------------------------------------------------------

def _save_mappings(
    *,
    assignment,
    data: dict,
    task_map: dict,
    criterion_map: dict,
) -> tuple[int, int]:
    """
    Upsert TaskCriteriaMapping rows from AI response.
    Returns (created_count, updated_count).
    """
    # Import here to avoid circular imports
    from grading.models import TaskCriteriaMapping  # noqa: PLC0415

    created = 0
    updated = 0

    with transaction.atomic():
        for mapping in data.get("mappings", []):
            task_code = mapping["task_code"]
            task_obj = task_map.get(task_code)
            if not task_obj:
                continue

            for cm in mapping.get("criteria", []):
                criterion_code = cm["criterion_code"]
                criterion_obj = criterion_map.get(criterion_code)
                if not criterion_obj:
                    continue

                try:
                    weight = Decimal(str(cm["inferred_weight"])).quantize(
                        Decimal("0.01")
                    )
                except (InvalidOperation, TypeError):
                    logger.warning(
                        "Could not parse weight %r for task=%s criterion=%s",
                        cm.get("inferred_weight"),
                        task_code,
                        criterion_code,
                    )
                    continue

                obj, was_created = TaskCriteriaMapping.objects.update_or_create(
                    assignment_level=assignment,
                    task=task_obj,
                    rubric_criterion=criterion_obj,
                    defaults={
                        "inferred_weight": weight,
                        "ai_explanation": cm.get("explanation", ""),
                    },
                )
                if was_created:
                    created += 1
                else:
                    updated += 1

    return created, updated


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def map_tasks_to_criteria(*, assignment) -> dict[str, Any]:
    """
    Run the full Task → Criteria → Weightage mapping pipeline for the given
    ModuleAssignment instance.

    Returns a summary dict:
    {
        "assignment_code": str,
        "created": int,
        "updated": int,
        "mapping_rationale": str,
        "validation_warnings": list[str],
        "mappings": [
            {
                "task_code": str,
                "criteria": [
                    {"criterion_code": str, "inferred_weight": float, "explanation": str}
                ]
            }
        ]
    }

    Raises:
        ValueError  – if tasks or criteria are missing, or if AI response is invalid
        RuntimeError – if OpenAI call fails
    """
    from grading.models import RubricCriterion, Task  # noqa: PLC0415
    from .openai_client import request_assessment  # noqa: PLC0415

    # ---- 1. Fetch data from DB ----------------------------------------
    tasks_qs = (
        Task.objects.filter(assignment_level=assignment)
        .order_by("sequence", "task_code")
    )
    criteria_qs = (
        RubricCriterion.objects.filter(assignment_level=assignment)
        .order_by("sequence", "criterion_code")
    )

    tasks = list(tasks_qs.values(
        "id", "task_code", "title", "instructions"
    ))
    criteria = list(criteria_qs.values(
        "id", "criterion_code", "title", "description", "maximum_score"
    ))

    if not tasks:
        raise ValueError(
            f"Assignment '{assignment.assignment_code}' has no Tasks. "
            "Add tasks before running the mapping."
        )
    if not criteria:
        raise ValueError(
            f"Assignment '{assignment.assignment_code}' has no RubricCriteria. "
            "Add criteria before running the mapping."
        )

    # Build lookup dicts keyed by code
    task_map = {t["task_code"]: tasks_qs.get(task_code=t["task_code"]) for t in tasks}
    criterion_map = {
        c["criterion_code"]: criteria_qs.get(criterion_code=c["criterion_code"])
        for c in criteria
    }

    # ---- 2. Build prompts ------------------------------------------------
    system_prompt = _load_system_prompt()
    user_prompt = _build_user_prompt(
        assignment_code=assignment.assignment_code,
        assignment_title=assignment.assignment_title,
        assignment_level=assignment.get_level_display(),
        objective=assignment.objective or "",
        tasks=tasks,
        criteria=criteria,
    )

    logger.info(
        "Running task-criteria mapping for assignment=%s (%d tasks, %d criteria)",
        assignment.assignment_code,
        len(tasks),
        len(criteria),
    )

    # ---- 3. Call OpenAI ---------------------------------------------------
    try:
        raw_response = request_assessment(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            model="gpt-4o",           # Use gpt-4o for complex structural reasoning
            max_tokens=4096,
            temperature=0.0,           # Deterministic — accuracy over creativity
            top_p=1.0,
        )
    except Exception as exc:
        logger.error("OpenAI call failed: %s", exc)
        raise RuntimeError(f"OpenAI API call failed: {exc}") from exc

    # ---- 4. Validate response ---------------------------------------------
    validation_errors = _validate_response(raw_response, tasks, criteria)
    if validation_errors:
        logger.warning(
            "Mapping validation issues for %s: %s",
            assignment.assignment_code,
            validation_errors,
        )
        # Non-fatal — proceed with what we have, but surface warnings

    # ---- 5. Persist -------------------------------------------------------
    created, updated = _save_mappings(
        assignment=assignment,
        data=raw_response,
        task_map=task_map,
        criterion_map=criterion_map,
    )

    logger.info(
        "Mapping complete for %s: created=%d updated=%d",
        assignment.assignment_code,
        created,
        updated,
    )

    return {
        "assignment_code": assignment.assignment_code,
        "created": created,
        "updated": updated,
        "mapping_rationale": raw_response.get("mapping_rationale", ""),
        "validation_warnings": validation_errors,
        "mappings": raw_response.get("mappings", []),
    }
