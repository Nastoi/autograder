import "../css/AssessmentMappings.css";
import "../css/QualificationsPage.css";
import {
  useEffect,
  useState,
  type FormEvent,
} from "react";
import {
  GraduationCap,
  Bookmark,
  Package,
  Headphones,
  Search,
  Pencil,
  MoreHorizontal,
  PauseCircle,
  PlayCircle,
  Trash2,
  ArrowUpRight,
  CheckCircle2,
  Archive,
  Plus
} from "lucide-react";

import {
  createModule,
  deleteModule,
  createQualification,
  deleteQualification,
  getModules,
  getQualifications,
  updateQualification,
  type Module,
  type Qualification,
} from "../api/lms";

export function QualificationsPage() {
  const [qualifications, setQualifications] = useState<Qualification[]>([]);
  const [modules, setModules] = useState<Module[]>([]);

  const [activeTab, setActiveTab] = useState<'setup' | 'qualifications' | 'modules'>('setup');

  const [qualificationCode, setQualificationCode] = useState("");
  const [qualificationName, setQualificationName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [selectedQualificationId, setSelectedQualificationId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [moduleSearchQuery, setModuleSearchQuery] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQualificationCode, setEditQualificationCode] = useState("");
  const [editQualificationName, setEditQualificationName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const [moduleCode, setModuleCode] = useState("");
  const [moduleName, setModuleName] = useState("");
  const [moduleDescription, setModuleDescription] = useState("");

  const [showCreateQualification, setShowCreateQualification] = useState(false);
  const [showCreateModule, setShowCreateModule] = useState(false);
  
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingModule, setIsCreatingModule] = useState(false);
  const [error, setError] = useState("");

  async function loadData() {
    try {
      const [qualificationData, moduleData] = await Promise.all([
        getQualifications(),
        getModules(),
      ]);

      setQualifications(qualificationData);
      setModules(moduleData);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load academic setup.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
    
    // Close dropdown on outside click
    const handleClickOutside = () => setOpenDropdownId(null);
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await createQualification({
        qualification_code: qualificationCode,
        qualification_name: qualificationName,
        description,
        is_active: isActive,
      });

      setQualificationCode("");
      setQualificationName("");
      setDescription("");
      setIsActive(true);
      setShowCreateQualification(false);

      await loadData();
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

  function beginEditing(qualification: Qualification) {
    setEditingId(qualification.id);
    setEditQualificationCode(qualification.qualification_code);
    setEditQualificationName(qualification.qualification_name);
    setEditDescription(qualification.description);
    setError("");
    setOpenDropdownId(null);
  }

  function cancelEditing() {
    setEditingId(null);
    setEditQualificationCode("");
    setEditQualificationName("");
    setEditDescription("");
  }

  async function saveQualification(qualificationId: string) {
    setError("");
    setIsSaving(true);

    try {
      await updateQualification(qualificationId, {
        qualification_code: editQualificationCode,
        qualification_name: editQualificationName,
        description: editDescription,
      });

      cancelEditing();
      await loadData();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to update qualification.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleQualificationStatus(qualification: Qualification) {
    setError("");
    setOpenDropdownId(null);

    try {
      await updateQualification(qualification.id, {
        is_active: !qualification.is_active,
      });

      await loadData();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to update qualification status.",
      );
    }
  }

  async function removeQualification(qualification: Qualification) {
    setOpenDropdownId(null);
    if (!window.confirm(`Delete qualification ${qualification.qualification_code}?`)) {
      return;
    }

    setError("");
    try {
      await deleteQualification(qualification.id);

      if (selectedQualificationId === qualification.id) {
        setSelectedQualificationId("");
      }

      await loadData();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to delete qualification.",
      );
    }
  }

  async function handleCreateModule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedQualificationId) return;

    setError("");
    setIsCreatingModule(true);

    try {
      await createModule({
        qualification: selectedQualificationId,
        code: moduleCode,
        name: moduleName,
        description: moduleDescription,
        is_active: true,
      });

      setModuleCode("");
      setModuleName("");
      setModuleDescription("");
      setShowCreateModule(false);

      await loadData();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to create module.",
      );
    } finally {
      setIsCreatingModule(false);
    }
  }

  async function removeModule(module: Module) {
    if (!window.confirm(`Delete module ${module.code} — ${module.name}?`)) {
      return;
    }
    setError("");
    try {
      await deleteModule(module.id);
      await loadData();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to delete module.",
      );
    }
  }

  if (isLoading) {
    return (
      <main className="academic-layout">
        <div style={{ padding: '40px' }}>Loading academic setup...</div>
      </main>
    );
  }

  const selectedQualification = qualifications.find(
    (qualification) => qualification.id === selectedQualificationId,
  );

  const selectedModules = modules.filter(
    (module) => module.qualification === selectedQualificationId,
  );

  const activeQualificationsCount = qualifications.filter(q => q.is_active).length;
  const inactiveQualificationsCount = qualifications.length - activeQualificationsCount;
  
  const filteredQualifications = qualifications.filter(q => 
    q.qualification_code.toLowerCase().includes(searchQuery.toLowerCase()) || 
    q.qualification_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredAllModules = modules.filter(m => 
    m.code.toLowerCase().includes(moduleSearchQuery.toLowerCase()) || 
    m.name.toLowerCase().includes(moduleSearchQuery.toLowerCase())
  );

  return (
    <div className="academic-layout">
      {/* Sidebar */}
      <aside className="academic-sidebar">
        <div 
          className={`sidebar-nav-item ${activeTab === 'setup' ? 'active' : ''}`}
          onClick={() => setActiveTab('setup')}
        >
          <GraduationCap className="sidebar-icon" />
          <span>Academic Setup</span>
        </div>
        <div 
          className={`sidebar-nav-item ${activeTab === 'qualifications' ? 'active' : ''}`}
          onClick={() => setActiveTab('qualifications')}
        >
          <Bookmark className="sidebar-icon" />
          <span>Qualifications</span>
        </div>
        <div 
          className={`sidebar-nav-item ${activeTab === 'modules' ? 'active' : ''}`}
          onClick={() => setActiveTab('modules')}
        >
          <Package className="sidebar-icon" />
          <span>Modules</span>
        </div>

        <div className="sidebar-help">
          <div className="help-icon-wrapper">
            <Headphones size={18} />
          </div>
          <div>
            <h3 className="help-title">Need help?</h3>
            <p className="help-text">Check our documentation or contact support.</p>
          </div>
          <a href="#" className="help-link">
            View Help Center <ArrowUpRight size={14} />
          </a>
        </div>
      </aside>

      {/* Main Content */}
      <main className="academic-main">
        <div className="academic-header">
          <div>
            <h1>
              {activeTab === 'setup' && 'Academic Setup'}
              {activeTab === 'qualifications' && 'Qualifications'}
              {activeTab === 'modules' && 'Modules'}
            </h1>
            <p className="section-description">
              {activeTab === 'setup' && 'Manage qualifications and their modules in one place.'}
              {activeTab === 'qualifications' && 'View and manage all active qualifications.'}
              {activeTab === 'modules' && 'Overview of all educational modules.'}
            </p>
          </div>

          {(activeTab === 'setup' || activeTab === 'qualifications') && (
            <button
              type="button"
              className="btn-accent"
              onClick={() => setShowCreateQualification((current) => !current)}
            >
              <Plus size={16} />
              {showCreateQualification ? "Close Form" : "New Qualification"}
            </button>
          )}
        </div>

        {error && (
          <p role="alert" className="error-message">
            {error}
          </p>
        )}

        {/* Metrics Row (Only visible in setup view) */}
        {activeTab === 'setup' && (
          <div className="metrics-row">
            <div className="metric-card" onClick={() => setActiveTab('qualifications')}>
              <div className="metric-icon-wrapper purple">
                <GraduationCap size={24} />
              </div>
              <div className="metric-content">
                <span className="metric-label">Total Qualifications</span>
                <span className="metric-value">{qualifications.length}</span>
                <span className="metric-sub">Active qualifications</span>
              </div>
            </div>
            <div className="metric-card" onClick={() => setActiveTab('modules')}>
              <div className="metric-icon-wrapper green">
                <Bookmark size={24} />
              </div>
              <div className="metric-content">
                <span className="metric-label">Total Modules</span>
                <span className="metric-value">{modules.length}</span>
                <span className="metric-sub">Across all qualifications</span>
              </div>
            </div>
            <div className="metric-card" onClick={() => setActiveTab('qualifications')}>
              <div className="metric-icon-wrapper blue">
                <CheckCircle2 size={24} />
              </div>
              <div className="metric-content">
                <span className="metric-label">Active</span>
                <span className="metric-value">{activeQualificationsCount}</span>
                <span className="metric-sub">Currently active</span>
              </div>
            </div>
            <div className="metric-card" onClick={() => setActiveTab('qualifications')}>
              <div className="metric-icon-wrapper orange">
                <Archive size={24} />
              </div>
              <div className="metric-content">
                <span className="metric-label">Inactive</span>
                <span className="metric-value">{inactiveQualificationsCount}</span>
                <span className="metric-sub">Currently inactive</span>
              </div>
            </div>
          </div>
        )}

        {/* Create Qualification Form */}
        {showCreateQualification && (activeTab === 'setup' || activeTab === 'qualifications') && (
          <section className="workspace-section" style={{ marginBottom: '32px' }}>
            <form onSubmit={handleSubmit} className="modern-form assignment-create-form" style={{ maxWidth: '100%' }}>
              <div className="form-grid form-grid-2">
                <div className="form-group">
                  <label htmlFor="qualification-code">Qualification code</label>
                  <input
                    id="qualification-code"
                    type="text"
                    value={qualificationCode}
                    onChange={(event) => setQualificationCode(event.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="qualification-name">Qualification name</label>
                  <input
                    id="qualification-name"
                    type="text"
                    value={qualificationName}
                    onChange={(event) => setQualificationName(event.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="qualification-description">Description</label>
                <textarea
                  id="qualification-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </div>
              <div className="checkbox-row">
                <label className="checkbox-group">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(event) => setIsActive(event.target.checked)}
                  />
                  Active
                </label>
              </div>
              <div className="form-actions form-actions-compact">
                <button type="submit" className="btn-accent" disabled={isSubmitting}>
                  {isSubmitting ? "Creating..." : "Create Qualification"}
                </button>
                <button type="button" className="btn-secondary" disabled={isSubmitting} onClick={() => setShowCreateQualification(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </section>
        )}

        {/* Qualifications Table Card */}
        {(activeTab === 'setup' || activeTab === 'qualifications') && (
          <div className="content-card">
            <div className="content-card-header">
              <div className="content-title-section">
                <div className="content-icon">
                  <Package size={20} />
                </div>
                <div className="content-title">
                  <h2>Qualifications</h2>
                  <p>Select a qualification to manage its modules.</p>
                </div>
              </div>
              <div className="search-box">
                <Search className="search-icon" />
                <input 
                  type="text" 
                  placeholder="Search qualifications..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Qualification</th>
                  <th>Description</th>
                  <th>Modules</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredQualifications.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '40px' }}>No qualifications found.</td>
                  </tr>
                ) : (
                  filteredQualifications.map((qualification) => {
                    const isEditing = editingId === qualification.id;
                    const moduleCount = modules.filter(
                      (m) => m.qualification === qualification.id,
                    ).length;
                    const isDropdownOpen = openDropdownId === qualification.id;

                    return (
                      <tr
                        key={qualification.id}
                        onClick={() => {
                          setSelectedQualificationId(qualification.id);
                          setShowCreateModule(false);
                        }}
                        style={{ cursor: "pointer", backgroundColor: selectedQualificationId === qualification.id ? 'rgba(238, 242, 255, 0.5)' : undefined }}
                      >
                        <td>
                          {isEditing ? (
                            <input
                              value={editQualificationCode}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => setEditQualificationCode(e.target.value)}
                              style={{ width: '80px', padding: '4px' }}
                            />
                          ) : (
                            <span className="tag-pill">{qualification.qualification_code}</span>
                          )}
                        </td>
                        <td style={{ fontWeight: 500, color: 'var(--text-h)' }}>
                          {isEditing ? (
                            <input
                              value={editQualificationName}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => setEditQualificationName(e.target.value)}
                              style={{ width: '100%', padding: '4px' }}
                            />
                          ) : (
                            qualification.qualification_name
                          )}
                        </td>
                        <td style={{ maxWidth: '250px' }}>
                          {isEditing ? (
                            <textarea
                              value={editDescription}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => setEditDescription(e.target.value)}
                              style={{ width: '100%', padding: '4px', minHeight: '40px' }}
                            />
                          ) : (
                            qualification.description || "—"
                          )}
                        </td>
                        <td style={{ fontWeight: 500 }}>{moduleCount}</td>
                        <td>
                          <span className={`status-badge ${!qualification.is_active ? 'inactive' : ''}`}>
                            <span className="status-dot"></span>
                            {qualification.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          {isEditing ? (
                            <div className="actions-cell">
                              <button type="button" className="btn-action" style={{ color: 'var(--success)' }} disabled={isSaving} onClick={() => void saveQualification(qualification.id)}>
                                {isSaving ? "Saving..." : "Save"}
                              </button>
                              <button type="button" className="btn-action" disabled={isSaving} onClick={cancelEditing}>
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="actions-cell">
                              <button type="button" className="btn-action" onClick={() => beginEditing(qualification)}>
                                <Pencil className="btn-action-icon" /> Edit
                              </button>
                              <div className="action-dropdown-wrapper">
                                <button 
                                  type="button" 
                                  className="btn-icon-only"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenDropdownId(isDropdownOpen ? null : qualification.id);
                                  }}
                                >
                                  <MoreHorizontal size={16} />
                                </button>
                                {isDropdownOpen && (
                                  <div className="action-dropdown-menu">
                                    <button type="button" className="dropdown-item warning" onClick={() => void toggleQualificationStatus(qualification)}>
                                      {qualification.is_active ? <><PauseCircle size={14} /> Deactivate</> : <><PlayCircle size={14} /> Activate</>}
                                    </button>
                                    {qualification.can_delete && (
                                      <button type="button" className="dropdown-item danger" onClick={() => void removeQualification(qualification)}>
                                        <Trash2 size={14} /> Delete
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Selected Qualification Modules (Legacy rendering adapted) */}
        {(activeTab === 'setup' || activeTab === 'qualifications') && selectedQualification && (
          <section className="content-card" style={{ marginTop: '32px' }}>
            <div className="content-card-header">
              <div className="content-title-section">
                <div className="content-title">
                  <h2>
                    {selectedQualification.qualification_code} Modules
                  </h2>
                  <p>
                    {selectedModules.length} module{selectedModules.length === 1 ? "" : "s"} found.
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="btn-action"
                onClick={() => setShowCreateModule((current) => !current)}
              >
                {showCreateModule ? "Close" : "+ Add Module"}
              </button>
            </div>

            <div style={{ padding: '24px' }}>
              {showCreateModule && (
                <form onSubmit={handleCreateModule} className="modern-form" style={{ marginBottom: '24px', maxWidth: '100%' }}>
                  <div className="form-grid form-grid-2">
                    <div className="form-group">
                      <label htmlFor="module-code">Module code</label>
                      <input id="module-code" value={moduleCode} onChange={(e) => setModuleCode(e.target.value)} required />
                    </div>
                    <div className="form-group">
                      <label htmlFor="module-name">Module name</label>
                      <input id="module-name" value={moduleName} onChange={(e) => setModuleName(e.target.value)} required />
                    </div>
                  </div>
                  <div className="form-group">
                    <label htmlFor="module-description">Description</label>
                    <textarea id="module-description" value={moduleDescription} onChange={(e) => setModuleDescription(e.target.value)} />
                  </div>
                  <div className="form-actions form-actions-compact">
                    <button type="submit" className="btn-accent" disabled={isCreatingModule}>
                      {isCreatingModule ? "Creating..." : "Add Module"}
                    </button>
                    <button type="button" className="btn-secondary" disabled={isCreatingModule} onClick={() => setShowCreateModule(false)}>
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {selectedModules.length === 0 ? (
                <p style={{ margin: 0, color: 'var(--text-muted)' }}>No modules under this qualification yet.</p>
              ) : (
                <table className="data-table" style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Module</th>
                      <th>Description</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedModules.map((module) => (
                      <tr key={module.id}>
                        <td><span className="tag-pill">{module.code}</span></td>
                        <td style={{ fontWeight: 500, color: 'var(--text-h)' }}>{module.name}</td>
                        <td>{module.description || "—"}</td>
                        <td>
                          <span className={`status-badge ${!module.is_active ? 'inactive' : ''}`}>
                            <span className="status-dot"></span>
                            {module.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td>
                          {module.can_delete ? (
                            <button type="button" className="btn-action" style={{ color: 'var(--danger)' }} onClick={() => void removeModule(module)}>
                              <Trash2 size={14} /> Delete
                            </button>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>In use</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        )}

        {/* Global Modules Table */}
        {activeTab === 'modules' && (
          <div className="content-card">
            <div className="content-card-header">
              <div className="content-title-section">
                <div className="content-icon">
                  <Package size={20} />
                </div>
                <div className="content-title">
                  <h2>All Modules</h2>
                  <p>Overview of all modules across qualifications.</p>
                </div>
              </div>
              <div className="search-box">
                <Search className="search-icon" />
                <input 
                  type="text" 
                  placeholder="Search modules..." 
                  value={moduleSearchQuery}
                  onChange={e => setModuleSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Qualification</th>
                  <th>Code</th>
                  <th>Module</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredAllModules.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '40px' }}>No modules found.</td>
                  </tr>
                ) : (
                  filteredAllModules.map((module) => {
                    const qName = qualifications.find(q => q.id === module.qualification)?.qualification_code || "—";
                    return (
                      <tr key={module.id}>
                        <td>{qName}</td>
                        <td><span className="tag-pill">{module.code}</span></td>
                        <td style={{ fontWeight: 500, color: 'var(--text-h)' }}>{module.name}</td>
                        <td>{module.description || "—"}</td>
                        <td>
                          <span className={`status-badge ${!module.is_active ? 'inactive' : ''}`}>
                            <span className="status-dot"></span>
                            {module.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td>
                          {module.can_delete ? (
                            <button type="button" className="btn-action" style={{ color: 'var(--danger)' }} onClick={() => void removeModule(module)}>
                              <Trash2 size={14} /> Delete
                            </button>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>In use</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

      </main>
    </div>
  );
}
