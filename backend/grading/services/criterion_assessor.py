from typing import List

from .prompt_builder import build_criterion_prompt
from .openai_client import request_assessment


def assess_criterion(
    *,
    assessment_run: dict,
    assignment: dict,
    task: dict,
    criterion: dict,
    learner_evidence: List[dict],
    deterministic_checks: List[dict],
    extraction_warnings: List[dict],
    previous_result: dict | None = None,
) -> dict:
    prompt_package = build_criterion_prompt(
        assessment_run=assessment_run,
        assignment=assignment,
        task=task,
        criterion=criterion,
        learner_evidence=learner_evidence,
        deterministic_checks=deterministic_checks,
        extraction_warnings=extraction_warnings,
        previous_result=previous_result,
    )

    result = request_assessment(
        system_prompt=prompt_package["system_prompt"],
        user_prompt=prompt_package["user_prompt"],
    )

    return result
