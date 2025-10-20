// src/context/AuthContext.tsx
import React, { createContext, useContext } from "react";
import type { User } from "firebase/auth";
import useFirebaseAuth from "../hooks/useFirebaseAuth";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user, loading } = useFirebaseAuth();
  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
