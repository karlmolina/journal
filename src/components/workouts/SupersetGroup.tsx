import type { ReactNode } from "react";

// A thin outline around exercises done back to back as one superset, with a
// quiet note of the round you're on and the rest after each round.
export default function SupersetGroup({
  size,
  progress,
  rest,
  grip,
  rounds,
  children,
}: {
  // How many exercises it has: two is a superset, more a circuit.
  size: number;
  // Like "Round 2 of 3" or "3 rounds".
  progress?: string;
  rest?: number;
  // A handle to drag the whole group by, beside its note.
  grip?: ReactNode;
  // Buttons for one round fewer or more; a missing one is disabled.
  rounds?: { fewer?: () => void; more?: () => void };
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-base-content/15 dark:border-base-content/25 p-1">
      <p className="flex items-center gap-1 px-2.5 pt-1 text-xs font-semibold text-base-content/50 dark:text-base-content/70 tabular-nums">
        {grip}
        <span className="flex-1 min-w-0">
          {[
            size > 2 ? "Circuit" : "Superset",
            progress,
            !!rest && rest > 0 && `${rest}s rest per round`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
        {rounds && (
          <span className="flex shrink-0 gap-1">
            {(
              [
                ["−", "One round fewer", rounds.fewer],
                ["+", "One more round", rounds.more],
              ] as const
            ).map(([sign, label, onClick]) => (
              <button
                key={sign}
                type="button"
                className="btn btn-xs btn-circle bg-base-content/8 border-0 shadow-none text-sm font-bold text-base-content/70 dark:text-base-content/80"
                onClick={onClick}
                disabled={!onClick}
                aria-label={label}
              >
                {sign}
              </button>
            ))}
          </span>
        )}
      </p>
      {children}
    </div>
  );
}
