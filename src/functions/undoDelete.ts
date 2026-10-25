// Deletes wait a few seconds behind an "Undo" toast before they reach the
// database, so nothing is gone until the toast has closed. The row (and
// everything that cascades from it) stays in place until then, which makes
// undo a matter of putting the local state back.

const UNDO_MS = 6000;

export interface PendingDelete {
  id: number;
  // Shown in the toast, e.g. "Workout deleted".
  message: string;
}

interface Queued extends PendingDelete {
  // Rows hidden from fresh loads until the delete has settled.
  rows: string[];
  commit: () => PromiseLike<{ error: unknown }>;
  // Puts the local state back; also used when the delete fails.
  undo: () => void;
  onError: (err: unknown) => void;
  timer?: ReturnType<typeof setTimeout>;
}

let nextId = 1;
// At most one delete waits behind the toast; a newer one sends it on its way.
let shown: Queued | null = null;
// Rows whose delete is waiting or in flight, as `table:id`.
const hidden = new Map<string, number>();
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((l) => l());

const release = (q: Queued) =>
  q.rows.forEach((row) => {
    const n = (hidden.get(row) ?? 1) - 1;
    if (n > 0) hidden.set(row, n);
    else hidden.delete(row);
  });

async function commit(q: Queued) {
  clearTimeout(q.timer);
  if (shown === q) {
    shown = null;
    notify();
  }
  const { error } = await q.commit();
  release(q);
  if (error) {
    q.undo();
    q.onError(error);
  }
}

export function queueDelete(d: {
  message: string;
  // `table:id` of each row this removes, so a reload doesn't show them again.
  rows: string[];
  commit: () => PromiseLike<{ error: unknown }>;
  undo: () => void;
  onError: (err: unknown) => void;
}) {
  if (shown) commit(shown);
  const q: Queued = { ...d, id: nextId++ };
  q.rows.forEach((row) => hidden.set(row, (hidden.get(row) ?? 0) + 1));
  q.timer = setTimeout(() => commit(q), UNDO_MS);
  shown = q;
  notify();
}

export function undoDelete(id: number) {
  const q = shown;
  if (!q || q.id !== id) return;
  clearTimeout(q.timer);
  shown = null;
  release(q);
  q.undo();
  notify();
}

export function dismissDelete(id: number) {
  if (shown?.id === id) commit(shown);
}

export const isDeleted = (table: string, id: string) =>
  hidden.has(`${table}:${id}`);

// Filters freshly loaded rows of `table` that are waiting to be deleted.
export const notDeleted =
  (table: string) =>
  (row: { id: string }): boolean =>
    !isDeleted(table, row.id);

export const pendingDelete = (): PendingDelete | null => shown;

// Sends the waiting delete now, e.g. before signing out.
export async function flushDeletes() {
  if (shown) await commit(shown);
}

export function subscribePendingDelete(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Leaving the page (closing the tab, switching apps) sends the waiting delete
// right away rather than losing it.
if (typeof document !== "undefined")
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushDeletes();
  });
