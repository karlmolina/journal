import { useState } from "react";
import type React from "react";
import useDragAdjust from "../../hooks/useDragAdjust";
import useDraft, { clearDraft } from "../../hooks/useDraft";
import type { NightInput, SleepNight } from "../../hooks/useSleep";
import {
  QUALITY_WORDS,
  formatSleep,
  formatTime,
  MAX_FALL_ASLEEP,
  parseMinutes,
  parseTime,
  qualityText,
  sleepMinutes,
  bedMinutes,
  today,
  wrapTime,
} from "../../functions/sleep";

// Same drag-to-adjust boxes as the reps and weight fields: tap to type, drag
// up or down to change, without scrolling the page.
const dragBoxClass =
  "flex flex-col items-center rounded-2xl bg-base-content/8 px-3 py-2.5 transition focus-within:bg-base-content/12";
const labelClass =
  "text-xs font-semibold tracking-wide text-base-content/55 dark:text-base-content/75";

// Scores are whole numbers from 0 to 10.
function parseQuality(text: string) {
  return /^\s*(10|\d)\s*$/.test(text) ? Number(text) : null;
}

function TimeField({
  label,
  value,
  onChange,
  fallback,
  placeholder,
  detail,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  // Where a drag starts when the field is empty.
  fallback?: number;
  placeholder?: string;
  // A small line under the time.
  detail?: string;
}) {
  const drag = useDragAdjust({
    value,
    onChange,
    label,
    parse: (text) => parseTime(text) ?? fallback ?? null,
    format: formatTime,
  });
  const invalid = value.trim() !== "" && parseTime(value) === null;

  return (
    <>
      <label className={`${dragBoxClass} flex-1 min-w-0`} {...drag.bind}>
        <span className={labelClass}>{label}</span>
        <input
          className={`w-full min-w-0 bg-transparent text-center text-2xl font-extrabold tracking-tight tabular-nums outline-none placeholder:text-base-content/25 ${
            invalid ? "text-error" : ""
          }`}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          // Typed times like "2330" or "11p" are tidied up once you're done.
          onBlur={() => {
            const t = parseTime(value);
            if (t !== null) onChange(formatTime(t));
          }}
          aria-label={label}
        />
        {detail !== undefined && (
          <span className="min-h-5 text-center text-sm font-semibold text-base-content/60 dark:text-base-content/75">
            {detail}
          </span>
        )}
      </label>
      {drag.picker}
    </>
  );
}

// Minutes, one minute per row on the wheel: time awake in bed, or how long
// before bedtime something happened.
function MinutesField({
  label,
  value,
  onChange,
  fallback = 0,
  placeholder = "0",
  detail,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  // Where a drag starts when the field is empty.
  fallback?: number;
  placeholder?: string;
  // A small line under the minutes.
  detail?: string;
}) {
  const drag = useDragAdjust({
    value,
    onChange,
    label,
    min: 0,
    max: MAX_FALL_ASLEEP,
    parse: (text) => parseMinutes(text) ?? fallback,
    format: String,
  });
  const invalid = value.trim() !== "" && parseMinutes(value) === null;

  return (
    <>
      <label className={`${dragBoxClass} flex-1 min-w-0`} {...drag.bind}>
        <span className={labelClass}>{label}</span>
        <span className="flex items-baseline gap-1">
          <input
            className={`w-12 bg-transparent text-right text-2xl font-extrabold tracking-tight tabular-nums outline-none placeholder:text-base-content/25 ${
              invalid ? "text-error" : ""
            }`}
            inputMode="numeric"
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-label={`${label}, in minutes`}
          />
          <span className="text-lg font-bold text-base-content/40 dark:text-base-content/60">
            min
          </span>
        </span>
        {detail !== undefined && (
          <span className="min-h-5 text-center text-sm font-semibold text-base-content/60 dark:text-base-content/75">
            {detail}
          </span>
        )}
      </label>
      {drag.picker}
    </>
  );
}

type NightFormProps = {
  night: string;
  existing?: SleepNight;
  // Times from the most recent night, as a starting point for a new one.
  lastTimes: {
    bedtime: number;
    woke_at: number;
    fall_asleep_minutes: number;
    get_ready_minutes: number | null;
    tech_free_minutes: number | null;
    out_of_bed_minutes: number;
  };
  onNightChange: (night: string) => void;
  onSave: (input: NightInput) => void;
  onDelete?: () => void;
};

// A fresh form whenever the saved night changes (saved from here, or newer
// data loaded), so Undo changes goes back to what's saved now. Unsaved
// changes carry over through the draft.
export default function NightForm(props: NightFormProps) {
  return (
    <NightFields
      key={props.existing ? JSON.stringify(props.existing) : "new"}
      {...props}
    />
  );
}

