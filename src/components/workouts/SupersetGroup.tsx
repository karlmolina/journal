import type { ReactNode } from "react";

const accent =
  "text-primary dark:text-[color-mix(in_oklab,var(--color-primary),white_65%)]";

// A box around exercises done back to back as one superset, headed with its
// letter, where you are in the rounds, and the rest after each round.
export default function SupersetGroup({
  letter,
  size,
  progress,
  rest,
  children,
}: {
  letter: string;
  // How many exercises it has: two is a superset, more a circuit.
  size: number;
  // Like "Round 2 of 3" or "3 rounds".
  progress?: string;
  rest?: number;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border-2 border-primary/45 dark:border-primary/70 bg-primary/6 dark:bg-primary/12 p-1.5">
      <div className="flex items-baseline gap-2 px-2 pt-0.5 pb-1">
        <span
          className={`whitespace-nowrap text-xs font-extrabold uppercase tracking-wide ${accent}`}
        >
          {size > 2 ? "Circuit" : "Superset"} {letter}
        </span>
        {progress && (
          <span
            className={`whitespace-nowrap text-xs font-bold tabular-nums ${accent}`}
          >
            · {progress}
          </span>
        )}
        {!!rest && rest > 0 && (
          <span className="ml-auto whitespace-nowrap text-xs font-semibold text-base-content/55 dark:text-base-content/75 tabular-nums">
            {rest}s rest per round
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
