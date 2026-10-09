// src/context/AuthContext.tsx
import React, { createContext, useContext } from "react";
import type { User } from "@supabase/supabase-js";
import useSupabaseAuth from "../hooks/useSupabaseAuth";

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
  const { user, loading } = useSupabaseAuth();
  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
