import { useState, type FormEvent } from "react";
import {
  Navigate,
  useLocation,
  useNavigate,
} from "react-router";

import { useAuth } from "../auth/AuthContext";
import "../css/LoginPage.css";

import { Bot } from "lucide-react";

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
    if (
      role === "system_admin" ||
      role === "mapping_admin" ||
      role === "faculty"
    ) {
      return "/dashboard";
    }

    return "/";
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

      const requestedPath = state?.from?.pathname;

      const isAdminUser =
        loggedInUser.role === "system_admin" ||
        loggedInUser.role === "mapping_admin" ||
        loggedInUser.role === "faculty";

      const nextDestination = isAdminUser
        ? "/dashboard"
        : requestedPath ?? "/";

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
    <div className="login-container">
      <main className="login-box">

        {/* Left Branding Panel */}
        <div className="login-panel-left">
          <div className="brand-logo-container">
            <Bot size={36} color="#ffffff" strokeWidth={2.5} />
          </div>
          <h1 className="brand-title">AutoGrader</h1>
          <p className="brand-subtitle">
            AI-assisted assessment, grading, and learner feedback platform.
          </p>
        </div>

        {/* Right Form Panel */}
        <div className="login-panel-right">
          <div className="form-header">
            <span className="eyebrow-text">Welcome Back</span>
            <h2 className="form-title">Sign in to your account</h2>
            <p className="form-subtitle">Enter your AutoGrader username and password to continue.</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <div className="input-group">
              <label htmlFor="username">Username</label>
              <div className="input-wrapper">
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  required
                />
              </div>
            </div>

            <div className="input-group">
              <label htmlFor="password">Password</label>
              <div className="input-wrapper">
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </div>
            </div>

            {error && (
              <div className="error-message" role="alert">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            )}

            <div className="form-actions">
              <button type="submit" className="login-button" disabled={isSubmitting}>
                {isSubmitting ? "Logging in..." : "Log in"}
              </button>
            </div>
          </form>
        </div>

      </main>
    </div>
  );
}