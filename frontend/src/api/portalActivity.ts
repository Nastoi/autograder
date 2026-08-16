const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  "http://localhost:8000/api";

export type PortalActivity = {
  id: number;
  action: "created" | "updated" | "deleted";
  object_type: string;
  object_id: string;
  object_label: string;
  username: string | null;
  created_at: string;
};

export async function getPortalActivity(
  objectType: string,
  objectId: string,
): Promise<PortalActivity[]> {
  const params = new URLSearchParams({
    object_type: objectType,
    object_id: objectId,
  });

  const response = await fetch(
    `${API_BASE_URL}/auth/activity/?${params.toString()}`,
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
        : "Unable to load audit history.",
    );
  }

  return data as PortalActivity[];
}

export async function getRecentDeletedPortalActivity(): Promise<
  PortalActivity[]
> {
  const response = await fetch(
    `${API_BASE_URL}/auth/activity/deleted/`,
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
        : "Unable to load recently deleted records.",
    );
  }

  return data as PortalActivity[];
}
