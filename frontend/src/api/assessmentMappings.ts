import { getCsrfToken } from "./auth";
import { extractResults, API_BASE_URL } from "./utils";





export type AssessmentMapping = {
    id: string;
    name: string;

    cohort: string;
    cohort_code: string;
    cohort_name: string;

    assignment: string;
    assignment_code: string;
    assignment_title: string;
    assignment_is_summative: boolean;

    lti_client_id: string;
    lti_deployment_id: string;
    lti_jwks_url: string;
    lti_access_token_url: string;

    is_active: boolean;
    has_submissions: boolean;
    can_delete: boolean;

    created_at: string;
    updated_at: string;
    final_mark_weight: string;
    assignment_contributes_to_final_mark: boolean;
    due_date: string | null;

    show_result_to_learner: boolean;
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

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            typeof data?.detail === "string"
                ? data.detail
                : "Unable to load assessment mappings.",
        );
    }

    return extractResults<AssessmentMapping>(data);
}




export type CreateAssessmentMappingInput = {
    cohort: string;
    assignment: string;

    lti_client_id: string;
    lti_deployment_id: string;
    lti_jwks_url: string;
    lti_access_token_url: string;

    is_active: boolean;
    final_mark_weight: string;

    show_result_to_learner?: boolean;
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

export async function deleteAssessmentMapping(
    mappingId: string,
): Promise<void> {
    const csrfToken = await getCsrfToken();

    const response = await fetch(
        `${API_BASE_URL}/lms/assessment-mappings/${mappingId}/`,
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

    let message = "Unable to unassign assessment.";

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

export async function updateAssessmentMapping(
  mappingId: string,
  data: Partial<{
    cohort: string;
    assignment: string;
    final_mark_weight: string;
    lti_client_id: string;
    lti_deployment_id: string;
    lti_jwks_url: string;
    lti_access_token_url: string;
    is_active: boolean;
    show_result_to_learner: boolean;
  }>,
): Promise<AssessmentMapping> {
  const csrfToken = await getCsrfToken();

  const response = await fetch(
    `${API_BASE_URL}/lms/assessment-mappings/${mappingId}/`,
    {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": csrfToken,
      },
      body: JSON.stringify(data),
    },
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      typeof result?.detail === "string"
        ? result.detail
        : "Unable to update assessment mapping.",
    );
  }

  return result as AssessmentMapping;
}