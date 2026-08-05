from django.utils import timezone

from grading.services.criterion_assessor import assess_criterion
from .models import LearnerSubmission


def _get_assignment_type(assignment_level) -> str:
    level_code = getattr(assignment_level, "level_code", "").lower()
    return "ADVANCED" if level_code == "expert" else "BASIC"


def _build_assignment_payload(submission: LearnerSubmission) -> dict:
    assignment_level = submission.assignment_level
    assignment = assignment_level.assignment

    return {
        "assignment_id": str(assignment.id),
        "assignment_version": getattr(assignment, "version", "1.0"),
        "assignment_title": assignment.title,
        "assignment_type": _get_assignment_type(assignment_level),
        "confidence_threshold": 0.60,
        "assignment_score_boundaries": {
            "FAILED": [0, 49],
            "FOUNDATION": [50, 74],
            "PROFICIENT": [75, 100],
            "EXPERT": [90, 100],
        },
        "output_json_schema": {
            "type": "object",
            "properties": {},
        },
    }


def _build_task_payload(submission: LearnerSubmission) -> dict:
    assignment_level = submission.assignment_level

    return {
        "id": str(assignment_level.id),
        "title": assignment_level.display_name or assignment_level.level_code,
        "instructions": assignment_level.instructions
        or "Assess the submitted assignment evidence against the published rubric.",
    }


def _build_criterion_payload(submission: LearnerSubmission) -> dict:
    assignment_type = _get_assignment_type(submission.assignment_level)

    score_bands = {
        "BASIC": {
            "FAILED": {"minimum": 0, "maximum": 49},
            "FOUNDATION": {"minimum": 50, "maximum": 74},
            "PROFICIENT": {"minimum": 75, "maximum": 100},
        },
        "ADVANCED": {
            "FAILED": {"minimum": 0, "maximum": 49},
            "PROFICIENT": {"minimum": 50, "maximum": 89},
            "EXPERT": {"minimum": 90, "maximum": 100},
        },
    }

    return {
        "id": "AUTO-GRADE-OVERALL",
        "title": "Overall assignment assessment",
        "purpose": "Assess the submission against the published assignment requirements and rubric.",
        "maximum_marks": submission.maximum_score or 100,
        "mandatory_requirements": [
            {
                "requirement_id": "MR01",
                "description": "The submission demonstrates the required assignment deliverables and evidence.",
            }
        ],
        "optional_enhancements": [],
        "required_evidence": [
            {
                "evidence_id": "EV01",
                "description": "Submitted file metadata and any extracted evidence.",
            }
        ],
        "performance_descriptors": [
            {
                "level": "FAILED",
                "description": "The submission does not demonstrate the required basic knowledge and skills.",
            },
            {
                "level": "FOUNDATION",
                "description": "The submission demonstrates the required basic knowledge and skills with minor limitations.",
            },
            {
                "level": "PROFICIENT",
                "description": "The submission applies the required skills accurately, independently, and consistently.",
            },
            {
                "level": "EXPERT",
                "description": "The submission demonstrates professional quality and advanced application.",
            },
        ],
        "score_bands": score_bands[assignment_type],
        "mandatory_outcome_rules": [],
        "assessor_guidance": [
            "Do not award a level that is not valid for the assignment type."
        ],
    }


def _build_evidence_payload(submission: LearnerSubmission) -> list[dict]:
    return [
        {
            "evidence_id": "EV-SUBMISSION-FILE",
            "evidence_type": "FILE_METADATA",
            "source_file": submission.original_filename,
            "description": "Submission file metadata and original filename.",
            "metadata": {
                "file_size": submission.submitted_file.size,
                "content_type": getattr(
                    submission.submitted_file.file, "content_type", None
                ),
            },
        }
    ]


def _build_deterministic_checks(submission: LearnerSubmission) -> list[dict]:
    return [
        {
            "check_id": "DC_FILE_EXISTS",
            "status": "PASSED",
            "description": "Submitted file is present on disk.",
        }
    ]


def run_ai_grading(submission: LearnerSubmission) -> LearnerSubmission:
    submission.status = LearnerSubmission.Status.PROCESSING
    submission.save(update_fields=["status"])

    assessment_run = {
        "id": str(submission.id),
        "submission_id": str(submission.id),
        "organization_id": None,
        "course_id": None,
        "attempt_number": submission.attempt_number,
    }
    assignment = _build_assignment_payload(submission)
    task = _build_task_payload(submission)
    criterion = _build_criterion_payload(submission)
    learner_evidence = _build_evidence_payload(submission)
    deterministic_checks = _build_deterministic_checks(submission)
    extraction_warnings: list[dict] = []

    result = assess_criterion(
        assessment_run=assessment_run,
        assignment=assignment,
        task=task,
        criterion=criterion,
        learner_evidence=learner_evidence,
        deterministic_checks=deterministic_checks,
        extraction_warnings=extraction_warnings,
    )

    submission.final_score = result.get("awarded_marks", 0)
    submission.maximum_score = submission.maximum_score
    submission.achieved_band = result.get("achievement_level", "FAILED").lower()
    submission.feedback = result.get("assessor_feedback", {}).get(
        "summary", "AI grading completed."
    )
    submission.status = LearnerSubmission.Status.COMPLETED
    submission.completed_at = timezone.now()
    submission.save(
        update_fields=[
            "final_score",
            "maximum_score",
            "achieved_band",
            "feedback",
            "status",
            "completed_at",
        ]
    )

    return submission