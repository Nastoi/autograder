import {
  useEffect,
  useState,
  type FormEvent,
} from "react";

import {
  createModule,
  deleteModule,
  getModules,
  getQualifications,
  updateModule,
  type Module,
  type Qualification,
} from "../api/lms";

export function ModulesPage() {
  const [modules, setModules] = useState<Module[]>([]);
  const [qualifications, setQualifications] = useState<
    Qualification[]
  >([]);

  const [qualificationId, setQualificationId] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [editingId, setEditingId] = useState<string | null>(
    null,
  );
  const [editQualificationId, setEditQualificationId] =
    useState("");
  const [editCode, setEditCode] = useState("");
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadData() {
    try {
      const [moduleData, qualificationData] =
        await Promise.all([
          getModules(),
          getQualifications(),
        ]);

      setModules(moduleData);
      setQualifications(qualificationData);

      if (
        !qualificationId &&
        qualificationData.length > 0
      ) {
        setQualificationId(qualificationData[0].id);
      }
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load modules.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");
    setIsSubmitting(true);

    try {
      await createModule({
        qualification: qualificationId,
        code,
        name,
        description,
        is_active: isActive,
      });

      setCode("");
      setName("");
      setDescription("");
      setIsActive(true);

      await loadData();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to create module.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function beginEditing(module: Module) {
    setEditingId(module.id);
    setEditQualificationId(module.qualification);
    setEditCode(module.code);
    setEditName(module.name);
    setEditDescription(module.description);
    setError("");
  }

  function cancelEditing() {
    setEditingId(null);
    setEditQualificationId("");
    setEditCode("");
    setEditName("");
    setEditDescription("");
  }

  async function saveModule(moduleId: string) {
    setError("");
    setIsSaving(true);

    try {
      await updateModule(moduleId, {
        qualification: editQualificationId,
        code: editCode,
        name: editName,
        description: editDescription,
      });

      cancelEditing();
      await loadData();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to update module.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleModuleStatus(module: Module) {
    setError("");

    try {
      await updateModule(module.id, {
        is_active: !module.is_active,
      });

      await loadData();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to update module status.",
      );
    }
  }

  async function removeModule(module: Module) {
    const confirmed = window.confirm(
      `Delete module ${module.code}?`,
    );

    if (!confirmed) {
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
    return <main>Loading modules...</main>;
  }

  return (
    <main>
      <h1>Modules</h1>

      <section>
        <h2>Add module</h2>

        <form onSubmit={handleSubmit}>
          <div>
            <label htmlFor="module-qualification">
              Qualification
            </label>

            <select
              id="module-qualification"
              value={qualificationId}
              onChange={(event) =>
                setQualificationId(event.target.value)
              }
              required
            >
              <option value="">
                Select qualification
              </option>

              {qualifications.map((qualification) => (
                <option
                  key={qualification.id}
                  value={qualification.id}
                >
                  {qualification.code} - {qualification.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="module-code">Code</label>

            <input
              id="module-code"
              value={code}
              onChange={(event) =>
                setCode(event.target.value)
              }
              required
            />
          </div>

          <div>
            <label htmlFor="module-name">Name</label>

            <input
              id="module-name"
              value={name}
              onChange={(event) =>
                setName(event.target.value)
              }
              required
            />
          </div>

          <div>
            <label htmlFor="module-description">
              Description
            </label>

            <textarea
              id="module-description"
              value={description}
              onChange={(event) =>
                setDescription(event.target.value)
              }
            />
          </div>

          <label>
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) =>
                setIsActive(event.target.checked)
              }
            />
            Active
          </label>

          {error && <p role="alert">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? "Creating..."
              : "Add module"}
          </button>
        </form>
      </section>

      <section>
        <h2>Existing modules</h2>

        {modules.length === 0 ? (
          <p>No modules found.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Qualification</th>
                <th>Code</th>
                <th>Name</th>
                <th>Description</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {modules.map((module) => {
                const isEditing =
                  editingId === module.id;

                return (
                  <tr key={module.id}>
                    <td>
                      {isEditing ? (
                        <select
                          value={editQualificationId}
                          onChange={(event) =>
                            setEditQualificationId(
                              event.target.value,
                            )
                          }
                        >
                          {qualifications.map(
                            (qualification) => (
                              <option
                                key={qualification.id}
                                value={qualification.id}
                              >
                                {qualification.code}
                              </option>
                            ),
                          )}
                        </select>
                      ) : (
                        module.qualification_code
                      )}
                    </td>

                    <td>
                      {isEditing ? (
                        <input
                          value={editCode}
                          onChange={(event) =>
                            setEditCode(event.target.value)
                          }
                        />
                      ) : (
                        module.code
                      )}
                    </td>

                    <td>
                      {isEditing ? (
                        <input
                          value={editName}
                          onChange={(event) =>
                            setEditName(event.target.value)
                          }
                        />
                      ) : (
                        module.name
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
                        module.description || "—"
                      )}
                    </td>

                    <td>
                      {module.is_active
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
                              void saveModule(module.id)
                            }
                          >
                            {isSaving
                              ? "Saving..."
                              : "Save"}
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
                              beginEditing(module)
                            }
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              void toggleModuleStatus(
                                module,
                              )
                            }
                          >
                            {module.is_active
                              ? "Deactivate"
                              : "Activate"}
                          </button>

                          {module.can_delete && (
                            <button
                              type="button"
                              onClick={() =>
                                void removeModule(module)
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
        )}
      </section>
    </main>
  );
}