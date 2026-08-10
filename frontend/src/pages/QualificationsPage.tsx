import "../css/AssessmentMappings.css";
import {
  useEffect,
  useState,
  type FormEvent,
} from "react";

import {
  createModule,
  deleteModule,
  createQualification,
  deleteQualification,
  getModules,
  getQualifications,
  updateQualification,
  type Module,
  type Qualification,
} from "../api/lms";

export function QualificationsPage() {
  const [qualifications, setQualifications] = useState<Qualification[]>([]);
  const [modules, setModules] = useState<Module[]>([]);

  const [qualificationCode, setQualificationCode] = useState("");
  const [qualificationName, setQualificationName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [selectedQualificationId, setSelectedQualificationId] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQualificationCode, setEditQualificationCode] = useState("");
  const [editQualificationName, setEditQualificationName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const [moduleCode, setModuleCode] = useState("");
  const [moduleName, setModuleName] = useState("");
  const [moduleDescription, setModuleDescription] = useState("");

  const [showCreateQualification, setShowCreateQualification] = useState(false);
  const [showCreateModule, setShowCreateModule] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingModule, setIsCreatingModule] = useState(false);
  const [error, setError] = useState("");

  async function loadData() {
    try {
      const [qualificationData, moduleData] = await Promise.all([
        getQualifications(),
        getModules(),
      ]);

      setQualifications(qualificationData);
      setModules(moduleData);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load academic setup.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
  // eslint-disable-next-line react-hooks/set-state-in-effect
  void loadData();
}, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
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
      setShowCreateQualification(false);

      await loadData();
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

  async function saveQualification(qualificationId: string) {
    setError("");
    setIsSaving(true);

    try {
      await updateQualification(qualificationId, {
        qualification_code: editQualificationCode,
        qualification_name: editQualificationName,
        description: editDescription,
      });

      cancelEditing();
      await loadData();
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

  async function toggleQualificationStatus(qualification: Qualification) {
    setError("");

    try {
      await updateQualification(qualification.id, {
        is_active: !qualification.is_active,
      });

      await loadData();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to update qualification status.",
      );
    }
  }

  async function removeQualification(qualification: Qualification) {
    if (
      !window.confirm(
        `Delete qualification ${qualification.qualification_code}?`,
      )
    ) {
      return;
    }

    setError("");

    try {
      await deleteQualification(qualification.id);

      if (selectedQualificationId === qualification.id) {
        setSelectedQualificationId("");
      }

      await loadData();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to delete qualification.",
      );
    }
  }

  async function handleCreateModule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedQualificationId) {
      return;
    }

    setError("");
    setIsCreatingModule(true);

    try {
      await createModule({
        qualification: selectedQualificationId,
        code: moduleCode,
        name: moduleName,
        description: moduleDescription,
        is_active: true,
      });

      setModuleCode("");
      setModuleName("");
      setModuleDescription("");
      setShowCreateModule(false);

      await loadData();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to create module.",
      );
    } finally {
      setIsCreatingModule(false);
    }
  }

  async function removeModule(module: Module) {
    if (
      !window.confirm(
        `Delete module ${module.code} — ${module.name}?`,
      )
    ) {
      return;
    }

    setError("");

    try {
      await deleteModule(module.id);
      await loadData();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to delete module.",
      );
    }
  }

  if (isLoading) {
    return (
      <main className="admin-container">
        Loading academic setup...
      </main>
    );
  }

  const selectedQualification = qualifications.find(
    (qualification) => qualification.id === selectedQualificationId,
  );

  const selectedModules = modules.filter(
    (module) => module.qualification === selectedQualificationId,
  );

  return (
    <main className="admin-container">
      <div className="admin-header">
        <div>
          <h1>Academic Setup</h1>
          <p className="section-description">
            Manage qualifications and their modules in one place.
          </p>
        </div>

        <button
          type="button"
          className="btn-primary"
          onClick={() =>
            setShowCreateQualification((current) => !current)
          }
        >
          {showCreateQualification ? "Close" : "+ New Qualification"}
        </button>
      </div>

      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}

      {showCreateQualification && (
        <section className="workspace-section">
          <form
            onSubmit={handleSubmit}
            className="modern-form assignment-create-form"
          >
            <div className="form-grid form-grid-2">
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

            <div className="checkbox-row">
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

            <div className="form-actions">
              <button
                type="submit"
                className="btn-primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Creating..." : "Create Qualification"}
              </button>

              <button
                type="button"
                className="btn-secondary"
                disabled={isSubmitting}
                onClick={() => setShowCreateQualification(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="page-section">
        <div className="section-header">
          <div>
            <h2>Qualifications</h2>
            <p className="section-description">
              Select a qualification to manage its modules.
            </p>
          </div>
        </div>

        {qualifications.length === 0 ? (
          <p>No qualifications found.</p>
        ) : (
          <div className="table-container">
            <table className="modern-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Qualification</th>
                  <th>Description</th>
                  <th>Modules</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {qualifications.map((qualification) => {
                  const isEditing = editingId === qualification.id;
                  const moduleCount = modules.filter(
                    (module) => module.qualification === qualification.id,
                  ).length;

                  return (
                    <tr
                      key={qualification.id}
                      className={
                        selectedQualificationId === qualification.id
                          ? "selected-row"
                          : ""
                      }
                      onClick={() => {
                        setSelectedQualificationId(qualification.id);
                        setShowCreateModule(false);
                      }}
                      style={{ cursor: "pointer" }}
                    >
                      <td>
                        {isEditing ? (
                          <input
                            value={editQualificationCode}
                            onClick={(event) => event.stopPropagation()}
                            onChange={(event) =>
                              setEditQualificationCode(event.target.value)
                            }
                          />
                        ) : (
                          qualification.qualification_code
                        )}
                      </td>

                      <td>
                        {isEditing ? (
                          <input
                            value={editQualificationName}
                            onClick={(event) => event.stopPropagation()}
                            onChange={(event) =>
                              setEditQualificationName(event.target.value)
                            }
                          />
                        ) : (
                          qualification.qualification_name
                        )}
                      </td>

                      <td>
                        {isEditing ? (
                          <textarea
                            value={editDescription}
                            onClick={(event) => event.stopPropagation()}
                            onChange={(event) =>
                              setEditDescription(event.target.value)
                            }
                          />
                        ) : (
                          qualification.description || "—"
                        )}
                      </td>

                      <td>{moduleCount}</td>

                      <td>
                        <span
                          className={
                            qualification.is_active
                              ? "status-badge status-active"
                              : "status-badge status-inactive"
                          }
                        >
                          {qualification.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>

                      <td onClick={(event) => event.stopPropagation()}>
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              className="btn-primary"
                              disabled={isSaving}
                              onClick={() =>
                                void saveQualification(qualification.id)
                              }
                            >
                              {isSaving ? "Saving..." : "Save"}
                            </button>

                            <button
                              type="button"
                              className="btn-secondary"
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
                              className="btn-secondary"
                              onClick={() => beginEditing(qualification)}
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() =>
                                void toggleQualificationStatus(qualification)
                              }
                            >
                              {qualification.is_active
                                ? "Deactivate"
                                : "Activate"}
                            </button>

                            {qualification.can_delete && (
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={() =>
                                  void removeQualification(qualification)
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

      {selectedQualification && (
        <section className="assignment-workspace">
          <div className="section-header">
            <div>
              <h2>
                {selectedQualification.qualification_code} —{" "}
                {selectedQualification.qualification_name}
              </h2>

              <p className="section-description">
                {selectedModules.length} module
                {selectedModules.length === 1 ? "" : "s"}
              </p>
            </div>

            <button
              type="button"
              className="btn-primary"
              onClick={() =>
                setShowCreateModule((current) => !current)
              }
            >
              {showCreateModule ? "Close" : "+ Add Module"}
            </button>
          </div>

          <div className="workspace-panel">
            {showCreateModule && (
              <form
                onSubmit={handleCreateModule}
                className="modern-form assignment-create-form"
              >
                <div className="form-grid form-grid-2">
                  <div className="form-group">
                    <label htmlFor="module-code">Module code</label>
                    <input
                      id="module-code"
                      value={moduleCode}
                      onChange={(event) =>
                        setModuleCode(event.target.value)
                      }
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="module-name">Module name</label>
                    <input
                      id="module-name"
                      value={moduleName}
                      onChange={(event) =>
                        setModuleName(event.target.value)
                      }
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="module-description">
                    Description
                  </label>
                  <textarea
                    id="module-description"
                    value={moduleDescription}
                    onChange={(event) =>
                      setModuleDescription(event.target.value)
                    }
                  />
                </div>

                <div className="form-actions">
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={isCreatingModule}
                  >
                    {isCreatingModule ? "Creating..." : "Add Module"}
                  </button>

                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={isCreatingModule}
                    onClick={() => setShowCreateModule(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {selectedModules.length === 0 ? (
              <p>No modules under this qualification yet.</p>
            ) : (
              <div className="table-container">
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Module</th>
                      <th>Description</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {selectedModules.map((module) => (
                      <tr key={module.id}>
                        <td>{module.code}</td>
                        <td>{module.name}</td>
                        <td>{module.description || "—"}</td>
                        <td>
                          <span
                            className={
                              module.is_active
                                ? "status-badge status-active"
                                : "status-badge status-inactive"
                            }
                          >
                            {module.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td>
                          {module.can_delete ? (
                            <button
                              type="button"
                              className="btn-danger"
                              onClick={() => void removeModule(module)}
                            >
                              Delete
                            </button>
                          ) : (
                            <span className="muted-text">In use</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
