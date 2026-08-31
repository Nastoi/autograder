import { getCsrfToken } from "./auth";
import { API_BASE_URL } from "./utils";

export type SubmissionProcessLogEntry = {
  id: string;
  stage: string;
  status: "started" | "success" | "warning" | "error" | string;
  event_code: string;
  message: string;
  details: Record<string, unknown>;
  created_at: string;
};

export type SubmissionAuditCriterionEvaluation = {
  task_code: string;
  rubric_criterion_id: string;
  score_percentage: number;
  inferred_weight: number;
  earned_points: number;
  criterion_max_score: number;
  passed: boolean;
  feedback: string;
  mapped_page_numbers: number[];
  mapping_confidence: number;
  mapping_justification: string;
};

export type SubmissionGradingAudit = {
  status: "started" | "completed" | "error" | string;
  model_name: string;
  grader_version: string;
  task_mapping_snapshot: Record<string, unknown>;
  raw_ai_response: Record<string, unknown>;
  criterion_evaluations: SubmissionAuditCriterionEvaluation[];
  scoring_snapshot: {
    total_earned_points?: number | null;
    total_max_possible_points?: number | null;
    overall_percentage?: number | null;
    achieved_band?: string | null;
    [key: string]: unknown;
  };
  overall_summary: string;
  error_code: string;
  error_message: string;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
};

export type InstructorConfiguredCriterion = {
  rubric_criterion: string;
  criterion_code: string;
  criterion_title: string;
  maximum_score: string;
};

export type InstructorCriterionResult = {
  id: string;
  rubric_criterion: string;
  criterion_code: string;
  criterion_title: string;
  awarded_marks: string;
  maximum_score: string;
  achievement_band: string;
  feedback: string;
};

export type InstructorMappingAttempt = {
  id: string;
  attempt_number: number;
  level_code: string;
  level_name: string;
  status: string;
  status_display: string;
  final_score: string | null;
  maximum_score: string | null;
  achieved_band: string;
  feedback: string;
  original_filename: string;
  has_submitted_file: boolean;
  submitted_at: string;
  completed_at: string | null;
  criterion_results: InstructorCriterionResult[];
  grading_audit: SubmissionGradingAudit | null;
  process_logs: SubmissionProcessLogEntry[];
  is_manual_override: boolean;
  manual_override_by: string | null;
  configured_criteria: InstructorConfiguredCriterion[];
};

export type InstructorMappingLearner = {
  id: string;
  learner_id: string;
  name: string;
  email: string;
  attempts: InstructorMappingAttempt[];
};

export type InstructorMappingDashboard = {
  mapping: {
    id: string;
    cohort_code: string;
    cohort_name: string;
    assignment_code: string;
    assignment_title: string;
    due_date: string | null;
    deadline_passed: boolean;
    lms_platform_url: string;
    lms_course_id: string;
    lms_resource_link_id: string;
  };
  learners: InstructorMappingLearner[];
};

export async function getInstructorMappingDashboard(
  mappingId: string,
): Promise<InstructorMappingDashboard> {
  const response = await fetch(
    `${API_BASE_URL}/lms/assessment-mappings/${mappingId}/instructor/`,
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
        : "Unable to load instructor submission view.",
    );
  }

  return data as InstructorMappingDashboard;
}

export type SyncInstructorMappingDueDateInput = {
  course_id: string;
  resource_link_id: string;
  due_date: string | null;
};

export type SyncedInstructorMappingDueDate = {
  id: string;
  due_date: string | null;
  deadline_passed: boolean;
};

export async function syncInstructorMappingDueDate(
  mappingId: string,
  input: SyncInstructorMappingDueDateInput,
): Promise<SyncedInstructorMappingDueDate> {
  const csrfToken = await getCsrfToken();

  const response = await fetch(
    `${API_BASE_URL}/lms/assessment-mappings/${mappingId}/instructor/`,
    {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": csrfToken,
      },
      body: JSON.stringify(input),
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      typeof data?.detail === "string"
        ? data.detail
        : "Unable to sync the LMS due date.",
    );
  }

  return data as SyncedInstructorMappingDueDate;
}

export async function downloadInstructorSubmission(
  mappingId: string,
  submissionId: string,
  fallbackFilename: string,
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/lms/assessment-mappings/${mappingId}/instructor/submissions/${submissionId}/download/`,
    {
      method: "GET",
      credentials: "include",
    },
  );

  if (!response.ok) {
    let message = "Unable to download the learner submission.";

    try {
      const data = await response.json();

      if (typeof data?.detail === "string") {
        message = data.detail;
      }
    } catch {
      // Keep the default message.
    }

    throw new Error(message);
  }

  const blob = await response.blob();
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = objectUrl;
  link.download = fallbackFilename || "submission";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(objectUrl);
}

export type InstructorGradeOverrideCriterionInput = {
  rubric_criterion: string;
  awarded_marks: string;
  feedback: string;
};

export type InstructorGradeOverrideInput = {
  overall_feedback: string;
  criteria: InstructorGradeOverrideCriterionInput[];
};

export type InstructorGradeOverrideResult = {
  id: string;
  attempt_number: number;
  final_score: string;
  maximum_score: string;
  overall_percentage: number;
  achieved_band: string;
  feedback: string;
  ags_queued: boolean;
};

export async function createInstructorGradeOverride(
  mappingId: string,
  submissionId: string,
  input: InstructorGradeOverrideInput,
): Promise<InstructorGradeOverrideResult> {
  const csrfToken = await getCsrfToken();

  const response = await fetch(
    `${API_BASE_URL}/lms/assessment-mappings/${mappingId}/instructor/submissions/${submissionId}/override/`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": csrfToken,
      },
      body: JSON.stringify(input),
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      typeof data?.detail === "string"
        ? data.detail
        : "Unable to save the faculty grade override.",
    );
  }

  return data as InstructorGradeOverrideResult;
}

export async function updateInstructorResultVisibility(
  mappingId: string,
  showResultToLearner: boolean,
): Promise<{
  show_result_to_learner: boolean;
}> {
  const csrfToken = await getCsrfToken();

  const response = await fetch(
    `${API_BASE_URL}/lms/assessment-mappings/${mappingId}/instructor/`,
    {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": csrfToken,
      },
      body: JSON.stringify({
        show_result_to_learner: showResultToLearner,
      }),
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      typeof data?.detail === "string"
        ? data.detail
        : "Unable to update learner result visibility.",
    );
  }

  return data as {
    show_result_to_learner: boolean;
  };
}
