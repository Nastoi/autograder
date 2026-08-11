from pydantic import BaseModel, Field


class CriterionEvaluation(BaseModel):
    criterion_name: str = Field(description="Name of the evaluated criterion")
    passed: bool = Field(description="Whether the criteria was met")
    score: float = Field(description="Score awarded (0.0 to 10.0)")
    reasoning: str = Field(description="Explanation based on text and images")


class GradingResponseSchema(BaseModel):
    overall_score: float = Field(description="Overall total score out of 100")
    overall_feedback: str = Field(description="Summary feedback for the submission")
    confidence_score: float = Field(description="Confidence rating from 0.0 to 1.0")
    criteria_evaluations: list[CriterionEvaluation] = Field(
        description="List of rubric items evaluated"
    )
    funny_quote: str = Field(description="A funny quote for test purposes")