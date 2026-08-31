import { X } from "lucide-react";

import type { AssignmentLevel } from "../../api/courses";

import type {
  RubricBand,
  RubricCriterion,
} from "../../api/grading";

type AssignmentBandsSectionProps = {
  level: AssignmentLevel;
  levelReadOnly: boolean;

  levelBands: RubricBand[];
  levelCriteria: RubricCriterion[];
  bands: RubricBand[];

  bandFormLevelId: string;
  bandCriterionId: string;
  bandCode: RubricBand["band_code"];
  bandDisplayName: string;
  bandMinimumPercentage: string;
  bandMaximumPercentage: string;
  bandDescriptor: string;
  bandSequence: string;

  isSavingBand: boolean;

  editingBandId: string;
  editBandMinimum: string;
  editBandMaximum: string;
  editBandDescriptor: string;

  setBandFormLevelId: (value: string) => void;
  setBandCriterionId: (value: string) => void;
  setBandCode: (value: RubricBand["band_code"]) => void;
  setBandDisplayName: (value: string) => void;
  setBandMinimumPercentage: (value: string) => void;
  setBandMaximumPercentage: (value: string) => void;
  setBandDescriptor: (value: string) => void;
  setBandSequence: (value: string) => void;

  setEditingBandId: (value: string) => void;
  setEditBandMinimum: (value: string) => void;
  setEditBandMaximum: (value: string) => void;
  setEditBandDescriptor: (value: string) => void;

  saveBand: (
    event: React.FormEvent<HTMLFormElement>,
  ) => void | Promise<void>;

  startEditingBand: (
    band: RubricBand,
  ) => void;

  saveBandEdit: (
    band: RubricBand,
  ) => void | Promise<void>;

  removeBand: (
    bandId: string,
  ) => void | Promise<void>;
};

