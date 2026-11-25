import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabase";
import { readUserCache, writeUserCache } from "../functions/userCache";
import { notDeleted, queueDelete } from "../functions/undoDelete";
import { reportError } from "../functions/reportError";

// Notes written for Claude (feature requests, bugs, feedback). Claude sessions
// read the open ones from the claude_notes table and set done_at when they
// pick one up.
export interface ClaudeNote {
  id: string;
  body: string;
  created_at: string;
  done_at: string | null;
}

const CACHE_KEY = "claude_notes";
const TABLE = "claude_notes";

export default function useClaudeNotes(userId?: string, enabled = true) {
  const [notes, setNotes] = useState<ClaudeNote[]>(() =>
    userId ? readUserCache<ClaudeNote[]>(CACHE_KEY, userId, []) : [],
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userId) writeUserCache(CACHE_KEY, userId, notes);
  }, [userId, notes]);

  const fail = useCallback((message: string, err: unknown) => {
    reportError(err, message);
    setError(message);
  }, []);

  // Loads when the notes are first opened, not on every page.
  useEffect(() => {
    if (!userId || !enabled) return;
    let cancelled = false;
    supabase
      .from(TABLE)
      .select("id, body, created_at, done_at")
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) return fail("Couldn't load your notes for Claude.", error);
        setNotes((data as ClaudeNote[]).filter(notDeleted(TABLE)));
      });
    return () => {
      cancelled = true;
    };
  }, [userId, enabled, fail]);

  const addNote = useCallback(
    async (body: string) => {
      const note: ClaudeNote = {
        id: crypto.randomUUID(),
        body,
        created_at: new Date().toISOString(),
        done_at: null,
      };
      setError(null);
      setNotes((prev) => [note, ...prev]);
      const { error } = await supabase
        .from(TABLE)
        .insert({ id: note.id, body: note.body });
      if (error) {
        setNotes((prev) => prev.filter((n) => n.id !== note.id));
        fail("Couldn't save your note for Claude.", error);
        return false;
      }
      return true;
    },
    [fail],
  );

  const deleteNote = useCallback(
    (note: ClaudeNote) => {
      setNotes((prev) => prev.filter((n) => n.id !== note.id));
      queueDelete({
        message: "Note deleted",
        rows: [`${TABLE}:${note.id}`],
        commit: () => supabase.from(TABLE).delete().eq("id", note.id),
        undo: () =>
          setNotes((prev) =>
            [note, ...prev.filter((n) => n.id !== note.id)].sort((a, b) =>
              b.created_at.localeCompare(a.created_at),
            ),
          ),
        onError: (err) => fail("Couldn't delete the note.", err),
      });
    },
    [fail],
  );

  return { notes, error, addNote, deleteNote };
}
