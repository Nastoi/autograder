from pydantic import BaseModel, Field

from typing import Literal

class TaskPageMapping(BaseModel):
    task_id: str = Field(
        description="Code of the assignment task (e.g., T-F-01)"
    )
    task_description: str = Field(
        description="Summary of required task evidence"
    )
    is_relevant: bool = Field(
        description="FALSE if the submitted document has no relevance to this task."
    )
    mapped_page_numbers: list[int] = Field(
        default_factory=list,
        description="PDF page numbers matching this task. Leave empty [] if not relevant.",
    )
    confidence_score: float = Field(
        description="0.0 if irrelevant, or 0.1-1.0 based on evidence strength."
    )

    evidence_type: Literal[
        "written",
        "visual",
        "mixed",
        "none",
    ] = Field(
        description=(
            "Primary type of evidence found for this task. "
            "'written' means descriptive/text evidence only; "
            "'visual' means direct visible artefact evidence; "
            "'mixed' means both written and direct visual evidence; "
            "'none' means no relevant evidence."
        )
    )

    visual_verification: bool = Field(
        description=(
            "TRUE only when the submitted rendered PDF pages directly show "
            "the observable artefact, feature, configuration, output, or state "
            "required by the task. Written descriptions or claims alone must be FALSE."
        )
    )

    justification: str = Field(
        description=(
            "Explain what evidence was found and clearly distinguish between "
            "what is described in text and what is visibly demonstrated."
        )
    )


class PDFTaskMappingResponseSchema(BaseModel):
    submission_id: str
    total_pdf_pages: int
    is_unrelated_document: bool = Field(
        description="TRUE if the uploaded PDF is completely unrelated to the subject matter."
    )
    task_mappings: list[TaskPageMapping]
    unmapped_pages: list[int]


# --- DISPATCH / GRADING SCHEMAS ---
class CriterionScore(BaseModel):
    task_code: str = Field(description="Code of the task being evaluated (e.g., T-F-01)")
    rubric_criterion_id: str = Field(description="UUID of the rubric criterion mapped to this task")
    score_percentage: float = Field(
        description="Percentage earned for this criterion based on quality (0.0 to 100.0)"
    )
    passed: bool = Field(description="Whether the learner met the criterion requirements")
    feedback: str = Field(description="Detailed grading justification based on evidence")


class GradingResponseSchema(BaseModel):
    submission_id: str
    criterion_evaluations: list[CriterionScore]
    overall_summary: str = Field(
        description=(
            "Holistic overall feedback synthesising performance across ALL "
            "task and criterion evaluations in the assignment. Summarise "
            "overall strengths, weaknesses, significant missing evidence, "
            "and alignment with the assignment objective. Do not focus only "
            "on one task or the final criterion."
        )
    )