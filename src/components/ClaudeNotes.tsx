import { useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import useDraft from "../hooks/useDraft";
import useClaudeNotes from "../hooks/useClaudeNotes";
import { formatNoteTime } from "../functions/noteTime";

const SCOPE = "claude-notes";

function NoteIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <path d="M8 8h8M8 12h5" />
    </svg>
  );
}

// A small button in the bottom-left corner of every page that opens notes for
// Claude: feature requests, bugs and feedback that later Claude sessions read
// from the claude_notes table. Pages with their own bottom bar (the journal's
// entry box) set --bottom-dock so the button sits above it.
export default function ClaudeNotes() {
  const { user } = useAuth();
  const [open, setOpen] = useDraft(SCOPE, "open", false);
  const [text, setText] = useDraft(SCOPE, "text", "");
  const { notes, error, addNote, deleteNote } = useClaudeNotes(user?.id, open);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  const save = async () => {
    const body = text.trim();
    if (!body) return;
    // Back at its start value, the draft is dropped; put it back on failure.
    setText("");
    if (!(await addNote(body))) setText(body);
    textareaRef.current?.focus();
  };

  if (!user) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Notes for Claude"
        title="Notes for Claude"
        className="fixed left-3 z-40 size-9 rounded-full grid place-items-center bg-base-100 dark:bg-base-300 text-base-content/60 dark:text-base-content/75 shadow-md ring-1 ring-base-content/10 cursor-pointer transition active:scale-95 hover:text-base-content bottom-(--bottom-dock,calc(env(safe-area-inset-bottom)+1rem))"
        onClick={() => setOpen(true)}
        hidden={open}
      >
        <NoteIcon />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 dark:bg-black/70 animate-fade-in p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]"
          onClick={() => setOpen(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="claude-notes-title"
            className="w-full max-w-md max-h-[85dvh] rounded-2xl bg-base-100 dark:bg-base-200 p-4 flex flex-col gap-3 shadow-xl ring-1 ring-base-content/10 animate-pop-in"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center gap-2">
              <span className="text-primary">
                <NoteIcon size={20} />
              </span>
              <h2 id="claude-notes-title" className="text-lg font-bold flex-1">
                Notes for Claude
              </h2>
              <button
                type="button"
                aria-label="Close"
                className="btn btn-sm btn-ghost btn-circle"
                onClick={() => setOpen(false)}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
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
            </header>

            <form
              className="flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
            >
              <textarea
                ref={textareaRef}
                autoFocus
                rows={4}
                className="w-full resize-none rounded-xl bg-base-content/8 px-3 py-2.5 font-medium outline-none focus:bg-base-content/12 placeholder:text-base-content/45 dark:placeholder:text-base-content/65"
                placeholder="A feature idea, a bug, anything Claude should know…"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
                }}
              />
              <button
                type="submit"
                className="btn btn-primary rounded-full font-bold self-end px-6"
                disabled={!text.trim()}
              >
                Save note
              </button>
            </form>

            {error && <p className="text-sm text-error">{error}</p>}

            {notes.length > 0 && (
              <ul className="flex flex-col gap-2 overflow-y-auto overscroll-contain -mx-1 px-1">
                {notes.map((note) => (
                  <li
                    key={note.id}
                    className={`rounded-xl bg-base-content/5 pl-3 pr-1 py-2 flex gap-1 items-start animate-fade-in ${
                      note.done_at ? "opacity-60" : ""
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="whitespace-pre-wrap break-words text-sm font-medium">
                        {note.body}
                      </p>
                      <p className="text-xs text-base-content/55 dark:text-base-content/70 mt-1">
                        {formatNoteTime(note.created_at)} ·{" "}
                        {note.done_at ? "Picked up by Claude" : "Waiting"}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label="Delete note"
                      className="btn btn-xs btn-ghost btn-circle text-base-content/50"
                      onClick={() => deleteNote(note)}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
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
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </>
  );
}
