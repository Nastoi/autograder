const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

export type LogSource = "backend" | "celery" | "errors" | "grading";

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
