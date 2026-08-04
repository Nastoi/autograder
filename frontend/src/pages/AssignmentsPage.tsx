import {
    useEffect,
    useState,
    type FormEvent,
} from "react";

import {
    createModuleAssignment,
    getModuleAssignments,
    getModules,
    getQualifications,
    type Module,
    type ModuleAssignment,
    type Qualification,
} from "../api/lms";

export function AssignmentsPage() {
    const [assignments, setAssignments] = useState<
        ModuleAssignment[]
    >([]);

    const [modules, setModules] = useState<Module[]>([]);

    const [qualifications, setQualifications] = useState<
        Qualification[]
    >([]);

    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");

    const [qualificationId, setQualificationId] = useState("");
    const [moduleId, setModuleId] = useState("");

    const [assignmentNumber, setAssignmentNumber] =
        useState("1");
    const [code, setCode] = useState("");
    const [title, setTitle] = useState("");

    const [skillStatementCode, setSkillStatementCode] =
        useState("");
    const [skillStatement, setSkillStatement] = useState("");
    const [objective, setObjective] = useState("");

    const [maximumScore, setMaximumScore] = useState("100");
    const [minimumPassScore, setMinimumPassScore] =
        useState("50");

    const [isSummative, setIsSummative] = useState(true);
    const [
        contributesToFinalMark,
        setContributesToFinalMark,
    ] = useState(true);

    const [finalMarkWeight, setFinalMarkWeight] =
        useState("100");
    const [isActive, setIsActive] = useState(true);

    const [isSubmitting, setIsSubmitting] = useState(false);

    const filteredModules = modules.filter(
        (module) =>
            !qualificationId ||
            module.qualification === qualificationId,
    );

    useEffect(() => {
        async function loadData() {
            try {
                const [
                    assignmentData,
                    moduleData,
                    qualificationData,
                ] = await Promise.all([
                    getModuleAssignments(),
                    getModules(),
                    getQualifications(),
                ]);

                setAssignments(assignmentData);
                setModules(moduleData);
                setQualifications(qualificationData);
            } catch (caughtError) {
                setError(
                    caughtError instanceof Error
                        ? caughtError.message
                        : "Unable to load assignments.",
                );
            } finally {
                setIsLoading(false);
            }
        }

        void loadData();
    }, []);

    if (isLoading) {
        return <main>Loading assignments...</main>;
    }


    async function handleSubmit(
        event: FormEvent<HTMLFormElement>,
    ) {
        event.preventDefault();

        setError("");
        setIsSubmitting(true);

        try {
            await createModuleAssignment({
                module: moduleId,
                assignment_number: Number(assignmentNumber),
                code,
                title,
                skill_statement_code: skillStatementCode,
                skill_statement: skillStatement,
                objective,
                maximum_score: maximumScore,
                minimum_pass_score: minimumPassScore,
                is_summative: isSummative,
                contributes_to_final_mark:
                    contributesToFinalMark,
                final_mark_weight: finalMarkWeight,
                is_active: isActive,
            });

            setAssignmentNumber("1");
            setCode("");
            setTitle("");
            setSkillStatementCode("");
            setSkillStatement("");
            setObjective("");
            setMaximumScore("100");
            setMinimumPassScore("50");
            setIsSummative(true);
            setContributesToFinalMark(true);
            setFinalMarkWeight("100");
            setIsActive(true);

            const assignmentData =
                await getModuleAssignments();

            setAssignments(assignmentData);
        } catch (caughtError) {
            setError(
                caughtError instanceof Error
                    ? caughtError.message
                    : "Unable to create assignment.",
            );
        } finally {
            setIsSubmitting(false);
        }
    }


    return (
        <main>
            <h1>Assignments</h1>

            {error && <p role="alert">{error}</p>}

            <section>
                <h2>Setup status</h2>

                <p>
                    Qualifications available: {qualifications.length}
                </p>

                <p>Modules available: {modules.length}</p>

                <p>Assignments available: {assignments.length}</p>
            </section>



            <section>
  <h2>Add assignment</h2>

  <form onSubmit={handleSubmit}>
    <div>
      <label htmlFor="assignment-qualification">
        Qualification
      </label>

      <select
        id="assignment-qualification"
        value={qualificationId}
        onChange={(event) => {
          setQualificationId(event.target.value);
          setModuleId("");
        }}
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
      <label htmlFor="assignment-module">
        Module
      </label>

      <select
        id="assignment-module"
        value={moduleId}
        onChange={(event) =>
          setModuleId(event.target.value)
        }
        disabled={!qualificationId}
        required
      >
        <option value="">
          Select module
        </option>

        {filteredModules.map((module) => (
          <option
            key={module.id}
            value={module.id}
          >
            {module.code} - {module.name}
          </option>
        ))}
      </select>
    </div>

    <div>
      <label htmlFor="assignment-number">
        Assignment number
      </label>

      <input
        id="assignment-number"
        type="number"
        min="1"
        value={assignmentNumber}
        onChange={(event) =>
          setAssignmentNumber(event.target.value)
        }
        required
      />
    </div>

    <div>
      <label htmlFor="assignment-code">
        Code
      </label>

      <input
        id="assignment-code"
        value={code}
        onChange={(event) =>
          setCode(event.target.value)
        }
        required
      />
    </div>

    <div>
      <label htmlFor="assignment-title">
        Title
      </label>

      <input
        id="assignment-title"
        value={title}
        onChange={(event) =>
          setTitle(event.target.value)
        }
        required
      />
    </div>

    <div>
      <label htmlFor="skill-statement-code">
        Skill statement code
      </label>

      <input
        id="skill-statement-code"
        value={skillStatementCode}
        onChange={(event) =>
          setSkillStatementCode(event.target.value)
        }
        required
      />
    </div>

    <div>
      <label htmlFor="skill-statement">
        Skill statement
      </label>

      <textarea
        id="skill-statement"
        value={skillStatement}
        onChange={(event) =>
          setSkillStatement(event.target.value)
        }
        required
      />
    </div>

    <div>
      <label htmlFor="assignment-objective">
        Objective
      </label>

      <textarea
        id="assignment-objective"
        value={objective}
        onChange={(event) =>
          setObjective(event.target.value)
        }
      />
    </div>

    <div>
      <label htmlFor="maximum-score">
        Maximum score
      </label>

      <input
        id="maximum-score"
        type="number"
        min="0"
        step="0.01"
        value={maximumScore}
        onChange={(event) =>
          setMaximumScore(event.target.value)
        }
        required
      />
    </div>

    <div>
      <label htmlFor="minimum-pass-score">
        Minimum pass score
      </label>

      <input
        id="minimum-pass-score"
        type="number"
        min="0"
        step="0.01"
        value={minimumPassScore}
        onChange={(event) =>
          setMinimumPassScore(event.target.value)
        }
        required
      />
    </div>

    <label>
      <input
        type="checkbox"
        checked={isSummative}
        onChange={(event) =>
          setIsSummative(event.target.checked)
        }
      />
      Summative
    </label>

    <label>
      <input
        type="checkbox"
        checked={contributesToFinalMark}
        onChange={(event) =>
          setContributesToFinalMark(
            event.target.checked,
          )
        }
      />
      Contributes to final mark
    </label>

    <div>
      <label htmlFor="final-mark-weight">
        Final mark weight
      </label>

      <input
        id="final-mark-weight"
        type="number"
        min="0"
        max="100"
        step="0.01"
        value={finalMarkWeight}
        onChange={(event) =>
          setFinalMarkWeight(event.target.value)
        }
        disabled={!contributesToFinalMark}
        required={contributesToFinalMark}
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
      disabled={
        isSubmitting ||
        !qualificationId ||
        !moduleId
      }
    >
      {isSubmitting
        ? "Creating..."
        : "Add assignment"}
    </button>
  </form>
</section>


            <section>
                <h2>Existing assignments</h2>

                {assignments.length === 0 ? (
                    <p>
                        No assignments found. Create an assignment under
                        a module first.
                    </p>
                ) : (
                    <table>
                        <thead>
                            <tr>
                                <th>Qualification</th>
                                <th>Module</th>
                                <th>Number</th>
                                <th>Code</th>
                                <th>Title</th>
                                <th>Maximum score</th>
                                <th>Pass score</th>
                                <th>Status</th>
                            </tr>
                        </thead>

                        <tbody>
                            {assignments.map((assignment) => (
                                <tr key={assignment.id}>
                                    <td>
                                        {assignment.qualification_code}
                                    </td>

                                    <td>{assignment.module_code}</td>

                                    <td>{assignment.assignment_number}</td>

                                    <td>{assignment.code}</td>

                                    <td>{assignment.title}</td>

                                    <td>{assignment.maximum_score}</td>

                                    <td>
                                        {assignment.minimum_pass_score}
                                    </td>

                                    <td>
                                        {assignment.is_active
                                            ? "Active"
                                            : "Inactive"}
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