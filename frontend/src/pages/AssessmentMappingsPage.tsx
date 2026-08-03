import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

import {
  getAssessmentMappings,
  type AssessmentMapping,
} from "../api/lms";

export function AssessmentMappingsPage() {
  const navigate = useNavigate();

  const [mappings, setMappings] = useState<
    AssessmentMapping[]
  >([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadMappings() {
      try {
        const data = await getAssessmentMappings();
        setMappings(data);
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to load assessment mappings.",
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadMappings();
  }, []);

  if (isLoading) {
    return <main>Loading assessment mappings...</main>;
  }

  if (error) {
    return (
      <main>
        <h1>Assessment mappings</h1>
        <p role="alert">{error}</p>
      </main>
    );
  }

  return (
    <main>
      <header>
        <h1>Assessment mappings</h1>

        <button
          type="button"
          onClick={() => navigate("/admin/mappings/new")}
        >
          Create mapping
        </button>
      </header>

      {mappings.length === 0 ? (
        <section>
          <p>No assessment mappings have been created yet.</p>
        </section>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Cohort</th>
              <th>Assignment</th>
              <th>Level</th>
              <th>Status</th>
              <th>Usage</th>
            </tr>
          </thead>

          <tbody>
            {mappings.map((mapping) => (
              <tr key={mapping.id}>
                <td>{mapping.name}</td>

                <td>
                  {mapping.cohort_code} —{" "}
                  {mapping.cohort_name}
                </td>

                <td>
                  {mapping.assignment_code} —{" "}
                  {mapping.assignment_title}
                </td>

                <td>{mapping.level_code}</td>

                <td>
                  {mapping.is_active
                    ? "Active"
                    : "Inactive"}
                </td>

                <td>
                  {mapping.has_submissions
                    ? "Used by submissions"
                    : "Not used"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}