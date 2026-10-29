import type { SleepNight } from "../../hooks/useSleep";
import {
  QUALITY_WORDS,
  formatNight,
  formatSleep,
  formatTime,
  qualityBg,
  qualityText,
  sleepMinutes,
} from "../../functions/sleep";

export function NightRow({
  night,
  selected,
  onSelect,
}: {
  night: SleepNight;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <li className="animate-entry-in">
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
              {formatSleep(
                sleepMinutes(
                  night.bedtime,
                  night.woke_at,
                  night.fall_asleep_minutes + night.awake_minutes,
                ),
              )}
            </span>
          </span>
          <span className="block text-sm tabular-nums text-base-content/60 dark:text-base-content/75">
            {night.get_ready_at !== null &&
              `Ready ${formatTime(night.get_ready_at)} · `}
            {formatTime(night.bedtime)} – {formatTime(night.woke_at)}
            {night.fall_asleep_minutes > 0 &&
              ` · ${formatSleep(night.fall_asleep_minutes)} to fall asleep`}
            {night.awake_minutes > 0 &&
              ` · ${formatSleep(night.awake_minutes)} awake`}
          </span>
          <span className="block text-sm font-medium">
            {QUALITY_WORDS[night.quality]}
          </span>
          {night.notes && (
            <span className="mt-0.5 block whitespace-pre-line text-sm text-base-content/70 dark:text-base-content/80">
              {night.notes}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}

// Averages over the latest week of logged nights.
export function WeekSummary({ nights }: { nights: SleepNight[] }) {
  const week = nights.slice(0, 7);
  if (week.length < 2) return null;
  const avg = (f: (n: SleepNight) => number) =>
    week.reduce((sum, n) => sum + f(n), 0) / week.length;
  const quality = avg((n) => n.quality);
  const minutes = avg((n) =>
    sleepMinutes(n.bedtime, n.woke_at, n.fall_asleep_minutes + n.awake_minutes),
  );

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
