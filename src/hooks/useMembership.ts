import { useState, useEffect, useCallback } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../supabase";
import { readUserCache, writeUserCache } from "../functions/userCache";

export interface Membership {
  member: boolean;
  admin: boolean;
}

const MEMBERSHIP_CACHE_KEY = "journal_membership";

const readCached = (userId: string) =>
  readUserCache<Membership | null>(MEMBERSHIP_CACHE_KEY, userId, null);

// Whether the signed-in user has redeemed an invite (or had an account before
// invites existed), and whether they can make invite codes. Starts from the
// last known answer so members don't wait on a round trip to see their journal.
export default function useMembership(user: User | null) {
  const userId = user?.id;
  const [state, setState] = useState<{
    userId?: string;
    membership: Membership | null;
  }>(() => ({
    userId,
    membership: userId ? readCached(userId) : null,
  }));

  // Reset synchronously when the user changes so a previous user's answer is
  // never shown for the next one.
  if (state.userId !== userId)
    setState({ userId, membership: userId ? readCached(userId) : null });

  const refresh = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from("members")
      .select("is_admin")
      .eq("user_id", userId)
      .maybeSingle();
    // Keep the cached answer when offline; RLS still guards the data.
    if (error) return console.error(error);
    const membership = {
      member: data !== null,
      admin: data?.is_admin === true,
    };
    writeUserCache(MEMBERSHIP_CACHE_KEY, userId, membership);
    setState((prev) =>
      prev.userId === userId ? { userId, membership } : prev,
    );
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    membership: state.userId === userId ? state.membership : null,
    refreshMembership: refresh,
  };
}
