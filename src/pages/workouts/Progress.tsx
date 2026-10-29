import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabase";
import { readUserCache, writeUserCache } from "../../functions/userCache";
import { useAuth } from "../../context/AuthContext";
import useInjuries from "../../hooks/useInjuries";
import { elapsedSeconds, type Workout } from "../../hooks/useWorkouts";
import BarChart from "../../components/charts/BarChart";
import LineChart, {
  type LineSeries,
  type LinePoint,
} from "../../components/charts/LineChart";
import { SERIES_COLORS, seriesColor } from "../../functions/chartScale";
import ErrorBanner from "../../components/ErrorBanner";
import { formatClock, formatDuration } from "../../functions/formatDuration";
import { WEIGHT_UNIT } from "../../functions/workoutSets";
import { placeLabel } from "../../functions/bodyRegions";
import { reportError } from "../../functions/reportError";
import { cardClass } from "../../components/styles";

const WEEKS = 12;
const HISTORY_WEEKS = 26;
const DAY_MS = 86_400_000;
const CACHE_KEY = "progress_workouts";

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

  // Exercises are measured in different units, so each line is its best set
  // as a percent change from its first session; the tooltip keeps the real set.
  const start = points.findIndex((p) => p.y > 0);
  if (start < 0) return [];
  const base = points[start].y;
  return points.slice(start).map((p) => {
    const pct = Math.round(((p.y - base) / base) * 100);
    return { ...p, y: pct, label: `${p.label} · ${formatPercent(pct)}` };
  });
}

const formatPercent = (v: number) =>
  `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v)}%`;

export default function Progress() {
  const { user } = useAuth();
  const userId = user?.id;
  const { injuries } = useInjuries(userId);
  // Seeded from the last visit so the charts paint before the refresh lands.
  const [workouts, setWorkouts] = useState<Workout[] | null>(() =>
    userId ? readUserCache<Workout[] | null>(CACHE_KEY, userId, null) : null,
  );
  const [error, setError] = useState<string | null>(null);

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
          reportError(error, "Progress");
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

  const exerciseLines = useMemo<LineSeries[]>(
    () =>
      workouts
        ? exerciseNames
            .map((name) => ({ name, points: exerciseSeries(workouts, name) }))
            .filter((e) => e.points.length > 0)
            .map((e, i) => ({
              id: e.name.toLowerCase(),
              name: e.name,
              color: seriesColor(i),
              points: e.points,
              other: i >= SERIES_COLORS,
            }))
        : [],
    [workouts, exerciseNames],
  );

  // Current injuries first so they get the leading colors; healed ones dashed.
  const injuryLines: LineSeries[] = injuries
    .filter((i) => i.injury_checkins.length > 0)
    .sort((a, b) => Number(!!a.healed_on) - Number(!!b.healed_on))
    .map((i, n) => ({
      id: i.id,
      name: `${i.name || placeLabel(i.region, i.side)}${i.healed_on ? " (healed)" : ""}`,
      color: seriesColor(n),
      dashed: !!i.healed_on,
      other: n >= SERIES_COLORS,
      points: i.injury_checkins.map(
        (c): LinePoint => ({
          x: Date.parse(`${c.checked_on}T12:00:00`),
          y: c.pain,
          label: `${c.pain}/10`,
        }),
      ),
    }));

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
        <h2 className="font-bold">Exercise progress</h2>
        <p className="mt-0.5 mb-3 text-xs font-semibold text-base-content/55 dark:text-base-content/75">
          Best set each session, as change since your first one
        </p>
        {workouts === null ? (
          <Empty text="Loading…" />
        ) : exerciseLines.length === 0 ? (
          <Empty text="Log a few sets and your progress shows up here." />
        ) : (
          <LineChart
            ariaLabel="Best set per exercise, percent change since the first session"
            series={exerciseLines}
            formatY={formatPercent}
          />
        )}
      </section>

      <section className={cardClass}>
        <h2 className="font-bold">Injury pain</h2>
        <p className="mt-0.5 mb-3 text-xs font-semibold text-base-content/55 dark:text-base-content/75">
          Pain at each check-in, 0 to 10
        </p>
        {injuryLines.length === 0 ? (
          <Empty text="Add an injury on the Injuries tab to track its pain here." />
        ) : (
          <LineChart
            ariaLabel="Pain over time per injury"
            series={injuryLines}
            yDomain={[0, 10]}
          />
        )}
      </section>
    </div>
  );
}
