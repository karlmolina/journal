// A whole rest from music notation: a small block hanging from a line.
function RestIcon() {
  return (
    <svg width="22" height="15" viewBox="0 0 20 14" aria-hidden="true">
      {/* One shape, the line and the block hanging from it, so a see-through
          color doesn't darken where they'd overlap. */}
      <path
        d="M2.125 3.375H17.875a.625.625 0 0 1 0 1.25H15V8.5A1.5 1.5 0 0 1 13.5 10h-7A1.5 1.5 0 0 1 5 8.5V4.625H2.125a.625.625 0 0 1 0-1.25Z"
        fill="currentColor"
      />
    </svg>
  );
}

const linkButtonClass =
  "flex size-7 items-center justify-center rounded-full font-bold transition cursor-pointer text-base-content/55 dark:text-base-content/75 hover:text-base-content/80 dark:hover:text-base-content/95";

// Between two planned exercises: whether they're a superset, and a tap to
// pair them up or split them.
export default function SupersetLink({
  linked,
  onToggle,
}: {
  linked: boolean;
  onToggle: () => void;
}) {
  if (!linked)
    return (
      <div className="flex justify-center">
        <button
          type="button"
          className={linkButtonClass}
          onClick={onToggle}
          aria-pressed={false}
          aria-label="Rest between these. Tap to make them a superset."
          title="Rest between · tap to superset"
        >
          <RestIcon />
        </button>
      </div>
    );
  // Joined with no rest: a neck of card joins the two cards, with the
  // superset sign in its waist.
  return (
    <div className="relative flex justify-center h-8 -my-1">
      <svg
        className="absolute inset-y-0 left-1/2 -translate-x-1/2 h-full w-24 text-base-content/5 dark:text-base-content/9"
        viewBox="0 0 80 28"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M0 0H80C62 0 56 7 56 14C56 21 62 28 80 28H0C18 28 24 21 24 14C24 7 18 0 0 0Z"
          fill="currentColor"
        />
      </svg>
      <button
        type="button"
        className={`${linkButtonClass} relative text-xl leading-none`}
        onClick={onToggle}
        aria-pressed
        aria-label="Superset, no rest between these. Tap to split them."
        title="Superset · tap to split"
      >
        ⊃
      </button>
    </div>
  );
}
