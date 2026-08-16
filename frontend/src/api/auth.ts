const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

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
  must_change_password: boolean;
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
    "lms_user_id" in data &&
    "must_change_password" in data
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


export type ManagedUser = {
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
  is_active: boolean;
  must_change_password: boolean;
  date_joined: string;
};

export async function getManagedUsers(): Promise<ManagedUser[]> {
  const response = await fetch(`${API_BASE_URL}/auth/users/`, {
    method: "GET",
    credentials: "include",
  });

  const data = await readJson<ManagedUser[] | ErrorResponse>(
    response,
  );

  if (!response.ok) {
    throw new Error(
      !Array.isArray(data) && data?.detail
        ? data.detail
        : "Unable to load users.",
    );
  }

  if (!Array.isArray(data)) {
    throw new Error("Invalid user list response.");
  }

  return data;
}

export async function createManagedUser(input: {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
}): Promise<{
  user: ManagedUser;
  temporary_password: string;
}> {
  const csrfToken = await getCsrfToken();

  const response = await fetch(`${API_BASE_URL}/auth/users/`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": csrfToken,
    },
    body: JSON.stringify(input),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      typeof data?.detail === "string"
        ? data.detail
        : "Unable to create user.",
    );
  }

  return data;
}

export async function resetManagedUserPassword(
  userId: number,
): Promise<{ temporary_password: string }> {
  const csrfToken = await getCsrfToken();

  const response = await fetch(
    `${API_BASE_URL}/auth/users/${userId}/reset-password/`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "X-CSRFToken": csrfToken,
      },
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      typeof data?.detail === "string"
        ? data.detail
        : "Unable to reset password.",
    );
  }

  return data;
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<User> {
  const csrfToken = await getCsrfToken();

  const response = await fetch(
    `${API_BASE_URL}/auth/change-password/`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": csrfToken,
      },
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      typeof data?.detail === "string"
        ? data.detail
        : "Unable to change password.",
    );
  }

  return data.user as User;
}


export async function toggleManagedUserActive(
  userId: number,
): Promise<ManagedUser> {
  const csrfToken = await getCsrfToken();

  const response = await fetch(
    `${API_BASE_URL}/auth/users/${userId}/toggle-active/`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "X-CSRFToken": csrfToken,
      },
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      typeof data?.detail === "string"
        ? data.detail
        : "Unable to update user status.",
    );
  }

  return data as ManagedUser;
}