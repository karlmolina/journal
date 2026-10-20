import { useState } from "react";
import { Link } from "react-router-dom";
import type { Checkin, Injury } from "../../hooks/useInjuries";
import { today } from "../../hooks/useInjuries";
import { painText, placeLabel } from "../../functions/bodyRegions";
import PainSlider from "./PainSlider";

const DAY_MS = 86_400_000;
const parseDay = (date: string) => Date.parse(`${date}T00:00:00`);
const daysBetween = (from: string, to: string) =>
  Math.round((parseDay(to) - parseDay(from)) / DAY_MS);

const formatDay = (date: string) =>
  new Date(parseDay(date)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

// Pain over the last 30 days; higher on the chart is more pain.
function PainTrend({ checkins }: { checkins: Checkin[] }) {
  const end = today();
  const span = 29;
  const points = checkins
    .map((c) => ({ day: span - daysBetween(c.checked_on, end), pain: c.pain }))
    .filter((p) => p.day >= 0);
  if (points.length < 2) return null;
  const x = (day: number) => (day / span) * 300;
  const y = (pain: number) => 56 - (pain / 10) * 52;
  return (
    <svg
      viewBox="-4 0 308 60"
      className="w-full h-14 text-primary"
      role="img"
      aria-label={`Pain over the last 30 days, from ${points[0].pain} to ${points[points.length - 1].pain}`}
    >
      <line
        x1="0"
        x2="300"
        y1={y(0)}
        y2={y(0)}
        className="stroke-base-content/10"
        strokeWidth="1"
      />
      <polyline
        points={points.map((p) => `${x(p.day)},${y(p.pain)}`).join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {points.map((p) => (
        <circle
          key={p.day}
          cx={x(p.day)}
          cy={y(p.pain)}
          r="3"
          fill="currentColor"
        />
      ))}
    </svg>
  );
}

interface InjuryCardProps {
  injury: Injury;
  onCheckIn: (pain: number, notes: string) => void;
  onHealed: () => void;
  onReopen: () => void;
  onDelete: () => void;
}

export default function InjuryCard({
  injury,
  onCheckIn,
  onHealed,
  onReopen,
  onDelete,
}: InjuryCardProps) {
  const checkins = injury.injury_checkins;
  const last = checkins.at(-1);
  const todays = last?.checked_on === today() ? last : undefined;
  const [pain, setPain] = useState(todays?.pain ?? last?.pain ?? 0);
  const [notes, setNotes] = useState(todays?.notes ?? "");
  const [editing, setEditing] = useState(!todays);
  const [showMore, setShowMore] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const healed = injury.healed_on !== null;
  const first = checkins[0];

  const title = placeLabel(injury.region, injury.side);
  const day = daysBetween(injury.started_on, injury.healed_on ?? today()) + 1;

  return (
    <div className="rounded-2xl bg-base-content/5 dark:bg-base-content/9 px-4 py-3 sm:px-5 sm:py-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-base-content/55 dark:text-base-content/70">
            {healed
              ? `${formatDay(injury.started_on)} – ${formatDay(injury.healed_on!)} · ${day} days`
              : `Since ${formatDay(injury.started_on)} · day ${day}`}
          </p>
          <p className="text-lg font-bold leading-snug">
            {injury.name ? `${title}: ${injury.name}` : title}
          </p>
        </div>
        {last && (
          <div className="text-right shrink-0">
            <p
              className={`text-2xl font-extrabold tabular-nums ${painText(last.pain)}`}
            >
              {last.pain}
              <span className="text-sm font-bold text-base-content/40">
                /10
              </span>
            </p>
            {first && first !== last && (
              <p className="text-xs font-semibold text-base-content/55">
                from {first.pain}
              </p>
            )}
          </div>
        )}
      </div>

      <PainTrend checkins={checkins} />

      {!healed &&
        (editing ? (
          <div className="flex flex-col gap-2">
            <PainSlider value={pain} onChange={setPain} />
            <input
              className="w-full rounded-xl bg-base-content/8 px-3 py-2.5 font-medium outline-none focus:bg-base-content/12 placeholder:text-base-content/45"
              placeholder="Notes for today (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              aria-label="Notes for today"
            />
            <button
              type="button"
              className="btn btn-primary rounded-full font-bold"
              onClick={() => {
                onCheckIn(pain, notes);
                setEditing(false);
              }}
            >
              {todays ? "Update today's check-in" : "Check in for today"}
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-base-content/5 px-3 py-2">
            <span className="text-sm font-semibold text-base-content/70">
              Checked in today
              {todays?.notes ? `: ${todays.notes}` : ""}
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-xs rounded-full font-bold"
              onClick={() => setEditing(true)}
            >
              Change
            </button>
          </div>
        ))}

      {showMore && (
        <div className="flex flex-col gap-2">
          {injury.notes && (
            <p className="font-medium whitespace-pre-wrap">{injury.notes}</p>
          )}
          <ol className="flex flex-col">
            {[...checkins].reverse().map((c) => (
              <li
                key={c.id}
                className="flex gap-3 min-h-7 items-baseline text-sm font-medium"
              >
                <span className="w-14 shrink-0 text-xs font-semibold text-base-content/55">
                  {formatDay(c.checked_on)}
                </span>
                <span
                  className={`w-10 shrink-0 font-bold tabular-nums ${painText(c.pain)}`}
                >
                  {c.pain}/10
                </span>
                <span className="text-base-content/70">{c.notes}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1 -mx-2">
        <Link
          to={`/workouts/library?region=${injury.region}&purpose=healing`}
          className="btn btn-ghost btn-sm rounded-full font-bold text-primary"
        >
          Exercises
        </Link>
        <button
          type="button"
          className="btn btn-ghost btn-sm rounded-full font-semibold text-base-content/60"
          onClick={() => setShowMore(!showMore)}
        >
          {showMore ? "Hide history" : "History"}
        </button>
        <span className="flex-1" />
        {confirmDelete ? (
          <>
            <button
              type="button"
              className="btn btn-ghost btn-sm rounded-full font-bold"
              onClick={() => setConfirmDelete(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-error btn-sm rounded-full font-bold"
              onClick={onDelete}
            >
              Delete
            </button>
          </>
        ) : (
          <>
            {showMore && (
              <button
                type="button"
                className="btn btn-ghost btn-sm rounded-full font-semibold text-base-content/60"
                onClick={() => setConfirmDelete(true)}
              >
                Delete
              </button>
            )}
            <button
              type="button"
              className="btn btn-ghost btn-sm rounded-full font-bold"
              onClick={healed ? onReopen : onHealed}
            >
              {healed ? "Not healed yet" : "Mark healed"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
