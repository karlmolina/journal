import React, {
  useEffect,
  useLayoutEffect,
  useState,
  useRef,
  useCallback,
} from "react";
import { supabase } from "../supabase";
import TopBar from "../components/TopBar";
import JournalEntry from "../components/JournalEntry";
import { useAuth } from "../context/AuthContext";
import useVisualViewport from "../hooks/useVisualViewport";
import signOut from "../functions/signOut";

const LOCAL_STORAGE_KEY = "journal_entries";
// Entries submitted but not yet confirmed saved, so a reload or a failed request
// doesn't lose them; they're retried until the insert succeeds.
const PENDING_KEY = "journal_pending";
const DRAFT_KEY = "journal_draft";
const ENTRY_LIMIT = 10;
const SEARCH_DEBOUNCE_MS = 300;
const PLACEHOLDERS = [
  "What happened today?",
  "How's it going today?",
  "How are you feeling today?",
];

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

interface SearchRow extends EntryRow {
  highlighted: string;
}

const toEntry = (row: EntryRow): Entry => ({
  id: row.id,
  text: row.text,
  createdAt: row.created_at,
});

interface SearchResult extends Entry {
  highlighted: string;
}

function readStored<T>(key: string, userId: string, fallback: T): T {
  try {
    const cached = localStorage.getItem(`${key}_${userId}`);
    return cached ? JSON.parse(cached) : fallback;
  } catch {
    return fallback;
  }
}

function writeStored(key: string, userId: string, value: unknown) {
  try {
    localStorage.setItem(`${key}_${userId}`, JSON.stringify(value));
  } catch {
    // Ignore quota / private mode errors; the cache is only a convenience.
  }
}

const readCache = (userId: string) =>
  readStored<Entry[]>(LOCAL_STORAGE_KEY, userId, []);
const writeCache = (userId: string, entries: Entry[]) =>
  writeStored(LOCAL_STORAGE_KEY, userId, entries);
const readPending = (userId: string) =>
  readStored<Entry[]>(PENDING_KEY, userId, []);
const writePending = (userId: string, entries: Entry[]) =>
  writeStored(PENDING_KEY, userId, entries);
const readDraft = (userId: string) => readStored(DRAFT_KEY, userId, "");
const writeDraft = (userId: string, draft: string) => {
  if (draft) writeStored(DRAFT_KEY, userId, draft);
  else localStorage.removeItem(`${DRAFT_KEY}_${userId}`);
};

function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-6 gap-1">
      <p className="text-lg font-bold">{title}</p>
      <p className="text-sm font-medium text-base-content/55">{hint}</p>
    </div>
  );
}

