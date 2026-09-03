import { getCsrfToken } from "./auth";
import { extractResults, API_BASE_URL } from "./utils";

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


export type UpdateQualificationInput = Partial<{
    qualification_code: string;
    qualification_name: string;
    description: string;
    is_active: boolean;
}>;

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

export type TrackBandDefinition = {
    band_code: string;
    display_name: string;
    minimum_percentage: number;
    maximum_percentage: number;
};

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

    level_code: string;
    sequence: number;
    
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
    band_definitions: TrackBandDefinition[];

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

    level_code: string;
    display_name: string;
    sequence: number;
    title: string;

    skill_statement_code?: string;
    skill_statement?: string;
    objective?: string;
    scenario?: string;
    instructions?: string;

    tasks?: unknown[];
    deliverables?: unknown[];
    expected_outcome?: string;
    band_definitions?: TrackBandDefinition[];

    source_filename?: string | null;
    version?: number;

    configuration_status?:
        AssignmentLevel["configuration_status"];

    is_active?: boolean;
};

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
        if (typeof data?.detail === "string") {
            throw new Error(data.detail);
        }

        if (data && typeof data === "object") {
            const message = Object.entries(data)
                .map(([field, errors]) => {
                    const text = Array.isArray(errors)
                        ? errors.join(", ")
                        : String(errors);

                    return `${field}: ${text}`;
                })
                .join(" | ");

            if (message) {
                throw new Error(message);
            }
        }

        throw new Error(
            "Unable to create submission track.",
        );
    }

    return data as AssignmentLevel;
}

export type UpdateAssignmentLevelInput =
    Partial<CreateAssignmentLevelInput>;

export type AssignmentConfigurationLock = {
    locked: boolean;
    locked_by: string | null;
    owned_by_me: boolean;
    detail?: string;
};

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


export async function updateAssignmentConfigurationLock(
    assignmentLevelId: string,
    action: "acquire" | "heartbeat" | "release",
): Promise<AssignmentConfigurationLock> {
    const csrfToken = await getCsrfToken();

    const response = await fetch(
        `${API_BASE_URL}/courses/assignment-levels/${assignmentLevelId}/edit-lock/`,
        {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json",
                "X-CSRFToken": csrfToken,
            },
            body: JSON.stringify({ action }),
        },
    );

    const data = await response.json();

    if (!response.ok && response.status !== 423) {
        throw new Error(
            typeof data?.detail === "string"
                ? data.detail
                : "Unable to update configuration edit lock.",
        );
    }

    return data as AssignmentConfigurationLock;
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

    let data: {
        detail?: string;
        retired?: boolean;
    } = {};

    try {
        data = await response.json();
    } catch {
        // Keep default handling.
    }

    if (response.ok) {
        return;
    }

    throw new Error(
        data.detail ||
        "Unable to delete submission track.",
    );
}