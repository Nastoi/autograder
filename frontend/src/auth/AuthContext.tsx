import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  getCurrentUser,
  loginUser,
  logoutUser,
  type User,
} from "../api/auth";

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  login: (
    username: string,
    password: string,
  ) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

type AuthProviderProps = {
  children: ReactNode;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function refreshUser(): Promise<void> {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      console.error("Failed to load current user:", error);
      setUser(null);
    }
  }

async function login(
  username: string,
  password: string,
): Promise<User> {
  const authenticatedUser = await loginUser(
    username,
    password,
  );

  setUser(authenticatedUser);

  return authenticatedUser;
}

  async function logout(): Promise<void> {
    await logoutUser();
    setUser(null);
  }

  useEffect(() => {
    async function initialiseAuthentication() {
      try {
        await refreshUser();
      } finally {
        setIsLoading(false);
      }
    }

    void initialiseAuthentication();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (context === null) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}