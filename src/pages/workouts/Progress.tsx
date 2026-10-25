import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabase";
import { readUserCache, writeUserCache } from "../../functions/userCache";
import { useAuth } from "../../context/AuthContext";
import useInjuries from "../../hooks/useInjuries";
import { elapsedSeconds, type Workout } from "../../hooks/useWorkouts";
import BarChart from "../../components/charts/BarChart";
import LineChart, { type LinePoint } from "../../components/charts/LineChart";
import ErrorBanner from "../../components/ErrorBanner";
import { formatClock, formatDuration } from "../../functions/formatDuration";
import { WEIGHT_UNIT } from "../../functions/workoutSets";
import { placeLabel } from "../../functions/bodyRegions";

const WEEKS = 12;
const HISTORY_WEEKS = 26;
const DAY_MS = 86_400_000;
const CACHE_KEY = "progress_workouts";

const cardClass =
  "rounded-2xl bg-base-content/5 dark:bg-base-content/9 px-4 py-4 sm:px-5";
const selectClass =
  "w-full rounded-xl bg-base-content/8 px-3 py-2.5 font-bold outline-none focus:bg-base-content/12 cursor-pointer";

// Monday 00:00 local time of the week containing `ms`.
function weekStart(ms: number) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

const shortDate = (ms: number) =>
  new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" });

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex-1 rounded-2xl bg-base-content/5 dark:bg-base-content/9 px-4 py-3">
      <p className="text-2xl font-extrabold tabular-nums">{value}</p>
      <p className="text-xs font-semibold tracking-wide text-base-content/55 dark:text-base-content/75">
        {label}
      </p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="py-6 text-center text-sm font-medium text-base-content/55 dark:text-base-content/75">
      {text}
    </p>
  );
}

// Each workout's best set of one exercise, using the heaviest measure logged:
// weight if any set had one, otherwise reps, otherwise time.
function exerciseSeries(workouts: Workout[], name: string) {
  const key = name.toLowerCase();
  const sessions = workouts
    .map((w) => ({
      at: Date.parse(w.started_at),
      sets: w.workout_sets.filter((s) => s.exercise_name.toLowerCase() === key),
    }))
    .filter((s) => s.sets.length > 0)
    .sort((a, b) => a.at - b.at);
  const all = sessions.flatMap((s) => s.sets);
  const metric = all.some((s) => s.weight !== null)
    ? "weight"
    : all.some((s) => s.reps !== null)
      ? "reps"
      : "time";

  const points: LinePoint[] = sessions.map(({ at, sets }) => {
    if (metric === "weight") {
      const best = sets.reduce((a, b) =>
        (b.weight ?? 0) > (a.weight ?? 0) ||
        ((b.weight ?? 0) === (a.weight ?? 0) && (b.reps ?? 0) > (a.reps ?? 0))
          ? b
          : a,
      );
      return {
        x: at,
        y: best.weight ?? 0,
        label: `${best.weight ?? 0} ${WEIGHT_UNIT}${best.reps ? ` × ${best.reps}` : ""}`,
      };
    }
    if (metric === "reps") {
      const reps = Math.max(...sets.map((s) => s.reps ?? 0));
      return { x: at, y: reps, label: `${reps} reps` };
    }
    const secs = Math.max(...sets.map((s) => s.duration_seconds ?? 0));
    return { x: at, y: secs, label: formatClock(secs) };
  });

  const title =
    metric === "weight"
      ? `Heaviest set (${WEIGHT_UNIT})`
      : metric === "reps"
        ? "Most reps in a set"
        : "Longest set";
  const format = metric === "time" ? formatClock : (v: number) => String(v);
  return { points, title, format };
}

