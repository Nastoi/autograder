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

import { CreateAssessmentMappingPage } from "./pages/CreateAssessmentMappingPage";

import { QualificationsPage } from "./pages/QualificationsPage";
import { CohortsPage } from "./pages/CohortsPage";
import { AssignmentsPage } from "./pages/AssignmentsPage";
// <<<<<<< HEAD
// =======
// import { GradingConfigurationsPage } from "./pages/GradingConfigurationsPage";
// import { AssignmentLevelsPage } from "./pages/AssignmentLevelsPage";
// import { RubricCriteriaPage } from "./pages/RubricCriteriaPage";
// import { RubricBandsPage } from "./pages/RubricBandsPage";
// import { AIGradingProfilesPage } from "./pages/AIGradingProfilesPage";
// import { TaskCriteriaMappingsPage } from "./pages/TaskCriteriaMappingsPage";
// >>>>>>> origin/feature/update_11Aug_8PM_MMT

import { MappingSubmissionPage } from "./pages/MappingSubmissionPage";

export default function App() {
  return (
    <BrowserRouter>
      <Header />

      <Routes>
        {/* -------------------- */}
        {/* Public routes        */}
        {/* -------------------- */}

        <Route
          path="/login"
          element={<LoginPage />}
        />

        {/* -------------------- */}
        {/* Protected routes     */}
        {/* -------------------- */}

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
            path="/submit/mapping/:mappingId"
            element={<MappingSubmissionPage />}
          /> 

          <Route
            path="/results/:submissionId"
            element={<ResultPage />}
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
            path="/admin/cohorts"
            element={<CohortsPage />}
          />

          <Route
            path="/admin/assignments"
            element={<AssignmentsPage />}
          />
{/* <<<<<<< HEAD

=======
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
          <Route
            path="/admin/task-criteria-mappings"
            element={<TaskCriteriaMappingsPage />}
          />
>>>>>>> origin/feature/update_11Aug_8PM_MMT */}
        </Route>

        {/* -------------------- */}
        {/* Redirects            */}
        {/* -------------------- */}

        <Route
          path="/"
          element={
            <Navigate
              to="/dashboard"
              replace
            />
          }
        />

        <Route
          path="*"
          element={
            <Navigate
              to="/login"
              replace
            />
          }
        />
      </Routes>
    </BrowserRouter>
  );
}