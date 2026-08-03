import {
  useEffect,
  useState,
  type FormEvent,
} from "react";

import {
  createQualification,
  getQualifications,
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

  if (isLoading) {
    return <main>Loading qualifications...</main>;
  }

  return (
    <main>
      <h1>Qualifications</h1>

      <section>
        <h2>Add qualification</h2>

        <form onSubmit={handleSubmit}>
          <div>
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

          <div>
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

          <div>
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

          <div>
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
          </div>

          {error && <p role="alert">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? "Creating..."
              : "Add qualification"}
          </button>
        </form>
      </section>

      <section>
        <h2>Existing qualifications</h2>

        {qualifications.length === 0 ? (
          <p>No qualifications found.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Status</th>
                <th>Can delete</th>
              </tr>
            </thead>

            <tbody>
              {qualifications.map((qualification) => (
                <tr key={qualification.id}>
                  <td>{qualification.code}</td>
                  <td>{qualification.name}</td>
                  <td>
                    {qualification.is_active
                      ? "Active"
                      : "Inactive"}
                  </td>
                  <td>
                    {qualification.can_delete
                      ? "Yes"
                      : "No"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}