export function AssignmentBandsSection({
  level,
  levelReadOnly,

  levelBands,
  levelCriteria,
  bands,

  bandFormLevelId,
  bandCriterionId,
  bandCode,
  bandMinimumPercentage,
  bandMaximumPercentage,
  bandDescriptor,
  bandSequence,

  isSavingBand,

  editingBandId,
  editBandMinimum,
  editBandMaximum,
  editBandDescriptor,

  setBandFormLevelId,
  setBandCriterionId,
  setBandCode,
  setBandDisplayName,
  setBandMinimumPercentage,
  setBandMaximumPercentage,
  setBandDescriptor,
  setBandSequence,

  setEditingBandId,
  setEditBandMinimum,
  setEditBandMaximum,
  setEditBandDescriptor,

  saveBand,
  startEditingBand,
  saveBandEdit,
  removeBand,
}: AssignmentBandsSectionProps) {
  return (
    <section className="rubric-section level-rubric-section">
      <div className="section-header compact-section-header">
        <div>
          <h3>
            {level.display_name} rubric bands
          </h3>

          <p className="section-description">
            Performance bands for this submission path.
          </p>
        </div>

        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            setBandCriterionId("");
            setBandFormLevelId(level.id);
          }}
          disabled={levelReadOnly}
        >
          + Add Band
        </button>
      </div>

      {levelBands.some(
        (band) => !band.descriptor?.trim(),
      ) && (
        <p className="error-message">
          Please fill up all descriptor fields and save.
        </p>
      )}

      {bandFormLevelId === level.id && (
        <div className="config-modal-backdrop">
          <div className="config-modal">
            <div className="config-modal-header">
              <h3>Add Rubric Band</h3>

              <button
                type="button"
                className="config-modal-close"
                onClick={() =>
                  setBandFormLevelId("")
                }
              >
                <X size={20} />
              </button>
            </div>

            <form
              className="modern-form"
              onSubmit={saveBand}
            >
              <div className="form-grid form-grid-2">
                <div className="form-group">
                  <label>Criterion</label>

                  <select
                    value={bandCriterionId}
                    onChange={(event) => {
                      const criterionId =
                        event.target.value;

                      setBandCriterionId(
                        criterionId,
                      );

                      setBandCode("failed");
                      setBandDisplayName(
                        "Failed",
                      );

                      const existingBands =
                        bands.filter(
                          (band) =>
                            band.rubric_criterion ===
                            criterionId,
                        );

                      setBandSequence(
                        String(
                          existingBands.length +
                            1,
                        ),
                      );
                    }}
                    required
                  >
                    <option value="">
                      Select criterion
                    </option>

                    {levelCriteria.map(
                      (criterion) => (
                        <option
                          key={criterion.id}
                          value={criterion.id}
                        >
                          {
                            criterion.criterion_code
                          }{" "}
                          - {criterion.title}
                        </option>
                      ),
                    )}
                  </select>
                </div>

                <div className="form-group">
                  <label>Band</label>

                  <select
                    value={bandCode}
                    onChange={(event) => {
                      const value =
                        event.target.value as RubricBand["band_code"];

                      setBandCode(value);

                      setBandDisplayName(
                        value
                          .charAt(0)
                          .toUpperCase() +
                          value.slice(1),
                      );
                    }}
                  >
                    {(level.level_code ===
                    "advanced"
                      ? [
                          "failed",
                          "proficient",
                          "expert",
                        ]
                      : [
                          "failed",
                          "foundation",
                          "proficient",
                        ]
                    ).map((code) => (
                      <option
                        key={code}
                        value={code}
                      >
                        {code
                          .charAt(0)
                          .toUpperCase() +
                          code.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>
                    Minimum percentage
                  </label>

                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={
                      bandMinimumPercentage
                    }
                    onChange={(event) =>
                      setBandMinimumPercentage(
                        event.target.value,
                      )
                    }
                    required
                  />
                </div>

                <div className="form-group">
                  <label>
                    Maximum percentage
                  </label>

                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={
                      bandMaximumPercentage
                    }
                    onChange={(event) =>
                      setBandMaximumPercentage(
                        event.target.value,
                      )
                    }
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Sequence</label>

                  <input
                    type="number"
                    min="1"
                    value={bandSequence}
                    onChange={(event) =>
                      setBandSequence(
                        event.target.value,
                      )
                    }
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Descriptor</label>

                <textarea
                  value={bandDescriptor}
                  onChange={(event) =>
                    setBandDescriptor(
                      event.target.value,
                    )
                  }
                  required
                />
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() =>
                    setBandFormLevelId("")
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={
                    isSavingBand ||
                    !bandCriterionId
                  }
                >
                  {isSavingBand
                    ? "Adding..."
                    : "Add Rubric Band"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {levelBands.length === 0 ? (
        <div className="empty-state">
          No rubric bands added yet.
        </div>
      ) : (
        <div className="table-container rubric-band-table-container">
          <table className="modern-table">
            <thead>
              <tr>
                <th>Criterion</th>
                <th>Band</th>
                <th>Range</th>
                <th>Descriptor</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {levelBands.map((band) => {
                const isEditing =
                  editingBandId === band.id;

                return (
                  <tr key={band.id}>
                    <td>
                      {band.criterion_title}
                    </td>

                    <td>
                      {band.display_name}
                    </td>

                    <td>
                      {isEditing ? (
                        <div className="range-edit">
                          <input
                            className="table-number-input"
                            type="number"
                            min="0"
                            max="100"
                            value={
                              editBandMinimum
                            }
                            onChange={(
                              event,
                            ) =>
                              setEditBandMinimum(
                                event.target
                                  .value,
                              )
                            }
                          />

                          <span>–</span>

                          <input
                            className="table-number-input"
                            type="number"
                            min="0"
                            max="100"
                            value={
                              editBandMaximum
                            }
                            onChange={(
                              event,
                            ) =>
                              setEditBandMaximum(
                                event.target
                                  .value,
                              )
                            }
                          />
                        </div>
                      ) : (
                        `${band.minimum_percentage}% – ${band.maximum_percentage}%`
                      )}
                    </td>

                    <td>
                      {isEditing ? (
                        <textarea
                          value={
                            editBandDescriptor
                          }
                          onChange={(event) =>
                            setEditBandDescriptor(
                              event.target.value,
                            )
                          }
                        />
                      ) : (
                        band.descriptor
                      )}
                    </td>

                    <td className="table-actions">
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            className="btn-table"
                            onClick={() =>
                              void saveBandEdit(
                                band,
                              )
                            }
                          >
                            Save
                          </button>

                          <button
                            type="button"
                            className="btn-table"
                            onClick={() =>
                              setEditingBandId(
                                "",
                              )
                            }
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="btn-table"
                            onClick={() =>
                              startEditingBand(
                                band,
                              )
                            }
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            className="btn-table btn-table-danger"
                            onClick={() =>
                              void removeBand(
                                band.id,
                              )
                            }
                          >
                            Delete
                          </button>
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
  );
}