import { useState, useEffect, useRef } from "react";
import type { User } from "@supabase/supabase-js";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";

const USER_CACHE_KEY = "journal_user";

function readCachedUser(): User | null {
  try {
    const cached = localStorage.getItem(USER_CACHE_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
}

function writeCachedUser(user: User | null) {
  try {
    if (user) localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
    else {
      localStorage.removeItem(USER_CACHE_KEY);
      // TopBar's copy of the profile photo.
      localStorage.removeItem("journal_photo");
    }
  } catch {
    // Ignore quota / private mode errors; the cache is only a convenience.
  }
}

export default function useSupabaseAuth() {
  // supabase-js refreshes an expired access token over the network before
  // getSession() resolves, which on most reloads means waiting on a round trip
  // (or forever, offline). Start from the last known user so cached entries and
  // the profile picture show instantly; requests still wait for a valid token.
  const [user, setUser] = useState<User | null>(readCachedUser);
  const [loading, setLoading] = useState(() => user === null);
  const hadUser = useRef(user !== null);
  const navigate = useNavigate();

  useEffect(() => {
    const update = (next: User | null) => {
      // Keep the same object while the user is unchanged so token refreshes
      // don't re-run effects keyed on the user.
      setUser((prev) =>
        prev &&
        next &&
        prev.id === next.id &&
        prev.updated_at === next.updated_at
          ? prev
          : next,
      );
      writeCachedUser(next);
      setLoading(false);
      // The cached user's session turned out to be gone (e.g. revoked).
      if (!next && hadUser.current) navigate("/signin");
      hadUser.current = next !== null;
    };

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => update(session?.user ?? null));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      update(session?.user ?? null);
      if (event === "SIGNED_OUT") navigate("/signin");
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  return { user, loading };
}
