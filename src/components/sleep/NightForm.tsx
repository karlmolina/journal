import type React from "react";
import { useState } from "react";
import useDragAdjust from "../../hooks/useDragAdjust";
import type { NightInput, SleepNight } from "../../hooks/useSleep";
import {
  QUALITY_WORDS,
  formatSleep,
  formatTime,
  MAX_FALL_ASLEEP,
  minutesBefore,
  parseMinutes,
  parseTime,
  qualityText,
  sleepMinutes,
  today,
} from "../../functions/sleep";

// Same drag-to-adjust boxes as the reps and weight fields: tap to type, drag
// up or down to change, without scrolling the page.
const dragBoxClass =
  "flex flex-col items-center rounded-2xl bg-base-content/8 px-3 py-2.5 transition focus-within:bg-base-content/12 cursor-ns-resize touch-none";
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

// Minutes spent awake in bed, one minute per row on the wheel.
function MinutesField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const drag = useDragAdjust({
    value,
    onChange,
    label,
    min: 0,
    max: MAX_FALL_ASLEEP,
    parse: (text) => parseMinutes(text) ?? 0,
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
            placeholder="0"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-label={`${label}, in minutes`}
          />
          <span className="text-lg font-bold text-base-content/40 dark:text-base-content/60">
            min
          </span>
        </span>
      </label>
      {drag.picker}
    </>
  );
}

export default function NightForm({
  night,
  existing,
  lastTimes,
  onNightChange,
  onSave,
  onDelete,
}: {
  night: string;
  existing?: SleepNight;
  // Times from the most recent night, as a starting point for a new one.
  lastTimes: {
    bedtime: number;
    woke_at: number;
    fall_asleep_minutes: number;
    get_ready_at: number | null;
    tech_free_at: number | null;
  };
  onNightChange: (night: string) => void;
  onSave: (input: NightInput) => void;
  onDelete?: () => void;
}) {
  const [quality, setQuality] = useState(
    existing ? String(existing.quality) : "",
  );
  const [bedtime, setBedtime] = useState(
    formatTime(existing?.bedtime ?? lastTimes.bedtime),
  );
  const [wokeAt, setWokeAt] = useState(
    formatTime(existing?.woke_at ?? lastTimes.woke_at),
  );
  const [fallAsleep, setFallAsleep] = useState(
    String(existing?.fall_asleep_minutes ?? lastTimes.fall_asleep_minutes),
  );
  // Optional: nights logged before this field have no get-ready time.
  const [getReady, setGetReady] = useState(() => {
    const t = existing ? existing.get_ready_at : lastTimes.get_ready_at;
    return t === null ? "" : formatTime(t);
  });
  // Optional, like the get-ready time.
  const [techFree, setTechFree] = useState(() => {
    const t = existing ? existing.tech_free_at : lastTimes.tech_free_at;
    return t === null ? "" : formatTime(t);
  });
  const [awake, setAwake] = useState(
    existing && existing.awake_minutes > 0
      ? String(existing.awake_minutes)
      : "",
  );
  const [notes, setNotes] = useState(existing?.notes ?? "");

  // An empty score starts a drag from the middle, not from "no sleep".
  const dragQuality = useDragAdjust({
    value: quality,
    onChange: setQuality,
    label: "Sleep quality",
    min: 0,
    max: 10,
    parse: (text) => parseQuality(text) ?? 5,
    format: String,
    detail: (n) => QUALITY_WORDS[n],
  });

  const q = parseQuality(quality);
  const bed = parseTime(bedtime);
  const woke = parseTime(wokeAt);
  // Left empty means it was straight away, or no time awake.
  const fell = fallAsleep.trim() === "" ? 0 : parseMinutes(fallAsleep);
  const up = awake.trim() === "" ? 0 : parseMinutes(awake);
  const ready = getReady.trim() === "" ? null : parseTime(getReady);
  const readyInvalid = getReady.trim() !== "" && ready === null;
  const offline = techFree.trim() === "" ? null : parseTime(techFree);
  const offlineInvalid = techFree.trim() !== "" && offline === null;
  const duration =
    bed !== null && woke !== null && fell !== null && up !== null
      ? sleepMinutes(bed, woke, fell + up)
      : null;
  const canSave =
    q !== null &&
    bed !== null &&
    woke !== null &&
    fell !== null &&
    up !== null &&
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
    ready === existing.get_ready_at &&
    offline === existing.tech_free_at &&
    notes.trim() === existing.notes;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    onSave({
      night,
      quality: q,
      bedtime: bed,
      woke_at: woke,
      fall_asleep_minutes: fell,
      awake_minutes: up,
      get_ready_at: ready,
      tech_free_at: offline,
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
        <span className={labelClass}>Sleep quality</span>
        <span className="flex items-baseline">
          <input
            className={`w-16 bg-transparent text-right text-5xl font-extrabold tracking-tight tabular-nums outline-none placeholder:text-base-content/25 ${
              q !== null ? qualityText(q) : quality ? "text-error" : ""
            }`}
            inputMode="numeric"
            placeholder="–"
            value={quality}
            onChange={(e) => setQuality(e.target.value)}
            aria-label="Sleep quality from 0 to 10"
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

      <div className="flex">
        <TimeField
          label="Tech free"
          value={techFree}
          onChange={setTechFree}
          // An empty field starts dragging an hour before bedtime.
          fallback={(bed ?? lastTimes.bedtime) - 60}
          placeholder="–"
          detail={
            offline !== null && bed !== null
              ? `${formatSleep(minutesBefore(offline, bed))} before bed`
              : "Screens away for the night"
          }
        />
      </div>
      <div className="flex gap-2">
        <TimeField
          label="Get ready for bed"
          value={getReady}
          onChange={setGetReady}
          // An empty field starts dragging half an hour before bedtime.
          fallback={(bed ?? lastTimes.bedtime) - 30}
          placeholder="–"
        />
        <TimeField label="Bedtime" value={bedtime} onChange={setBedtime} />
      </div>
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
      <TimeField label="Woke up" value={wokeAt} onChange={setWokeAt} />
      <p className="text-center text-sm font-semibold text-base-content/60 dark:text-base-content/75">
        {duration !== null && !readyInvalid && !offlineInvalid
          ? `${formatSleep(duration)} of sleep`
          : fell === null || up === null
            ? `Minutes awake, from 0 to ${MAX_FALL_ASLEEP}`
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
      {onDelete && (
        <button
          type="button"
          className="btn btn-ghost btn-sm rounded-full font-semibold text-error self-center"
          onClick={onDelete}
        >
          Delete night
        </button>
      )}
    </form>
  );
}
