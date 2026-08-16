import {
  useState,
  type FormEvent,
} from "react";
import { useNavigate } from "react-router";

import { changePassword } from "../api/auth";
import { useAuth } from "../auth/AuthContext";

export function ChangePasswordPage() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      await changePassword(
  currentPassword,
  newPassword,
);

await refreshUser();

navigate("/dashboard", {
  replace: true,
});
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to change password.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="admin-container">
      <div className="admin-header">
        <div>
          <h1>Change Password</h1>
          <p className="section-description">
            {user?.must_change_password
              ? "You must create a new password before continuing."
              : "Update your account password."}
          </p>
        </div>
      </div>

      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}

      <form
        className="modern-form"
        onSubmit={handleSubmit}
        style={{ maxWidth: "600px" }}
      >
        <div className="form-group">
          <label>Current password</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(event) =>
              setCurrentPassword(event.target.value)
            }
            required
          />
        </div>

        <div className="form-group">
          <label>New password</label>
          <input
            type="password"
            value={newPassword}
            onChange={(event) =>
              setNewPassword(event.target.value)
            }
            minLength={8}
            required
          />
        </div>

        <div className="form-group">
          <label>Confirm new password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) =>
              setConfirmPassword(event.target.value)
            }
            minLength={8}
            required
          />
        </div>

        <div className="form-actions">
          <button
            type="submit"
            className="btn-primary"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? "Changing..."
              : "Change Password"}
          </button>
        </div>
      </form>
    </main>
  );
}