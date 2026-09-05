import { Navigate, Outlet, useLocation } from "react-router";

import { useAuth } from "./AuthContext";

export function ProtectedRoute() {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  const isLtiSubmissionRoute =
    location.pathname.startsWith("/submit/mapping/");

  if (isLoading) {
    return <p>Loading...</p>;
  }

  // LTI submission pages use the LTI session,
  // not normal portal authentication.
  if (isLtiSubmissionRoute) {
    return <Outlet />;
  }

  if (!user) {
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