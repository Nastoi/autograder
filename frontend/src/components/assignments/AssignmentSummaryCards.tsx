import { Link } from "react-router";
import {
  ClipboardList,
  GraduationCap,
  Package,
} from "lucide-react";

type AssignmentSummaryCardsProps = {
  qualificationCount: number;
  moduleCount: number;
  assignmentCount: number;
};

export function AssignmentSummaryCards({
  qualificationCount,
  moduleCount,
  assignmentCount,
}: AssignmentSummaryCardsProps) {
  return (
    <section style={{ marginBottom: "40px" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(250px, 1fr))",
          gap: "20px",
          marginBottom: "32px",
        }}
      >
        <Link
          to="/admin/qualifications"
          className="metric-card-modern"
        >
          <div className="metric-icon-wrapper purple">
            <GraduationCap size={24} />
          </div>

          <div className="metric-content">
            <span
              className="metric-label"
              style={{
                textTransform: "uppercase",
                fontSize: "11px",
                fontWeight: 700,
              }}
            >
              Qualifications
            </span>

            <span
              className="metric-value"
              style={{ marginTop: "4px" }}
            >
              {qualificationCount}
            </span>
          </div>
        </Link>

        <Link
          to="/admin/modules"
          className="metric-card-modern"
        >
          <div className="metric-icon-wrapper blue">
            <Package size={24} />
          </div>

          <div className="metric-content">
            <span
              className="metric-label"
              style={{
                textTransform: "uppercase",
                fontSize: "11px",
                fontWeight: 700,
              }}
            >
              Modules
            </span>

            <span
              className="metric-value"
              style={{ marginTop: "4px" }}
            >
              {moduleCount}
            </span>
          </div>
        </Link>

        <Link
          to="/admin/assignments"
          className="metric-card-modern"
        >
          <div className="metric-icon-wrapper orange">
            <ClipboardList size={24} />
          </div>

          <div className="metric-content">
            <span
              className="metric-label"
              style={{
                textTransform: "uppercase",
                fontSize: "11px",
                fontWeight: 700,
              }}
            >
              Assignments
            </span>

            <span
              className="metric-value"
              style={{ marginTop: "4px" }}
            >
              {assignmentCount}
            </span>
          </div>
        </Link>
      </div>
    </section>
  );
}