const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

function getCookie(name: string): string | null {
  const cookies = document.cookie.split(";");

  for (const cookie of cookies) {
    const [key, ...rest] = cookie.trim().split("=");

    if (key === name) {
      return decodeURIComponent(rest.join("="));
    }
  }

  return null;
}


export type LogSource =
  | "backend"
  | "celery"
  | "errors"
  | "grading"
  | "queue";

export type GradingLogFilters = {
  cohort?: string;
  assignment?: string;
  learner?: string;
  attempt?: string;
  stage?: string;
  status?: string;
};

export type GradingLogFilterOptions = {
  cohorts: string[];
  assignments: string[];
  learners: string[];
  attempts: number[];
  stages: string[];
  statuses: string[];
};

export type PortalLogsResponse = {
  source: LogSource;
  lines: string[];
  message?: string | null;
  grading_filters?: GradingLogFilterOptions;
  queue_summary?: QueueSummary;
};

export async function getPortalLogs(
  source: LogSource,
  lines = 200,
  filters: GradingLogFilters = {},
): Promise<PortalLogsResponse> {
  const params = new URLSearchParams({
    source,
    lines: String(lines),
  });

  if (source === "grading") {
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
  }

  const response = await fetch(
    `${API_BASE_URL}/auth/logs/?${params.toString()}`,
    {
      method: "GET",
      credentials: "include",
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.detail ?? "Unable to load logs.");
  }

  return data as PortalLogsResponse;
}

export type QueueSummary = {
  queued: number;
  processing: number;
  total: number;
};

export type ProcessingSubmissionAction =
  | "terminate"
  | "terminate_requeue";

export type ProcessingSubmissionActionResponse = {
  detail: string;
  submission_id: string;
  status: string;
  celery_task_id?: string | null;
  previous_celery_task_id?: string | null;
  new_celery_task_id?: string | null;
};

export async function processSubmissionAction(
  submissionId: string,
  action: ProcessingSubmissionAction,
): Promise<ProcessingSubmissionActionResponse> {
  const csrfToken = getCookie("csrftoken");

  if (!csrfToken) {
    throw new Error(
      "CSRF token is unavailable. Please refresh the page and try again.",
    );
  }

  const response = await fetch(
    `${API_BASE_URL}/auth/logs/`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": csrfToken,
      },
      body: JSON.stringify({
        submission_id: submissionId,
        action,
      }),
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.detail ??
        "Unable to process submission action.",
    );
  }

  return data as ProcessingSubmissionActionResponse;
}