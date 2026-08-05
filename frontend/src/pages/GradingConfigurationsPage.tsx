import "../css/AssessmentMappings.css";
import {
  useEffect,
  useState,
  type FormEvent,
} from "react";

import {
  createGradingConfiguration,
  getGradingConfigurations,
  type GradingConfiguration,
} from "../api/lms";

export function GradingConfigurationsPage() {
  const [configurations, setConfigurations] = useState<
    GradingConfiguration[]
  >([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [code, setCode] = useState("");
const [name, setName] = useState("");

const [gradingType, setGradingType] =
  useState<GradingConfiguration["grading_type"]>(
    "hybrid",
  );

const [structuralCheckEnabled, setStructuralCheckEnabled] =
  useState(true);

const [automatedTestingEnabled, setAutomatedTestingEnabled] =
  useState(false);

const [ragEnabled, setRagEnabled] = useState(true);
const [aiGradingEnabled, setAiGradingEnabled] =
  useState(true);

const [manualReviewRequired, setManualReviewRequired] =
  useState(true);

const [
  confidenceReviewThreshold,
  setConfidenceReviewThreshold,
] = useState("0.700");

const [version, setVersion] = useState("1");
const [isActive, setIsActive] = useState(true);
const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadConfigurations() {
      try {
        const data = await getGradingConfigurations();
        setConfigurations(data);
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to load grading configurations.",
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadConfigurations();
  }, []);


  async function handleSubmit(
  event: FormEvent<HTMLFormElement>,
) {
  event.preventDefault();

  setError("");
  setIsSubmitting(true);

  try {
    await createGradingConfiguration({
      code,
      name,
      grading_type: gradingType,
      structural_check_enabled: structuralCheckEnabled,
      automated_testing_enabled: automatedTestingEnabled,
      rag_enabled: ragEnabled,
      ai_grading_enabled: aiGradingEnabled,
      manual_review_required: manualReviewRequired,
      confidence_review_threshold:
        confidenceReviewThreshold,
      version: Number(version),
      configuration: {},
      is_active: isActive,
    });

    setCode("");
    setName("");
    setGradingType("hybrid");
    setStructuralCheckEnabled(true);
    setAutomatedTestingEnabled(false);
    setRagEnabled(true);
    setAiGradingEnabled(true);
    setManualReviewRequired(true);
    setConfidenceReviewThreshold("0.700");
    setVersion("1");
    setIsActive(true);

    const data = await getGradingConfigurations();
    setConfigurations(data);
  } catch (caughtError) {
    setError(
      caughtError instanceof Error
        ? caughtError.message
        : "Unable to create grading configuration.",
    );
  } finally {
    setIsSubmitting(false);
  }
}


  if (isLoading) {
    return <main className="admin-container">Loading grading configurations...</main>;
  }

  return (
    <main className="admin-container">
      <div className="admin-header">
                <h1>Grading configurations</h1>
            </div>

      {error && <p role="alert" className="error-message">{error}</p>}
        
      <div className="admin-split-layout">
        <section>
  <h2 style={{ marginBottom: "16px", color: "#112642" }}>Add grading configuration</h2>

  <form onSubmit={handleSubmit} className="modern-form">
    <div className="form-group">
      <label htmlFor="grading-code">Code</label>

      <input
        id="grading-code"
        value={code}
        onChange={(event) => setCode(event.target.value)}
        required
      />
    </div>

    <div className="form-group">
      <label htmlFor="grading-name">Name</label>

      <input
        id="grading-name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        required
      />
    </div>

    <div className="form-group">
      <label htmlFor="grading-type">Grading type</label>

      <select
        id="grading-type"
        value={gradingType}
        onChange={(event) =>
          setGradingType(
            event.target.value as GradingConfiguration["grading_type"],
          )
        }
      >
        <option value="rules_only">Rules only</option>
        <option value="automated_tests">Automated tests</option>
        <option value="ai_rubric">AI rubric</option>
        <option value="hybrid">Hybrid</option>
        <option value="manual">Manual</option>
      </select>
    </div>

    <label className="checkbox-group">
      <input
        type="checkbox"
        checked={structuralCheckEnabled}
        onChange={(event) =>
          setStructuralCheckEnabled(event.target.checked)
        }
      />
      Structural checks enabled
    </label>

    <label className="checkbox-group">
      <input
        type="checkbox"
        checked={automatedTestingEnabled}
        onChange={(event) =>
          setAutomatedTestingEnabled(event.target.checked)
        }
      />
      Automated testing enabled
    </label>

    <label className="checkbox-group">
      <input
        type="checkbox"
        checked={ragEnabled}
        onChange={(event) =>
          setRagEnabled(event.target.checked)
        }
      />
      RAG enabled
    </label>

    <label className="checkbox-group">
      <input
        type="checkbox"
        checked={aiGradingEnabled}
        onChange={(event) =>
          setAiGradingEnabled(event.target.checked)
        }
      />
      AI grading enabled
    </label>

    <label className="checkbox-group">
      <input
        type="checkbox"
        checked={manualReviewRequired}
        onChange={(event) =>
          setManualReviewRequired(event.target.checked)
        }
      />
      Manual review required
    </label>

    <div className="form-group">
      <label htmlFor="confidence-threshold">
        Confidence review threshold
      </label>

      <input
        id="confidence-threshold"
        type="number"
        min="0"
        max="1"
        step="0.001"
        value={confidenceReviewThreshold}
        onChange={(event) =>
          setConfidenceReviewThreshold(event.target.value)
        }
        required
      />
    </div>

    <div className="form-group">
      <label htmlFor="configuration-version">
        Version
      </label>

      <input
        id="configuration-version"
        type="number"
        min="1"
        value={version}
        onChange={(event) =>
          setVersion(event.target.value)
        }
        required
      />
    </div>

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

    {error && <p role="alert" className="error-message">{error}</p>}

    <div className="form-actions">
                        <button
                              type="submit"
                              disabled={isSubmitting}
                             className="btn-primary">
                              {isSubmitting
                                ? "Creating..."
                                : "Add grading configuration"}
                            </button>
                    </div>
  </form>
</section>

      <section>
        <h2 style={{ marginBottom: "16px", color: "#112642" }}>Existing grading configurations</h2>
      {configurations.length === 0 ? (
        <p>
          No grading configurations found. Create one before
          creating assignment levels.
        </p>
      ) : (
        <div className="table-container">
                        <table className="modern-table">
                                  <thead>
                                    <tr>
                                      <th>Code</th>
                                      <th>Name</th>
                                      <th>Type</th>
                                      <th>Version</th>
                                      <th>RAG</th>
                                      <th>AI grading</th>
                                      <th>Manual review</th>
                                      <th>Status</th>
                                    </tr>
                                  </thead>
                        
                                  <tbody>
                                    {configurations.map((configuration) => (
                                      <tr key={configuration.id}>
                                        <td>{configuration.code}</td>
                                        <td>{configuration.name}</td>
                                        <td>{configuration.grading_type}</td>
                                        <td>{configuration.version}</td>
                                        <td>
                                          {configuration.rag_enabled
                                            ? "Enabled"
                                            : "Disabled"}
                                        </td>
                                        <td>
                                          {configuration.ai_grading_enabled
                                            ? "Enabled"
                                            : "Disabled"}
                                        </td>
                                        <td>
                                          {configuration.manual_review_required
                                            ? "Required"
                                            : "Not required"}
                                        </td>
                                        <td>
                                          {configuration.is_active
                                            ? "Active"
                                            : "Inactive"}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                    </div>
      )}
      </section>
      </div>
    </main>
  );
}