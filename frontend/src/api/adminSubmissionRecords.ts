const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  "http://localhost:8000/api";


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

export type OpenAITokenUsage = {
  input_tokens: number;
  cached_input_tokens: number;
  output_tokens: number;
  reasoning_tokens: number;
  total_tokens: number;
};

export type OpenAITokenUsageCall = OpenAITokenUsage & {
  stage: string;
};

export type AttemptTokenUsage = {
  task_mapping?: OpenAITokenUsage;
  grading?: {
    calls?: OpenAITokenUsageCall[];
    total?: OpenAITokenUsage;
  };
  total?: OpenAITokenUsage;
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
    token_usage?: AttemptTokenUsage;
    [key: string]: unknown;
  };
  overall_summary: string;
  error_code: string;
  error_message: string;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
};

export type AdminCriterionResult = {
  id: string;
  rubric_criterion: string;
  criterion_code: string;
  criterion_title: string;
  awarded_marks: string;
  maximum_score: string;
  achievement_band: string;
  feedback: string;
};

export type AdminSubmissionAttempt = {
  id: string;
  attempt_number: number;
  level_code: string;
  level_name: string;
  status: string;
  status_display: string;
  final_score: string | null;
  maximum_score: string | null;
  feedback: string;
  achieved_band: string;
  original_filename: string;
  submitted_at: string;
  completed_at: string | null;
  grading_audit: SubmissionGradingAudit | null;
  process_logs: SubmissionProcessLogEntry[];
  is_manual_review?: boolean;
  manual_reviewer?: string | null;
  criterion_results?: AdminCriterionResult[];
};

export type AdminSubmissionLearner = {
  id: string;
  learner_id: string;
  username: string;
  name: string;
  email: string;
  attempts: AdminSubmissionAttempt[];
};

export type AdminSubmissionAssignment = {
  id: string;
  code: string;
  title: string;
  unique_learners: number;
  total_attempts: number;
  latest_result_counts?: {
    failed: number;
    foundation: number;
    proficient_basic: number;
    proficient_advanced: number;
    expert: number;
  };
  learners: AdminSubmissionLearner[];
};

export type AdminSubmissionCohort = {
  id: string;
  code: string;
  name: string;
  assignments: AdminSubmissionAssignment[];
};

export type AdminGradebookLearner = {
  id: string;
  learner_id: string;
  username: string;
  name: string;
  email: string;
};

export type AdminGradebookCohort = {
  id: string;
  code: string;
  name: string;
  learners: AdminGradebookLearner[];
};

export type AdminSubmissionRecordsResponse = {
  cohorts: AdminSubmissionCohort[];
  gradebook_cohorts: AdminGradebookCohort[];
  summary: {
    cohorts: number;
    assignments: number;
    unique_learners: number;
    total_attempts: number;
  };
};

export async function getAdminSubmissionRecords(): Promise<AdminSubmissionRecordsResponse> {
  const response = await fetch(
    `${API_BASE_URL}/submissions/admin-records/`,
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
        : "Unable to load submission records.",
    );
  }

  return data as AdminSubmissionRecordsResponse;
}
