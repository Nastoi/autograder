import { getCsrfToken } from "./auth";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:8000/api";



async function fetchAllPaginatedResults<T>(
  initialUrl: string,
  errorMessage: string,
): Promise<T[]> {
  const results: T[] = [];
  let nextUrl: string | null = initialUrl;

  while (nextUrl) {
    const response = await fetch(nextUrl, {
      method: "GET",
      credentials: "include",
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        typeof data?.detail === "string"
          ? data.detail
          : errorMessage,
      );
    }

    if (Array.isArray(data)) {
      results.push(...data);
      break;
    }

    if (
      data &&
      typeof data === "object" &&
      Array.isArray(data.results)
    ) {
      results.push(...data.results);
      nextUrl = data.next;
      continue;
    }

    throw new Error("Invalid API response.");
  }

  return results;
}

export type TaskCriteriaMapping = {
  id: string;
  assignment_level: string;
  assignment_level_id: string;
  task: string;
  task_code: string;
  rubric_criterion: string;
  criterion_code: string;
  inferred_weight: string;
  ai_explanation: string;
  created_at: string;
};

export type SaveTaskCriteriaMappingInput = {
  assignment_level: string;
  task: string;
  rubric_criterion: string;
  inferred_weight: string;
  ai_explanation: string;
};

export async function getTaskCriteriaMappings(
  assignmentLevelId?: string,
): Promise<TaskCriteriaMapping[]> {
  const query = assignmentLevelId
    ? `?assignment_level_id=${encodeURIComponent(assignmentLevelId)}`
    : "";

  return fetchAllPaginatedResults<TaskCriteriaMapping>(
    `${API_BASE_URL}/grading/task-criteria-mappings/${query}`,
    "Unable to load task-to-rubric mappings.",
  );
}

export async function createTaskCriteriaMapping(
  input: SaveTaskCriteriaMappingInput,
): Promise<TaskCriteriaMapping> {
  const csrfToken = await getCsrfToken();

  const response = await fetch(
    `${API_BASE_URL}/grading/task-criteria-mappings/`,
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
        : "Unable to create task-to-rubric mapping.",
    );
  }

  return data as TaskCriteriaMapping;
}

export async function updateTaskCriteriaMapping(
  mappingId: string,
  input: Partial<SaveTaskCriteriaMappingInput>,
): Promise<TaskCriteriaMapping> {
  const csrfToken = await getCsrfToken();

  const response = await fetch(
    `${API_BASE_URL}/grading/task-criteria-mappings/${mappingId}/`,
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
        : "Unable to update task-to-rubric mapping.",
    );
  }

  return data as TaskCriteriaMapping;
}

export async function deleteTaskCriteriaMapping(
  mappingId: string,
): Promise<void> {
  const csrfToken = await getCsrfToken();

  const response = await fetch(
    `${API_BASE_URL}/grading/task-criteria-mappings/${mappingId}/`,
    {
      method: "DELETE",
      credentials: "include",
      headers: {
        "X-CSRFToken": csrfToken,
      },
    },
  );

  if (response.status === 204) {
    return;
  }

  let message = "Unable to delete task-to-rubric mapping.";

  try {
    const data = await response.json();

    if (typeof data?.detail === "string") {
      message = data.detail;
    }
  } catch {
    // Keep default message.
  }

  throw new Error(message);
}
