import { getCsrfToken } from "./auth";



const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  "http://localhost:8000/api";

export type AssessmentMapping = {
  id: string;
  name: string;

  cohort: number;
  cohort_code: string;
  cohort_name: string;

  assignment_level: string;
  assignment_code: string;
  assignment_title: string;
  level_code: string;

  external_platform_id: string;
  external_context_id: string;
  external_resource_link_id: string;

  is_active: boolean;
  has_submissions: boolean;
  can_delete: boolean;

  created_at: string;
  updated_at: string;
};

export async function getAssessmentMappings(): Promise<
  AssessmentMapping[]
> {
  const response = await fetch(
    `${API_BASE_URL}/lms/assessment-mappings/`,
    {
      method: "GET",
      credentials: "include",
    },
  );

  const data = (await response.json()) as
    | AssessmentMapping[]
    | { detail?: string };

  if (!response.ok || !Array.isArray(data)) {
    throw new Error(
      !Array.isArray(data) && data.detail
        ? data.detail
        : "Unable to load assessment mappings.",
    );
  }

  return data;
}

export type CohortOption = {
  id: number;
  code: string;
  name: string;
  module: {
    id: string;
    code: string;
    name: string;
  };
  qualification: {
    id: string;
    code: string;
    name: string;
  };
};

export type AssignmentLevelOption = {
  id: string;
  level_code: string;
  display_name: string;
  version: number;
  configuration_status: string;

  assignment: {
    id: string;
    code: string;
    title: string;
    assignment_number: number;
    maximum_score: string;
  };

  module: {
    id: string;
    code: string;
    name: string;
  };
};


export async function getCohorts(): Promise<CohortOption[]> {
  const response = await fetch(
    `${API_BASE_URL}/courses/cohorts/`,
    {
      method: "GET",
      credentials: "include",
    },
  );

  const data = (await response.json()) as
    | CohortOption[]
    | { detail?: string };

  if (!response.ok || !Array.isArray(data)) {
    throw new Error(
      !Array.isArray(data) && data.detail
        ? data.detail
        : "Unable to load cohorts.",
    );
  }

  return data;
}

export async function getAssignmentLevels(
  moduleId: string,
): Promise<AssignmentLevelOption[]> {
  const response = await fetch(
    `${API_BASE_URL}/courses/assignment-levels/?module_id=${encodeURIComponent(
      moduleId,
    )}`,
    {
      method: "GET",
      credentials: "include",
    },
  );

  const data = (await response.json()) as
    | AssignmentLevelOption[]
    | { detail?: string };

  if (!response.ok || !Array.isArray(data)) {
    throw new Error(
      !Array.isArray(data) && data.detail
        ? data.detail
        : "Unable to load assignment levels.",
    );
  }

  return data;
}



export type CreateAssessmentMappingInput = {
  name: string;
  cohort: number;
  assignment_level: string;
  external_platform_id: string;
  external_context_id: string;
  external_resource_link_id: string;
  is_active: boolean;
};

export async function createAssessmentMapping(
  input: CreateAssessmentMappingInput,
): Promise<AssessmentMapping> {
  const csrfToken = await getCsrfToken();

  const response = await fetch(
    `${API_BASE_URL}/lms/assessment-mappings/`,
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

  const data = (await response.json()) as
    | AssessmentMapping
    | { detail?: string }
    | Record<string, unknown>;

  if (!response.ok) {
    const detail =
      typeof data === "object" &&
      data !== null &&
      "detail" in data &&
      typeof data.detail === "string"
        ? data.detail
        : "Unable to create assessment mapping.";

    throw new Error(detail);
  }

  if (
    typeof data !== "object" ||
    data === null ||
    !("id" in data)
  ) {
    throw new Error(
      "The server did not return a valid assessment mapping.",
    );
  }

  return data as AssessmentMapping;
}


export type Qualification = {
  id: string;
  code: string;
  name: string;
  description: string;
  is_active: boolean;
  can_delete: boolean;
  created_at: string;
  updated_at: string;
};

export type CreateQualificationInput = {
  code: string;
  name: string;
  description: string;
  is_active: boolean;
};


export async function getQualifications(): Promise<Qualification[]> {
  const response = await fetch(
    `${API_BASE_URL}/courses/qualifications/`,
    {
      method: "GET",
      credentials: "include",
    },
  );

  const data = (await response.json()) as
    | Qualification[]
    | { detail?: string };

  if (!response.ok || !Array.isArray(data)) {
    throw new Error(
      !Array.isArray(data) && data.detail
        ? data.detail
        : "Unable to load qualifications.",
    );
  }

  return data;
}

export async function createQualification(
  input: CreateQualificationInput,
): Promise<Qualification> {
  const csrfToken = await getCsrfToken();

  const response = await fetch(
    `${API_BASE_URL}/courses/qualifications/`,
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

  const data = (await response.json()) as
    | Qualification
    | { detail?: string }
    | Record<string, unknown>;

  if (!response.ok) {
    let message = "Unable to create qualification.";

    if (
      typeof data === "object" &&
      data !== null &&
      "detail" in data &&
      typeof data.detail === "string"
    ) {
      message = data.detail;
    }

    throw new Error(message);
  }

  if (
    typeof data !== "object" ||
    data === null ||
    !("id" in data)
  ) {
    throw new Error(
      "The server did not return a valid qualification.",
    );
  }

  return data as Qualification;
}