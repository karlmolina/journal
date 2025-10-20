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
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { db, auth } from "../firebase";
import { useNavigate } from "react-router-dom";
import TopBar from "../components/TopBar";
import formatDate from "../functions/formatDate";
import JournalEntry from "../components/JournalEntry";

interface Entry {
  id: string;
  text: string;
  createdAt: Date;
}

export default function Journal() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [text, setText] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const navigate = useNavigate();
  const observer = useRef<IntersectionObserver | null>(null);

  // --- Watch auth ---
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) navigate("/signin");
      setUser(u);
    });
    return unsub;
  }, [navigate]);

  useEffect(() => {
    if (!user) return;
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

      setEntries((prev) => (more ? [...prev, ...newEntries] : newEntries));
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

  // --- Add new entry ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !user) return;
    await addDoc(collection(db, "entries"), {
      text: text.trim(),
      createdAt: serverTimestamp(),
      userId: user.uid,
    });
    setText("");
    await loadEntries();
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/signin");
  };

  return (
    <div className="max-w-xl mx-auto p-2 sm:p-6">
      <TopBar userPhoto={user?.photoURL} onSignOut={handleLogout} />

      <form onSubmit={handleSubmit} className="mb-4 sm:mb-8">
        <textarea
          id="journal-entry"
          className="textarea w-full h-32 resize-none focus:outline-none transition-shadow text-base p-2 sm:p-4"
          placeholder="Write a journal entry..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" className="btn btn-primary mt-2 sm:mt-4 w-full">
          Add Entry
        </button>
      </form>

      {entries.length === 0 && !loading ? (
        <p className="text-center text-gray-500">No entries yet.</p>
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

      {loading && <p className="text-center text-gray-400 mt-4">Loading...</p>}
    </div>
  );
}
