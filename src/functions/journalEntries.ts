import { readUserCache, removeUserCache, writeUserCache } from "./userCache";

const LOCAL_STORAGE_KEY = "journal_entries";
// Entries submitted but not yet confirmed saved, so a reload or a failed request
// doesn't lose them; they're retried until the insert succeeds.
const PENDING_KEY = "journal_pending";
const DRAFT_KEY = "journal_draft";

export interface Entry {
  id: string;
  text: string;
  // Raw timestamptz string from Postgres; kept as-is so it can be used as a
  // pagination cursor without losing microsecond precision.
  createdAt: string;
}

export interface EntryRow {
  id: string;
  text: string;
  created_at: string;
}

export interface SearchRow extends EntryRow {
  highlighted: string;
}

export const toEntry = (row: EntryRow): Entry => ({
  id: row.id,
  text: row.text,
  createdAt: row.created_at,
});

export interface SearchResult extends Entry {
  highlighted: string;
}

export const readCache = (userId: string) =>
  readUserCache<Entry[]>(LOCAL_STORAGE_KEY, userId, []);
export const writeCache = (userId: string, entries: Entry[]) =>
  writeUserCache(LOCAL_STORAGE_KEY, userId, entries);
export const readPending = (userId: string) =>
  readUserCache<Entry[]>(PENDING_KEY, userId, []);
export const writePending = (userId: string, entries: Entry[]) =>
  writeUserCache(PENDING_KEY, userId, entries);
export const readDraft = (userId: string) =>
  readUserCache(DRAFT_KEY, userId, "");
export const writeDraft = (userId: string, draft: string) => {
  if (draft) writeUserCache(DRAFT_KEY, userId, draft);
  else removeUserCache(DRAFT_KEY, userId);
};
