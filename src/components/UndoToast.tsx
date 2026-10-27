import { useState, useSyncExternalStore } from "react";
import {
  dismissDelete,
  pendingDelete,
  subscribePendingDelete,
  undoDelete,
} from "../functions/undoDelete";

// The "Deleted · Undo" toast for whatever was deleted last, on every page.
export default function UndoToast() {
  const current = useSyncExternalStore(subscribePendingDelete, pendingDelete);
  // The last toast stays up while it slides away.
  const [last, setLast] = useState(current);
  if (current && current !== last) setLast(current);
  const pending = current ?? last;
  const leaving = !current;
  if (!pending) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pointer-events-none">
      <div
        key={pending.id}
        role="status"
        className={`flex items-center gap-2 rounded-full bg-base-content text-base-100 shadow-lg pl-5 pr-1.5 py-1.5 text-sm font-semibold ${
          leaving
            ? "animate-toast-out"
            : "pointer-events-auto animate-entry-in"
        }`}
        onAnimationEnd={() => leaving && setLast(null)}
      >
        <span>{pending.message}</span>
        <button
          type="button"
          className="btn btn-sm btn-ghost rounded-full font-bold text-primary-content bg-primary border-0 hover:bg-primary/85"
          onClick={() => undoDelete(pending.id)}
        >
          Undo
        </button>
        <button
          type="button"
          aria-label="Dismiss"
          className="btn btn-sm btn-ghost btn-circle text-base-100/70 hover:bg-base-100/15 border-0"
          onClick={() => dismissDelete(pending.id)}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
