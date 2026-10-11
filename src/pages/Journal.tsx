import React, { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "../supabase";
import TopBar from "../components/TopBar";
import JournalEntry from "../components/JournalEntry";
import { useAuth } from "../context/AuthContext";

const LOCAL_STORAGE_KEY = "journal_entries";
const ENTRY_LIMIT = 10;
const SEARCH_DEBOUNCE_MS = 300;

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
  const latestRequest = useRef(0);
  const [searchText, setSearchText] = useState("");
  const [results, setResults] = useState<Entry[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const loadEntries = useCallback(
    async (cursor?: string) => {
      if (!user) return;
      // Only a fresh (cursorless) load invalidates in-flight requests.
      const requestId = cursor
        ? latestRequest.current
        : ++latestRequest.current;
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

      // A fresh load started after this one; its result supersedes ours.
      if (requestId !== latestRequest.current) return;

      const newEntries = data.map(toEntry);
      setEntries((prev) => {
        const seen = new Set(prev.map((e) => e.id));
        const updated = cursor
          ? [...prev, ...newEntries.filter((e) => !seen.has(e.id))]
          : newEntries;
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

  // Only the latest request may update state, so slow earlier responses can't
  // overwrite newer results.
  const searchRequestId = useRef(0);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const runSearch = useCallback(async (query: string) => {
    const requestId = ++searchRequestId.current;
    setSearching(true);
    const { data, error } = await supabase.rpc("search_entries", {
      query_text: query,
    });
    if (requestId !== searchRequestId.current) return;
    setSearching(false);
    if (error) {
      console.error(error);
      return;
    }
    setResults((data as EntryRow[]).map(toEntry));
  }, []);

  // Search 300ms after the user stops typing.
  useEffect(() => {
    const query = searchText.trim();
    if (!query) {
      searchRequestId.current++;
      setSearching(false);
      return;
    }
    searchTimer.current = setTimeout(() => runSearch(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(searchTimer.current);
  }, [searchText, runSearch]);

  // Enter searches immediately instead of waiting out the debounce.
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchText.trim();
    if (!query) return;
    clearTimeout(searchTimer.current);
    runSearch(query);
  };

  const clearSearchText = () => {
    setSearchText("");
    setResults(null);
  };

  const toggleSearch = () => {
    if (searchOpen) clearSearchText();
    setSearchOpen(!searchOpen);
  };

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
        userPhoto={
          user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture
        }
        onSignOut={handleLogout}
        searchOpen={searchOpen}
        onSearchToggle={toggleSearch}
        searchText={searchText}
        onSearchTextChange={(value) => {
          setSearchText(value);
          if (!value) setResults(null);
        }}
        onSearchClear={clearSearchText}
        onSearchSubmit={handleSearch}
        searching={searching}
      />

      {!searchOpen && (
        <form onSubmit={handleSubmit}>
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
      )}

      {results ? (
        <div className="space-y-2">
          {results.length === 0 ? (
            <p className="text-center text-gray-400">No matching entries.</p>
          ) : (
            results.map(({ id, text, createdAt }) => (
              <JournalEntry key={id} text={text} createdAt={new Date(createdAt)} />
            ))
          )}
        </div>
      ) : entries.length === 0 && !loading ? (
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

      {loading && !results && (
        <div className="text-center text-gray-400 mt-4">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      )}
    </div>
  );
}
