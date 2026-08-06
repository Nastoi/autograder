import "../css/AssessmentMappings.css";
import {
    useEffect,
    useState,
    type FormEvent,
} from "react";

import {
    createQualification,
    deleteQualification,
    getQualifications,
    updateQualification,
    type Qualification,
} from "../api/lms";

export function QualificationsPage() {
    const [qualifications, setQualifications] = useState<
        Qualification[]
    >([]);

    const [qualificationCode, setQualificationCode] = useState("");
    const [qualificationName, setQualificationName] = useState("");
    const [description, setDescription] = useState("");
    const [isActive, setIsActive] = useState(true);

    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");

    const [editingId, setEditingId] = useState<string | null>(null);

    const [editQualificationCode, setEditQualificationCode] = useState("");
    const [editQualificationName, setEditQualificationName] = useState("");
    const [editDescription, setEditDescription] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    async function loadQualifications() {
        try {
            const data = await getQualifications();
            setQualifications(data);
        } catch (caughtError) {
            setError(
                caughtError instanceof Error
                    ? caughtError.message
                    : "Unable to load qualifications.",
            );
        } finally {
            setIsLoading(false);
        }
    }

    useEffect(() => {
        void loadQualifications();
    }, []);

    async function handleSubmit(
        event: FormEvent<HTMLFormElement>,
    ) {
        event.preventDefault();

        setError("");
        setIsSubmitting(true);

        try {
            await createQualification({
                qualification_code: qualificationCode,
                qualification_name: qualificationName,
                description,
                is_active: isActive,
            });

            setQualificationCode("");
            setQualificationName("");
            setDescription("");
            setIsActive(true);

            await loadQualifications();
        } catch (caughtError) {
            setError(
                caughtError instanceof Error
                    ? caughtError.message
                    : "Unable to create qualification.",
            );
        } finally {
            setIsSubmitting(false);
        }
    }


    function beginEditing(qualification: Qualification) {
        setEditingId(qualification.id);
        setEditQualificationCode(qualification.qualification_code);
        setEditQualificationName(qualification.qualification_name);
        setEditDescription(qualification.description);
        setError("");
    }

    function cancelEditing() {
        setEditingId(null);
        setEditQualificationCode("");
        setEditQualificationName("");
        setEditDescription("");
    }

    async function saveQualification(
        qualificationId: string,
    ) {
        setError("");
        setIsSaving(true);

        try {
            await updateQualification(qualificationId, {
                qualification_code: editQualificationCode,
                qualification_name: editQualificationName,
                description: editDescription,
            });

            cancelEditing();
            await loadQualifications();
        } catch (caughtError) {
            setError(
                caughtError instanceof Error
                    ? caughtError.message
                    : "Unable to update qualification.",
            );
        } finally {
            setIsSaving(false);
        }
    }

    async function toggleQualificationStatus(
        qualification: Qualification,
    ) {
        setError("");

        try {
            await updateQualification(qualification.id, {
                is_active: !qualification.is_active,
            });

            await loadQualifications();
        } catch (caughtError) {
            setError(
                caughtError instanceof Error
                    ? caughtError.message
                    : "Unable to update qualification status.",
            );
        }
    }

    async function removeQualification(
        qualification: Qualification,
    ) {
        const confirmed = window.confirm(
            `Delete qualification ${qualification.qualification_code}?`,
        );

        if (!confirmed) {
            return;
        }

        setError("");

        try {
            await deleteQualification(qualification.id);
            await loadQualifications();
        } catch (caughtError) {
            setError(
                caughtError instanceof Error
                    ? caughtError.message
                    : "Unable to delete qualification.",
            );
        }
    }

    if (isLoading) {
        return <main className="admin-container">Loading qualifications...</main>;
    }

    return (
        <main className="admin-container">
            <div className="admin-header">
                <h1>Qualifications</h1>
            </div>

            <div className="admin-split-layout">
                <section>
                    <h2 style={{ marginBottom: "16px", color: "#112642" }}>Add qualification</h2>

                    <form onSubmit={handleSubmit} className="modern-form">
                        <div className="form-group">
                            <label htmlFor="qualification-code">
                                Qualification code
                            </label>

                            <input
                                id="qualification-code"
                                type="text"
                                value={qualificationCode}
                                onChange={(event) =>
                                    setQualificationCode(event.target.value)
                                }
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="qualification-name">
                                Qualification name
                            </label>

                            <input
                                id="qualification-name"
                                type="text"
                                value={qualificationName}
                                onChange={(event) =>
                                    setQualificationName(event.target.value)
                                }
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="qualification-description">
                                Description
                            </label>

                            <textarea
                                id="qualification-description"
                                value={description}
                                onChange={(event) =>
                                    setDescription(event.target.value)
                                }
                            />
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

                        {error && <p role="alert" className="error-message">{error}</p>}

                        <div className="form-actions">
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="btn-primary"
                            >
                                {isSubmitting
                                    ? "Creating..."
                                    : "Add qualification"}
                            </button>
                        </div>
                    </form>
                </section>

                <section>
                    <h2 style={{ marginBottom: "16px", color: "#112642" }}>Existing qualifications</h2>

                    {qualifications.length === 0 ? (
                        <p>No qualifications found.</p>
                    ) : (
                        <div className="table-container">
                            <table className="modern-table">
                                <thead>
                                    <tr>
                                        <th>Qualification code</th>
                                        <th>Qualification name</th>
                                        <th>Description</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {qualifications.map((qualification) => {
                                        const isEditing =
                                            editingId === qualification.id;

                                        return (
                                            <tr key={qualification.id}>
                                                <td>
                                                    {isEditing ? (
                                                        <input
                                                            value={editQualificationCode}
                                                            onChange={(event) =>
                                                                setEditQualificationCode(event.target.value)
                                                            }
                                                            required
                                                        />
                                                    ) : (
                                                        qualification.qualification_code
                                                    )}
                                                </td>

                                                <td>
                                                    {isEditing ? (
                                                        <input
                                                            value={editQualificationName}
                                                            onChange={(event) =>
                                                                setEditQualificationName(event.target.value)
                                                            }
                                                            required
                                                        />
                                                    ) : (
                                                        qualification.qualification_name
                                                    )}
                                                </td>

                                                <td>
                                                    {isEditing ? (
                                                        <textarea
                                                            value={editDescription}
                                                            onChange={(event) =>
                                                                setEditDescription(
                                                                    event.target.value,
                                                                )
                                                            }
                                                        />
                                                    ) : (
                                                        qualification.description || "—"
                                                    )}
                                                </td>

                                                <td>
                                                    {qualification.is_active
                                                        ? "Active"
                                                        : "Inactive"}
                                                </td>

                                                <td>
                                                    {isEditing ? (
                                                        <>
                                                            <button
                                                                type="button"
                                                                disabled={isSaving}
                                                                onClick={() =>
                                                                    void saveQualification(
                                                                        qualification.id,
                                                                    )
                                                                }
                                                            >
                                                                {isSaving ? "Saving..." : "Save"}
                                                            </button>

                                                            <button
                                                                type="button"
                                                                disabled={isSaving}
                                                                onClick={cancelEditing}
                                                            >
                                                                Cancel
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    beginEditing(qualification)
                                                                }
                                                            >
                                                                Edit
                                                            </button>

                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    void toggleQualificationStatus(
                                                                        qualification,
                                                                    )
                                                                }
                                                            >
                                                                {qualification.is_active
                                                                    ? "Deactivate"
                                                                    : "Activate"}
                                                            </button>

                                                            {qualification.can_delete && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        void removeQualification(
                                                                            qualification,
                                                                        )
                                                                    }
                                                                >
                                                                    Delete
                                                                </button>
                                                            )}
                                                        </>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </div>
        </main>
    );
}