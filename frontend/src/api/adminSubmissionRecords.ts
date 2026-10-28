const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  "http://localhost:8000/api";


export type AdminSubmissionCohortDetail = {
  id: string;
  code: string;
  name: string;
  assignments: AdminSubmissionAssignment[];
};

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
  grading_audit?: SubmissionGradingAudit | null;
  process_logs?: SubmissionProcessLogEntry[];
  is_manual_review?: boolean;
  manual_reviewer?: string | null;
  criterion_results?: AdminCriterionResult[];
};


export type AdminSubmissionRecordDetail = {
  id: string;
  feedback: string;
  grading_audit: SubmissionGradingAudit | null;
  process_logs: SubmissionProcessLogEntry[];
  criterion_results: AdminCriterionResult[];
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
  learners: AdminSubmissionLearner[];
};

export type AdminSubmissionCohort = {
  id: string;
  code: string;
  name: string;
  assignment_count: number;
  unique_learners: number;
  total_attempts: number;
  assignments: AdminSubmissionAssignment[];
};

export async function getAdminSubmissionRecordCohortDetail(
  cohortId: string,
  params: {
    search?: string;
    assignmentId?: string;
  } = {},
): Promise<AdminSubmissionCohortDetail> {
  const query = new URLSearchParams();

  if (params.search?.trim()) {
    query.set("search", params.search.trim());
  }

  if (params.assignmentId) {
    query.set("assignment_id", params.assignmentId);
  }

  const response = await fetch(
    `${API_BASE_URL}/submissions/admin-records/cohorts/${cohortId}/?${query.toString()}`,
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
        : "Unable to load cohort submission records.",
    );
  }

  return data as AdminSubmissionCohortDetail;
}

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

export type AdminGradebookAssignmentScore = {
  assignment_id: string;
  submission_id: string;
  attempt_number: number;
  final_score: string | null;
  maximum_score: string | null;
  achieved_band: string;
  status: string;
  submitted_at: string;
};

export type AdminGradebookResultLearner = {
  id: string;
  learner_id: string;
  username: string;
  name: string;
  email: string;
  assignment_scores: AdminGradebookAssignmentScore[];
};

export type AdminGradebookResultCohort = {
  id: string;
  code: string;
  name: string;
  learners: AdminGradebookResultLearner[];
};

export type AdminGradebookResponse = {
  cohorts: AdminGradebookResultCohort[];
};

export type AdminSubmissionRecordsResponse = {
  count: number;
  next: string | null;
  previous: string | null;
  page: number;
  page_size: number;
  total_pages: number;
  cohorts: AdminSubmissionCohort[];
  gradebook_cohorts: AdminGradebookCohort[];
  summary: {
    cohorts: number;
    assignments: number;
    unique_learners: number;
    total_attempts: number;
  };
  filter_options: {
    cohorts: Array<{
      id: string;
      code: string;
      name: string;
    }>;
    assignments: Array<{
      id: string;
      code: string;
      title: string;
    }>;
  };
};

export type AdminSubmissionRecordsParams = {
  page?: number;
  search?: string;
  cohortId?: string;
  assignmentId?: string;
};

export async function getAdminSubmissionRecords(
  params: AdminSubmissionRecordsParams = {},
): Promise<AdminSubmissionRecordsResponse> {
  const query = new URLSearchParams();

  query.set("page", String(params.page ?? 1));

  if (params.search?.trim()) {
    query.set("search", params.search.trim());
  }

  if (params.cohortId) {
    query.set("cohort_id", params.cohortId);
  }

  if (params.assignmentId) {
    query.set("assignment_id", params.assignmentId);
  }

  const response = await fetch(
    `${API_BASE_URL}/submissions/admin-records/?${query.toString()}`,
    {
      method: "GET",
      credentials: "include",
    },
  );

  const text = await response.text();

  let data: unknown;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(
      response.ok
        ? "The server returned an incomplete response."
        : "Unable to load submission records.",
    );
  }

  if (!response.ok) {
    const detail =
      data &&
      typeof data === "object" &&
      "detail" in data &&
      typeof (data as { detail?: unknown }).detail === "string"
        ? (data as { detail: string }).detail
        : null;

    throw new Error(
      detail || "Unable to load submission records.",
    );
  }

  return data as AdminSubmissionRecordsResponse;
}

export async function getAdminGradebook(
  cohortId?: string,
): Promise<AdminGradebookResponse> {
  const query = new URLSearchParams();

  if (cohortId) {
    query.set("cohort_id", cohortId);
  }

  const suffix = query.toString()
    ? `?${query.toString()}`
    : "";

  const response = await fetch(
    `${API_BASE_URL}/submissions/admin-gradebook/${suffix}`,
    {
      method: "GET",
      credentials: "include",
    },
  );

  const text = await response.text();

  let data: unknown;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(
      response.ok
        ? "The server returned an incomplete response."
        : "Unable to load final gradebook.",
    );
  }

  if (!response.ok) {
    const detail =
      data &&
      typeof data === "object" &&
      "detail" in data &&
      typeof (data as { detail?: unknown }).detail === "string"
        ? (data as { detail: string }).detail
        : null;

    throw new Error(
      detail || "Unable to load final gradebook.",
    );
  }

  return data as AdminGradebookResponse;
}

export async function getAdminSubmissionRecordDetail(
  submissionId: string,
): Promise<AdminSubmissionRecordDetail> {
  const response = await fetch(
    `${API_BASE_URL}/submissions/admin-records/${submissionId}/`,
    {
      method: "GET",
      credentials: "include",
    },
  );

  const text = await response.text();

  let data: unknown;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(
      response.ok
        ? "The server returned an incomplete response."
        : "Unable to load submission details.",
    );
  }

  if (!response.ok) {
    const detail =
      data &&
      typeof data === "object" &&
      "detail" in data &&
      typeof (data as { detail?: unknown }).detail === "string"
        ? (data as { detail: string }).detail
        : null;

    throw new Error(
      detail || "Unable to load submission details.",
    );
  }

  return data as AdminSubmissionRecordDetail;
}