import {
  useEffect,
  useState,
  type FormEvent,
} from "react";
import { useNavigate } from "react-router";

import {
  createAssessmentMapping,
  getAssignmentLevels,
  getCohorts,
  type AssignmentLevelOption,
  type CohortOption,
} from "../api/lms";
import "../css/AssessmentMappings.css";

export function CreateAssessmentMappingPage() {
  const navigate = useNavigate();

  const [cohorts, setCohorts] = useState<CohortOption[]>([]);
  const [assignmentLevels, setAssignmentLevels] = useState<
    AssignmentLevelOption[]
  >([]);

  const [name, setName] = useState("");
  const [cohortId, setCohortId] = useState("");
  const [assignmentLevelId, setAssignmentLevelId] =
    useState("");

  const [externalPlatformId, setExternalPlatformId] =
    useState("");
  const [externalContextId, setExternalContextId] =
    useState("");
  const [
    externalResourceLinkId,
    setExternalResourceLinkId,
  ] = useState("");

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
    setAssignmentLevelId("");
    setAssignmentLevels([]);
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
      const levels = await getAssignmentLevels(
        selectedCohort.module.id,
      );

      setAssignmentLevels(levels);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load assignment levels.",
      );
    }
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!cohortId || !assignmentLevelId) {
      setError(
        "Please select a cohort and assignment level.",
      );
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      await createAssessmentMapping({
        name,
        cohort: Number(cohortId),
        assignment_level: assignmentLevelId,
        external_platform_id: externalPlatformId,
        external_context_id: externalContextId,
        external_resource_link_id: externalResourceLinkId,
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
          <label htmlFor="mapping-name">
            Mapping name
          </label>

          <input
            id="mapping-name"
            type="text"
            value={name}
            placeholder="e.g. Fall 2026 Intro to CS"
            onChange={(event) =>
              setName(event.target.value)
            }
            required
          />
        </div>

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
                {cohort.qualification.code}
                {" → "}
                {cohort.module.code}
                {" → "}
                {cohort.code}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="assignment-level">
            Assignment level
          </label>

          <select
            id="assignment-level"
            value={assignmentLevelId}
            onChange={(event) =>
              setAssignmentLevelId(
                event.target.value,
              )
            }
            disabled={!cohortId}
            required
          >
            <option value="">
              Select assignment level
            </option>

            {assignmentLevels.map((level) => (
              <option
                key={level.id}
                value={level.id}
              >
                {level.assignment.code}
                {" — "}
                {level.assignment.title}
                {" — "}
                {level.display_name}
                {" v"}
                {level.version}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="external-platform-id">
            External platform ID
          </label>

          <input
            id="external-platform-id"
            type="text"
            placeholder="Optional"
            value={externalPlatformId}
            onChange={(event) =>
              setExternalPlatformId(
                event.target.value,
              )
            }
          />
        </div>

        <div className="form-group">
          <label htmlFor="external-context-id">
            External context ID
          </label>

          <input
            id="external-context-id"
            type="text"
            placeholder="Optional"
            value={externalContextId}
            onChange={(event) =>
              setExternalContextId(
                event.target.value,
              )
            }
          />
        </div>

        <div className="form-group">
          <label htmlFor="external-resource-link-id">
            External resource link ID
          </label>

          <input
            id="external-resource-link-id"
            type="text"
            placeholder="Optional"
            value={externalResourceLinkId}
            onChange={(event) =>
              setExternalResourceLinkId(
                event.target.value,
              )
            }
          />
        </div>

        <div>
          <label className="checkbox-group">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) =>
                setIsActive(event.target.checked)
              }
            />
            Active Mapping
          </label>
        </div>

        {error && (
          <div className="error-message" role="alert" style={{ marginTop: '0', textAlign: 'left' }}>
            {error}
          </div>
        )}

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