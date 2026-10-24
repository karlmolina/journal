import { useEffect, useRef, useState } from "react";

const MAX_MATCHES = 5;

interface ExerciseInputProps {
  className: string;
  value: string;
  onChange: (value: string) => void;
  // Exercise names used before, most recent first.
  suggestions: string[];
}

// An exercise name field with suggestions listed right under it. A native
// <datalist> isn't used because mobile browsers draw its popup on top of the
// on-screen keyboard, where it can't be positioned or kept in view.
export default function ExerciseInput({
  className,
  value,
  onChange,
  suggestions,
}: ExerciseInputProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);

  const query = value.trim().toLowerCase();
  const matches = suggestions
    .filter((name) => {
      const n = name.toLowerCase();
      return n !== query && n.includes(query);
    })
    .slice(0, MAX_MATCHES);
  const showList = open && matches.length > 0;

  // The keyboard opens after focus and shrinks the visual viewport, so keep
  // the field and its list scrolled into what's still on screen.
  useEffect(() => {
    if (!showList) return;
    const reveal = () =>
      wrapperRef.current?.scrollIntoView({ block: "nearest" });
    reveal();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", reveal);
    return () => vv?.removeEventListener("resize", reveal);
  }, [showList, matches.length]);

  const pick = (name: string) => {
    onChange(name);
    setOpen(false);
    // Drop the keyboard so the rest of the form is visible again.
    inputRef.current?.blur();
  };

  return (
    <div ref={wrapperRef} className="flex flex-col gap-1 scroll-my-3">
      <input
        ref={inputRef}
        className={className}
        placeholder="Exercise, like Goblet squat"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        aria-label="Exercise"
        aria-autocomplete="list"
        aria-expanded={showList}
        autoCapitalize="words"
        autoComplete="off"
      />
      {showList && (
        <ul
          role="listbox"
          aria-label="Exercise suggestions"
          className="flex flex-col rounded-xl bg-base-content/5 p-1"
        >
          {matches.map((name) => (
            <li key={name} role="option" aria-selected={false}>
              <button
                type="button"
                tabIndex={-1}
                className="w-full rounded-lg px-3 py-2 text-left font-semibold transition hover:bg-base-content/8 active:bg-base-content/12"
                // Keep focus in the input so the blur doesn't close the list
                // before the tap lands.
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => pick(name)}
              >
                {name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
