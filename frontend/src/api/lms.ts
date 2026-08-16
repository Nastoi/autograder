import { getCsrfToken } from "./auth";



const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL ||
    "http://localhost:8000/api";

type PaginatedResponse<T> = {
    count: number;
    next: string | null;
    previous: string | null;
    results: T[];
};

function extractResults<T>(
    data: T[] | PaginatedResponse<T>,
): T[] {
    if (Array.isArray(data)) {
        return data;
    }

    if (
        data &&
        typeof data === "object" &&
        "results" in data &&
        Array.isArray(data.results)
    ) {
        return data.results;
    }

    throw new Error("Invalid API response.");
}

export type AssessmentMapping = {
    id: string;
    name: string;

    cohort: string;
    cohort_code: string;
    cohort_name: string;

    assignment: string;
    assignment_code: string;
    assignment_title: string;

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



export type CreateAssessmentMappingInput = {
    cohort: string;
    assignment: string;

    lti_client_id: string;
    lti_deployment_id: string;
    lti_jwks_url: string;
    lti_access_token_url: string;

    is_active: boolean;
    final_mark_weight: string;
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
    qualification_code: string;
    qualification_name: string;
    description: string;
    is_active: boolean;
    can_delete: boolean;
    created_at: string;
    updated_at: string;
};

export type CreateQualificationInput = {
    qualification_code: string;
    qualification_name: string;
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

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            typeof data?.detail === "string"
                ? data.detail
                : "Unable to load qualifications.",
        );
    }

    return extractResults<Qualification>(data);
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


export type UpdateQualificationInput = Partial<{
    qualification_code: string;
    qualification_name: string;
    description: string;
    is_active: boolean;
}>;

export async function updateQualification(
    qualificationId: string,
    input: UpdateQualificationInput,
): Promise<Qualification> {
    const csrfToken = await getCsrfToken();

    const response = await fetch(
        `${API_BASE_URL}/courses/qualifications/${qualificationId}/`,
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
                : "Unable to update qualification.",
        );
    }

    return data as Qualification;
}

export async function deleteQualification(
    qualificationId: string,
): Promise<void> {
    const csrfToken = await getCsrfToken();

    const response = await fetch(
        `${API_BASE_URL}/courses/qualifications/${qualificationId}/`,
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

    let message = "Unable to delete qualification.";

    try {
        const data = (await response.json()) as {
            detail?: string;
        };

        if (data.detail) {
            message = data.detail;
        }
    } catch {
        // Keep the default error message.
    }

    throw new Error(message);
}

export type QualificationDeleteImpact = {
    can_delete: boolean;

    blockers: {
        active_cohorts: Array<{
            id: string;
            code: string;
            name: string;
        }>;

        assessment_mappings: Array<{
            id: string;
            name: string;
            cohort: string;
            assignment: string;
        }>;

        submissions: number;
    };

    affected: {
        modules: number;
        inactive_cohorts: number;
        assignments: number;
        assignment_levels: number;
        submission_contexts: number;
    };
};

export async function getQualificationDeleteImpact(
    qualificationId: string,
): Promise<QualificationDeleteImpact> {
    const response = await fetch(
        `${API_BASE_URL}/courses/qualifications/${qualificationId}/delete-impact/`,
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
                : "Unable to check qualification dependencies.",
        );
    }

    return data as QualificationDeleteImpact;
}


export type Module = {
    id: string;
    qualification: string;
    qualification_code: string;
    qualification_name: string;
    module_code: string;
    module_name: string;
    description: string;
    is_active: boolean;
    can_delete: boolean;
    created_at: string;
    updated_at: string;
};

export type CreateModuleInput = {
    qualification: string;
    module_code: string;
    module_name: string;
    description: string;
    is_active: boolean;
};

export type UpdateModuleInput = Partial<CreateModuleInput>;

export async function getModules(
    qualificationId?: string,
): Promise<Module[]> {
    const query = qualificationId
        ? `?qualification_id=${encodeURIComponent(qualificationId)}`
        : "";

    const response = await fetch(
        `${API_BASE_URL}/courses/modules/${query}`,
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
                : "Unable to load modules.",
        );
    }

    return extractResults<Module>(data);
}

