import {
  useEffect,
  useState,
  type FormEvent,
} from "react";

import {
  createRubricBand,
  getRubricBands,
  getRubricCriteria,
  type RubricBand,
  type RubricCriterion,
} from "../api/lms";

export function RubricBandsPage() {
  const [bands, setBands] = useState<RubricBand[]>([]);
  const [criteria, setCriteria] = useState<
    RubricCriterion[]
  >([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [rubricCriterionId, setRubricCriterionId] =
  useState("");

const [bandCode, setBandCode] =
  useState<RubricBand["band_code"]>("failed");

const [displayName, setDisplayName] =
  useState("Failed");

const [minimumPercentage, setMinimumPercentage] =
  useState("0");

const [maximumPercentage, setMaximumPercentage] =
  useState("49.99");

const [descriptor, setDescriptor] = useState("");

const [sequence, setSequence] = useState("1");

const [isSubmitting, setIsSubmitting] =
  useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [bandData, criterionData] =
          await Promise.all([
            getRubricBands(),
            getRubricCriteria(),
          ]);

        setBands(bandData);
        setCriteria(criterionData);
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to load rubric bands.",
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
    await createRubricBand({
      rubric_criterion: rubricCriterionId,
      band_code: bandCode,
      display_name: displayName,
      minimum_percentage: minimumPercentage,
      maximum_percentage: maximumPercentage,
      descriptor,
      sequence: Number(sequence),
    });

    setBandCode("failed");
    setDisplayName("Failed");
    setMinimumPercentage("0");
    setMaximumPercentage("49.99");
    setDescriptor("");
    setSequence("1");

    const data = await getRubricBands();
    setBands(data);
  } catch (caughtError) {
    setError(
      caughtError instanceof Error
        ? caughtError.message
        : "Unable to create rubric band.",
    );
  } finally {
    setIsSubmitting(false);
  }
}


  if (isLoading) {
    return <main>Loading rubric bands...</main>;
  }

  return (
    <main>
      <h1>Rubric bands</h1>

      {error && <p role="alert">{error}</p>}

      <section>
        <h2>Setup status</h2>

        <p>Rubric criteria: {criteria.length}</p>
        <p>Rubric bands: {bands.length}</p>
      </section>



        <section>
  <h2>Add rubric band</h2>

  <form onSubmit={handleSubmit}>
    <div>
      <label htmlFor="band-criterion">
        Rubric criterion
      </label>

      <select
        id="band-criterion"
        value={rubricCriterionId}
        onChange={(event) =>
          setRubricCriterionId(event.target.value)
        }
        required
      >
        <option value="">
          Select rubric criterion
        </option>

        {criteria.map((criterion) => (
          <option
            key={criterion.id}
            value={criterion.id}
          >
            {criterion.assignment_code} —{" "}
            {criterion.level_display_name} —{" "}
            {criterion.criterion_code} —{" "}
            {criterion.title}
          </option>
        ))}
      </select>
    </div>

    <div>
      <label htmlFor="band-code">
        Band
      </label>

      <select
        id="band-code"
        value={bandCode}
        onChange={(event) => {
          const value =
            event.target.value as RubricBand["band_code"];

          setBandCode(value);

          setDisplayName(
            value.charAt(0).toUpperCase() +
              value.slice(1),
          );
        }}
      >
        <option value="failed">Failed</option>
        <option value="foundation">Foundation</option>
        <option value="proficient">Proficient</option>
        <option value="expert">Expert</option>
      </select>
    </div>

    <div>
      <label htmlFor="band-display-name">
        Display name
      </label>

      <input
        id="band-display-name"
        value={displayName}
        onChange={(event) =>
          setDisplayName(event.target.value)
        }
        required
      />
    </div>

    <div>
      <label htmlFor="band-minimum-percentage">
        Minimum percentage
      </label>

      <input
        id="band-minimum-percentage"
        type="number"
        min="0"
        max="100"
        step="0.01"
        value={minimumPercentage}
        onChange={(event) =>
          setMinimumPercentage(event.target.value)
        }
        required
      />
    </div>

    <div>
      <label htmlFor="band-maximum-percentage">
        Maximum percentage
      </label>

      <input
        id="band-maximum-percentage"
        type="number"
        min="0"
        max="100"
        step="0.01"
        value={maximumPercentage}
        onChange={(event) =>
          setMaximumPercentage(event.target.value)
        }
        required
      />
    </div>

    <div>
      <label htmlFor="band-descriptor">
        Descriptor
      </label>

      <textarea
        id="band-descriptor"
        value={descriptor}
        onChange={(event) =>
          setDescriptor(event.target.value)
        }
        required
      />
    </div>

    <div>
      <label htmlFor="band-sequence">
        Sequence
      </label>

      <input
        id="band-sequence"
        type="number"
        min="1"
        value={sequence}
        onChange={(event) =>
          setSequence(event.target.value)
        }
        required
      />
    </div>

    {error && <p role="alert">{error}</p>}

    <button
      type="submit"
      disabled={
        isSubmitting ||
        !rubricCriterionId
      }
    >
      {isSubmitting
        ? "Creating..."
        : "Add rubric band"}
    </button>
  </form>
</section>


      <section>
        <h2>Existing rubric bands</h2>

        {bands.length === 0 ? (
          <p>
            No rubric bands found. Create bands under a rubric
            criterion first.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Assignment</th>
                <th>Level</th>
                <th>Criterion</th>
                <th>Band</th>
                <th>Percentage range</th>
                <th>Sequence</th>
              </tr>
            </thead>

            <tbody>
              {bands.map((band) => (
                <tr key={band.id}>
                  <td>{band.assignment_code}</td>
                  <td>{band.level_code}</td>
                  <td>
                    {band.criterion_code} —{" "}
                    {band.criterion_title}
                  </td>
                  <td>
                    {band.band_code} — {band.display_name}
                  </td>
                  <td>
                    {band.minimum_percentage}% to{" "}
                    {band.maximum_percentage}%
                  </td>
                  <td>{band.sequence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}