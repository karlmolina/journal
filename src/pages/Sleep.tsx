import React, { useState } from "react";
import TopBar from "../components/TopBar";
import ErrorBanner from "../components/ErrorBanner";
import { useAuth } from "../context/AuthContext";
import signOut from "../functions/signOut";
import useDragAdjust from "../hooks/useDragAdjust";
import useSleep, { type SleepNight, type NightInput } from "../hooks/useSleep";
import {
  QUALITY_WORDS,
  defaultNight,
  formatNight,
  formatSleep,
  formatTime,
  parseTime,
  qualityBg,
  qualityText,
  sleepMinutes,
  today,
} from "../functions/sleep";

// Same drag-to-adjust boxes as the reps and weight fields: tap to type, drag
// up or down to change, without scrolling the page.
const dragBoxClass =
  "flex flex-col items-center rounded-2xl bg-base-content/8 px-3 py-2.5 transition focus-within:bg-base-content/12 cursor-ns-resize touch-none";
const labelClass =
  "text-xs font-semibold tracking-wide text-base-content/55 dark:text-base-content/75";

const DEFAULT_BEDTIME = 23 * 60;
const DEFAULT_WOKE_AT = 7 * 60;

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

function NightForm({
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
  lastTimes: { bedtime: number; woke_at: number };
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
  const duration =
    bed !== null && woke !== null ? sleepMinutes(bed, woke) : null;
  const canSave = q !== null && bed !== null && woke !== null && night !== "";
  const unchanged =
    existing !== undefined &&
    q === existing.quality &&
    bed === existing.bedtime &&
    woke === existing.woke_at;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    onSave({ night, quality: q, bedtime: bed, woke_at: woke });
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
      <p className="text-center text-sm font-semibold text-base-content/60 dark:text-base-content/75">
        {duration !== null
          ? `${formatSleep(duration)} of sleep`
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

function NightRow({
  night,
  selected,
  onSelect,
}: {
  night: SleepNight;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={`flex w-full items-start gap-3 rounded-2xl px-3 py-2.5 text-left transition ${
          selected
            ? "bg-base-content/10"
            : "bg-base-content/5 dark:bg-base-content/9 hover:bg-base-content/8"
        }`}
      >
        <span
          className={`flex size-10 shrink-0 items-center justify-center rounded-full text-lg font-extrabold tabular-nums ${qualityBg(night.quality)}`}
        >
          {night.quality}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="font-bold">{formatNight(night.night)}</span>
            <span className="shrink-0 font-bold tabular-nums">
              {formatSleep(sleepMinutes(night.bedtime, night.woke_at))}
            </span>
          </span>
          <span className="block text-sm tabular-nums text-base-content/60 dark:text-base-content/75">
            {formatTime(night.bedtime)} – {formatTime(night.woke_at)}
          </span>
          <span className="block text-sm font-medium">
            {QUALITY_WORDS[night.quality]}
          </span>
        </span>
      </button>
    </li>
  );
}

// Averages over the latest week of logged nights.
function WeekSummary({ nights }: { nights: SleepNight[] }) {
  const week = nights.slice(0, 7);
  if (week.length < 2) return null;
  const avg = (f: (n: SleepNight) => number) =>
    week.reduce((sum, n) => sum + f(n), 0) / week.length;
  const quality = avg((n) => n.quality);
  const minutes = avg((n) => sleepMinutes(n.bedtime, n.woke_at));

  return (
    <p className="px-1 text-sm font-semibold text-base-content/60 dark:text-base-content/75">
      Last {week.length} nights:{" "}
      <span className={qualityText(Math.round(quality))}>
        {quality.toFixed(1)}/10
      </span>{" "}
      · {formatSleep(Math.round(minutes))} a night
    </p>
  );
}

// The sleep tab: log how a night went, and look back at past nights.
export default function Sleep() {
  const { user } = useAuth();
  const { nights, loading, error, dismissError, saveNight, removeNight } =
    useSleep(user?.id);
  const [night, setNight] = useState(defaultNight);

  const existing = nights.find((n) => n.night === night);
  const lastTimes = nights[0]
    ? { bedtime: nights[0].bedtime, woke_at: nights[0].woke_at }
    : { bedtime: DEFAULT_BEDTIME, woke_at: DEFAULT_WOKE_AT };

  return (
    <div className="max-w-xl mx-auto px-2 sm:px-6 min-h-dvh flex flex-col gap-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <TopBar
        userPhoto={
          user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture
        }
        onSignOut={() => signOut(user?.id)}
      />
      {error && <ErrorBanner message={error} onDismiss={dismissError} />}

      <NightForm
        // A fresh form for each night, filled from that night if it's logged,
        // and once more when the nights finish loading.
        key={`${night}:${loading}`}
        night={night}
        existing={existing}
        lastTimes={lastTimes}
        onNightChange={setNight}
        onSave={saveNight}
        onDelete={
          existing
            ? () => {
                removeNight(existing.id);
                setNight(defaultNight());
              }
            : undefined
        }
      />

      <WeekSummary nights={nights} />
      {nights.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {nights.map((n) => (
            <NightRow
              key={n.id}
              night={n}
              selected={n.night === night}
              onSelect={() => {
                setNight(n.night);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            />
          ))}
        </ul>
      ) : loading ? (
        <div className="flex justify-center py-8 text-base-content/40 dark:text-base-content/70">
          <span className="loading loading-spinner loading-md"></span>
        </div>
      ) : (
        <p className="py-6 text-center text-sm font-medium text-base-content/55 dark:text-base-content/70">
          Nights you log show up here.
        </p>
      )}
    </div>
  );
}
