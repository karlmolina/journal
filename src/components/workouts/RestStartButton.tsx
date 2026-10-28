// The one big button on the card: big enough to hit mid-set.
export const primaryClass =
  "btn btn-primary btn-lg h-16 rounded-full text-2xl font-extrabold w-full active:scale-[0.98] transition";

// The start button during a rest is the rest's progress bar too: it fills
// toward the planned rest and starts the set whenever it's tapped. The label
// is drawn twice, once on each side of the fill, so it reads on both.
export default function RestStartButton({
  label,
  progress,
  onClick,
  disabled,
}: {
  label: string;
  progress: number;
  onClick: () => void;
  disabled?: boolean;
}) {
  const filled = Math.min(1, Math.max(0, progress)) * 100;
  const text = "absolute inset-0 flex items-center justify-center";
  // The fill slides in from the left while its label slides back the same
  // amount to stay put. Transforms run off the main thread, so the bar
  // never repaints the page while you scroll.
  const slide =
    "absolute inset-0 transition-transform duration-1000 ease-linear";
  return (
    <button
      type="button"
      className={`${primaryClass} relative overflow-hidden border-0`}
      onClick={onClick}
      disabled={disabled}
    >
      <span
        aria-hidden
        className={`${text} bg-[color-mix(in_oklab,var(--color-primary)_22%,var(--color-base-100))] text-primary dark:bg-[color-mix(in_oklab,var(--color-primary)_30%,var(--color-base-100))] dark:text-[color-mix(in_oklab,var(--color-primary),white_65%)]`}
      >
        {label}
      </span>
      <span
        aria-hidden
        className={`${slide} overflow-hidden`}
        style={{ transform: `translateX(${filled - 100}%)` }}
      >
        <span
          className={`${text} ${slide} bg-primary text-primary-content`}
          style={{ transform: `translateX(${100 - filled}%)` }}
        >
          {label}
        </span>
      </span>
      <span className="sr-only">{label}</span>
    </button>
  );
}
