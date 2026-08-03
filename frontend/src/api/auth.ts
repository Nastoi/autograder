const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api";

export type User = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role:
    | "system_admin"
    | "mapping_admin"
    | "faculty"
    | "learner"
    | null;
  lms_user_id: string;
};

type LoginResponse = {
  message: string;
  user: User;
};

type CsrfResponse = {
  csrfToken: string;
};

type ErrorResponse = {
  detail?: string;
};

async function readJson<T>(response: Response): Promise<T | null> {
  const contentType = response.headers.get("content-type");

  if (!contentType?.includes("application/json")) {
    return null;
  }

  return (await response.json()) as T;
}

export async function getCsrfToken(): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/auth/csrf/`, {
    method: "GET",
    credentials: "include",
  });

  const data = await readJson<CsrfResponse | ErrorResponse>(response);

  if (!response.ok) {
    throw new Error(
      data && "detail" in data
        ? data.detail ?? "Unable to obtain CSRF token."
        : "Unable to obtain CSRF token.",
    );
  }

  if (!data || !("csrfToken" in data) || !data.csrfToken) {
    throw new Error("CSRF token was not returned by the server.");
  }

  return data.csrfToken;
}

export async function loginUser(
  username: string,
  password: string,
): Promise<User> {
  const csrfToken = await getCsrfToken();

  const response = await fetch(`${API_BASE_URL}/auth/login/`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": csrfToken,
    },
    body: JSON.stringify({
      username,
      password,
    }),
  });

  const data = await readJson<LoginResponse | ErrorResponse>(response);

  if (!response.ok) {
    throw new Error(
      data && "detail" in data
        ? data.detail ?? "Login failed."
        : "Login failed.",
    );
  }

  if (!data || !("user" in data)) {
    throw new Error("Login succeeded, but no user was returned.");
  }

  return data.user;
}

export async function logoutUser(): Promise<void> {
  // Django rotates the CSRF token after login,
  // so always request a fresh token before logout.
  const csrfToken = await getCsrfToken();

  const response = await fetch(`${API_BASE_URL}/auth/logout/`, {
    method: "POST",
    credentials: "include",
    headers: {
      "X-CSRFToken": csrfToken,
    },
  });

  const data = await readJson<ErrorResponse>(response);

  if (!response.ok) {
    throw new Error(data?.detail ?? "Logout failed.");
  }
}

function isUser(data: User | ErrorResponse): data is User {
  return (
    "id" in data &&
    "username" in data &&
    "email" in data &&
    "first_name" in data &&
    "last_name" in data &&
    "role" in data &&
    "lms_user_id" in data
  );
}

export async function getCurrentUser(): Promise<User | null> {
  const response = await fetch(`${API_BASE_URL}/auth/me/`, {
    method: "GET",
    credentials: "include",
  });

  if (response.status === 401 || response.status === 403) {
    return null;
  }

  const data = await readJson<User | ErrorResponse>(response);

  if (!response.ok) {
    const message =
      data && "detail" in data
        ? data.detail ?? "Unable to load current user."
        : "Unable to load current user.";

    throw new Error(message);
  }

  if (!data || !isUser(data)) {
    throw new Error("Current user data was not returned correctly.");
  }

  return data;
}