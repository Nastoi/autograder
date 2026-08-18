const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

export type LogSource = "backend" | "celery" | "errors";

export type PortalLogsResponse = {
  source: LogSource;
  lines: string[];
  message?: string;
};

export async function getPortalLogs(
  source: LogSource,
  lines = 200,
): Promise<PortalLogsResponse> {
  const params = new URLSearchParams({
    source,
    lines: String(lines),
  });

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