export async function createModule(
    input: CreateModuleInput,
): Promise<Module> {
    const csrfToken = await getCsrfToken();

    const response = await fetch(
        `${API_BASE_URL}/courses/modules/`,
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
        console.error("Create module failed:", data);

        if (typeof data?.detail === "string") {
            throw new Error(data.detail);
        }

        if (data && typeof data === "object") {
            const messages = Object.entries(data)
                .map(([field, errors]) => {
                    const message = Array.isArray(errors)
                        ? errors.join(", ")
                        : String(errors);

                    return `${field}: ${message}`;
                })
                .join(" | ");

            if (messages) {
                throw new Error(messages);
            }
        }

        throw new Error("Unable to create module.");
    }

    return data as Module;
}


export async function deleteModule(
    moduleId: string,
): Promise<void> {
    const csrfToken = await getCsrfToken();

    const response = await fetch(
        `${API_BASE_URL}/courses/modules/${moduleId}/`,
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

    let message = "Unable to delete module.";

    try {
        const data = (await response.json()) as {
            detail?: string;
        };

        if (data.detail) {
            message = data.detail;
        }
    } catch {
        // Keep the default message.
    }

    throw new Error(message);
}


export type Cohort = {
    id: string;
    cohort_code: string;
    cohort_name: string;
    module: string;
    module_code: string;
    module_name: string;
    qualification_id: string;
    qualification_code: string;
    qualification_name: string;
    start_date: string | null;
    end_date: string | null;
    is_active: boolean;
    can_delete: boolean;
    created_at: string;
    updated_at: string;
};

export type CreateCohortInput = {
    cohort_code: string;
    cohort_name: string;
    module: string;
    start_date: string | null;
    end_date: string | null;
    is_active: boolean;
};

export type UpdateCohortInput =
    Partial<CreateCohortInput>;


export async function getCohorts(
    moduleId?: string,
): Promise<Cohort[]> {
    const query = moduleId
        ? `?module_id=${encodeURIComponent(moduleId)}`
        : "";

    const response = await fetch(
        `${API_BASE_URL}/courses/cohorts/${query}`,
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
                : "Unable to load cohorts.",
        );
    }

    return extractResults<Cohort>(data);
}

export async function createCohort(
    input: CreateCohortInput,
): Promise<Cohort> {
    const csrfToken = await getCsrfToken();

    const response = await fetch(
        `${API_BASE_URL}/courses/cohorts/`,
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
                : "Unable to create cohort.",
        );
    }

    return data as Cohort;
}

export async function updateCohort(
    cohortId: string,
    input: UpdateCohortInput,
): Promise<Cohort> {
    const csrfToken = await getCsrfToken();

    const response = await fetch(
        `${API_BASE_URL}/courses/cohorts/${cohortId}/`,
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
                : "Unable to update cohort.",
        );
    }

    return data as Cohort;
}

export async function deleteCohort(
    cohortId: string,
): Promise<void> {
    const csrfToken = await getCsrfToken();

    const response = await fetch(
        `${API_BASE_URL}/courses/cohorts/${cohortId}/`,
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

    let message = "Unable to delete cohort.";

    try {
        const data = (await response.json()) as {
            detail?: string;
        };

        if (data.detail) {
            message = data.detail;
        }
    } catch {
        // Keep the default message.
    }

    throw new Error(message);
}

export type CohortDeleteImpact = {
    can_delete: boolean;

    blockers: {
        assessment_mappings: Array<{
            id: string;
            name: string;
            assignment: string;
        }>;

        submissions: number;
    };

    affected: {
        submission_contexts: number;
    };
};

export async function getCohortDeleteImpact(
    cohortId: string,
): Promise<CohortDeleteImpact> {
    const response = await fetch(
        `${API_BASE_URL}/courses/cohorts/${cohortId}/delete-impact/`,
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
                : "Unable to check cohort dependencies.",
        );
    }

    return data as CohortDeleteImpact;
}


export type ModuleAssignment = {
    id: string;

    module: string;
    module_code: string;
    module_name: string;

    qualification_id: string;
    qualification_code: string;
    qualification_name: string;

    assignment_code: string;
    assignment_title: string;

    skill_statement_code: string;
    skill_statement: string;
    objective: string;

    maximum_score: string;
    minimum_pass_score: string;

    is_summative: boolean;
    contributes_to_final_mark: boolean;
    final_mark_weight: string;

    is_active: boolean;
    can_delete: boolean;

    created_at: string;
    updated_at: string;
};

