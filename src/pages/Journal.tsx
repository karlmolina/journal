import React, { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "../supabase";
import TopBar from "../components/TopBar";
import JournalEntry from "../components/JournalEntry";
import { useAuth } from "../context/AuthContext";

const LOCAL_STORAGE_KEY = "journal_entries";
const ENTRY_LIMIT = 10;

interface Entry {
  id: string;
  text: string;
  // Raw timestamptz string from Postgres; kept as-is so it can be used as a
  // pagination cursor without losing microsecond precision.
  createdAt: string;
}

interface EntryRow {
  id: string;
  text: string;
  created_at: string;
}

const toEntry = (row: EntryRow): Entry => ({
  id: row.id,
  text: row.text,
  createdAt: row.created_at,
});

function readCache(userId: string): Entry[] {
  try {
    const cached = localStorage.getItem(`${LOCAL_STORAGE_KEY}_${userId}`);
    return cached ? JSON.parse(cached) : [];
  } catch {
    return [];
  }
}

function writeCache(userId: string, entries: Entry[]) {
  try {
    localStorage.setItem(
      `${LOCAL_STORAGE_KEY}_${userId}`,
      JSON.stringify(entries),
    );
  } catch {
    // Ignore quota / private mode errors; the cache is only a convenience.
  }
}

export default function Journal() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const observer = useRef<IntersectionObserver | null>(null);

  const loadEntries = useCallback(
    async (cursor?: string) => {
      if (!user) return;
      setLoading(true);

      let q = supabase
        .from("entries")
        .select("id, text, created_at")
        .order("created_at", { ascending: false })
        .limit(ENTRY_LIMIT);
      if (cursor) q = q.lt("created_at", cursor);

      const { data, error } = await q;
      setLoading(false);
      if (error) {
        console.error(error);
        return;
      }

      const newEntries = data.map(toEntry);
      setEntries((prev) => {
        const updated = cursor ? [...prev, ...newEntries] : newEntries;
        writeCache(user.id, updated);
        return updated;
      });
      setHasMore(newEntries.length === ENTRY_LIMIT);
    },
    [user],
  );

  // Show cached entries instantly, then refresh from Supabase.
  useEffect(() => {
    if (!user) return;
    setEntries(readCache(user.id));
    setHasMore(true);
    loadEntries();
  }, [user, loadEntries]);

  // --- Infinite scroll observer ---
  const lastEntryRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (loading) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver((observed) => {
        if (observed[0].isIntersecting && hasMore && entries.length > 0) {
          loadEntries(entries[entries.length - 1].createdAt);
        }
      });
      if (node) observer.current.observe(node);
    },
    [loading, hasMore, entries, loadEntries],
  );

  // Add new entry
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || !user) return;

    const { data, error } = await supabase
      .from("entries")
      .insert({ text: trimmed })
      .select("id, text, created_at")
      .single();
    if (error) {
      console.error(error);
      return;
    }

    setEntries((prev) => {
      const updated = [toEntry(data), ...prev];
      writeCache(user.id, updated);
      return updated;
    });
    setText("");
  };

  const handleLogout = async () => {
    if (user) localStorage.removeItem(`${LOCAL_STORAGE_KEY}_${user.id}`);
    await supabase.auth.signOut();
  };

  return (
    <div className="max-w-xl mx-auto p-2 sm:p-6">
      <TopBar
        userPhoto={user?.user_metadata?.avatar_url}
        onSignOut={handleLogout}
      />

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
              createdAt={new Date(createdAt)}
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
