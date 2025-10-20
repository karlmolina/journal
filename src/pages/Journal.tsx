import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  collection,
  addDoc,
  getDocs,
  orderBy,
  query,
  where,
  serverTimestamp,
  limit,
  startAfter,
  DocumentSnapshot,
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import { db, auth } from "../firebase";
import { useNavigate } from "react-router-dom";
import TopBar from "../components/TopBar";
import JournalEntry from "../components/JournalEntry";
import { useAuth } from "../context/AuthContext";
// At the top of your component
const LOCAL_STORAGE_KEY = "journal_entries";

interface Entry {
  id: string;
  text: string;
  createdAt: Date;
}

export default function Journal() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<Entry[]>(() => {
    if (!user) return []; // no user yet

    const cached = localStorage.getItem(`${LOCAL_STORAGE_KEY}_${user.uid}`);
    if (!cached) return [];

    try {
      const parsed: Entry[] = JSON.parse(cached).map((entry: any) => ({
        ...entry,
        createdAt: new Date(entry.createdAt), // restore Date objects
      }));
      return parsed;
    } catch {
      return [];
    }
  });
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const navigate = useNavigate();
  const observer = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (!user) return;

    // Then fetch latest entries from Firestore
    loadEntries();
  }, [user]);

  const loadEntries = useCallback(
    async (more = false) => {
      const entryLimit = 10;
      if (!user || loading || (!hasMore && more)) return;
      setLoading(true);

      const q = query(
        collection(db, "entries"),
        where("userId", "==", user.uid),
        orderBy("createdAt", "desc"),
        ...(lastDoc && more ? [startAfter(lastDoc)] : []),
        limit(entryLimit),
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setHasMore(false);
        setLoading(false);
        return;
      }

      const newEntries = snapshot.docs.map((doc) => ({
        id: doc.id,
        text: doc.data().text,
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      }));

      setEntries((prev) => {
        const updated = more ? [...prev, ...newEntries] : newEntries;
        localStorage.setItem(
          `${LOCAL_STORAGE_KEY}_${user.uid}`,
          JSON.stringify(updated),
        );
        return updated;
      });
      setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
      if (snapshot.docs.length < entryLimit) setHasMore(false);
      setLoading(false);
    },
    [user, lastDoc, loading, hasMore],
  );

  // --- Infinite scroll observer ---
  const lastEntryRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (loading) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) {
          loadEntries(true);
        }
      });
      if (node) observer.current.observe(node);
    },
    [loading, hasMore, loadEntries],
  );

  // Add new entry
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !user) return;

    // Create new entry in Firestore
    const docRef = await addDoc(collection(db, "entries"), {
      text: text.trim(),
      createdAt: serverTimestamp(),
      userId: user.uid,
    });

    // Immediately add it to local state for instant UI update
    const newEntry: Entry = {
      id: docRef.id,
      text: text.trim(),
      createdAt: new Date(), // Use now, will be replaced on next fetch if needed
    };
    setEntries((prev) => {
      const updated = [newEntry, ...prev];
      localStorage.setItem(
        `${LOCAL_STORAGE_KEY}_${user.uid}`,
        JSON.stringify(updated),
      );
      return updated;
    });
    setText("");
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/signin");
  };

  return (
    <div className="max-w-xl mx-auto p-2 sm:p-6">
      <TopBar userPhoto={user?.photoURL} onSignOut={handleLogout} />

      <form onSubmit={handleSubmit} className="">
        <textarea
          id="journal-entry"
          className="textarea w-full h-32 resize-none focus:outline-none transition-shadow text-base p-2 sm:p-4"
          placeholder="Write a journal entry..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" className="btn btn-primary my-2 sm:my-4 w-full">
          Add Entry
        </button>
      </form>

      {entries.length === 0 && !loading ? (
        <p className="text-center text-gray-400">No entries yet.</p>
      ) : (
        <div className="space-y-2">
          {entries.map(({ id, text, createdAt }, i) => (
            <JournalEntry
              key={id}
              text={text}
              createdAt={createdAt}
              refProp={i === entries.length - 1 ? lastEntryRef : undefined}
            />
          ))}
        </div>
      )}

      {loading && (
        <div className="text-center text-gray-400 mt-4">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      )}
    </div>
  );
}
