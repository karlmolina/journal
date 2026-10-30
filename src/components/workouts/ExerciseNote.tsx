import { useState } from "react";
import useDraft, { clearDraft } from "../../hooks/useDraft";
import type {
  ExerciseNoteEntry,
  ExerciseNotes,
} from "../../hooks/useExerciseNotes";
import type { Injury } from "../../hooks/useInjuries";
import { libraryRegion, placeLabel } from "../../functions/bodyRegions";
import { formatNoteTime } from "../../functions/noteTime";

// What a page passes down for showing and adding exercise notes.
export interface ExerciseNotesProps {
  notes: ExerciseNotes;
  injuries: Injury[];
}

interface ExerciseNoteProps extends ExerciseNotesProps {
  exercise: string;
  // The exercise's body regions, to suggest which injury a note is about.
  regions: string[];
}

// Notes shown before "Show all".
const SHOWN = 2;

const accentText =
  "text-accent dark:text-[color-mix(in_oklab,var(--color-accent),white_45%)]";

const injuryLabel = (i: Injury) => {
  const place = placeLabel(i.region, i.side);
  return i.name ? `${place} · ${i.name}` : place;
};

function NoteForm({
  scope,
  initial,
  injuries,
  initialInjury,
  saveLabel,
  onSave,
  onCancel,
  onDelete,
}: {
  // Where unsaved input is kept until it's saved or cancelled.
  scope: string;
  initial: string;
  injuries: Injury[];
  initialInjury: string | null;
  saveLabel: string;
  onSave: (note: string, injuryId: string | null) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [draft, setDraft] = useDraft(scope, "note", initial);
  const [injuryId, setInjuryId] = useDraft(scope, "injury", initialInjury);
  // Any way out of the form drops the unsaved input.
  const done = (then: () => void) => () => {
    clearDraft(scope);
    then();
  };
  const [confirmDelete, setConfirmDelete] = useState(false);
  const chip = (selected: boolean) =>
    `rounded-full px-2.5 py-1 text-xs font-bold cursor-pointer ${
      selected
        ? "bg-accent/20 text-accent dark:text-[color-mix(in_oklab,var(--color-accent),white_45%)]"
        : "bg-base-content/8 text-base-content/65 dark:text-base-content/80"
    }`;

  return (
    <div className="flex flex-col gap-1.5">
      <textarea
        className="w-full resize-none rounded-xl bg-base-content/8 px-3 py-2 text-sm font-medium outline-none focus:bg-base-content/12 placeholder:text-base-content/45 dark:placeholder:text-base-content/65"
        rows={3}
        placeholder="A cue that helps, a weight that felt right, how it felt…"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        autoFocus
      />
      {injuries.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-base-content/55 dark:text-base-content/75">
            About an injury?
          </span>
          <button
            type="button"
            className={chip(injuryId === null)}
            onClick={() => setInjuryId(null)}
            aria-pressed={injuryId === null}
          >
            No
          </button>
          {injuries.map((i) => (
            <button
              key={i.id}
              type="button"
              className={chip(injuryId === i.id)}
              onClick={() => setInjuryId(i.id)}
              aria-pressed={injuryId === i.id}
            >
              {injuryLabel(i)}
            </button>
          ))}
        </div>
      )}
      <div className="flex justify-end gap-2">
        {onDelete &&
          (confirmDelete ? (
            <button
              type="button"
              className="btn btn-sm btn-error rounded-full font-bold mr-auto"
              onClick={done(onDelete)}
            >
              Delete note
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-sm btn-ghost rounded-full font-semibold text-base-content/55 dark:text-base-content/75 mr-auto"
              onClick={() => setConfirmDelete(true)}
            >
              Delete
            </button>
          ))}
        <button
          type="button"
          className="btn btn-sm btn-ghost rounded-full font-bold"
          onClick={done(onCancel)}
        >
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-sm btn-primary rounded-full font-bold"
          onClick={done(() => onSave(draft, injuryId))}
          disabled={!draft.trim()}
        >
          {saveLabel}
        </button>
      </div>
    </div>
  );
}

