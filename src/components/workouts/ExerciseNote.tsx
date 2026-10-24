import { useState } from "react";

interface ExerciseNoteProps {
  note?: string;
  onSave: (note: string) => void;
}

// Your own note on an exercise, edited in place.
export default function ExerciseNote({ note, onSave }: ExerciseNoteProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  if (editing)
    return (
      <div className="flex flex-col gap-1.5">
        <textarea
          className="w-full resize-none rounded-xl bg-base-content/8 px-3 py-2 text-sm font-medium outline-none focus:bg-base-content/12 placeholder:text-base-content/45 dark:placeholder:text-base-content/65"
          rows={3}
          placeholder="A cue that helps, a weight that felt right…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="btn btn-sm btn-ghost rounded-full font-bold"
            onClick={() => setEditing(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-sm btn-primary rounded-full font-bold"
            onClick={() => {
              onSave(draft);
              setEditing(false);
            }}
          >
            Save note
          </button>
        </div>
      </div>
    );

  const edit = () => {
    setDraft(note ?? "");
    setEditing(true);
  };

  return note ? (
    <button
      type="button"
      className="w-full rounded-xl bg-accent/10 px-3 py-2 text-left text-sm font-medium cursor-pointer"
      onClick={edit}
    >
      <span className="block text-xs font-bold text-accent dark:text-[color-mix(in_oklab,var(--color-accent),white_45%)]">Your note</span>
      <span className="whitespace-pre-wrap">{note}</span>
    </button>
  ) : (
    <button
      type="button"
      className="self-start text-xs font-bold text-base-content/55 dark:text-base-content/75 cursor-pointer"
      onClick={edit}
    >
      + Add your own note
    </button>
  );
}
