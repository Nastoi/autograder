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

    const [code, setCode] = useState("");
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [isActive, setIsActive] = useState(true);

    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editCode, setEditCode] = useState("");
    const [editName, setEditName] = useState("");
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
                code,
                name,
                description,
                is_active: isActive,
            });

            setCode("");
            setName("");
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
        setEditCode(qualification.code);
        setEditName(qualification.name);
        setEditDescription(qualification.description);
        setError("");
    }

    function cancelEditing() {
        setEditingId(null);
        setEditCode("");
        setEditName("");
        setEditDescription("");
    }

    async function saveQualification(
        qualificationId: string,
    ) {
        setError("");
        setIsSaving(true);

        try {
            await updateQualification(qualificationId, {
                code: editCode,
                name: editName,
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
            `Delete qualification ${qualification.code}?`,
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
                            Code
                        </label>

                        <input
                            id="qualification-code"
                            type="text"
                            value={code}
                            onChange={(event) =>
                                setCode(event.target.value)
                            }
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="qualification-name">
                            Name
                        </label>

                        <input
                            id="qualification-name"
                            type="text"
                            value={name}
                            onChange={(event) =>
                                setName(event.target.value)
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
                                <th>Code</th>
                                <th>Name</th>
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
                                                    value={editCode}
                                                    onChange={(event) =>
                                                        setEditCode(event.target.value)
                                                    }
                                                    required
                                                />
                                            ) : (
                                                qualification.code
                                            )}
                                        </td>

                                        <td>
                                            {isEditing ? (
                                                <input
                                                    value={editName}
                                                    onChange={(event) =>
                                                        setEditName(event.target.value)
                                                    }
                                                    required
                                                />
                                            ) : (
                                                qualification.name
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