export type CreateModuleAssignmentInput = {
    module: string;
    assignment_code: string;
    assignment_title: string;
    maximum_score: string;
    minimum_pass_score: string;
    is_summative: boolean;
    contributes_to_final_mark: boolean;
    final_mark_weight: string;
    is_active: boolean;
};

export type UpdateModuleAssignmentInput =
    Partial<CreateModuleAssignmentInput>;




export async function getModuleAssignments(
    moduleId?: string,
): Promise<ModuleAssignment[]> {
    const query = moduleId
        ? `?module_id=${encodeURIComponent(moduleId)}`
        : "";

    const response = await fetch(
        `${API_BASE_URL}/courses/assignments/${query}`,
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
                : "Unable to load assignments.",
        );
    }

    return extractResults<ModuleAssignment>(data);
}

export async function createModuleAssignment(
    input: CreateModuleAssignmentInput,
): Promise<ModuleAssignment> {
    const csrfToken = await getCsrfToken();

    const response = await fetch(
        `${API_BASE_URL}/courses/assignments/`,
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
        console.error("Create assignment failed:", data);

        if (typeof data?.detail === "string") {
            throw new Error(data.detail);
        }

        if (data && typeof data === "object") {
            const messages = Object.entries(data)
                .map(([field, errors]) => {
                    const message = Array.isArray(errors)
                        ? errors.join(", ")
                        : String(errors);

                    return `${field}: ${message}`;
                })
                .join(" | ");

            if (messages) {
                throw new Error(messages);
            }
        }

        throw new Error("Unable to create assignment.");
    }

    return data as ModuleAssignment;
}

export async function updateModuleAssignment(
    assignmentId: string,
    input: UpdateModuleAssignmentInput,
): Promise<ModuleAssignment> {
    const csrfToken = await getCsrfToken();

    const response = await fetch(
        `${API_BASE_URL}/courses/assignments/${assignmentId}/`,
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
                : "Unable to update assignment.",
        );
    }

    return data as ModuleAssignment;
}

export async function deleteModuleAssignment(
    assignmentId: string,
): Promise<void> {
    const csrfToken = await getCsrfToken();

    const response = await fetch(
        `${API_BASE_URL}/courses/assignments/${assignmentId}/`,
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

    let message = "Unable to delete assignment.";

    try {
        const data = (await response.json()) as {
            detail?: string;
        };

        if (data.detail) {
            message = data.detail;
        }
    } catch {
        // Keep the default message.
    }

    throw new Error(message);
}


export type GradingConfiguration = {
    id: string;
    code: string;
    name: string;

    grading_type:
    | "rules_only"
    | "automated_tests"
    | "ai_rubric"
    | "hybrid"
    | "manual";

    structural_check_enabled: boolean;
    automated_testing_enabled: boolean;
    rag_enabled: boolean;
    ai_grading_enabled: boolean;
    manual_review_required: boolean;

    confidence_review_threshold: string;
    version: number;
    configuration: Record<string, unknown>;

    is_active: boolean;
    can_delete: boolean;

    created_at: string;
    updated_at: string;
};

export type CreateGradingConfigurationInput = {
    code: string;
    name: string;
    grading_type: GradingConfiguration["grading_type"];

    structural_check_enabled: boolean;
    automated_testing_enabled: boolean;
    rag_enabled: boolean;
    ai_grading_enabled: boolean;
    manual_review_required: boolean;

    confidence_review_threshold: string;
    version: number;
    configuration: Record<string, unknown>;

    is_active: boolean;
};

export type UpdateGradingConfigurationInput =
    Partial<CreateGradingConfigurationInput>;




export async function getGradingConfigurations(): Promise<
    GradingConfiguration[]
> {
    const response = await fetch(
        `${API_BASE_URL}/grading/configurations/`,
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
                : "Unable to load grading configurations.",
        );
    }

    return extractResults<GradingConfiguration>(data);
}

export async function createGradingConfiguration(
    input: CreateGradingConfigurationInput,
): Promise<GradingConfiguration> {
    const csrfToken = await getCsrfToken();

    const response = await fetch(
        `${API_BASE_URL}/grading/configurations/`,
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
                : "Unable to create grading configuration.",
        );
    }

    return data as GradingConfiguration;
}

