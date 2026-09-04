import { getCsrfToken } from "./auth";
import {
  API_BASE_URL,
  fetchAllPaginatedResults,
} from "./utils";

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

    return fetchAllPaginatedResults<RubricCriterion>(
        `${API_BASE_URL}/grading/rubric-criteria/${query}`,
        "Unable to load rubric criteria.",
    );
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

    return fetchAllPaginatedResults<RubricBand>(
        `${API_BASE_URL}/grading/rubric-bands/${query}`,
        "Unable to load rubric bands.",
    );
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
    evidence_required: string;
    sequence: number;
    created_at: string;
};

export type CreateTaskInput = {
    assignment_level: string;
    task_code: string;
    title: string;
    evidence_required: string;
    sequence: number;
};

export type UpdateTaskInput = Partial<CreateTaskInput>;

export async function getTasks(
    assignmentLevelId?: string,
): Promise<Task[]> {
    const query = assignmentLevelId
        ? `?assignment_level_id=${encodeURIComponent(
            assignmentLevelId,
        )}`
        : "";

    return fetchAllPaginatedResults<Task>(
        `${API_BASE_URL}/grading/tasks/${query}`,
        "Unable to load tasks.",
    );
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

export type AssignmentConfigurationImportResult = {
    assignment_level: string;
    level_code: string;
    requirements_updated: boolean;
    tasks_created: number;
    criteria_created: number;
};

export async function importAssignmentConfigurationCsv(
    assignmentLevelId: string,
    file: File,
): Promise<AssignmentConfigurationImportResult> {
    const csrfToken = await getCsrfToken();
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(
        `${API_BASE_URL}/grading/assignment-levels/${assignmentLevelId}/import-csv/`,
        {
            method: "POST",
            credentials: "include",
            headers: {
                "X-CSRFToken": csrfToken,
            },
            body: formData,
        },
    );

    const data = await response.json();

    if (!response.ok) {
        if (typeof data?.detail === "string") {
            throw new Error(data.detail);
        }
        if (Array.isArray(data?.errors)) {
            throw new Error(data.errors.join(" | "));
        }
        throw new Error("Unable to import assignment configuration CSV.");
    }

    return data as AssignmentConfigurationImportResult;
}