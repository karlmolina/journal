import type React from "react";
import { useState } from "react";
import useDragAdjust from "../../hooks/useDragAdjust";
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const drag = useDragAdjust({
    value,
    onChange,
    label,
    parse: parseTime,
    format: formatTime,
  });
  const invalid = value.trim() !== "" && parseTime(value) === null;

  return (
    <>
      <label className={`${dragBoxClass} flex-1 min-w-0`} {...drag.bind}>
        <span className={labelClass}>{label}</span>
        <input
          className={`w-full min-w-0 bg-transparent text-center text-2xl font-extrabold tracking-tight tabular-nums outline-none ${
            invalid ? "text-error" : ""
          }`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          // Typed times like "2330" or "11p" are tidied up once you're done.
          onBlur={() => {
            const t = parseTime(value);
            if (t !== null) onChange(formatTime(t));
          }}
          aria-label={label}
        />
      </label>
      {drag.picker}
    </>
  );
}

// Minutes it took to fall asleep, one minute per row on the wheel.
function FallAsleepField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const drag = useDragAdjust({
    value,
    onChange,
    label: "Time to fall asleep",
    min: 0,
    max: MAX_FALL_ASLEEP,
    parse: (text) => parseMinutes(text) ?? 0,
    format: String,
  });
  const invalid = value.trim() !== "" && parseMinutes(value) === null;

  return (
    <>
      <label className={dragBoxClass} {...drag.bind}>
        <span className={labelClass}>Time to fall asleep</span>
        <span className="flex items-baseline gap-1">
          <input
            className={`w-12 bg-transparent text-right text-2xl font-extrabold tracking-tight tabular-nums outline-none placeholder:text-base-content/25 ${
              invalid ? "text-error" : ""
            }`}
            inputMode="numeric"
            placeholder="0"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-label="Minutes to fall asleep"
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
  lastTimes: { bedtime: number; woke_at: number; fall_asleep_minutes: number };
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
  // Left empty means it was straight away.
  const fell = fallAsleep.trim() === "" ? 0 : parseMinutes(fallAsleep);
  const duration =
    bed !== null && woke !== null && fell !== null
      ? sleepMinutes(bed, woke, fell)
      : null;
  const canSave =
    q !== null &&
    bed !== null &&
    woke !== null &&
    fell !== null &&
    night !== "";
  const unchanged =
    existing !== undefined &&
    q === existing.quality &&
    bed === existing.bedtime &&
    woke === existing.woke_at &&
    fell === existing.fall_asleep_minutes;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    onSave({
      night,
      quality: q,
      bedtime: bed,
      woke_at: woke,
      fall_asleep_minutes: fell,
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

      <div className="flex gap-2">
        <TimeField label="Bedtime" value={bedtime} onChange={setBedtime} />
        <TimeField label="Woke up" value={wokeAt} onChange={setWokeAt} />
      </div>
      <FallAsleepField value={fallAsleep} onChange={setFallAsleep} />
      <p className="text-center text-sm font-semibold text-base-content/60 dark:text-base-content/75">
        {duration !== null
          ? `${formatSleep(duration)} of sleep`
          : fell === null
            ? `Minutes to fall asleep, from 0 to ${MAX_FALL_ASLEEP}`
            : "Use times like 11:30 PM or 23:30"}
      </p>

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