export default function Progress() {
  const { user } = useAuth();
  const userId = user?.id;
  const { injuries } = useInjuries(userId);
  // Seeded from the last visit so the charts paint before the refresh lands.
  const [workouts, setWorkouts] = useState<Workout[] | null>(() =>
    userId ? readUserCache<Workout[] | null>(CACHE_KEY, userId, null) : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [exercise, setExercise] = useState<string | null>(null);
  const [injuryId, setInjuryId] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    supabase
      .from("workouts")
      .select(
        "id, started_at, paused_at, paused_seconds, ended_at, notes, workout_sets (id, workout_id, exercise_name, exercise_id, reps, weight, duration_seconds, side, created_at)",
      )
      .not("ended_at", "is", null)
      .gte(
        "started_at",
        new Date(
          weekStart(Date.now()) - HISTORY_WEEKS * 7 * DAY_MS,
        ).toISOString(),
      )
      .order("started_at")
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error(error);
          setError("Couldn't load your workouts.");
          return;
        }
        const next = (data as Workout[]).map((w) => ({
          ...w,
          workout_sets: w.workout_sets.map((s) => ({
            ...s,
            weight: s.weight === null ? null : Number(s.weight),
          })),
        }));
        setWorkouts(next);
        writeUserCache(CACHE_KEY, userId, next);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const weeks = useMemo(() => {
    const thisWeek = weekStart(Date.now());
    // Step by calendar days, not 7 × 24h, so daylight saving can't shift a week.
    const buckets = Array.from({ length: WEEKS }, (_, i) => {
      const d = new Date(thisWeek);
      d.setDate(d.getDate() - (WEEKS - 1 - i) * 7);
      return { start: d.getTime(), count: 0, seconds: 0 };
    });
    for (const w of workouts ?? []) {
      const start = weekStart(Date.parse(w.started_at));
      const bucket = buckets.find((b) => b.start === start);
      if (!bucket) continue;
      bucket.count++;
      bucket.seconds += elapsedSeconds(w);
    }
    return buckets;
  }, [workouts]);

  const thisWeek = weeks[weeks.length - 1];
  const lastFour = weeks.slice(-5, -1);
  const avg = lastFour.reduce((n, w) => n + w.count, 0) / lastFour.length;
  let streak = 0;
  // A week in progress without a workout yet doesn't break the streak.
  for (let i = weeks.length - (thisWeek.count ? 1 : 2); i >= 0; i--) {
    if (!weeks[i].count) break;
    streak++;
  }

  // Exercises by how often they were done, most frequent first.
  const exerciseNames = useMemo(() => {
    const counts = new Map<string, { name: string; n: number }>();
    for (const w of workouts ?? []) {
      const seen = new Set<string>();
      for (const s of w.workout_sets) {
        const key = s.exercise_name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        const entry = counts.get(key) ?? { name: s.exercise_name, n: 0 };
        entry.n++;
        counts.set(key, entry);
      }
    }
    return [...counts.values()].sort((a, b) => b.n - a.n).map((e) => e.name);
  }, [workouts]);

  const selectedExercise = exercise ?? exerciseNames[0] ?? null;
  const series = useMemo(
    () =>
      workouts && selectedExercise
        ? exerciseSeries(workouts, selectedExercise)
        : null,
    [workouts, selectedExercise],
  );

  const tracked = injuries
    .filter((i) => i.injury_checkins.length > 0)
    .sort((a, b) => Number(!!a.healed_on) - Number(!!b.healed_on));
  const injury = tracked.find((i) => i.id === injuryId) ?? tracked[0];
  const painPoints: LinePoint[] =
    injury?.injury_checkins.map((c) => ({
      x: Date.parse(`${c.checked_on}T12:00:00`),
      y: c.pain,
      label: `pain ${c.pain}/10${c.notes ? ` · ${c.notes}` : ""}`,
    })) ?? [];

  return (
    <div className="flex flex-col gap-3 pb-6">
      {error && (
        <ErrorBanner message={error} onDismiss={() => setError(null)} />
      )}

      <div className="flex gap-3">
        <Stat
          value={String(thisWeek.count)}
          label={
            thisWeek.count === 1 ? "workout this week" : "workouts this week"
          }
        />
        <Stat
          value={thisWeek.seconds ? formatDuration(thisWeek.seconds) : "0 min"}
          label="trained this week"
        />
        <Stat
          value={String(streak)}
          label={streak === 1 ? "week streak" : "weeks streak"}
        />
      </div>

      <section className={cardClass}>
        <div className="flex items-baseline justify-between gap-3 mb-2">
          <h2 className="font-bold">Workouts per week</h2>
          <span className="text-xs font-semibold text-base-content/55 dark:text-base-content/75">
            {avg.toFixed(1).replace(/\.0$/, "")} a week lately
          </span>
        </div>
        {workouts === null ? (
          <Empty text="Loading…" />
        ) : (
          <BarChart
            ariaLabel={`Workouts per week over the last ${WEEKS} weeks`}
            bars={weeks.map((w) => ({
              label: shortDate(w.start),
              value: w.count,
              tooltip: `Week of ${shortDate(w.start)}: ${w.count} ${
                w.count === 1 ? "workout" : "workouts"
              }${w.seconds ? ` · ${formatDuration(w.seconds)}` : ""}`,
            }))}
          />
        )}
      </section>

      <section className={cardClass}>
        <h2 className="font-bold mb-2">Exercise progress</h2>
        {exerciseNames.length === 0 ? (
          <Empty text="Log a few sets and your progress shows up here." />
        ) : (
          <>
            <select
              className={selectClass}
              value={selectedExercise ?? ""}
              onChange={(e) => setExercise(e.target.value)}
              aria-label="Exercise"
            >
              {exerciseNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            {series && (
              <>
                <p className="mt-3 mb-1 text-xs font-semibold tracking-wide text-base-content/55 dark:text-base-content/75">
                  {series.title}
                </p>
                <LineChart
                  ariaLabel={`${series.title} for ${selectedExercise}`}
                  points={series.points}
                  formatY={series.format}
                />
              </>
            )}
          </>
        )}
      </section>

      <section className={cardClass}>
        <h2 className="font-bold mb-2">Injury pain</h2>
        {!injury ? (
          <Empty text="Add an injury on the Injuries tab to track its pain here." />
        ) : (
          <>
            <select
              className={selectClass}
              value={injury.id}
              onChange={(e) => setInjuryId(e.target.value)}
              aria-label="Injury"
            >
              {tracked.map((i) => (
                <option key={i.id} value={i.id}>
                  {placeLabel(i.region, i.side)}
                  {i.name ? `: ${i.name}` : ""}
                  {i.healed_on ? " (healed)" : ""}
                </option>
              ))}
            </select>
            <p className="mt-3 mb-1 text-xs font-semibold tracking-wide text-base-content/55 dark:text-base-content/75">
              Pain, 0 to 10
            </p>
            <LineChart
              ariaLabel="Pain over time"
              points={painPoints}
              yDomain={[0, 10]}
            />
          </>
        )}
      </section>
    </div>
  );
}
