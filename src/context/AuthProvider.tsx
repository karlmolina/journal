// src/context/AuthProvider.tsx
import React from "react";
import useSupabaseAuth from "../hooks/useSupabaseAuth";
import { AuthContext } from "./AuthContext";

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
