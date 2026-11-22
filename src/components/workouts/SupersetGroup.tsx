import type { ReactNode } from "react";

// A thin outline around exercises done back to back as one superset, with a
// quiet note of the round you're on and the rest after each round.
export default function SupersetGroup({
  size,
  progress,
  rest,
  grip,
  children,
}: {
  // How many exercises it has: two is a superset, more a circuit.
  size: number;
  // Like "Round 2 of 3" or "3 rounds".
  progress?: string;
  rest?: number;
  // A handle to drag the whole group by, beside its note.
  grip?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-base-content/15 dark:border-base-content/25 p-1">
      <p className="flex items-center gap-1 px-2.5 pt-1 text-xs font-semibold text-base-content/50 dark:text-base-content/70 tabular-nums">
        {grip}
        {[
          size > 2 ? "Circuit" : "Superset",
          progress,
          !!rest && rest > 0 && `${rest}s rest per round`,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {children}
    </div>
  );
}