export async function updateGradingConfiguration(
    configurationId: string,
    input: UpdateGradingConfigurationInput,
): Promise<GradingConfiguration> {
    const csrfToken = await getCsrfToken();

    const response = await fetch(
        `${API_BASE_URL}/grading/configurations/${configurationId}/`,
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
                : "Unable to update grading configuration.",
        );
    }

    return data as GradingConfiguration;
}

export async function deleteGradingConfiguration(
    configurationId: string,
): Promise<void> {
    const csrfToken = await getCsrfToken();

    const response = await fetch(
        `${API_BASE_URL}/grading/configurations/${configurationId}/`,
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

    let message = "Unable to delete grading configuration.";

    try {
        const data = (await response.json()) as {
            detail?: string;
        };

        if (data.detail) {
            message = data.detail;
        }
    } catch {
        // Keep the default message.
    }

    throw new Error(message);
}


export type AssignmentLevel = {
    id: string;

    assignment: string;
    assignment_code: string;
    assignment_title: string;

    module_id: string;
    module_code: string;

    qualification_id: string;
    qualification_code: string;

    grading_configuration: string;
    grading_configuration_code: string;
    grading_configuration_name: string;

    level_code:
    "basic" | "advanced"

    display_name: string;
    title: string;

    skill_statement_code: string;
    skill_statement: string;
    objective: string;
    scenario: string;
    instructions: string;

    tasks: unknown[];
    deliverables: unknown[];
    expected_outcome: string;

    source_filename: string | null;
    version: number;

    configuration_status:
    | "draft"
    | "ready"
    | "retired";

    is_active: boolean;
    can_delete: boolean;

    created_at: string;
    updated_at: string;
};

export type CreateAssignmentLevelInput = {
    assignment: string;
    grading_configuration: string;

    level_code: AssignmentLevel["level_code"];
    display_name: string;
    title: string;

    skill_statement_code: string;
    skill_statement: string;
    objective: string;
    scenario: string;
    instructions: string;

    tasks: unknown[];
    deliverables: unknown[];
    expected_outcome: string;

    source_filename: string | null;
    version: number;

    configuration_status:
    AssignmentLevel["configuration_status"];

    is_active: boolean;
};

export type UpdateAssignmentLevelInput =
    Partial<CreateAssignmentLevelInput>;



export async function getAssignmentLevels(
    moduleId?: string,
    assignmentId?: string,
): Promise<AssignmentLevel[]> {
    const params = new URLSearchParams();

    if (moduleId) {
        params.set("module_id", moduleId);
    }

    if (assignmentId) {
        params.set("assignment_id", assignmentId);
    }

    const query = params.toString()
        ? `?${params.toString()}`
        : "";

    const response = await fetch(
        `${API_BASE_URL}/courses/assignment-levels/${query}`,
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
                : "Unable to load assignment levels.",
        );
    }

    return extractResults<AssignmentLevel>(data);

}

export async function createAssignmentLevel(
    input: CreateAssignmentLevelInput,
): Promise<AssignmentLevel> {
    const csrfToken = await getCsrfToken();

    const response = await fetch(
        `${API_BASE_URL}/courses/assignment-levels/`,
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
                : "Unable to create assignment level.",
        );
    }

    return data as AssignmentLevel;
}

export async function updateAssignmentLevel(
    assignmentLevelId: string,
    input: UpdateAssignmentLevelInput,
): Promise<AssignmentLevel> {
    const csrfToken = await getCsrfToken();

    const response = await fetch(
        `${API_BASE_URL}/courses/assignment-levels/${assignmentLevelId}/`,
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
                : "Unable to update assignment level.",
        );
    }

    return data as AssignmentLevel;
}

