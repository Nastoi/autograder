import "../css/AssessmentMappings.css";
import { useState, type FormEvent } from "react";
import {
  Navigate,
  useLocation,
  useNavigate,
} from "react-router";

import { useAuth } from "../auth/AuthContext";
import "../css/LoginPage.css";

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

      let nextDestination =
        state?.from?.pathname ??
        getDefaultDestination(loggedInUser.role);
        
      if (nextDestination.includes("YOUR-CONTEXT-UUID")) {
        nextDestination = getDefaultDestination(loggedInUser.role);
      }

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
      <div className="background-shapes">
        <div className="shape shape-1"></div>
        <div className="shape shape-2"></div>
        <div className="shape shape-3"></div>
      </div>
      
      <main className="login-box">
        <div className="login-header">
          <div className="admin-header">
                <h1>Welcome Back</h1>
            </div>
          <p>Sign in to continue to Autograder</p>
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
                placeholder="••••••••"
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
                                    {isSubmitting ? (
                                      <span className="loading-spinner"></span>
                                    ) : (
                                      "Log in"
                                    )}
                                  </button>
                    </div>
        </form>
      </main>
    </div>
  );
}