// Your own dated notes on an exercise, newest first, with a form to add one.
export default function ExerciseNote({
  exercise,
  regions,
  notes,
  injuries,
}: ExerciseNoteProps) {
  // "new", a note's id, or null when not editing.
  const [editing, setEditing] = useDraft<string | null>(
    `notes:${exercise}`,
    "editing",
    null,
  );
  const [showAll, setShowAll] = useState(false);
  // Folded to just its heading until tapped open.
  const [open, setOpen] = useState(false);
  const entries = notes.notesFor(exercise);
  const active = injuries.filter((i) => !i.healed_on);
  const byId = new Map(injuries.map((i) => [i.id, i]));
  // An injury in one of the exercise's areas is probably what a note is about.
  const suggested =
    active.find(
      (i) =>
        regions.includes(i.region) || regions.includes(libraryRegion(i.region)),
    )?.id ?? null;

  if (editing === "new")
    return (
      <NoteForm
        scope={`note:${exercise}:new`}
        initial=""
        injuries={active}
        initialInjury={suggested}
        saveLabel="Save note"
        onSave={(note, injuryId) => {
          notes.addNote(exercise, note, injuryId);
          setEditing(null);
        }}
        onCancel={() => setEditing(null)}
      />
    );

  const add = (
    <button
      type="button"
      className="self-start text-xs font-bold text-base-content/55 dark:text-base-content/75 cursor-pointer"
      onClick={(e) => {
        // Not also a tap on the top bar, which closes the box.
        e.stopPropagation();
        setEditing("new");
      }}
    >
      + Add a note
    </button>
  );
  if (entries.length === 0) return add;

  const shown = showAll ? entries : entries.slice(0, SHOWN);
  const renderEntry = (e: ExerciseNoteEntry) => {
    if (editing === e.id) {
      const linked = e.injury_id ? byId.get(e.injury_id) : undefined;
      return (
        <li key={e.id}>
          <NoteForm
            scope={`note:${exercise}:${e.id}`}
            initial={e.note}
            // Keep a healed injury the note is already linked to on offer.
            injuries={linked && linked.healed_on ? [...active, linked] : active}
            initialInjury={e.injury_id}
            saveLabel="Save"
            onSave={(note, injuryId) => {
              notes.updateNote(e.id, { note, injury_id: injuryId });
              setEditing(null);
            }}
            onCancel={() => setEditing(null)}
            onDelete={() => {
              notes.removeNote(e.id);
              setEditing(null);
            }}
          />
        </li>
      );
    }
    const injury = e.injury_id ? byId.get(e.injury_id) : undefined;
    return (
      <li key={e.id}>
        <button
          type="button"
          className="w-full text-left cursor-pointer"
          onClick={() => setEditing(e.id)}
        >
          <span className="block text-xs font-semibold text-base-content/55 dark:text-base-content/75">
            {formatNoteTime(e.created_at)}
            {injury && (
              <span className={`font-bold ${accentText}`}>
                {" "}
                · {injuryLabel(injury)}
              </span>
            )}
          </span>
          <span className="whitespace-pre-wrap">{e.note}</span>
        </button>
      </li>
    );
  };

  return (
    // Folded, the whole box is a tap target; the button inside is for
    // keyboards.
    <div
      className={`w-full rounded-xl bg-accent/10 px-3 py-2 text-left text-sm font-medium ${open ? "" : "cursor-pointer"}`}
      onClick={() => !open && setOpen(true)}
    >
      <div
        className="flex items-baseline justify-between gap-2 cursor-pointer"
        onClick={() => setOpen(!open)}
      >
        <button
          type="button"
          className={`text-xs font-bold cursor-pointer ${accentText}`}
          aria-expanded={open}
        >
          Notes ({entries.length})
        </button>
        {open && add}
      </div>
      {/* Stays mounted so it folds shut as smoothly as it opens. */}
      <div
        aria-hidden={!open}
        inert={!open}
        className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
      >
        <div className="overflow-hidden">
          <div className="mt-2 flex flex-col gap-2">
            <ol className="flex flex-col gap-2">{shown.map(renderEntry)}</ol>
            {entries.length > SHOWN && (
              <button
                type="button"
                className="self-start text-xs font-bold text-base-content/55 dark:text-base-content/75 cursor-pointer"
                onClick={() => setShowAll(!showAll)}
              >
                {showAll ? "Show fewer" : `Show all ${entries.length}`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
