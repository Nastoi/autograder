// frontend/src/App.tsx

import { BrowserRouter, Route, Routes } from "react-router";

function HomePage() {
  return <h1>AutoGrader</h1>;
}

function SubmissionPage() {
  return <h1>Submit Assignment</h1>;
}

function ResultPage() {
  return <h1>Grading Result</h1>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route
          path="/learner/submit/:assignmentId"
          element={<SubmissionPage />}
        />
        <Route
          path="/learner/results/:submissionId"
          element={<ResultPage />}
        />
      </Routes>
    </BrowserRouter>
  );
}