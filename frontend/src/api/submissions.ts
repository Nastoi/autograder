import { getCsrfToken } from "./auth";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  "http://localhost:8000/api";

type ApiError = {
  detail?: string;
};

export type SubmissionContext = {
  context_id: string;

  learner: {
    id: number;
    username: string;
    name: string;
    email: string;
  };

  cohort: {
    id: number;
    code: string;
    name: string;
  };

  module: {
    id: string;
    code: string;
    name: string;
  };

  assignment: {
    id: string;
    code: string;
    title: string;
    maximum_score: string;
  };

  assignment_level: {
    id: string;
    level_code: string;
    display_name: string;
  };
};

export type Submission = {
  id: string;
  context_id: string;
  assignment_code: string;
  assignment_title: string;
  level: string;
  original_filename: string;
  attempt_number: number;
  status:
    | "uploaded"
    | "processing"
    | "completed"
    | "failed"
    | "manual_review";
  final_score: string | null;
  maximum_score: string | null;
  achieved_band: string;
  feedback: string;
  submitted_at: string;
  completed_at: string | null;
};

async function readJson<T>(
  response: Response,
): Promise<T | null> {
  const contentType = response.headers.get("content-type");

  if (!contentType?.includes("application/json")) {
    return null;
  }

  return (await response.json()) as T;
}

function isApiError(
  data: unknown,
): data is ApiError {
  return (
    typeof data === "object" &&
    data !== null &&
    "detail" in data
  );
}

function isSubmissionContext(
  data: unknown,
): data is SubmissionContext {
  if (typeof data !== "object" || data === null) {
    return false;
  }

  return (
    "context_id" in data &&
    "learner" in data &&
    "cohort" in data &&
    "module" in data &&
    "assignment" in data &&
    "assignment_level" in data
  );
}

function isSubmission(
  data: unknown,
): data is Submission {
  if (typeof data !== "object" || data === null) {
    return false;
  }

  return (
    "id" in data &&
    "context_id" in data &&
    "assignment_code" in data &&
    "assignment_title" in data &&
    "level" in data &&
    "original_filename" in data &&
    "attempt_number" in data &&
    "status" in data &&
    "final_score" in data &&
    "maximum_score" in data &&
    "achieved_band" in data &&
    "feedback" in data &&
    "submitted_at" in data &&
    "completed_at" in data
  );
}

function getErrorMessage(
  data: unknown,
  fallback: string,
): string {
  if (
    isApiError(data) &&
    typeof data.detail === "string" &&
    data.detail.length > 0
  ) {
    return data.detail;
  }

  return fallback;
}

export async function getSubmissionContext(
  contextId: string,
): Promise<SubmissionContext> {
  const response = await fetch(
    `${API_BASE_URL}/submissions/context/${contextId}/`,
    {
      method: "GET",
      credentials: "include",
    },
  );

  const data = await readJson<unknown>(response);

  if (!response.ok) {
    throw new Error(
      getErrorMessage(
        data,
        "Unable to load submission details.",
      ),
    );
  }

  if (!isSubmissionContext(data)) {
    throw new Error(
      "The server returned invalid submission context data.",
    );
  }

  return data;
}

export async function submitAssignment(
  contextId: string,
  file: File,
): Promise<Submission> {
  const csrfToken = await getCsrfToken();

  const formData = new FormData();
  formData.append("submitted_file", file);

  const response = await fetch(
    `${API_BASE_URL}/submissions/context/${contextId}/submit/`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "X-CSRFToken": csrfToken,
      },
      body: formData,
    },
  );

  const data = await readJson<unknown>(response);

  if (!response.ok) {
    throw new Error(
      getErrorMessage(
        data,
        "Submission failed.",
      ),
    );
  }

  if (!isSubmission(data)) {
    throw new Error(
      "The server did not return a valid submission.",
    );
  }

  return data;
}

export async function getSubmission(
  submissionId: string,
): Promise<Submission> {
  const response = await fetch(
    `${API_BASE_URL}/submissions/${submissionId}/`,
    {
      method: "GET",
      credentials: "include",
    },
  );

  const data = await readJson<unknown>(response);

  if (!response.ok) {
    throw new Error(
      getErrorMessage(
        data,
        "Unable to load submission.",
      ),
    );
  }

  if (!isSubmission(data)) {
    throw new Error(
      "The server did not return valid submission data.",
    );
  }

  return data;
}