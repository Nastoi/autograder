import { useNavigate } from "react-router";

import { useAuth } from "../auth/AuthContext";

export function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await logout();
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Logout failed:", error);
      alert("Unable to log out.");
    }
  }

  return (
    <main>
      <h1>Dashboard</h1>

      <p>
        Logged in as <strong>{user?.username}</strong>
      </p>

      <p>
        Role: <strong>{user?.role ?? "No role assigned"}</strong>
      </p>

      <button type="button" onClick={handleLogout}>
        Log out
      </button>
    </main>
  );
}