function NightFields({
  night,
  existing,
  lastTimes,
  onNightChange,
  onSave,
  onDelete,
}: NightFormProps) {
  // Unsaved changes survive a refresh, per night.
  const draft = `sleep:${night}`;
  // What each field shows before any unsaved change: the saved night, or a
  // new night's starting values. Undo changes puts these back.
  const [start] = useState(() => {
    const from = existing ?? lastTimes;
    const minutes = (m: number | null) => (m === null ? "" : String(m));
    return {
      quality: existing ? String(existing.quality) : "",
      bedtime: formatTime(from.bedtime),
      // The form asks when he got out of bed; the stored woke_at stays the
      // wake time, worked out by taking off the minutes before getting up. A
      // new night starts from when he got up last time.
      gotUp: formatTime(from.woke_at + from.out_of_bed_minutes),
      fallAsleep: String(from.fall_asleep_minutes),
      // Optional, in minutes before bedtime: nights logged before these
      // fields have none.
      getReady: minutes(from.get_ready_minutes),
      techFree: minutes(from.tech_free_minutes),
      outOfBed:
        existing && existing.out_of_bed_minutes > 0
          ? String(existing.out_of_bed_minutes)
          : "",
      awake:
        existing && existing.awake_minutes > 0
          ? String(existing.awake_minutes)
          : "",
      notes: existing?.notes ?? "",
    };
  });
  const [quality, setQuality] = useDraft(draft, "quality", start.quality);
  const [bedtime, setBedtime] = useDraft(draft, "bedtime", start.bedtime);
  const [gotUp, setGotUp] = useDraft(draft, "gotUp", start.gotUp);
  const [fallAsleep, setFallAsleep] = useDraft(
    draft,
    "fallAsleep",
    start.fallAsleep,
  );
  // The draft keys changed when these stopped being clock times, so an old
  // unsaved time isn't read as minutes.
  const [getReady, setGetReady] = useDraft(
    draft,
    "getReadyMinutes",
    start.getReady,
  );
  const [techFree, setTechFree] = useDraft(
    draft,
    "techFreeMinutes",
    start.techFree,
  );
  const [outOfBed, setOutOfBed] = useDraft(draft, "outOfBed", start.outOfBed);
  const [awake, setAwake] = useDraft(draft, "awake", start.awake);
  const [notes, setNotes] = useDraft(draft, "notes", start.notes);

  const edited =
    quality !== start.quality ||
    bedtime !== start.bedtime ||
    gotUp !== start.gotUp ||
    fallAsleep !== start.fallAsleep ||
    getReady !== start.getReady ||
    techFree !== start.techFree ||
    outOfBed !== start.outOfBed ||
    awake !== start.awake ||
    notes !== start.notes;
  // Back to the saved night (or the new night's starting values); the
  // unsaved draft goes with it.
  const undoChanges = () => {
    setQuality(start.quality);
    setBedtime(start.bedtime);
    setGotUp(start.gotUp);
    setFallAsleep(start.fallAsleep);
    setGetReady(start.getReady);
    setTechFree(start.techFree);
    setOutOfBed(start.outOfBed);
    setAwake(start.awake);
    setNotes(start.notes);
    clearDraft(draft);
  };

  // An empty score starts a drag from the middle, not from "completely exhausted".
  const dragQuality = useDragAdjust({
    value: quality,
    onChange: setQuality,
    label: "How rested",
    min: 0,
    max: 10,
    parse: (text) => parseQuality(text) ?? 5,
    format: String,
    detail: (n) => QUALITY_WORDS[n],
  });

  const q = parseQuality(quality);
  const bed = parseTime(bedtime);
  const outAt = parseTime(gotUp);
  // Left empty means it was straight away, or no time awake.
  const fell = fallAsleep.trim() === "" ? 0 : parseMinutes(fallAsleep);
  const up = awake.trim() === "" ? 0 : parseMinutes(awake);
  const lazy = outOfBed.trim() === "" ? 0 : parseMinutes(outOfBed);
  const woke = outAt !== null && lazy !== null ? wrapTime(outAt - lazy) : null;
  const ready = getReady.trim() === "" ? null : parseMinutes(getReady);
  const readyInvalid = getReady.trim() !== "" && ready === null;
  const offline = techFree.trim() === "" ? null : parseMinutes(techFree);
  const offlineInvalid = techFree.trim() !== "" && offline === null;
  const minutesValid =
    fell !== null &&
    up !== null &&
    lazy !== null &&
    !readyInvalid &&
    !offlineInvalid;
  const duration =
    bed !== null && woke !== null && fell !== null && up !== null
      ? sleepMinutes(bed, woke, fell + up)
      : null;
  const inBed =
    bed !== null && woke !== null ? bedMinutes(bed, woke, lazy ?? 0) : null;
  // "At 10:30 PM", worked out from bedtime.
  const clockBefore = (minutes: number | null, empty: string) =>
    minutes !== null && bed !== null
      ? `At ${formatTime(bed - minutes)}`
      : empty;
  const canSave =
    q !== null &&
    bed !== null &&
    woke !== null &&
    fell !== null &&
    up !== null &&
    lazy !== null &&
    !readyInvalid &&
    !offlineInvalid &&
    night !== "";
  const unchanged =
    existing !== undefined &&
    q === existing.quality &&
    bed === existing.bedtime &&
    woke === existing.woke_at &&
    fell === existing.fall_asleep_minutes &&
    up === existing.awake_minutes &&
    lazy === existing.out_of_bed_minutes &&
    ready === existing.get_ready_minutes &&
    offline === existing.tech_free_minutes &&
    notes.trim() === existing.notes;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    clearDraft(draft);
    onSave({
      night,
      quality: q,
      bedtime: bed,
      woke_at: woke,
      fall_asleep_minutes: fell,
      awake_minutes: up,
      out_of_bed_minutes: lazy,
      get_ready_minutes: ready,
      tech_free_minutes: offline,
      notes: notes.trim(),
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 rounded-2xl bg-base-content/5 dark:bg-base-content/9 p-3"
    >
      <label className="flex items-center justify-between gap-3 px-1">
        <span className={labelClass}>Night of</span>
        <input
          type="date"
          className="rounded-xl bg-base-content/8 px-3 py-1.5 font-semibold outline-none transition focus:bg-base-content/12"
          value={night}
          max={today()}
          onChange={(e) => onNightChange(e.target.value)}
        />
      </label>

      <label className={dragBoxClass} {...dragQuality.bind}>
        <span className={labelClass}>How rested I feel</span>
        <span className="flex items-baseline">
          <input
            className={`w-16 bg-transparent text-right text-5xl font-extrabold tracking-tight tabular-nums outline-none placeholder:text-base-content/25 ${
              q !== null ? qualityText(q) : quality ? "text-error" : ""
            }`}
            inputMode="numeric"
            placeholder="–"
            value={quality}
            onChange={(e) => setQuality(e.target.value)}
            aria-label="How rested from 0 to 10"
          />
          <span className="text-xl font-bold text-base-content/40 dark:text-base-content/60">
            /10
          </span>
        </span>
        <span className="min-h-5 text-center text-sm font-semibold">
          {q !== null
            ? QUALITY_WORDS[q]
            : quality
              ? "Pick a whole number from 0 to 10"
              : "Drag up or down, or tap to type"}
        </span>
      </label>

      {dragQuality.picker}

      <div className="flex gap-2">
        <MinutesField
          label="Get ready for bed"
          value={getReady}
          onChange={setGetReady}
          // An empty field starts dragging at half an hour before bed.
          fallback={30}
          placeholder="–"
          detail={clockBefore(ready, "Before bed")}
        />
        <MinutesField
          label="Tech free"
          value={techFree}
          onChange={setTechFree}
          // An empty field starts dragging at an hour before bed.
          fallback={60}
          placeholder="–"
          detail={clockBefore(offline, "Screens away")}
        />
      </div>
      <TimeField label="Bedtime" value={bedtime} onChange={setBedtime} />
      <div className="flex gap-2">
        <MinutesField
          label="To fall asleep"
          value={fallAsleep}
          onChange={setFallAsleep}
        />
        <MinutesField
          label="Awake at night"
          value={awake}
          onChange={setAwake}
        />
      </div>
      <div className="flex gap-2">
        <MinutesField
          label="Before getting up"
          value={outOfBed}
          onChange={setOutOfBed}
        />
        <TimeField label="Got out of bed" value={gotUp} onChange={setGotUp} />
      </div>
      <p className="text-center text-sm font-semibold text-base-content/60 dark:text-base-content/75">
        {duration !== null && minutesValid
          ? `${formatSleep(duration)} of sleep · ${formatSleep(inBed ?? 0)} in bed`
          : !minutesValid
            ? `Minutes, from 0 to ${MAX_FALL_ASLEEP}`
            : "Use times like 11:30 PM or 23:30"}
      </p>
      <textarea
        className="min-h-20 rounded-2xl bg-base-content/8 px-3 py-2.5 outline-none transition placeholder:text-base-content/40 focus:bg-base-content/12"
        placeholder="Notes: caffeine, dreams, what woke you up…"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        aria-label="Notes"
      />

      <button
        type="submit"
        className="btn btn-primary rounded-full font-bold active:scale-[0.98] transition"
        disabled={!canSave || unchanged}
      >
        {unchanged ? "Saved" : existing ? "Update night" : "Save night"}
      </button>
      {(edited || onDelete) && (
        <div className="flex justify-center gap-2">
          {edited && (
            <button
              type="button"
              className="btn btn-ghost btn-sm rounded-full font-semibold"
              onClick={undoChanges}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-4"
                aria-hidden="true"
              >
                <path d="M9 14 4 9l5-5" />
                <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
              </svg>
              Undo changes
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              className="btn btn-ghost btn-sm rounded-full font-semibold text-error"
              onClick={() => {
                clearDraft(draft);
                onDelete();
              }}
            >
              Delete night
            </button>
          )}
        </div>
      )}
    </form>
  );
}
