from pydantic import BaseModel, Field


# --- TASK MAPPING SCHEMAS ---
class TaskPageMapping(BaseModel):
    task_id: str = Field(description="Code of the assignment task (e.g., T-F-01)")
    task_description: str = Field(description="Summary of task instructions")
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
    justification: str = Field(
        description="Detailed explanation of why pages match or why evidence is missing."
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
    overall_summary: str