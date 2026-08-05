import { useState, type FormEvent } from "react";
import {
  Navigate,
  useLocation,
  useNavigate,
} from "react-router";

import { useAuth } from "../auth/AuthContext";
import "./LoginPage.css";

type LocationState = {
  from?: {
    pathname?: string;
  };
};

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const state = location.state as LocationState | null;

  function getDefaultDestination(
    role: string | null | undefined,
  ) {
    if (role === "system_admin" || role === "mapping_admin") {
      return "/admin/mappings";
    }

    if (role === "faculty") {
      return "/dashboard";
    }

    return "/submit/YOUR-CONTEXT-UUID";
  }

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (user) {
    return (
      <Navigate
        to={getDefaultDestination(user.role)}
        replace
      />
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setIsSubmitting(true);

    try {
      const loggedInUser = await login(username, password);

      const nextDestination =
        state?.from?.pathname ??
        getDefaultDestination(loggedInUser.role);

      navigate(nextDestination, { replace: true });
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to log in.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
  <main className="login-page">
    <section className="login-card">
      <div className="login-brand-panel">
        <div className="login-logo">AG</div>

        <h1>AutoGrader</h1>

        <p>
          AI-assisted assessment, grading, and learner feedback
          platform.
        </p>
      </div>

      <div className="login-form-panel">
        <div className="login-heading">
          <p className="login-eyebrow">Welcome back</p>
          <h2>Sign in to your account</h2>
          <p>
            Enter your AutoGrader username and password to
            continue.
          </p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-field">
            <label htmlFor="username">Username</label>

            <input
              id="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(event) =>
                setUsername(event.target.value)
              }
              placeholder="Enter your username"
              required
            />
          </div>

          <div className="login-field">
            <label htmlFor="password">Password</label>

            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              placeholder="Enter your password"
              required
            />
          </div>

          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}

          <button
            className="login-submit-button"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Logging in..." : "Log in"}
          </button>
        </form>
      </div>
    </section>
  </main>
);
}