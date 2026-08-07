import json
from pathlib import Path
from typing import Any

from django.conf import settings
from django.template import Context, Template

PROMPTS_DIR = Path(settings.BASE_DIR) / "prompts"


def json_text(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2, default=str)


def load_prompt_template(filename: str) -> str:
    path = PROMPTS_DIR / filename
    path_text = path.read_text(encoding="utf-8")
    return path_text


def build_criterion_prompt(
    *,
    assessment_run: dict,
    assignment: dict,
    task: dict,
    criterion: dict,
    learner_evidence: list[dict],
    deterministic_checks: list[dict],
    extraction_warnings: list[dict],
    previous_result: dict | None = None,
) -> dict:
    system_prompt = load_prompt_template(
        "assessor_system_prompt.txt"
    )
    user_prompt_template = load_prompt_template(
        "criterion_assessment_prompt.txt"
    )

    context = {
        "assessment_run_id": assessment_run["id"],
        "organization_id": assessment_run.get("organization_id", ""),
        "course_id": assessment_run.get("course_id", ""),
        "assignment_id": assignment["assignment_id"],
        "assignment_version": assignment.get("assignment_version", ""),
        "assignment_title": assignment.get("assignment_title", ""),
        "assignment_type": assignment.get("assignment_type", ""),
        "submission_id": assessment_run["submission_id"],
        "attempt_number": assessment_run.get("attempt_number", 1),
        "criterion": criterion,
        "task": task,
        "integer_marks_only": True,
        "confidence_threshold": assignment.get(
            "confidence_threshold",
            0.60,
        ),
        "assignment_score_boundaries_json": json_text(
            assignment.get("assignment_score_boundaries", {})
        ),
        "mandatory_requirements_json": json_text(
            criterion.get("mandatory_requirements", [])
        ),
        "optional_enhancements_json": json_text(
            criterion.get("optional_enhancements", [])
        ),
        "required_evidence_json": json_text(
            criterion.get("required_evidence", [])
        ),
        "performance_descriptors_json": json_text(
            criterion.get("performance_descriptors", [])
        ),
        "criterion_score_bands_json": json_text(
            criterion.get("score_bands", {})
        ),
        "mandatory_outcome_rules_json": json_text(
            criterion.get("mandatory_outcome_rules", [])
        ),
        "assessor_guidance_json": json_text(
            criterion.get("assessor_guidance", [])
        ),
        "deterministic_checks_json": json_text(
            deterministic_checks
        ),
        "learner_evidence_json": json_text(learner_evidence),
        "extraction_warnings_json": json_text(
            extraction_warnings
        ),
        "previous_result_json": json_text(
            previous_result or {}
        ),
        "output_json_schema": json_text(
            assignment.get("output_json_schema", {})
        ),
    }

    user_prompt = Template(user_prompt_template).render(
        Context(context)
    )

    return {
        "system_prompt": system_prompt,
        "user_prompt": user_prompt,
    }
