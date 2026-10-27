import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export const LAST_PAGE_KEY = "journal_last_page";

// Pages worth coming back to; sign-in and the root redirect are not.
const SAVED = /^\/(journal|workouts|sleep|meals|invites)(\/|$|\?)/;

export function readLastPage(): string | null {
  try {
    const page = localStorage.getItem(LAST_PAGE_KEY);
    return page && SAVED.test(page) ? page : null;
  } catch {
    return null;
  }
}

// Remembers the page you're on and goes back to it when the app is opened on
// the journal, where the sign-in redirect and home screen shortcuts land. The
// root page sends you there itself.
export default function useLastPage() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const page = location.pathname + location.search;
  // Only the page the app opened on is a candidate for restoring, so later
  // visits to the journal are left alone.
  const openedOnJournal = useRef(location.pathname === "/journal");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (ready || loading) return;
    if (user && openedOnJournal.current) {
      const last = readLastPage();
      if (last && last !== page) navigate(last, { replace: true });
    }
    setReady(true);
  }, [ready, user, loading, page, navigate]);

  useEffect(() => {
    // Wait for any restore so the landing page doesn't overwrite the saved one.
    if (!ready || !user || !SAVED.test(page)) return;
    try {
      localStorage.setItem(LAST_PAGE_KEY, page);
    } catch {
      // Ignore quota / private mode errors; this is only a convenience.
    }
  }, [ready, user, page]);
}
