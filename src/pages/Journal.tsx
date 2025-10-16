// src/pages/Journal.tsx
import React, { useEffect, useState } from "react";
import {
  collection,
  addDoc,
  onSnapshot,
  orderBy,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { db, auth } from "../firebase";
import { useNavigate } from "react-router-dom";
import TopBar from "../components/TopBar";

interface Entry {
  id: string;
  text: string;
  createdAt: Date;
}

export default function Journal() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [text, setText] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) navigate("/signin");
      setUser(u);
    });
    return unsub;
  }, [navigate]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "entries"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc"),
    );
    const unsub = onSnapshot(q, (snapshot) => {
      setEntries(
        snapshot.docs.map((doc) => ({
          id: doc.id,
          text: doc.data().text,
          createdAt: doc.data().createdAt?.toDate() || new Date(),
        })),
      );
    });
    return unsub;
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !user) return;
    await addDoc(collection(db, "entries"), {
      text: text.trim(),
      createdAt: serverTimestamp(),
      userId: user.uid,
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

      {entries.length === 0 ? (
        <p className="text-center text-gray-500">No entries yet.</p>
      ) : (
        <div className="space-y-2">
          {entries.map(({ id, text, createdAt }) => (
            <div
              key={id}
              className="card bg-base-100 border-base-content/20 border"
            >
              <div className="card-body text-base p-2 sm:p-4">
                <div className="text-sm text-gray-400">
                  {createdAt.toLocaleString()}
                </div>
                <p className="whitespace-pre-wrap">{text}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
