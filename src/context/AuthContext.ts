// src/context/AuthContext.ts
import { createContext, useContext } from "react";
import type { User } from "@supabase/supabase-js";
import type { Membership } from "../hooks/useMembership";

export interface AuthContextValue {
  user: User | null;
  loading: boolean;
  // null until known for the signed-in user.
  membership: Membership | null;
  refreshMembership: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  membership: null,
  refreshMembership: async () => {},
});

export const useAuth = () => useContext(AuthContext);