export async function deleteAssignmentLevel(
    assignmentLevelId: string,
): Promise<void> {
    const csrfToken = await getCsrfToken();

    const response = await fetch(
        `${API_BASE_URL}/courses/assignment-levels/${assignmentLevelId}/`,
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

    let message = "Unable to delete assignment level.";

    try {
        const data = (await response.json()) as {
            detail?: string;
        };

        if (data.detail) {
            message = data.detail;
        }
    } catch {
        // Keep the default message.
    }

    throw new Error(message);
}


export type RubricCriterion = {
    id: string;

    assignment_level: string;
    assignment_code: string;
    assignment_title: string;

    level_code: string;
    level_display_name: string;

    criterion_code: string;
    title: string;
    description: string;

    maximum_score: string;
    sequence: number;

    ai_gradable: boolean;
    deterministic: boolean;

    can_delete: boolean;
    created_at: string;
};

export type CreateRubricCriterionInput = {
    assignment_level: string;
    criterion_code: string;
    title: string;
    description: string;
    maximum_score: string;
    sequence: number;
    ai_gradable: boolean;
    deterministic: boolean;
};

export type UpdateRubricCriterionInput =
    Partial<CreateRubricCriterionInput>;



export async function getRubricCriteria(
    assignmentLevelId?: string,
): Promise<RubricCriterion[]> {
    const query = assignmentLevelId
        ? `?assignment_level_id=${encodeURIComponent(
            assignmentLevelId,
        )}`
        : "";

    const response = await fetch(
        `${API_BASE_URL}/grading/rubric-criteria/${query}`,
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
                : "Unable to load rubric criteria.",
        );
    }

    return extractResults<RubricCriterion>(data);
}

export async function createRubricCriterion(
    input: CreateRubricCriterionInput,
): Promise<RubricCriterion> {
    const csrfToken = await getCsrfToken();

    const response = await fetch(
        `${API_BASE_URL}/grading/rubric-criteria/`,
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
                : "Unable to create rubric criterion.",
        );
    }

    return data as RubricCriterion;
}

export async function updateRubricCriterion(
    criterionId: string,
    input: UpdateRubricCriterionInput,
): Promise<RubricCriterion> {
    const csrfToken = await getCsrfToken();

    const response = await fetch(
        `${API_BASE_URL}/grading/rubric-criteria/${criterionId}/`,
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
                : "Unable to update rubric criterion.",
        );
    }

    return data as RubricCriterion;
}

export async function deleteRubricCriterion(
    criterionId: string,
): Promise<void> {
    const csrfToken = await getCsrfToken();

    const response = await fetch(
        `${API_BASE_URL}/grading/rubric-criteria/${criterionId}/`,
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

    let message = "Unable to delete rubric criterion.";

    try {
        const data = (await response.json()) as {
            detail?: string;
        };

        if (data.detail) {
            message = data.detail;
        }
    } catch {
        // Keep the default message.
    }

    throw new Error(message);
}

export type RubricBand = {
    id: string;

    rubric_criterion: string;
    criterion_code: string;
    criterion_title: string;

    assignment_level_id: string;
    assignment_code: string;
    level_code: string;

    band_code:
    | "failed"
    | "foundation"
    | "proficient"
    | "expert";

    display_name: string;

    minimum_percentage: string;
    maximum_percentage: string;

    descriptor: string;
    sequence: number;
};

export type CreateRubricBandInput = {
    rubric_criterion: string;

    band_code: RubricBand["band_code"];
    display_name: string;

    minimum_percentage: string;
    maximum_percentage: string;

    descriptor: string;
    sequence: number;
};

export type UpdateRubricBandInput =
    Partial<CreateRubricBandInput>;



export async function getRubricBands(
    rubricCriterionId?: string,
    assignmentLevelId?: string,
): Promise<RubricBand[]> {
    const params = new URLSearchParams();

    if (rubricCriterionId) {
        params.set(
            "rubric_criterion_id",
            rubricCriterionId,
        );
    }

    if (assignmentLevelId) {
        params.set(
            "assignment_level_id",
            assignmentLevelId,
        );
    }

    const query = params.toString()
        ? `?${params.toString()}`
        : "";

    const response = await fetch(
        `${API_BASE_URL}/grading/rubric-bands/${query}`,
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
                : "Unable to load rubric bands.",
        );
    }

    return extractResults<RubricBand>(data);
}

