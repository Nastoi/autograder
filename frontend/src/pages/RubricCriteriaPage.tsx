import "../css/AssessmentMappings.css";
import {
  useEffect,
  useState,
  type FormEvent,
} from "react";

import {
  createRubricCriterion,
  getAssignmentLevels,
  getRubricCriteria,
  type AssignmentLevel,
  type RubricCriterion,
} from "../api/lms";

export function RubricCriteriaPage() {
  const [criteria, setCriteria] = useState<
    RubricCriterion[]
  >([]);

  const [assignmentLevels, setAssignmentLevels] =
    useState<AssignmentLevel[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [assignmentLevelId, setAssignmentLevelId] =
  useState("");

const [criterionCode, setCriterionCode] =
  useState("");

const [title, setTitle] = useState("");
const [description, setDescription] =
  useState("");

const [maximumScore, setMaximumScore] =
  useState("10");

const [sequence, setSequence] = useState("1");

const [aiGradable, setAiGradable] =
  useState(true);

const [deterministic, setDeterministic] =
  useState(false);

const [isSubmitting, setIsSubmitting] =
  useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [criteriaData, levelData] =
          await Promise.all([
            getRubricCriteria(),
            getAssignmentLevels(),
          ]);

        setCriteria(criteriaData);
        setAssignmentLevels(levelData);
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to load rubric criteria.",
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
    await createRubricCriterion({
      assignment_level: assignmentLevelId,
      criterion_code: criterionCode,
      title,
      description,
      maximum_score: maximumScore,
      sequence: Number(sequence),
      ai_gradable: aiGradable,
      deterministic,
    });

    setCriterionCode("");
    setTitle("");
    setDescription("");
    setMaximumScore("10");
    setSequence("1");
    setAiGradable(true);
    setDeterministic(false);

    const data = await getRubricCriteria();
    setCriteria(data);
  } catch (caughtError) {
    setError(
      caughtError instanceof Error
        ? caughtError.message
        : "Unable to create rubric criterion.",
    );
  } finally {
    setIsSubmitting(false);
  }
}


  if (isLoading) {
    return <main className="admin-container">Loading rubric criteria...</main>;
  }

  return (
    <main className="admin-container">
      <div className="admin-header">
                <h1>Rubric criteria</h1>
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
              <span className="status-label">Rubric criteria</span>
              <span className="status-value">{criteria.length}</span>
            </div>
        </div>
      </section>


        <section>
  <h2 style={{ marginBottom: "16px", color: "white" }}>Add rubric criterion</h2>

  <form onSubmit={handleSubmit} className="modern-form">
    <div className="form-group">
      <label htmlFor="criterion-assignment-level">
        Assignment level
      </label>

      <select
        id="criterion-assignment-level"
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
      <label htmlFor="criterion-code">
        Criterion code
      </label>

      <input
        id="criterion-code"
        value={criterionCode}
        onChange={(event) =>
          setCriterionCode(event.target.value)
        }
        required
      />
    </div>

    <div className="form-group">
      <label htmlFor="criterion-title">
        Title
      </label>

      <input
        id="criterion-title"
        value={title}
        onChange={(event) =>
          setTitle(event.target.value)
        }
        required
      />
    </div>

    <div className="form-group">
      <label htmlFor="criterion-description">
        Description
      </label>

      <textarea
        id="criterion-description"
        value={description}
        onChange={(event) =>
          setDescription(event.target.value)
        }
      />
    </div>

    <div className="form-group">
      <label htmlFor="criterion-maximum-score">
        Maximum score
      </label>

      <input
        id="criterion-maximum-score"
        type="number"
        min="0.01"
        step="0.01"
        value={maximumScore}
        onChange={(event) =>
          setMaximumScore(event.target.value)
        }
        required
      />
    </div>

    <div className="form-group">
      <label htmlFor="criterion-sequence">
        Sequence
      </label>

      <input
        id="criterion-sequence"
        type="number"
        min="1"
        value={sequence}
        onChange={(event) =>
          setSequence(event.target.value)
        }
        required
      />
    </div>

    <label className="checkbox-group">
      <input
        type="checkbox"
        checked={aiGradable}
        onChange={(event) =>
          setAiGradable(event.target.checked)
        }
      />
      AI gradable
    </label>

    <label className="checkbox-group">
      <input
        type="checkbox"
        checked={deterministic}
        onChange={(event) =>
          setDeterministic(event.target.checked)
        }
      />
      Deterministic
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
                                : "Add rubric criterion"}
                            </button>
                    </div>
  </form>
</section>


      <section>
        <h2 style={{ marginBottom: "16px", color: "white" }}>Existing rubric criteria</h2>

        {criteria.length === 0 ? (
          <p>
            No rubric criteria found. Create one under an
            assignment level first.
          </p>
        ) : (
          <div className="table-container">
                        <table className="modern-table">
                                    <thead>
                                      <tr>
                                        <th>Assignment</th>
                                        <th>Level</th>
                                        <th>Sequence</th>
                                        <th>Code</th>
                                        <th>Title</th>
                                        <th>Maximum score</th>
                                        <th>AI gradable</th>
                                        <th>Deterministic</th>
                                      </tr>
                                    </thead>
                        
                                    <tbody>
                                      {criteria.map((criterion) => (
                                        <tr key={criterion.id}>
                                          <td>
                                            {criterion.assignment_code} —{" "}
                                            {criterion.assignment_title}
                                          </td>
                        
                                          <td>
                                            {criterion.level_display_name}
                                          </td>
                        
                                          <td>{criterion.sequence}</td>
                        
                                          <td>{criterion.criterion_code}</td>
                        
                                          <td>{criterion.title}</td>
                        
                                          <td>{criterion.maximum_score}</td>
                        
                                          <td>
                                            {criterion.ai_gradable
                                              ? "Yes"
                                              : "No"}
                                          </td>
                        
                                          <td>
                                            {criterion.deterministic
                                              ? "Yes"
                                              : "No"}
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