export default function Journal() {
  const { user } = useAuth();
  const userId = user?.id;
  useVisualViewport();
  // Seeded synchronously so cached entries are in the very first paint.
  const [entries, setEntries] = useState<Entry[]>(() =>
    userId ? readCache(userId) : [],
  );
  // Newest first, like `entries`; shown above them until the insert succeeds.
  const [pending, setPending] = useState<Entry[]>(() =>
    userId ? readPending(userId) : [],
  );
  // Ids whose save failed this session, shown with a retry button.
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const [text, setText] = useState(() => (userId ? readDraft(userId) : ""));
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const observer = useRef<IntersectionObserver | null>(null);
  const latestRequest = useRef(0);
  // Scroll bookkeeping: the newest entry is at the bottom, so we jump there on
  // first render / new entry, and keep position steady when older ones load above.
  const scrollToBottom = useRef(true);
  const prevScrollHeight = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showJumpDown, setShowJumpDown] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  // The entry box is a compact one-row pill until focused or non-empty.
  const [focused, setFocused] = useState(false);
  // Picked once per page load so the prompt stays steady while typing.
  const [placeholder] = useState(
    () => PLACEHOLDERS[Math.floor(Math.random() * PLACEHOLDERS.length)],
  );
  const expanded = focused || text !== "";

  const loadEntries = useCallback(
    async (cursor?: string) => {
      if (!userId) return;
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
      if (cursor)
        prevScrollHeight.current = scrollRef.current?.scrollHeight ?? null;
      setEntries((prev) => {
        const seen = new Set(prev.map((e) => e.id));
        const updated = cursor
          ? [...prev, ...newEntries.filter((e) => !seen.has(e.id))]
          : newEntries;
        writeCache(userId, updated);
        return updated;
      });
      setHasMore(newEntries.length === ENTRY_LIMIT);
    },
    [userId],
  );

  const updatePending = useCallback(
    (update: (prev: Entry[]) => Entry[]) => {
      if (!userId) return;
      setPending((prev) => {
        const updated = update(prev);
        writePending(userId, updated);
        return updated;
      });
    },
    [userId],
  );

  // Inserts with the entry's client-generated id, so retrying one that already
  // reached the database (e.g. the page reloaded before the reply) is a no-op.
  const saving = useRef(new Set<string>());
  const saveEntry = useCallback(
    async (entry: Entry) => {
      if (!userId || saving.current.has(entry.id)) return;
      saving.current.add(entry.id);
      setFailed((prev) => {
        const next = new Set(prev);
        next.delete(entry.id);
        return next;
      });
      const { data, error } = await supabase
        .from("entries")
        .upsert(
          { id: entry.id, text: entry.text },
          { onConflict: "id", ignoreDuplicates: true },
        )
        .select("id, text, created_at");
      saving.current.delete(entry.id);
      if (error) {
        console.error(error);
        setFailed((prev) => new Set(prev).add(entry.id));
        return;
      }
      // An already-saved duplicate returns no row; the next refresh has it.
      const saved = data[0] ? toEntry(data[0]) : null;
      if (saved)
        setEntries((prev) => {
          if (prev.some((e) => e.id === saved.id)) return prev;
          const updated = [saved, ...prev];
          writeCache(userId, updated);
          return updated;
        });
      updatePending((prev) => prev.filter((e) => e.id !== entry.id));
    },
    [userId, updatePending],
  );

  // Show cached entries and draft instantly, retry unsaved entries, then
  // refresh from Supabase.
  const loadedFor = useRef(userId);
  useEffect(() => {
    if (!userId) return;
    scrollToBottom.current = true;
    // State was seeded from this user's cache on mount; only re-read on change.
    if (loadedFor.current !== userId) {
      loadedFor.current = userId;
      setEntries(readCache(userId));
      setPending(readPending(userId));
      setText(readDraft(userId));
    }
    setHasMore(true);
    readPending(userId).forEach(saveEntry);
    loadEntries();
  }, [userId, loadEntries, saveEntry]);

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
    setResults(
      (data as SearchRow[]).map((row) => ({
        ...toEntry(row),
        highlighted: row.highlighted,
      })),
    );
  }, []);

  // Search 300ms after the user stops typing.
  useEffect(() => {
    const query = searchText.trim();
    if (!query) {
      searchRequestId.current++;
      setSearching(false);
      return;
    }
    searchTimer.current = setTimeout(
      () => runSearch(query),
      SEARCH_DEBOUNCE_MS,
    );
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

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (scrollToBottom.current && entries.length + pending.length > 0) {
      scrollToBottom.current = false;
      el.scrollTop = el.scrollHeight;
    } else if (prevScrollHeight.current !== null) {
      el.scrollTop += el.scrollHeight - prevScrollHeight.current;
    }
    prevScrollHeight.current = null;
  }, [entries, pending]);

  // Grow the entry box with its content (up to its max-height). Browsers with
  // `field-sizing: content` do this in CSS; others measure the textarea here.
  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el || CSS.supports("field-sizing", "content")) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useLayoutEffect(resizeTextarea, [text, searchOpen, resizeTextarea]);

  // Search results are bottom-anchored like the journal: newest nearest the input.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && results) el.scrollTop = el.scrollHeight;
  }, [results]);

  // Whether the list is scrolled to the newest entry, so it can stay there
  // when the list gets shorter (keyboard opening, entry box expanding).
  const atBottom = useRef(true);

  const handleListScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    atBottom.current = distance < 2;
    setShowJumpDown(distance > 200);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (atBottom.current) el.scrollTop = el.scrollHeight;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const jumpToBottom = () => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  };

  // --- Infinite scroll observer (fires at the top: older entries load upward) ---
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

  const updateText = (value: string) => {
    setText(value);
    if (userId) writeDraft(userId, value);
  };

  // Add new entry: show it right away and save in the background. It stays in
  // the pending list (and localStorage) until the insert succeeds.
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || !userId) return;

    const entry: Entry = {
      id: crypto.randomUUID(),
      text: trimmed,
      createdAt: new Date().toISOString(),
    };
    updatePending((prev) => [entry, ...prev]);
    updateText("");
    // Clearing the text disables the send button, which drops focus without a
    // blur event, so the box would otherwise stay expanded.
    if (document.activeElement !== textareaRef.current) setFocused(false);
    scrollToBottom.current = true;
    saveEntry(entry);
  };

  // A pending entry the refresh already returned was saved by an earlier visit.
  const savedIds = new Set(entries.map((e) => e.id));
  const unsaved = pending.filter((e) => !savedIds.has(e.id));

  return (
    // Fixed to the visible area so the page itself never scrolls: the entry
    // list is the only scroller and the top bar stays put when the keyboard opens.
    <div className="fixed inset-x-0 top-(--vv-top,0px) h-(--vv-height,100dvh) max-w-xl mx-auto px-2 sm:px-6 flex flex-col">
      <TopBar
        userPhoto={
          user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture
        }
        onSignOut={() => signOut(userId)}
      />

      <div className="relative flex-1 min-h-0">
        <div
          ref={scrollRef}
          onScroll={handleListScroll}
          className="h-full overflow-y-auto overscroll-contain scrollbar-none"
        >
          {loading && !results && (
            <div className="flex justify-center py-4 text-base-content/40">
              <span className="loading loading-spinner loading-md"></span>
            </div>
          )}

          {results ? (
            <div className="flex flex-col gap-3 pb-1">
              {results.length === 0 && !searching ? (
                <EmptyState
                  title="No matching entries"
                  hint="Try a different word or phrase."
                />
              ) : (
                [...results]
                  .reverse()
                  .map(({ id, text, highlighted, createdAt }) => (
                    <JournalEntry
                      key={id}
                      text={text}
                      highlighted={highlighted}
                      createdAt={new Date(createdAt)}
                    />
                  ))
              )}
            </div>
          ) : entries.length === 0 && unsaved.length === 0 && !loading ? (
            <EmptyState
              title="Nothing here yet"
              hint="Write your first entry below. Only you can see it."
            />
          ) : (
            <div className="flex flex-col gap-3 pb-1">
              {[...entries].reverse().map(({ id, text, createdAt }, i) => (
                <JournalEntry
                  key={id}
                  text={text}
                  createdAt={new Date(createdAt)}
                  refProp={i === 0 ? lastEntryRef : undefined}
                />
              ))}
              {[...unsaved].reverse().map((entry) => (
                <JournalEntry
                  key={entry.id}
                  text={entry.text}
                  createdAt={new Date(entry.createdAt)}
                  status={failed.has(entry.id) ? "failed" : "saving"}
                  onRetry={() => saveEntry(entry)}
                />
              ))}
            </div>
          )}
        </div>
        {showJumpDown && !results && (
          <button
            type="button"
            onClick={jumpToBottom}
            aria-label="Scroll to latest entry"
            className="btn btn-circle btn-primary absolute bottom-3 left-1/2 -translate-x-1/2 shadow-lg active:scale-95 transition"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 5v14" />
              <path d="m19 12-7 7-7-7" />
            </svg>
          </button>
        )}
      </div>

      {searchOpen ? (
        <form
          onSubmit={handleSearch}
          className="shrink-0 bg-base-100 flex items-end gap-2 pt-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:pt-10 sm:pb-[calc(env(safe-area-inset-bottom)+2.5rem)]"
        >
          <label className="input relative flex-1 h-14 rounded-3xl bg-base-content/8 border-0 shadow-sm text-lg font-medium text-base-content/90 dark:text-[color-mix(in_oklab,var(--color-base-content),white_45%)] gap-0 pl-14 pr-14 sm:h-16 sm:pl-16 sm:pr-16 focus-within:outline-none [&_input]:placeholder:text-base-content/50">
            <button
              type="button"
              className="btn btn-ghost btn-circle absolute z-10 left-2 bottom-2 sm:left-3 sm:bottom-3"
              onClick={toggleSearch}
              aria-label="Close search"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 12H5" />
                <path d="m12 19-7-7 7-7" />
              </svg>
            </button>
            <input
              type="text"
              autoFocus
              placeholder="Search entries..."
              value={searchText}
              onChange={(e) => {
                setSearchText(e.target.value);
                if (!e.target.value) setResults(null);
              }}
              onKeyDown={(e) => e.key === "Escape" && toggleSearch()}
            />
            {searching && (
              <span className="loading loading-spinner loading-xs"></span>
            )}
            <button
              type="button"
              className="btn btn-ghost btn-circle absolute z-10 right-2 bottom-2 sm:right-3 sm:bottom-3"
              // Clear the text first; close search if there's nothing to clear.
              onClick={searchText ? clearSearchText : toggleSearch}
              aria-label={searchText ? "Clear search" : "Close search"}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </label>
        </form>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="shrink-0 bg-base-100 pt-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:pt-10 sm:pb-[calc(env(safe-area-inset-bottom)+2.5rem)]"
        >
          <div
            className={`bg-base-content/8 rounded-3xl shadow-sm flex flex-wrap items-center transition-[padding] duration-150 focus-within:bg-base-content/10 ${
              expanded ? "px-3 pt-4 pb-3 sm:px-4 sm:pt-5 sm:pb-4" : "p-2"
            }`}
            onFocus={() => setFocused(true)}
            onBlur={(e) => {
              if (e.currentTarget.contains(e.relatedTarget)) return;
              setFocused(false);
              // Drop stray blank lines so the box collapses to one row.
              if (!text.trim()) updateText("");
            }}
          >
            <button
              type="button"
              className={`btn btn-ghost btn-circle${expanded ? " mr-auto" : ""}`}
              onClick={toggleSearch}
              aria-label="Search entries"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </button>
            <textarea
              id="journal-entry"
              ref={textareaRef}
              rows={1}
              className={`block max-h-64 resize-none [field-sizing:content] bg-transparent border-0 outline-none px-2 text-lg font-medium text-base-content/90 dark:text-[color-mix(in_oklab,var(--color-base-content),white_45%)] leading-snug placeholder:text-base-content/50 ${
                expanded ? "order-first basis-full mb-3" : "flex-1 min-w-0"
              }`}
              placeholder={placeholder}
              value={text}
              onChange={(e) => updateText(e.target.value)}
              onFocus={resizeTextarea}
            />
            <button
              type="submit"
              className="btn btn-primary btn-circle transition active:scale-95"
              disabled={!text.trim()}
              aria-label="Add entry"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 19V5" />
                <path d="m5 12 7-7 7 7" />
              </svg>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