export async function createRubricBand(
    input: CreateRubricBandInput,
): Promise<RubricBand> {
    const csrfToken = await getCsrfToken();

    const response = await fetch(
        `${API_BASE_URL}/grading/rubric-bands/`,
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
        if (typeof data?.detail === "string") {
            throw new Error(data.detail);
        }

        if (data && typeof data === "object") {
            const messages = Object.entries(data)
                .map(([field, errors]) => {
                    const message = Array.isArray(errors)
                        ? errors.join(", ")
                        : String(errors);

                    return `${field}: ${message}`;
                })
                .join(" | ");

            if (messages) {
                throw new Error(messages);
            }
        }

        throw new Error("Unable to create rubric band.");
    }
    return data as RubricBand;
}

export async function updateRubricBand(
    bandId: string,
    input: UpdateRubricBandInput,
): Promise<RubricBand> {
    const csrfToken = await getCsrfToken();

    const response = await fetch(
        `${API_BASE_URL}/grading/rubric-bands/${bandId}/`,
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
                : "Unable to update rubric band.",
        );
    }

    return data as RubricBand;
}

export async function deleteRubricBand(
    bandId: string,
): Promise<void> {
    const csrfToken = await getCsrfToken();

    const response = await fetch(
        `${API_BASE_URL}/grading/rubric-bands/${bandId}/`,
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

    let message = "Unable to delete rubric band.";

    try {
        const data = (await response.json()) as {
            detail?: string;
        };

        if (data.detail) {
            message = data.detail;
        }
    } catch {
        // Keep the default message.
    }

    throw new Error(message);
}



export type Task = {
    id: string;
    assignment_level: string;
    assignment_code: string;
    level_code: string;
    task_code: string;
    title: string;
    instructions: string;
    sequence: number;
    created_at: string;
};

export type CreateTaskInput = {
    assignment_level: string;
    task_code: string;
    title: string;
    instructions: string;
    sequence: number;
};

export type UpdateTaskInput = Partial<CreateTaskInput>;

export async function getTasks(
    assignmentLevelId?: string,
): Promise<Task[]> {
    const query = assignmentLevelId
        ? `?assignment_level_id=${encodeURIComponent(assignmentLevelId)}`
        : "";

    const response = await fetch(
        `${API_BASE_URL}/grading/tasks/${query}`,
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
                : "Unable to load tasks.",
        );
    }

    return extractResults<Task>(data);
}

export async function createTask(
    input: CreateTaskInput,
): Promise<Task> {
    const csrfToken = await getCsrfToken();

    const response = await fetch(
        `${API_BASE_URL}/grading/tasks/`,
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
        const message =
            typeof data?.detail === "string"
                ? data.detail
                : data && typeof data === "object"
                    ? Object.entries(data)
                        .map(([field, errors]) =>
                            `${field}: ${Array.isArray(errors) ? errors.join(", ") : String(errors)}`
                        )
                        .join(" | ")
                    : "Unable to create task.";

        throw new Error(message || "Unable to create task.");
    }

    return data as Task;
}

export async function updateTask(
    taskId: string,
    input: UpdateTaskInput,
): Promise<Task> {
    const csrfToken = await getCsrfToken();

    const response = await fetch(
        `${API_BASE_URL}/grading/tasks/${taskId}/`,
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
                : "Unable to update task.",
        );
    }

    return data as Task;
}

