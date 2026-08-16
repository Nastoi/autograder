import { useState } from "react";
import { ArchiveRestore, X } from "lucide-react";

import {
  getRecentDeletedPortalActivity,
  type PortalActivity,
} from "../api/portalActivity";

function formatAuditDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function RecentDeletedAuditButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [activities, setActivities] =
    useState<PortalActivity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function openRecentDeleted() {
    setIsOpen(true);
    setIsLoading(true);
    setError("");

    try {
      setActivities(
        await getRecentDeletedPortalActivity(),
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load recently deleted records.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="btn-secondary"
        onClick={() => void openRecentDeleted()}
      >
        <ArchiveRestore size={16} />
        Recent Deletions
      </button>

      {isOpen && (
        <div className="config-modal-backdrop">
          <div className="config-modal">
            <div className="config-modal-header">
              <div>
                <h3>Recent Deletions</h3>
                <p className="section-description">
                  Deleted audit records are retained for 30 days.
                </p>
              </div>

              <button
                type="button"
                className="config-modal-close"
                onClick={() => setIsOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            {isLoading ? (
              <p>Loading recent deletions...</p>
            ) : error ? (
              <p className="error-message">{error}</p>
            ) : activities.length === 0 ? (
              <div className="empty-state">
                No records were deleted in the last 30 days.
              </div>
            ) : (
              <div className="audit-history-list">
                {activities.map((activity) => (
                  <div
                    key={activity.id}
                    className="detail-block"
                  >
                    <strong>{activity.object_label}</strong>

                    <p style={{ marginBottom: "4px" }}>
                      <strong>Section:</strong>{" "}
                      {activity.object_type === "qualification"
                        ? "Qualification"
                        : activity.object_type === "module"
                          ? "Module"
                          : activity.object_type === "cohort"
                            ? "Cohort"
                            : activity.object_type === "assignment"
                              ? "Assignment"
                              : activity.object_type === "assessment_mapping"
                                ? "Assessment Mapping"
                                : activity.object_type}
                    </p>

                    <p style={{ marginBottom: 0 }}>
                      Deleted by {activity.username || "Unknown user"}
                    </p>

                    <small className="table-subtext">
                      {formatAuditDate(activity.created_at)}
                    </small>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
