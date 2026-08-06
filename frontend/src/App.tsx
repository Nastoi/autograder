import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router";


import { Header } from "./components/Header";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { LoginPage } from "./pages/LoginPage";
import { ResultPage } from "./pages/ResultPage";
import { SubmissionPage } from "./pages/SubmissionPage";
import { DashboardPage } from "./pages/DashboardPage";
import { AssessmentMappingsPage } from "./pages/AssessmentMappingsPage";
import { CreateAssessmentMappingPage } from "./pages/CreateAssessmentMappingPage";
import { QualificationsPage } from "./pages/QualificationsPage";
import { ModulesPage } from "./pages/ModulesPage";
import { CohortsPage } from "./pages/CohortsPage";
import { AssignmentsPage } from "./pages/AssignmentsPage";
import { GradingConfigurationsPage } from "./pages/GradingConfigurationsPage";
import { AssignmentLevelsPage } from "./pages/AssignmentLevelsPage";
import { RubricCriteriaPage } from "./pages/RubricCriteriaPage";
import { RubricBandsPage } from "./pages/RubricBandsPage";
import { AIGradingProfilesPage } from "./pages/AIGradingProfilesPage";

const TEST_CONTEXT_ID =
  "72b85e24-ecda-4cda-965a-e771e91c3592";

export default function App() {
  return (
    <BrowserRouter>
      <Header />
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<ProtectedRoute />}>
          <Route
            path="/dashboard"
            element={<DashboardPage />}
          />
          <Route
            path="/submit/:contextId"
            element={<SubmissionPage />}
          />

          <Route
            path="/results/:submissionId"
            element={<ResultPage />}
          />

          <Route
            path="/admin/mappings"
            element={<AssessmentMappingsPage />}
          />

          <Route
            path="/admin/mappings/new"
            element={<CreateAssessmentMappingPage />}
          />
          <Route
            path="/admin/qualifications"
            element={<QualificationsPage />}
          />
          <Route
            path="/admin/modules"
            element={<ModulesPage />}
          />
          <Route
            path="/admin/cohorts"
            element={<CohortsPage />}
          />
          <Route
            path="/admin/assignments"
            element={<AssignmentsPage />}
          />
          <Route
            path="/admin/grading-configurations"
            element={<GradingConfigurationsPage />}
          />
          <Route
            path="/admin/assignment-levels"
            element={<AssignmentLevelsPage />}
          />
          <Route
            path="/admin/rubric-criteria"
            element={<RubricCriteriaPage />}
          />
          <Route
            path="/admin/rubric-bands"
            element={<RubricBandsPage />}
          />
          <Route
            path="/admin/ai-grading-profiles"
            element={<AIGradingProfilesPage />}
          />
        </Route>

        <Route
          path="/"
          element={
            <Navigate
              to={`/submit/${TEST_CONTEXT_ID}`}
              replace
            />
          }
        />

        <Route
          path="*"
          element={<Navigate to="/login" replace />}
        />



      </Routes>
    </BrowserRouter>
  );
}