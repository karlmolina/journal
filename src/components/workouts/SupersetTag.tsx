// The letter that marks exercises done back to back as one superset.
export default function SupersetTag({ letter }: { letter: string }) {
  return (
    <span
      className="shrink-0 self-center rounded-md bg-primary/12 dark:bg-primary/25 px-1.5 text-[11px] leading-[18px] font-bold text-primary dark:text-[color-mix(in_oklab,var(--color-primary),white_65%)]"
      title={`Superset ${letter}`}
    >
      {letter}
    </span>
  );
}
