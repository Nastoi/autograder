const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:8000/api";

export type AssignmentDeleteImpact = {
  can_delete: boolean;

  blockers: {
    assessment_mappings: Array<{
      id: string;
      name: string;
      cohort: string;
    }>;
    submissions: number;
  };

  affected: {
    assignment_levels: number;
    tasks: number;
    rubric_criteria: number;
    rubric_bands: number;
    task_criteria_mappings: number;
    submission_contexts: number;
  };
};

export async function getAssignmentDeleteImpact(
  assignmentId: string,
): Promise<AssignmentDeleteImpact> {
  const response = await fetch(
    `${API_BASE_URL}/courses/assignments/${assignmentId}/delete-impact/`,
    {
      method: "GET",
      credentials: "include",
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      typeof data?.detail === "string"
        ? data.detail
        : "Unable to check assignment dependencies.",
    );
  }

  return data as AssignmentDeleteImpact;
}
