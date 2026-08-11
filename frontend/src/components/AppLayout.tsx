import { Outlet, useLocation } from "react-router";
import { GlobalSidebar } from "./GlobalSidebar";
import { GlobalHeader } from "./GlobalHeader";
import "../css/GlobalLayout.css";

export function AppLayout() {
  const location = useLocation();

  const isSubmissionFlow =
    location.pathname.startsWith("/submit/mapping/") ||
    location.pathname.startsWith("/results/");

  if (isSubmissionFlow) {
    return <Outlet />;
  }

  return (
    <div className="app-layout">
      <GlobalSidebar />
      <div className="app-main">
        <GlobalHeader />
        <div className="app-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
