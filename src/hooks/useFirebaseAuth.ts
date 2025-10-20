import { useState, useEffect } from "react";
import { getAuth, onAuthStateChanged, type User } from "firebase/auth";
import { useNavigate } from "react-router-dom";

const USER_CACHE_KEY = "userCache";

export default function useFirebaseAuth() {
  const auth = getAuth();

  // Try to restore from localStorage first
  const cached = localStorage.getItem(USER_CACHE_KEY);
  const [user, setUser] = useState<User | null>(
    cached ? (JSON.parse(cached) as User) : auth.currentUser,
  );
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
        // Store minimal info in localStorage for instant load next time
        localStorage.setItem(
          USER_CACHE_KEY,
          JSON.stringify({
            uid: u.uid,
            displayName: u.displayName,
            photoURL: u.photoURL,
            email: u.email,
          }),
        );
      } else {
        localStorage.removeItem("journal_entries_" + (user?.uid || ""));
        setUser(null);
        localStorage.removeItem(USER_CACHE_KEY);
        navigate("/signin");
      }
      setLoading(false);
    });

    return () => unsub();
  }, [auth, navigate]);

  return { user, loading };
}
