import { getCsrfToken } from "./auth";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
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

};

export type CriterionResult = {
  id: string;
  rubric_criterion: string;
  awarded_marks: string;
  achievement_band:
    | "failed"
    | "foundation"
    | "proficient"
    | "expert"
    | "";
  feedback: string;
  created_at: string;
};

export type SubmissionTrack = "basic" | "advanced";

export type Submission = {
  id: string;
  context_id: string;
  assignment_code: string;
  assignment_title: string;
  submission_track: SubmissionTrack;
  original_filename: string;
  attempt_number: number;
  status:
  | "uploaded"
  | "processing"
  | "graded"
  | "completed"
  | "failed"
  | "error"
  | "manual_review";
  final_score: string | null;
  maximum_score: string | null;
  achieved_band: string;
  feedback: string;
  is_manual_override: boolean;
  manual_override_by: string | null;
  criterion_results: CriterionResult[];
  submitted_at: string;
  completed_at: string | null;
};

export type AttemptPolicy = {
  can_submit: boolean;
  limited_mode: boolean;
  attempts_used: number;
  attempts_remaining: number | null;
  first_pass_attempt: number | null;
  best_score: string | null;
};

export type MappingSubmissionHistory = {
  submissions: Submission[];
  attempt_policy: AttemptPolicy;
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
    "assignment" in data
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
    "submission_track" in data &&
    "original_filename" in data &&
    "attempt_number" in data &&
    "status" in data &&
    "final_score" in data &&
    "maximum_score" in data &&
    "achieved_band" in data &&
    "feedback" in data &&
    "is_manual_override" in data &&
    "manual_override_by" in data &&
    "criterion_results" in data &&
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
    const detail = data.detail.toLowerCase();

    if (
      detail.includes("authentication") ||
      detail.includes("credentials") ||
      detail.includes("csrf") ||
      detail.includes("unauthorized") ||
      detail.includes("forbidden")
    ) {
      return (
        "Your session may have expired. "
        + "Please refresh the page and try again. "
        + "If the issue continues, please log in again."
      );
    }

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
  submissionTrack: SubmissionTrack,
): Promise<Submission> {
  const csrfToken = await getCsrfToken();

  const formData = new FormData();
  formData.append("submitted_file", file);
  formData.append("submission_track", submissionTrack);

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
        "We couldn't start grading right now. Please wait a few minutes and try again.",
      )
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


export type MappingResolvedContext = {
  context_id: string;
  mapping_id: string;

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

  assignment: {
    id: string;
    code: string;
    title: string;
    maximum_score: string;
  };
  assignment_level: {
    id: string;
    level_code: "basic" | "advanced";
    display_name: string;
  };
};

export async function resolveMappingContext(
  mappingId: string,
  assignmentLevelId: string,
): Promise<MappingResolvedContext> {
  const csrfToken = await getCsrfToken();

  const response = await fetch(
    `${API_BASE_URL}/submissions/mapping/${mappingId}/context/`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": csrfToken,
      },
      body: JSON.stringify({
        assignment_level: assignmentLevelId,
      }),
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      typeof data?.detail === "string"
        ? data.detail
        : "Unable to prepare submission.",
    );
  }

  return data as MappingResolvedContext;
}


export async function getMappingSubmissionHistory(
  mappingId: string,
): Promise<MappingSubmissionHistory> {
  const response = await fetch(
    `${API_BASE_URL}/submissions/mapping/${mappingId}/attempts/`,
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
        "Unable to load previous attempts.",
      ),
    );
  }

  if (
    typeof data !== "object" ||
    data === null ||
    !("submissions" in data) ||
    !("attempt_policy" in data) ||
    !Array.isArray(data.submissions)
  ) {
    throw new Error(
      "The server returned invalid submission history data.",
    );
  }

  const submissions =
    data.submissions.filter(isSubmission);

  if (submissions.length !== data.submissions.length) {
    throw new Error(
      "The server returned invalid submission history data.",
    );
  }

  return {
    submissions,
    attempt_policy:
      data.attempt_policy as AttemptPolicy,
  };
}