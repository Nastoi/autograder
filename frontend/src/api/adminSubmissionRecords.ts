const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  "http://localhost:8000/api";

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
