import "../css/AssessmentMappings.css";
import {
  useEffect,
  useState,
  type FormEvent,
} from "react";

import {
  createAIGradingProfile,
  getAIGradingProfiles,
  getAssignmentLevels,
  type AIGradingProfile,
  type AssignmentLevel,
} from "../api/lms";

export function AIGradingProfilesPage() {
  const [profiles, setProfiles] = useState<
    AIGradingProfile[]
  >([]);

  const [assignmentLevels, setAssignmentLevels] =
    useState<AssignmentLevel[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [assignmentLevelId, setAssignmentLevelId] =
  useState("");

const [profileName, setProfileName] = useState("");
const [systemPrompt, setSystemPrompt] = useState("");

const [outputSchemaText, setOutputSchemaText] = useState(
  `{
  "score": 0,
  "feedback": "",
  "confidence": 0
}`,
);

const [temperature, setTemperature] = useState("0.10");

const [modelProvider, setModelProvider] =
  useState("ollama");

const [modelName, setModelName] =
  useState("configure-in-environment");

const [isActive, setIsActive] = useState(true);

const [isSubmitting, setIsSubmitting] =
  useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [profileData, levelData] =
          await Promise.all([
            getAIGradingProfiles(),
            getAssignmentLevels(),
          ]);

        setProfiles(profileData);
        setAssignmentLevels(levelData);
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to load AI grading profiles.",
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadData();
  }, []);


  async function handleSubmit(
  event: FormEvent<HTMLFormElement>,
) {
  event.preventDefault();

  setError("");
  setIsSubmitting(true);

  try {
    let outputSchema: Record<string, unknown>;

    try {
      outputSchema = JSON.parse(outputSchemaText) as Record<
        string,
        unknown
      >;
    } catch {
      throw new Error(
        "Output schema must be valid JSON.",
      );
    }

    await createAIGradingProfile({
      assignment_level: assignmentLevelId,
      profile_name: profileName,
      system_prompt: systemPrompt,
      output_schema: outputSchema,
      temperature,
      model_provider: modelProvider,
      model_name: modelName,
      is_active: isActive,
    });

    setAssignmentLevelId("");
    setProfileName("");
    setSystemPrompt("");
    setOutputSchemaText(`{
  "score": 0,
  "feedback": "",
  "confidence": 0
}`);
    setTemperature("0.10");
    setModelProvider("ollama");
    setModelName("configure-in-environment");
    setIsActive(true);

    const data = await getAIGradingProfiles();
    setProfiles(data);
  } catch (caughtError) {
    setError(
      caughtError instanceof Error
        ? caughtError.message
        : "Unable to create AI grading profile.",
    );
  } finally {
    setIsSubmitting(false);
  }
}


  if (isLoading) {
    return <main className="admin-container">Loading AI grading profiles...</main>;
  }

  return (
    <main className="admin-container">
      <div className="admin-header">
                <h1>AI grading profiles</h1>
            </div>

      {error && <p role="alert" className="error-message">{error}</p>}

      <section>
        <h2>Setup status</h2>

        <div className="status-grid">
          <div className="status-card">
              <span className="status-label">Assignment levels</span>
              <span className="status-value">{assignmentLevels.length}</span>
            </div>
          <div className="status-card">
              <span className="status-label">AI grading profiles</span>
              <span className="status-value">{profiles.length}</span>
            </div>
        </div>
      </section>


    <section>
  <h2 style={{ marginBottom: "16px", color: "white" }}>Add AI grading profile</h2>

  <form onSubmit={handleSubmit} className="modern-form">
    <div className="form-group">
      <label htmlFor="ai-profile-assignment-level">
        Assignment level
      </label>

      <select
        id="ai-profile-assignment-level"
        value={assignmentLevelId}
        onChange={(event) =>
          setAssignmentLevelId(event.target.value)
        }
        required
      >
        <option value="">
          Select assignment level
        </option>

        {assignmentLevels.map((level) => (
          <option key={level.id} value={level.id}>
            {level.assignment_code} —{" "}
            {level.assignment_title} —{" "}
            {level.display_name}
          </option>
        ))}
      </select>
    </div>

    <div className="form-group">
      <label htmlFor="ai-profile-name">
        Profile name
      </label>

      <input
        id="ai-profile-name"
        value={profileName}
        onChange={(event) =>
          setProfileName(event.target.value)
        }
        required
      />
    </div>

    <div className="form-group">
      <label htmlFor="ai-system-prompt">
        System prompt
      </label>

      <textarea
        id="ai-system-prompt"
        value={systemPrompt}
        onChange={(event) =>
          setSystemPrompt(event.target.value)
        }
        rows={12}
        required
      />
    </div>

    <div className="form-group">
      <label htmlFor="ai-output-schema">
        Output schema
      </label>

      <textarea
        id="ai-output-schema"
        value={outputSchemaText}
        onChange={(event) =>
          setOutputSchemaText(event.target.value)
        }
        rows={10}
        required
      />
    </div>

    <div className="form-group">
      <label htmlFor="ai-temperature">
        Temperature
      </label>

      <input
        id="ai-temperature"
        type="number"
        min="0"
        max="2"
        step="0.01"
        value={temperature}
        onChange={(event) =>
          setTemperature(event.target.value)
        }
        required
      />
    </div>

    <div className="form-group">
      <label htmlFor="ai-model-provider">
        Model provider
      </label>

      <input
        id="ai-model-provider"
        value={modelProvider}
        onChange={(event) =>
          setModelProvider(event.target.value)
        }
        required
      />
    </div>

    <div className="form-group">
      <label htmlFor="ai-model-name">
        Model name
      </label>

      <input
        id="ai-model-name"
        value={modelName}
        onChange={(event) =>
          setModelName(event.target.value)
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
                              disabled={
                                isSubmitting ||
                                !assignmentLevelId
                              }
                             className="btn-primary">
                              {isSubmitting
                                ? "Creating..."
                                : "Add AI grading profile"}
                            </button>
                    </div>
  </form>
</section>


      <section>
        <h2 style={{ marginBottom: "16px", color: "white" }}>Existing AI grading profiles</h2>

        {profiles.length === 0 ? (
          <p>
            No AI grading profiles found. Create one under an
            assignment level first.
          </p>
        ) : (
          <div className="table-container">
                        <table className="modern-table">
                                    <thead>
                                      <tr>
                                        <th>Assignment</th>
                                        <th>Level</th>
                                        <th>Profile</th>
                                        <th>Provider</th>
                                        <th>Model</th>
                                        <th>Temperature</th>
                                        <th>Status</th>
                                      </tr>
                                    </thead>
                        
                                    <tbody>
                                      {profiles.map((profile) => (
                                        <tr key={profile.id}>
                                          <td>
                                            {profile.assignment_code} —{" "}
                                            {profile.assignment_title}
                                          </td>
                        
                                          <td>{profile.level_display_name}</td>
                        
                                          <td>{profile.profile_name}</td>
                        
                                          <td>{profile.model_provider}</td>
                        
                                          <td>{profile.model_name}</td>
                        
                                          <td>{profile.temperature}</td>
                        
                                          <td>
                                            {profile.is_active
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
    </main>
  );
}


export default AIGradingProfilesPage;