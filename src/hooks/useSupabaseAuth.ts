import { useState, useEffect, useRef } from "react";
import type { User } from "@supabase/supabase-js";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { clearUserCaches, setCacheOwner } from "../functions/userCache";

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
    // A different account signed in: drop the previous one's cached data.
    const prev = readCachedUser();
    if (user && prev && prev.id !== user.id) clearUserCaches(prev.id);
    setCacheOwner(user?.id ?? null);
    if (user) localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
    else {
      localStorage.removeItem(USER_CACHE_KEY);
      // TopBar's copy of the profile photo.
      localStorage.removeItem("journal_photo");
      // useLastPage's saved page, so the next person starts on the journal.
      localStorage.removeItem("journal_last_page");
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
  const [user, setUser] = useState<User | null>(() => {
    const cached = readCachedUser();
    setCacheOwner(cached?.id ?? null);
    return cached;
  });
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
      // Signed out here or in another tab, or the session was revoked; the
      // cached data goes with it so nobody else on this device sees it.
      if (event === "SIGNED_OUT") clearUserCaches(readCachedUser()?.id);
      update(session?.user ?? null);
      if (event === "SIGNED_OUT") navigate("/signin");
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  return { user, loading };
}
