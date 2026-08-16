import { useState } from "react";
import { Info, X } from "lucide-react";

import {
  getPortalActivity,
  type PortalActivity,
} from "../api/portalActivity";

type AuditTrailButtonProps = {
  objectType: string;
  objectId: string;
  label?: string;
};

function formatAuditDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function AuditTrailButton({
  objectType,
  objectId,
  label,
}: AuditTrailButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activities, setActivities] =
    useState<PortalActivity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function openAudit() {
    setIsOpen(true);
    setIsLoading(true);
    setError("");

    try {
      setActivities(
        await getPortalActivity(objectType, objectId),
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load audit history.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="btn-icon-only"
        onClick={(event) => {
          event.stopPropagation();
          void openAudit();
        }}
        title="View audit history"
        aria-label="View audit history"
      >
        <Info size={16} />
      </button>

      {isOpen && (
        <div
          className="config-modal-backdrop"
          onClick={(event) => {
            event.stopPropagation();
            setIsOpen(false);
          }}
        >
          <div
            className="config-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="config-modal-header">
              <div>
                <h3>Audit History</h3>
                {label && (
                  <p className="section-description">
                    {label}
                  </p>
                )}
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
              <p>Loading audit history...</p>
            ) : error ? (
              <p className="error-message">{error}</p>
            ) : activities.length === 0 ? (
              <div className="empty-state">
                No audit history is available for this record yet.
              </div>
            ) : (
              <div className="audit-history-list">
                {activities.map((activity) => (
                  <div
                    key={activity.id}
                    className="detail-block"
                  >
                    <strong
                      style={{
                        textTransform: "capitalize",
                      }}
                    >
                      {activity.action}
                    </strong>

                    <p style={{ marginBottom: 0 }}>
                      By {activity.username || "Unknown user"}
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
