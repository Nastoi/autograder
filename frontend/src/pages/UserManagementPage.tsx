import {
    useEffect,
    useState,
    type FormEvent,
} from "react";
import {
    Plus,
    Copy,
    KeyRound,
    ShieldCheck,
    X,
} from "lucide-react";

import {
    createManagedUser,
    getManagedUsers,
    resetManagedUserPassword,
    toggleManagedUserActive,
    updateManagedUserPermissions,
    type ManagedUser,
    type ManagedUserPermissions,
} from "../api/auth";
import { useAuth } from "../auth/AuthContext";

export function UserManagementPage() {
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState<ManagedUser[]>([]);

    const [showCreateUser, setShowCreateUser] =
        useState(false);

    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");

    const [temporaryPassword, setTemporaryPassword] =
        useState("");

    const [temporaryPasswordUsername, setTemporaryPasswordUsername] =
        useState("");

    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] =
        useState(false);

    const [resettingUserId, setResettingUserId] =
        useState<number | null>(null);

    const [error, setError] = useState("");

    const [updatingUserId, setUpdatingUserId] =
        useState<number | null>(null);

    const [permissionUser, setPermissionUser] =
        useState<ManagedUser | null>(null);
    const [permissionValues, setPermissionValues] =
        useState<ManagedUserPermissions | null>(null);
    const [savingPermissions, setSavingPermissions] =
        useState(false);

    async function loadUsers() {
        try {
            setUsers(await getManagedUsers());
        } catch (caughtError) {
            setError(
                caughtError instanceof Error
                    ? caughtError.message
                    : "Unable to load users.",
            );
        } finally {
            setIsLoading(false);
        }
    }

    useEffect(() => {
        void loadUsers();
    }, []);

    async function handleCreateUser(
        event: FormEvent<HTMLFormElement>,
    ) {
        event.preventDefault();

        setError("");
        setIsSubmitting(true);

        try {
            const result = await createManagedUser({
                username,
                email,
                first_name: firstName,
                last_name: lastName,
            });

            setTemporaryPassword(
                result.temporary_password,
            );

            setTemporaryPasswordUsername(
                result.user.username,
            );

            setUsername("");
            setEmail("");
            setFirstName("");
            setLastName("");

            setShowCreateUser(false);

            await loadUsers();
        } catch (caughtError) {
            setError(
                caughtError instanceof Error
                    ? caughtError.message
                    : "Unable to create user.",
            );
        } finally {
            setIsSubmitting(false);
        }
    }

    async function handleResetPassword(
        user: ManagedUser,
    ) {
        const confirmed = window.confirm(
            `Reset password for ${user.username}?`,
        );

        if (!confirmed) {
            return;
        }

        setError("");
        setResettingUserId(user.id);

        try {
            const result =
                await resetManagedUserPassword(user.id);

            setTemporaryPassword(
                result.temporary_password,
            );

            setTemporaryPasswordUsername(
                user.username,
            );

            await loadUsers();
        } catch (caughtError) {
            setError(
                caughtError instanceof Error
                    ? caughtError.message
                    : "Unable to reset password.",
            );
        } finally {
            setResettingUserId(null);
        }
    }

    function copyTemporaryPassword() {
        void navigator.clipboard.writeText(
            temporaryPassword,
        );
    }

    if (isLoading) {
        return (
            <main className="admin-container">
                Loading users...
            </main>
        );
    }

    async function handleToggleActive(
        user: ManagedUser,
    ) {
        const action = user.is_active
            ? "disable"
            : "enable";

        const confirmed = window.confirm(
            `${action === "disable" ? "Disable" : "Enable"} ${user.username}?`,
        );

        if (!confirmed) {
            return;
        }

        setError("");
        setUpdatingUserId(user.id);

        try {
            await toggleManagedUserActive(user.id);
            await loadUsers();
        } catch (caughtError) {
            setError(
                caughtError instanceof Error
                    ? caughtError.message
                    : "Unable to update user status.",
            );
        } finally {
            setUpdatingUserId(null);
        }
    }

    function openPermissions(user: ManagedUser) {
        setPermissionUser(user);
        setPermissionValues({
            can_access_user_management: user.can_access_user_management,
            can_create_users: user.can_create_users,
            can_reset_passwords: user.can_reset_passwords,
            can_toggle_users: user.can_toggle_users,
            can_view_logs: user.can_view_logs,
        });
    }

    function setPermission(
        field: keyof ManagedUserPermissions,
        value: boolean,
    ) {
        setPermissionValues((current) => {
            if (!current) return current;

            const next = { ...current, [field]: value };
            if (field === "can_access_user_management" && !value) {
                next.can_create_users = false;
                next.can_reset_passwords = false;
                next.can_toggle_users = false;
            }
            return next;
        });
    }

    async function handleSavePermissions() {
        if (!permissionUser || !permissionValues) return;

        setError("");
        setSavingPermissions(true);
        try {
            await updateManagedUserPermissions(
                permissionUser.id,
                permissionValues,
            );
            setPermissionUser(null);
            setPermissionValues(null);
            await loadUsers();
        } catch (caughtError) {
            setError(
                caughtError instanceof Error
                    ? caughtError.message
                    : "Unable to update permissions.",
            );
        } finally {
            setSavingPermissions(false);
        }
    }

    if (
        !currentUser ||
        !(currentUser.is_superuser || currentUser.can_access_user_management)
    ) {
        return (
            <main className="admin-container">
                <div className="empty-state">
                    You do not have permission to access User Management.
                </div>
            </main>
        );
    }

    return (
        <main className="admin-container">
            <div className="admin-header">
                <div>
                    <h1>User Management</h1>

                    <p className="section-description">
                        Create application users and reset temporary passwords.
                    </p>
                </div>

                {(currentUser.is_superuser || currentUser.can_create_users) && (
                    <button
                        type="button"
                        className="btn-primary"
                        onClick={() =>
                            setShowCreateUser((current) => !current)
                        }
                    >
                        <Plus size={16} />
                        New User
                    </button>
                )}
            </div>

            {error && (
                <p
                    role="alert"
                    className="error-message"
                >
                    {error}
                </p>
            )}

            {showCreateUser && (
                <form
                    className="modern-form assignment-create-form"
                    onSubmit={handleCreateUser}
                    style={{ marginBottom: "32px" }}
                >
                    <div className="form-grid form-grid-2">
                        <div className="form-group">
                            <label>Username</label>

                            <input
                                value={username}
                                onChange={(event) =>
                                    setUsername(event.target.value)
                                }
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>Email</label>

                            <input
                                type="email"
                                value={email}
                                onChange={(event) =>
                                    setEmail(event.target.value)
                                }
                            />
                        </div>

                        <div className="form-group">
                            <label>First name</label>

                            <input
                                value={firstName}
                                onChange={(event) =>
                                    setFirstName(event.target.value)
                                }
                            />
                        </div>

                        <div className="form-group">
                            <label>Last name</label>

                            <input
                                value={lastName}
                                onChange={(event) =>
                                    setLastName(event.target.value)
                                }
                            />
                        </div>
                    </div>

                    <div className="form-actions">
                        <button
                            type="button"
                            className="btn-secondary"
                            disabled={isSubmitting}
                            onClick={() =>
                                setShowCreateUser(false)
                            }
                        >
                            Cancel
                        </button>

                        <button
                            type="submit"
                            className="btn-primary"
                            disabled={isSubmitting}
                        >
                            {isSubmitting
                                ? "Creating..."
                                : "Create User"}
                        </button>
                    </div>
                </form>
            )}

            {users.length === 0 ? (
                <div className="empty-state">
                    No application users found.
                </div>
            ) : (
                <div className="table-container">
                    <table className="modern-table">
                        <thead>
                            <tr>
                                <th>Username</th>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Status</th>
                                <th>Password</th>
                                <th>Actions</th>
                            </tr>
                        </thead>

                        <tbody>
                            {users.map((user) => (
                                <tr key={user.id}>
                                    <td>
                                        <strong>
                                            {user.username}
                                        </strong>
                                    </td>

                                    <td>
                                        {[
                                            user.first_name,
                                            user.last_name,
                                        ]
                                            .filter(Boolean)
                                            .join(" ") || "—"}
                                    </td>

                                    <td>
                                        {user.email || "—"}
                                    </td>

                                    <td>
                                        <span
                                            className={`status-badge ${user.is_active
                                                    ? "status-active"
                                                    : "status-inactive"
                                                }`}
                                        >
                                            {user.is_active
                                                ? "Active"
                                                : "Inactive"}
                                        </span>
                                    </td>

                                    <td>
                                        {user.must_change_password ? (
                                            <span className="status-badge status-inactive">
                                                Temporary password
                                            </span>
                                        ) : (
                                            <span className="status-badge status-active">
                                                Set
                                            </span>
                                        )}
                                    </td>

                                    <td className="table-actions">
                                        {(currentUser.is_superuser || currentUser.can_reset_passwords) && (
                                            <button
                                                type="button"
                                                className="btn-table"
                                                disabled={resettingUserId === user.id}
                                                onClick={() =>
                                                    void handleResetPassword(user)
                                                }
                                            >
                                                <KeyRound size={14} />
                                                {resettingUserId === user.id
                                                    ? "Resetting..."
                                                    : "Reset Password"}
                                            </button>
                                        )}

                                        {(currentUser.is_superuser || currentUser.can_toggle_users) && (
                                            <button
                                                type="button"
                                                className="btn-table"
                                                disabled={updatingUserId === user.id}
                                                onClick={() =>
                                                    void handleToggleActive(user)
                                                }
                                            >
                                                {updatingUserId === user.id
                                                    ? "Updating..."
                                                    : user.is_active
                                                        ? "Disable"
                                                        : "Enable"}
                                            </button>
                                        )}

                                        {currentUser.is_superuser && !user.is_superuser && (
                                            <button
                                                type="button"
                                                className="btn-table"
                                                onClick={() => openPermissions(user)}
                                            >
                                                <ShieldCheck size={14} />
                                                Permissions
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {permissionUser && permissionValues && (
                <div className="config-modal-backdrop">
                    <div className="config-modal">
                        <div className="config-modal-header">
                            <div>
                                <h3>Permissions</h3>
                                <p className="section-description">
                                    User: {permissionUser.username}
                                </p>
                            </div>

                            <button
                                type="button"
                                className="config-modal-close"
                                onClick={() => {
                                    setPermissionUser(null);
                                    setPermissionValues(null);
                                }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="detail-block">
                            <strong>User Management</strong>
                            <label style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
                                <input
                                    type="checkbox"
                                    checked={permissionValues.can_access_user_management}
                                    onChange={(event) =>
                                        setPermission("can_access_user_management", event.target.checked)
                                    }
                                />
                                Access User Management
                            </label>

                            <div style={{ marginLeft: "28px", marginTop: "10px", display: "grid", gap: "10px" }}>
                                <label style={{ display: "flex", gap: "10px" }}>
                                    <input
                                        type="checkbox"
                                        checked={permissionValues.can_create_users}
                                        disabled={!permissionValues.can_access_user_management}
                                        onChange={(event) =>
                                            setPermission("can_create_users", event.target.checked)
                                        }
                                    />
                                    Create Users
                                </label>
                                <label style={{ display: "flex", gap: "10px" }}>
                                    <input
                                        type="checkbox"
                                        checked={permissionValues.can_reset_passwords}
                                        disabled={!permissionValues.can_access_user_management}
                                        onChange={(event) =>
                                            setPermission("can_reset_passwords", event.target.checked)
                                        }
                                    />
                                    Reset Passwords
                                </label>
                                <label style={{ display: "flex", gap: "10px" }}>
                                    <input
                                        type="checkbox"
                                        checked={permissionValues.can_toggle_users}
                                        disabled={!permissionValues.can_access_user_management}
                                        onChange={(event) =>
                                            setPermission("can_toggle_users", event.target.checked)
                                        }
                                    />
                                    Disable / Enable Users
                                </label>
                            </div>
                        </div>

                        <div className="detail-block" style={{ marginTop: "16px" }}>
                            <strong>Logs</strong>
                            <label style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
                                <input
                                    type="checkbox"
                                    checked={permissionValues.can_view_logs}
                                    onChange={(event) =>
                                        setPermission("can_view_logs", event.target.checked)
                                    }
                                />
                                View Logs
                            </label>
                        </div>

                        <p className="section-description" style={{ marginTop: "16px" }}>
                            Only superusers can change these permissions.
                        </p>

                        <div className="form-actions">
                            <button
                                type="button"
                                className="btn-secondary"
                                disabled={savingPermissions}
                                onClick={() => {
                                    setPermissionUser(null);
                                    setPermissionValues(null);
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="btn-primary"
                                disabled={savingPermissions}
                                onClick={() => void handleSavePermissions()}
                            >
                                {savingPermissions ? "Saving..." : "Save Permissions"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {temporaryPassword && (
                <div className="config-modal-backdrop">
                    <div className="config-modal">
                        <div className="config-modal-header">
                            <div>
                                <h3>Temporary Password</h3>

                                <p className="section-description">
                                    User: {temporaryPasswordUsername}
                                </p>
                            </div>

                            <button
                                type="button"
                                className="config-modal-close"
                                onClick={() => {
                                    setTemporaryPassword("");
                                    setTemporaryPasswordUsername("");
                                }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="detail-block">
                            <span className="detail-label">
                                Temporary password
                            </span>

                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "12px",
                                }}
                            >
                                <strong
                                    style={{
                                        fontFamily: "monospace",
                                        fontSize: "18px",
                                    }}
                                >
                                    {temporaryPassword}
                                </strong>

                                <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={copyTemporaryPassword}
                                >
                                    <Copy size={14} />
                                    Copy
                                </button>
                            </div>
                        </div>

                        <p className="section-description">
                            Share this password with the user securely.
                            They will be required to create a new password
                            after logging in.
                        </p>

                        <div className="form-actions">
                            <button
                                type="button"
                                className="btn-primary"
                                onClick={() => {
                                    setTemporaryPassword("");
                                    setTemporaryPasswordUsername("");
                                }}
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