export async function deleteTask(taskId: string): Promise<void> {
    const csrfToken = await getCsrfToken();

    const response = await fetch(
        `${API_BASE_URL}/grading/tasks/${taskId}/`,
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

    let message = "Unable to delete task.";
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

export type AIGradingProfile = {
    id: string;

    assignment_level: string;
    assignment_code: string;
    assignment_title: string;

    level_code: string;
    level_display_name: string;

    profile_name: string;
    system_prompt: string;
    output_schema: Record<string, unknown>;

    temperature: string;
    model_provider: string;
    model_name: string;

    is_active: boolean;

    created_at: string;
    updated_at: string;
};

export type CreateAIGradingProfileInput = {
    assignment_level: string;
    profile_name: string;
    system_prompt: string;
    output_schema: Record<string, unknown>;
    temperature: string;
    model_provider: string;
    model_name: string;
    is_active: boolean;
};

export type UpdateAIGradingProfileInput =
    Partial<CreateAIGradingProfileInput>;



export async function getAIGradingProfiles(
    assignmentLevelId?: string,
): Promise<AIGradingProfile[]> {
    const query = assignmentLevelId
        ? `?assignment_level_id=${encodeURIComponent(
            assignmentLevelId,
        )}`
        : "";

    const response = await fetch(
        `${API_BASE_URL}/grading/ai-grading-profiles/${query}`,
        {
            method: "GET",
            credentials: "include",
        },
    );

    const data = await response.json();

    if (!response.ok || !Array.isArray(data)) {
        throw new Error(
            typeof data?.detail === "string"
                ? data.detail
                : "Unable to load AI grading profiles.",
        );
    }

    return data as AIGradingProfile[];
}

export async function createAIGradingProfile(
    input: CreateAIGradingProfileInput,
): Promise<AIGradingProfile> {
    const csrfToken = await getCsrfToken();

    const response = await fetch(
        `${API_BASE_URL}/grading/ai-grading-profiles/`,
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
                : "Unable to create AI grading profile.",
        );
    }

    return data as AIGradingProfile;
}

export async function updateAIGradingProfile(
    profileId: string,
    input: UpdateAIGradingProfileInput,
): Promise<AIGradingProfile> {
    const csrfToken = await getCsrfToken();

    const response = await fetch(
        `${API_BASE_URL}/grading/ai-grading-profiles/${profileId}/`,
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
                : "Unable to update AI grading profile.",
        );
    }

    return data as AIGradingProfile;
}

export async function deleteAIGradingProfile(
    profileId: string,
): Promise<void> {
    const csrfToken = await getCsrfToken();

    const response = await fetch(
        `${API_BASE_URL}/grading/ai-grading-profiles/${profileId}/`,
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

    let message = "Unable to delete AI grading profile.";

    try {
        const data = (await response.json()) as {
            detail?: string;
        };

        if (data.detail) {
            message = data.detail;
        }
    } catch {
        // Keep the default message.
    }


    throw new Error(message);
}


export type MappingSubmissionContext = {
    mapping_id: string;

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

    assignment_levels: {
        id: string;
        level_code: "basic" | "advanced";
        display_name: string;
        title: string;
    }[];
};

export async function getMappingSubmissionContext(
    mappingId: string,
): Promise<MappingSubmissionContext> {
    const response = await fetch(
        `${API_BASE_URL}/lms/assessment-mappings/${mappingId}/submission/`,
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
                : "Unable to load assignment.",
        );
    }

    return data as MappingSubmissionContext;
}


export type AutoTaskCriteriaMappingResult = {
    assignment_level: string;
    tasks_mapped: number;
    status: string;
    mappings: {
        task_code: string;
        task_title: string;
        rubric_criterion: {
            id: string;
            criterion_code: string | null;
            title: string | null;
            description: string | null;
            maximum_score: number;
        };
        inferred_weight: number;
        ai_explanation: string;
    }[];
};

export async function generateTaskCriteriaMapping(
    assignmentLevelId: string,
): Promise<AutoTaskCriteriaMappingResult> {
    const csrfToken = await getCsrfToken();

    const response = await fetch(
        `${API_BASE_URL}/grading/map-tasks-criteria/`,
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
            typeof data?.error === "string"
                ? data.error
                : "Unable to generate task criteria mapping.",
        );
    }

    return data as AutoTaskCriteriaMappingResult;
}

export type ModuleDeleteImpact = {
    can_delete: boolean;

    blockers: {
        active_cohorts: Array<{
            id: string;
            code: string;
            name: string;
        }>;

        assessment_mappings: Array<{
            id: string;
            name: string;
            cohort: string;
            assignment: string;
        }>;

        submissions: number;
    };

    affected: {
        inactive_cohorts: number;
        assignments: number;
        assignment_levels: number;
        submission_contexts: number;
    };
};

export async function updateModule(
    moduleId: string,
    input: UpdateModuleInput,
): Promise<Module> {
    const csrfToken = await getCsrfToken();

    const response = await fetch(
        `${API_BASE_URL}/courses/modules/${moduleId}/`,
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
                : "Unable to update module.",
        );
    }

    return data as Module;
}

export async function getModuleDeleteImpact(
    moduleId: string,
): Promise<ModuleDeleteImpact> {
    const response = await fetch(
        `${API_BASE_URL}/courses/modules/${moduleId}/delete-impact/`,
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
                : "Unable to check module dependencies.",
        );
    }

    return data as ModuleDeleteImpact;
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