import {
    useEffect,
    useState,
    type FormEvent,
} from "react";
import { useNavigate } from "react-router";

import "../css/AssessmentMappings.css";

import {
    createAssessmentMapping,
    getCohorts,
    getModuleAssignments,
    type Cohort,
    type ModuleAssignment,
} from "../api/lms";

export function CreateAssessmentMappingPage() {
    const navigate = useNavigate();

    const [cohorts, setCohorts] = useState<Cohort[]>([]);
    const [assignments, setAssignments] = useState<ModuleAssignment[]>([]);

    const [assignmentId, setAssignmentId] = useState("");

    const [cohortId, setCohortId] = useState("");



    const [isActive, setIsActive] = useState(true);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        async function loadCohorts() {
            try {
                const data = await getCohorts();
                setCohorts(data);
            } catch (caughtError) {
                setError(
                    caughtError instanceof Error
                        ? caughtError.message
                        : "Unable to load cohorts.",
                );
            } finally {
                setIsLoading(false);
            }
        }

        void loadCohorts();
    }, []);

    async function handleCohortChange(

        selectedCohortId: string,
    ) {
        setCohortId(selectedCohortId);
        setAssignmentId("");
        setAssignments([]);
        setError("");

        if (!selectedCohortId) {
            return;
        }

        const selectedCohort = cohorts.find(
            (cohort) =>
                cohort.id.toString() === selectedCohortId,
        );

        if (!selectedCohort) {
            setError("Selected cohort was not found.");
            return;
        }

        try {
            const data = await getModuleAssignments(
                selectedCohort.module.id,
            );

            setAssignments(data);
        } catch (caughtError) {
            setError(
                caughtError instanceof Error
                    ? caughtError.message
                    : "Unable to load assignments.",
            );
        }
    }

    async function handleSubmit(
        event: FormEvent<HTMLFormElement>,
    ) {
        event.preventDefault();

        if (!cohortId || !assignmentId) {
            setError(
                "Please select a cohort and assignment.",
            );
            return;
        }

        setError("");
        setIsSubmitting(true);

        try {
            await createAssessmentMapping({
                cohort: Number(cohortId),
                assignment: assignmentId,
                is_active: isActive,
            });

            navigate("/admin/mappings", {
                replace: true,
            });
        } catch (caughtError) {
            setError(
                caughtError instanceof Error
                    ? caughtError.message
                    : "Unable to create assessment mapping.",
            );
        } finally {
            setIsSubmitting(false);
        }
    }

    if (isLoading) {
        return <main className="admin-container">Loading mapping form...</main>;
    }

    return (
        <main className="admin-container">
            <div className="admin-header">
                <h1>Create assessment mapping</h1>
            </div>

            <form onSubmit={handleSubmit} className="modern-form">


                <div className="form-group">
                    <label htmlFor="cohort">
                        Cohort
                    </label>

                    <select
                        id="cohort"
                        value={cohortId}
                        onChange={(event) =>
                            void handleCohortChange(
                                event.target.value,
                            )
                        }
                        required
                    >
                        <option value="">
                            Select cohort
                        </option>

                        {cohorts.map((cohort) => (
                            <option
                                key={cohort.id}
                                value={cohort.id}
                            >
                                {cohort.qualification_code}
                                {" → "}
                                {cohort.module_code}
                                {" → "}
                                {cohort.cohort_code}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="form-group">
                    <label htmlFor="assignment">
                        Assignment
                    </label>

                    <select
                        id="assignment"
                        value={assignmentId}
                        onChange={(event) =>
                            setAssignmentId(event.target.value)
                        }
                        disabled={!cohortId}
                        required
                    >
                        <option value="">
                            Select assignment
                        </option>

                        {assignments.map((assignment) => (
                            <option
                                key={assignment.id}
                                value={assignment.id}
                            >
                                {assignment.code}
                                {" — "}
                                {assignment.title}
                            </option>
                        ))}
                    </select>
                </div>


                <div className="form-group">
                    <label className="checkbox-group">
                        <input
                            type="checkbox"
                            checked={isActive}
                            onChange={(event) =>
                                setIsActive(event.target.checked)
                            }
                        />
                        Active
                    </label>
                </div>

                {error && <p role="alert" style={{ color: "#ef4444" }}>{error}</p>}

                <div className="form-actions">
                    <button
                        type="submit"
                        className="btn-primary"
                        disabled={isSubmitting}
                    >
                        {isSubmitting
                            ? "Creating..."
                            : "Create mapping"}
                    </button>

                    <button
                        type="button"
                        className="btn-secondary"
                        onClick={() =>
                            navigate("/admin/mappings")
                        }
                        disabled={isSubmitting}
                    >
                        Cancel
                    </button>
                </div>
            </form>
        </main>
    );
}