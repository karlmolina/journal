import type { ReactNode } from "react";

// A thin outline around exercises done back to back as one superset, with a
// quiet note of the round you're on and the rest after each round.
export default function SupersetGroup({
  size,
  progress,
  rest,
  children,
}: {
  // How many exercises it has: two is a superset, more a circuit.
  size: number;
  // Like "Round 2 of 3" or "3 rounds".
  progress?: string;
  rest?: number;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-base-content/15 dark:border-base-content/25 p-1">
      <p className="px-2.5 pt-1 text-xs font-semibold text-base-content/50 dark:text-base-content/70 tabular-nums">
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
