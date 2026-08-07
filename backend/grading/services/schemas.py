from enum import Enum
from pydantic import BaseModel, Field, model_validator


class AssignmentType(str, Enum):
    BASIC = "BASIC"
    ADVANCED = "ADVANCED"


class AchievementLevel(str, Enum):
    FAILED = "FAILED"
    FOUNDATION = "FOUNDATION"
    PROFICIENT = "PROFICIENT"
    EXPERT = "EXPERT"


class RequirementStatus(str, Enum):
    MET = "MET"
    PARTIALLY_MET = "PARTIALLY_MET"
    NOT_MET = "NOT_MET"
    NOT_VERIFIABLE = "NOT_VERIFIABLE"


class EvidenceStatus(str, Enum):
    VERIFIED = "VERIFIED"
    PARTIALLY_VERIFIED = "PARTIALLY_VERIFIED"
    NOT_FOUND = "NOT_FOUND"
    UNREADABLE = "UNREADABLE"
    CONFLICTING = "CONFLICTING"
    NOT_RELEVANT = "NOT_RELEVANT"


class CriterionDecision(str, Enum):
    MET = "MET"
    PARTIALLY_MET = "PARTIALLY_MET"
    NOT_MET = "NOT_MET"
    REVIEW_REQUIRED = "REVIEW_REQUIRED"


class RequirementAssessment(BaseModel):
    requirement_id: str
    status: RequirementStatus
    evidence_ids: list[str] = Field(default_factory=list)
    reason: str


class EvidenceAssessment(BaseModel):
    evidence_id: str
    status: EvidenceStatus
    relevance: str
    description: str
    supports: list[str] = Field(default_factory=list)


class FeedbackItem(BaseModel):
    statement: str | None = None
    issue: str | None = None
    action: str | None = None
    evidence_ids: list[str] = Field(default_factory=list)


class MissingEvidence(BaseModel):
    requirement_id: str
    description: str
    impact: str


class ConflictItem(BaseModel):
    description: str
    evidence_ids: list[str]
    impact: str


class AssessorFeedback(BaseModel):
    summary: str
    most_important_next_step: str


class RubricAlignment(BaseModel):
    selected_descriptor_summary: str
    higher_level_not_awarded_reason: str


class CriterionAssessmentResponse(BaseModel):
    assessment_run_id: str
    submission_id: str
    criterion_id: str
    criterion_title: str
    assignment_type: AssignmentType
    maximum_marks: int = Field(ge=0)
    awarded_marks: int = Field(ge=0)
    achievement_level: AchievementLevel
    criterion_decision: CriterionDecision
    mandatory_requirements: list[RequirementAssessment]
    evidence_assessment: list[EvidenceAssessment]
    strengths: list[FeedbackItem]
    improvements: list[FeedbackItem]
    missing_evidence: list[MissingEvidence]
    conflicts: list[ConflictItem]
    assessor_feedback: AssessorFeedback
    confidence: float = Field(ge=0.0, le=1.0)
    review_required: bool
    review_reasons: list[str]
    rubric_alignment: RubricAlignment

    @model_validator(mode="after")
    def validate_result(self):
        if self.awarded_marks > self.maximum_marks:
            raise ValueError(
                "awarded_marks cannot exceed maximum_marks"
            )

        if (
            self.assignment_type == AssignmentType.BASIC
            and self.achievement_level == AchievementLevel.EXPERT
        ):
            raise ValueError(
                "EXPERT is not valid for a BASIC assignment"
            )

        if (
            self.assignment_type == AssignmentType.ADVANCED
            and self.achievement_level == AchievementLevel.FOUNDATION
        ):
            raise ValueError(
                "FOUNDATION is not valid for an ADVANCED assignment"
            )

        if self.confidence < 0.60 and not self.review_required:
            raise ValueError(
                "review_required must be true when confidence is below 0.60"
            )

        return self
