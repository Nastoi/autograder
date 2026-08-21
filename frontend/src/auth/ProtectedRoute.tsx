import { Navigate, Outlet, useLocation } from "react-router";

import { useState } from "react";
import { useAuth } from "./AuthContext";

export function ProtectedRoute() {
  const { user, isLoading, refreshUser } = useAuth();
  const location = useLocation();
  const [isRetryingLtiSession, setIsRetryingLtiSession] =
    useState(false);
  const [retryMessage, setRetryMessage] = useState("");

  const isLtiSubmissionRoute =
    location.pathname.startsWith("/submit/mapping/");

  async function retryLtiSession() {
    setRetryMessage("");
    setIsRetryingLtiSession(true);

    try {
      await refreshUser();
      setRetryMessage(
        "Session check completed. If the assessment does not open, return to your LMS and launch the assignment again.",
      );
    } catch {
      setRetryMessage(
        "We could not reconnect the assessment session. Please return to your LMS and launch the assignment again.",
      );
    } finally {
      setIsRetryingLtiSession(false);
    }
  }

  if (isLoading) {
    return <p>Loading...</p>;
  }

  if (!user) {
    if (isLtiSubmissionRoute) {
      return (
        <main
          style={{
            maxWidth: "720px",
            margin: "64px auto",
            padding: "32px",
          }}
        >
          <section className="content-card" style={{ padding: "32px" }}>
            <h1 style={{ marginTop: 0 }}>
              Unable to open your assessment
            </h1>

            <p>
              We could not establish your assessment session automatically.
              Your work has not been affected.
            </p>

            <p>
              Please try the following:
            </p>

            <ol style={{ paddingLeft: "22px", lineHeight: 1.7 }}>
              <li>
                Select <strong>Try again</strong> below to check the
                assessment session once more.
              </li>
              <li>
                If it still does not open, refresh this page once.
              </li>
              <li>
                If the issue continues, return to your LMS course and open
                the assignment again.
              </li>
              <li>
                Make sure you are still signed in to your LMS.
              </li>
            </ol>

            <p>
              If the assessment still cannot be opened after these steps,
              please contact your instructor or support.
            </p>

            {retryMessage && (
              <p
                role="status"
                style={{ marginTop: "16px" }}
              >
                {retryMessage}
              </p>
            )}

            <button
              type="button"
              className="btn-primary"
              disabled={isRetryingLtiSession}
              onClick={() => void retryLtiSession()}
            >
              {isRetryingLtiSession
                ? "Checking session..."
                : "Try again"}
            </button>
          </section>
        </main>
      );
    }

    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location }}
      />
    );
  }

  if (
    user.must_change_password &&
    location.pathname !== "/change-password"
  ) {
    return (
      <Navigate
        to="/change-password"
        replace
      />
    );
  }

  return <Outlet />;
}
