import { X } from "lucide-react";
import type { ReactNode } from "react";

import type { ModuleAssignment } from "../../api/courses";

type WorkspaceTab = "overview" | "configuration";

type AssignmentWorkspaceShellProps = {
  assignment: ModuleAssignment;
  activeWorkspaceTab: WorkspaceTab;

  onClose: () => void;
  onTabChange: (tab: WorkspaceTab) => void;

  children: ReactNode;
};

export function AssignmentWorkspaceShell({
  assignment,
  activeWorkspaceTab,
  onClose,
  onTabChange,
  children,
}: AssignmentWorkspaceShellProps) {
  return (
    <>
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.4)",
          zIndex: 9998,
        }}
        onClick={onClose}
      />

      <section className="assignment-workspace content-card assignment-workspace-modal">
        <div
          className="section-header assignment-workspace-header"
          style={{
            position: "sticky",
            top: 0,
            backgroundColor: "white",
            zIndex: 10,
            padding: "24px 24px 0",
            borderBottom: "1px solid var(--border)",
            margin: 0,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "8px",
              }}
            >
              <h2 style={{ margin: 0 }}>
                {assignment.assignment_code}
              </h2>

              {assignment.is_summative && (
                <span
                  className="status-badge"
                  style={{
                    fontSize: "11px",
                    padding: "2px 7px",
                  }}
                >
                  Summative
                </span>
              )}
            </div>

            <p
              className="section-description"
              style={{
                margin: 0,
                paddingBottom: "16px",
              }}
            >
              {assignment.qualification_code} → {assignment.module_code}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "4px",
              display: "flex",
            }}
            aria-label="Close panel"
          >
            <X size={20} color="var(--text-muted)" />
          </button>
        </div>

        <div className="workspace-tabs">
          <button
            type="button"
            className={
              activeWorkspaceTab === "overview"
                ? "workspace-tab active"
                : "workspace-tab"
            }
            onClick={() => onTabChange("overview")}
          >
            Overview
          </button>

          <button
            type="button"
            className={
              activeWorkspaceTab === "configuration"
                ? "workspace-tab active"
                : "workspace-tab"
            }
            onClick={() => onTabChange("configuration")}
          >
            Submission Configuration
          </button>
        </div>

        {children}
      </section>
    </>
  );
}