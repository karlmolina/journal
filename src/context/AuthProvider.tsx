// src/context/AuthProvider.tsx
import React from "react";
import useSupabaseAuth from "../hooks/useSupabaseAuth";
import useMembership from "../hooks/useMembership";
import { AuthContext } from "./AuthContext";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user, loading } = useSupabaseAuth();
  const { membership, refreshMembership } = useMembership(user);
  return (
    <AuthContext.Provider
      value={{ user, loading, membership, refreshMembership }}
    >
      {children}
    </AuthContext.Provider>
  );
};
