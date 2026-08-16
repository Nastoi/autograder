import {
  useEffect,
  useState,
  type FormEvent,
} from "react";
import { useNavigate } from "react-router";
import {
  Plus,
  Users,
  Link as LinkIcon,
  Copy,
  Search,
  X,
  Pencil,
  PauseCircle,
  PlayCircle,
  Trash2,
} from "lucide-react";

import {
  createCohort,
  getAssessmentMappings,
  getCohorts,
  getModules,
  getQualifications,
  type AssessmentMapping,
  deleteCohort,
  getCohortDeleteImpact,
  updateCohort,
  updateAssessmentMapping,
  deleteAssessmentMapping,
  type CohortDeleteImpact,
  type Cohort,
  type Module,
  type Qualification,
} from "../api/lms";

import "../css/AssessmentMappings.css";
import "../css/QualificationsPage.css"; // For modern UI classes

import { AuditTrailButton } from "../components/AuditTrailButton";
import { RecentDeletedAuditButton } from "../components/RecentDeletedAuditButton";

export function CohortsPage() {
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [qualifications, setQualifications] = useState<Qualification[]>([]);
  const [mappings, setMappings] = useState<AssessmentMapping[]>([]);

  const [qualificationId, setQualificationId] = useState("");
  const [moduleId, setModuleId] = useState("");
  const [cohortCode, setCohortCode] = useState("");
  const [cohortName, setCohortName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [selectedCohortId, setSelectedCohortId] = useState<string | null>(null);
  const [showCreateCohort, setShowCreateCohort] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();

  const [editingCohortId, setEditingCohortId] =
    useState<string | null>(null);

  const [editCohortCode, setEditCohortCode] = useState("");
  const [editCohortName, setEditCohortName] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");

  const [cohortToDelete, setCohortToDelete] =
    useState<Cohort | null>(null);

  const [cohortDeleteImpact, setCohortDeleteImpact] =
    useState<CohortDeleteImpact | null>(null);

  const [isSavingCohort, setIsSavingCohort] = useState(false);
  const [isCheckingCohortDelete, setIsCheckingCohortDelete] =
    useState(false);

  const [isDeletingCohort, setIsDeletingCohort] =
    useState(false);

  const [editingMappingWeightId, setEditingMappingWeightId] =
    useState<string | null>(null);
  const [editMappingWeight, setEditMappingWeight] = useState("");
  const [isSavingMappingWeight, setIsSavingMappingWeight] =
    useState(false);
  const [mappingError, setMappingError] = useState("");

  async function loadData() {
    try {
      const [
        cohortData,
        moduleData,
        qualificationData,
        mappingData,
      ] = await Promise.all([
        getCohorts(),
        getModules(),
        getQualifications(),
        getAssessmentMappings(),
      ]);

      setCohorts(cohortData);
      setModules(moduleData);
      setQualifications(qualificationData);
      setMappings(mappingData);
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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, []);

  const filteredModules = modules.filter(
    (module) =>
      !qualificationId ||
      module.qualification === qualificationId,
  );

  const selectedCohort = cohorts.find(
    (cohort) => cohort.id === selectedCohortId,
  );

  const filteredCohorts = cohorts.filter((cohort) => {
    const term = searchTerm.toLowerCase();
    return (
      cohort.cohort_code.toLowerCase().includes(term) ||
      cohort.cohort_name.toLowerCase().includes(term) ||
      cohort.qualification_code.toLowerCase().includes(term) ||
      cohort.module_code.toLowerCase().includes(term)
    );
  });

  const selectedCohortMappings = mappings.filter(
    (mapping) => mapping.cohort === selectedCohortId,
  );

  function handleQualificationChange(
    selectedQualificationId: string,
  ) {
    setQualificationId(selectedQualificationId);
    setModuleId("");
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");
    setIsSubmitting(true);

    try {
      await createCohort({
        cohort_code: cohortCode,
        cohort_name: cohortName,
        module: moduleId,
        start_date: startDate || null,
        end_date: endDate || null,
        is_active: isActive,
      });

      setCohortCode("");
      setCohortName("");
      setStartDate("");
      setEndDate("");
      setIsActive(true);
      setQualificationId("");
      setModuleId("");
      setShowCreateCohort(false);

      await loadData();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to create cohort.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function copyLtiUrl(mappingId: string) {
    const publicUrl =
      import.meta.env.VITE_AUTOGRADER_PUBLIC_URL;

    const ltiUrl =
      `${publicUrl}/api/lms/lti/launch/${mappingId}/`;

    void navigator.clipboard.writeText(ltiUrl);
  }

  function beginEditingCohort(cohort: Cohort) {
    setEditingCohortId(cohort.id);
    setEditCohortCode(cohort.cohort_code);
    setEditCohortName(cohort.cohort_name);
    setEditStartDate(cohort.start_date ?? "");
    setEditEndDate(cohort.end_date ?? "");
    setError("");
  }

  function cancelEditingCohort() {
    setEditingCohortId(null);
    setEditCohortCode("");
    setEditCohortName("");
    setEditStartDate("");
    setEditEndDate("");
  }

  async function saveCohort(cohortId: string) {
    setError("");
    setIsSavingCohort(true);

    try {
      await updateCohort(cohortId, {
        cohort_code: editCohortCode,
        cohort_name: editCohortName,
        start_date: editStartDate || null,
        end_date: editEndDate || null,
      });

      cancelEditingCohort();
      await loadData();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to update cohort.",
      );
    } finally {
      setIsSavingCohort(false);
    }
  }

  async function toggleCohortStatus(cohort: Cohort) {
    setError("");

    try {
      await updateCohort(cohort.id, {
        is_active: !cohort.is_active,
      });

      await loadData();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to update cohort status.",
      );
    }
  }

  async function removeCohort(cohort: Cohort) {
    setError("");
    setIsCheckingCohortDelete(true);

    try {
      const impact = await getCohortDeleteImpact(cohort.id);

      setCohortToDelete(cohort);
      setCohortDeleteImpact(impact);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to check cohort dependencies.",
      );
    } finally {
      setIsCheckingCohortDelete(false);
    }
  }

  async function confirmCohortDelete() {
    if (!cohortToDelete || !cohortDeleteImpact?.can_delete) {
      return;
    }

    setError("");
    setIsDeletingCohort(true);

    try {
      await deleteCohort(cohortToDelete.id);

      if (selectedCohortId === cohortToDelete.id) {
        setSelectedCohortId(null);
      }

      setCohortToDelete(null);
      setCohortDeleteImpact(null);

      await loadData();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to delete cohort.",
      );
    } finally {
      setIsDeletingCohort(false);
    }
  }

  function closeCohortDeleteDialog() {
    if (isDeletingCohort) {
      return;
    }

    setCohortToDelete(null);
    setCohortDeleteImpact(null);
  }


  function beginEditingMappingWeight(
    mapping: AssessmentMapping,
  ) {
    setEditingMappingWeightId(mapping.id);
    setEditMappingWeight(mapping.final_mark_weight || "0");
    setError("");
  }

  function cancelEditingMappingWeight() {
    setEditingMappingWeightId(null);
    setEditMappingWeight("");
  }

  async function saveMappingWeight(
    mapping: AssessmentMapping,
  ) {
    const numericWeight = Number(editMappingWeight);

    if (
      !Number.isFinite(numericWeight) ||
      numericWeight < 0 ||
      numericWeight > 100
    ) {
      setError(
        "Final mark weight must be between 0 and 100.",
      );
      return;
    }

    setError("");
    setIsSavingMappingWeight(true);

    try {
      await updateAssessmentMapping(mapping.id, {
        final_mark_weight: editMappingWeight,
      });

      cancelEditingMappingWeight();
      await loadData();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to update final mark weight.",
      );
    } finally {
      setIsSavingMappingWeight(false);
    }
  }

  async function unassignAssessment(
    mapping: AssessmentMapping,
  ) {
    setMappingError("");

if (mapping.has_submissions) {
  setMappingError(
    `${mapping.assignment_code} — ${mapping.assignment_title} cannot be unassigned because learner submissions already exist for this assessment. Remove the submissions first before removing the assessment mapping.`,
  );
  return;
}

    const confirmed = window.confirm(
      `Unassign ${mapping.assignment_code} — ${mapping.assignment_title} from ${selectedCohort?.cohort_code ?? "this cohort"}?\n\nThis removes only the assessment mapping. The assignment itself will not be deleted.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      await deleteAssessmentMapping(mapping.id);
      await loadData();
    } catch (caughtError) {
      setMappingError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to unassign assessment.",
      );
    }
  }

  if (isLoading) {
    return (
      <main className="academic-main-centered">
        Loading cohorts...
      </main>
    );
  }

  return (
    <main className="academic-main-centered">
      <div className="academic-header">
        <div>
          <h1>Cohorts</h1>
          <p className="section-description">
            Create cohorts, assign assessments and manage submission URLs.
          </p>
        </div>

        <div className="section-actions">
          <RecentDeletedAuditButton />

          <button
            type="button"
            className="btn-accent"
            onClick={() =>
              setShowCreateCohort((current) => !current)
            }
          >
            {showCreateCohort ? (
              "Close Form"
            ) : (
              <><Plus size={16} /> New Cohort</>
            )}
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}

      {showCreateCohort && (
        <section className="workspace-section" style={{ marginBottom: '32px' }}>
          <form
            onSubmit={handleSubmit}
            className="modern-form assignment-create-form"
            style={{ maxWidth: '100%' }}
          >
            <div className="form-grid form-grid-2">
              <div className="form-group">
                <label htmlFor="cohort-qualification">
                  Qualification
                </label>
                <select
                  id="cohort-qualification"
                  value={qualificationId}
                  onChange={(event) =>
                    handleQualificationChange(event.target.value)
                  }
                  required
                >
                  <option value="">Select qualification</option>
                  {qualifications.map((qualification) => (
                    <option
                      key={qualification.id}
                      value={qualification.id}
                    >
                      {qualification.qualification_code} -{" "}
                      {qualification.qualification_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="cohort-module">
                  Module
                </label>
                <select
                  id="cohort-module"
                  value={moduleId}
                  onChange={(event) =>
                    setModuleId(event.target.value)
                  }
                  disabled={!qualificationId}
                  required
                >
                  <option value="">Select module</option>
                  {filteredModules.map((module) => (
                    <option key={module.id} value={module.id}>
                      {module.module_code} - {module.module_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="cohort-code">
                  Cohort code
                </label>
                <input
                  id="cohort-code"
                  value={cohortCode}
                  onChange={(event) =>
                    setCohortCode(event.target.value)
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="cohort-name">
                  Cohort name
                </label>
                <input
                  id="cohort-name"
                  value={cohortName}
                  onChange={(event) =>
                    setCohortName(event.target.value)
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="cohort-start-date">
                  Start date
                </label>
                <input
                  id="cohort-start-date"
                  type="date"
                  value={startDate}
                  onChange={(event) =>
                    setStartDate(event.target.value)
                  }
                />
              </div>

              <div className="form-group">
                <label htmlFor="cohort-end-date">
                  End date
                </label>
                <input
                  id="cohort-end-date"
                  type="date"
                  value={endDate}
                  onChange={(event) =>
                    setEndDate(event.target.value)
                  }
                />
              </div>
            </div>

            <div className="checkbox-row">
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
            </div>

            <div className="form-actions form-actions-compact">
              <button
                type="submit"
                className="btn-accent"
                disabled={
                  isSubmitting ||
                  !qualificationId ||
                  !moduleId
                }
              >
                {isSubmitting ? "Creating..." : "Create Cohort"}
              </button>

              <button
                type="button"
                className="btn-secondary"
                disabled={isSubmitting}
                onClick={() => setShowCreateCohort(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Cohorts Table Card */}
      <div className="content-card">
        <div className="content-card-header">
          <div className="content-title-section">
            <div className="content-icon">
              <Users size={20} />
            </div>
            <div className="content-title">
              <h2>Existing cohorts</h2>
              <p>Select a cohort to view its mapped assessments and URLs.</p>
            </div>
          </div>
          <div className="section-actions">
            <div style={{ position: "relative" }}>
              <Search
                size={16}
                style={{
                  position: "absolute",
                  left: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-muted)",
                }}
              />
              <input
                type="text"
                placeholder="Search cohorts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  paddingLeft: "32px",
                  height: "36px",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border)",
                  width: "250px",
                  fontSize: "14px",
                }}
              />
            </div>
          </div>
        </div>

        {cohorts.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No cohorts found.
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Qualification</th>
                <th>Module</th>
                <th>Code</th>
                <th>Name</th>
                <th>Dates</th>
                <th>Assessments</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCohorts.map((cohort) => {
                const mappingCount = mappings.filter(
                  (mapping) => mapping.cohort === cohort.id,
                ).length;

                return (
                  <tr
                    key={cohort.id}
                    onClick={() => {
  setSelectedCohortId(cohort.id);
  setMappingError("");
}}
                    style={{
                      cursor: "pointer",
                      backgroundColor: selectedCohortId === cohort.id ? 'rgba(238, 242, 255, 0.5)' : undefined
                    }}
                  >
                    <td>{cohort.qualification_code}</td>
                    <td>{cohort.module_code}</td>
                    <td className="cohort-code-cell">
                      {editingCohortId === cohort.id ? (
                        <input
                          value={editCohortCode}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setEditCohortCode(e.target.value)}
                          style={{ width: "120px", padding: "4px" }}
                        />
                      ) : (
                        <span className="tag-pill">
                          {cohort.cohort_code}
                        </span>
                      )}
                    </td>
                    <td style={{ fontWeight: 500, color: "var(--text-h)" }}>
                      {editingCohortId === cohort.id ? (
                        <input
                          value={editCohortName}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setEditCohortName(e.target.value)}
                          style={{ width: "100%", padding: "4px" }}
                        />
                      ) : (
                        cohort.cohort_name
                      )}
                    </td>
                    <td className="cohort-dates">
                      {editingCohortId === cohort.id ? (
                        <div className="cohort-date-edit-stack">
                          <input
                            type="date"
                            value={editStartDate}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => setEditStartDate(e.target.value)}
                          />

                          <input
                            type="date"
                            value={editEndDate}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => setEditEndDate(e.target.value)}
                          />
                        </div>
                      ) : (
                        <div className="cohort-date-stack">
                          <span>{cohort.start_date || "—"}</span>
                          <span className="cohort-date-separator">to</span>
                          <span>{cohort.end_date || "—"}</span>
                        </div>
                      )}
                    </td>
                    <td style={{ fontWeight: 500 }}>{mappingCount}</td>
                    <td>
                      <span
                        className={`status-badge ${!cohort.is_active ? 'inactive' : ''}`}
                      >
                        <span className="status-dot"></span>
                        {cohort.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {editingCohortId === cohort.id ? (
                        <div className="cohort-actions">
                          <button
                            type="button"
                            className="btn-action"
                            style={{ color: "var(--success)" }}
                            disabled={isSavingCohort}
                            onClick={() => void saveCohort(cohort.id)}
                          >
                            {isSavingCohort ? "Saving..." : "Save"}
                          </button>

                          <button
                            type="button"
                            className="btn-action"
                            disabled={isSavingCohort}
                            onClick={cancelEditingCohort}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="cohort-actions">
                          <AuditTrailButton
                            objectType="cohort"
                            objectId={cohort.id}
                            label={`${cohort.cohort_code} — ${cohort.cohort_name}`}
                          />
                          <button
                            type="button"
                            className="btn-action"
                            onClick={() => beginEditingCohort(cohort)}
                          >
                            <Pencil size={14} />
                            Edit
                          </button>

                          <button
                            type="button"
                            className="btn-action"
                            onClick={() => void toggleCohortStatus(cohort)}
                          >
                            {cohort.is_active ? (
                              <>
                                <PauseCircle size={14} />
                                Deactivate
                              </>
                            ) : (
                              <>
                                <PlayCircle size={14} />
                                Activate
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            className="btn-action"
                            style={{ color: "var(--danger)" }}
                            disabled={isCheckingCohortDelete}
                            onClick={() => void removeCohort(cohort)}
                          >
                            <Trash2 size={14} />
                            {isCheckingCohortDelete ? "Checking..." : "Delete"}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {selectedCohort && (
        <>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              zIndex: 9998,
            }}
            onClick={() => {
  setSelectedCohortId(null);
  setMappingError("");
}}
          />
          <section
            className="content-card"
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              width: '70%',
              margin: 0,
              zIndex: 9999,
              borderRadius: '16px 0 0 16px',
              boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.15)',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'white'
            }}
          >
            <div className="content-card-header" style={{ position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 10 }}>
              <div className="content-title-section">
                <div className="content-title">
                  <h2>
                    {selectedCohort.cohort_code} — {selectedCohort.cohort_name}
                  </h2>
                  <p>
                    {selectedCohort.qualification_code} {" → "} {selectedCohort.module_code}
                  </p>
                </div>
              </div>

              <div className="section-actions" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <button
                  type="button"
                  className="btn-action"
                  onClick={() =>
                    navigate(
                      `/admin/mappings/new?cohort=${selectedCohort.id}`,
                    )
                  }
                >
                  <LinkIcon size={16} /> Assign assessments
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCohortId(null)}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex' }}
                  aria-label="Close panel"
                >
                  <X size={20} color="var(--text-muted)" />
                </button>
              </div>
            </div>

            {mappingError && (
  <div style={{ padding: "16px 24px 0" }}>
    <p role="alert" className="error-message">
      {mappingError}
    </p>
  </div>
)}

            <div style={{ padding: '24px', flex: 1 }}>
              {selectedCohortMappings.length === 0 ? (
                <p style={{ margin: 0, color: 'var(--text-muted)' }}>No assignments mapped to this cohort.</p>
              ) : (
                <table className="data-table" style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                  <thead>
                    <tr>
                      <th>Assignment</th>
                      <th>Status</th>
                      <th>Weightage</th>
                      <th>Submission URL</th>
                      <th>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {selectedCohortMappings.map((mapping) => (
                      <tr key={mapping.id}>
                        <td
                          style={{
                            fontWeight: 500,
                            color: "var(--text-h)",
                          }}
                        >
                          {mapping.assignment_code} —{" "}
                          {mapping.assignment_title}
                        </td>

                        <td>
                          <span
                            className={`status-badge ${!mapping.is_active ? "inactive" : ""
                              }`}
                          >
                            <span className="status-dot"></span>
                            {mapping.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>

                        <td>
                          {mapping.assignment_contributes_to_final_mark ? (
                            editingMappingWeightId === mapping.id ? (
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "8px",
                                  minWidth: "180px",
                                }}
                              >
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.01"
                                  value={editMappingWeight}
                                  onChange={(event) =>
                                    setEditMappingWeight(
                                      event.target.value,
                                    )
                                  }
                                  style={{
                                    width: "80px",
                                    padding: "6px 8px",
                                  }}
                                />
                                <span>%</span>

                                <button
                                  type="button"
                                  className="btn-action"
                                  disabled={isSavingMappingWeight}
                                  onClick={() =>
                                    void saveMappingWeight(mapping)
                                  }
                                >
                                  {isSavingMappingWeight
                                    ? "Saving..."
                                    : "Save"}
                                </button>

                                <button
                                  type="button"
                                  className="btn-action"
                                  disabled={isSavingMappingWeight}
                                  onClick={cancelEditingMappingWeight}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "8px",
                                }}
                              >
                                <strong>
                                  {Number(
                                    mapping.final_mark_weight || 0,
                                  ).toFixed(2)}
                                  %
                                </strong>

                                <button
                                  type="button"
                                  className="btn-action"
                                  onClick={() =>
                                    beginEditingMappingWeight(mapping)
                                  }
                                >
                                  <Pencil size={14} />
                                  Edit Weight
                                </button>
                              </div>
                            )
                          ) : (
                            <span className="table-subtext">
                              Does not contribute
                            </span>
                          )}
                        </td>

                        <td>
                          <span
                            style={{
                              fontFamily: "monospace",
                              color: "var(--text-muted)",
                              fontSize: "13px",
                            }}
                          >
                            {`${import.meta.env.VITE_AUTOGRADER_PUBLIC_URL}/api/lms/lti/launch/${mapping.id}/`}
                          </span>
                        </td>

                        <td>
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "8px",
                              alignItems: "flex-start",
                            }}
                          >
                            <AuditTrailButton
                              objectType="assessment_mapping"
                              objectId={mapping.id}
                              label={`${mapping.assignment_code} — ${mapping.assignment_title}`}
                            />

                            <button
                              type="button"
                              className="btn-action"
                              onClick={() => copyLtiUrl(mapping.id)}
                            >
                              <Copy size={14} />
                              Copy LTI URL
                            </button>

                            <button
                              type="button"
                              className="btn-action"
                              style={{
                                color: mapping.has_submissions
                                  ? "var(--text-muted)"
                                  : "var(--danger)",
                              }}
                              onClick={() => void unassignAssessment(mapping)}
                              title={
                                mapping.has_submissions
                                  ? "Cannot unassign because learner submissions exist."
                                  : "Remove this assessment from the cohort."
                              }
                            >
                              <Trash2 size={14} />
                              {mapping.has_submissions
                                ? "Cannot Unassign"
                                : "Unassign"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </>
      )}
      {cohortToDelete && cohortDeleteImpact && (
        <div className="delete-modal-backdrop">
          <div className="delete-modal">
            <div className="delete-modal-header">
              <div>
                <h2>Delete Cohort</h2>
                <p>
                  {cohortToDelete.cohort_code} —{" "}
                  {cohortToDelete.cohort_name}
                </p>
              </div>

              <button
                type="button"
                className="delete-modal-close"
                onClick={closeCohortDeleteDialog}
                disabled={isDeletingCohort}
              >
                ×
              </button>
            </div>

            {!cohortDeleteImpact.can_delete ? (
              <div className="delete-blocked-section">
                <h3>This cohort cannot be deleted</h3>

                {cohortDeleteImpact.blockers.assessment_mappings.length > 0 && (
                  <div className="delete-blocker">
                    <strong>Assessment mappings</strong>
                    <p>
                      Remove these assessment mappings before deleting
                      the cohort.
                    </p>

                    <ul>
                      {cohortDeleteImpact.blockers.assessment_mappings.map(
                        (mapping) => (
                          <li key={mapping.id}>
                            {mapping.name} — {mapping.assignment}
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                )}

                {cohortDeleteImpact.blockers.submissions > 0 && (
                  <div className="delete-blocker">
                    <strong>Learner submissions</strong>

                    <p>
                      {cohortDeleteImpact.blockers.submissions} learner
                      submission
                      {cohortDeleteImpact.blockers.submissions === 1
                        ? ""
                        : "s"}{" "}
                      exist for this cohort.
                    </p>

                    <p>
                      Remove the relevant submissions first before
                      deleting this cohort.
                    </p>
                  </div>
                )}

                <div className="delete-modal-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={closeCohortDeleteDialog}
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="delete-warning">
                  <strong>
                    This will permanently delete this cohort.
                  </strong>

                  <p>
                    Its module, qualification and assignments will not be
                    deleted.
                  </p>

                  {cohortDeleteImpact.affected.submission_contexts > 0 && (
                    <p>
                      {
                        cohortDeleteImpact.affected
                          .submission_contexts
                      }{" "}
                      empty submission context
                      {cohortDeleteImpact.affected.submission_contexts === 1
                        ? ""
                        : "s"}{" "}
                      will also be removed.
                    </p>
                  )}
                </div>

                <div className="delete-modal-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={closeCohortDeleteDialog}
                    disabled={isDeletingCohort}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="btn-danger"
                    onClick={() => void confirmCohortDelete()}
                    disabled={isDeletingCohort}
                  >
                    <Trash2 size={14} />
                    {isDeletingCohort
                      ? "Deleting..."
                      : "Delete Cohort"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
