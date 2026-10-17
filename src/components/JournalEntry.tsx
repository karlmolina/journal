import formatDate, { formatFullDate } from "../functions/formatDate";

// The database wraps search matches in these private-use characters.
const MATCH_START = "\ue000";
const MATCH_END = "\ue001";

function renderHighlighted(highlighted: string) {
  // Splitting on a capture group puts the matched text at odd indexes.
  return highlighted
    .split(new RegExp(`${MATCH_START}(.*?)${MATCH_END}`, "gs"))
    .map((part, i) =>
      i % 2 === 1 ? (
        <mark
          key={i}
          className="bg-primary/30 text-inherit font-semibold rounded-sm px-0.5"
        >
          {part}
        </mark>
      ) : (
        part
      ),
    );
}

interface JournalEntryProps {
  text: string;
  // Search result text with matches marked; shown instead of `text`.
  highlighted?: string;
  createdAt: Date;
  refProp?: (node: HTMLDivElement | null) => void;
  // Set while the entry hasn't been confirmed saved.
  status?: "saving" | "failed";
  onRetry?: () => void;
}

export default function JournalEntry({
  text,
  highlighted,
  createdAt,
  refProp,
  status,
  onRetry,
}: JournalEntryProps) {
  return (
    <div
      ref={refProp}
      className={`rounded-2xl bg-base-content/5 px-4 py-3 sm:px-5 sm:py-4 ${
        // Unsaved entries were just written, so they animate in.
        status ? "animate-entry-in" : ""
      }`}
    >
      <div className="text-xs font-semibold tracking-wide text-base-content/55 flex items-center gap-2 min-h-5">
        <time
          dateTime={createdAt.toISOString()}
          title={formatFullDate(createdAt)}
        >
          {formatDate(createdAt)}
        </time>
        {status === "saving" && (
          <span className="loading loading-spinner loading-xs opacity-70"></span>
        )}
        {status === "failed" && (
          <>
            <span className="text-error">Not saved</span>
            <button
              type="button"
              className="btn btn-link btn-xs p-0 min-h-0 h-auto font-semibold"
              onClick={onRetry}
            >
              Retry
            </button>
          </>
        )}
      </div>
      <p className="mt-1.5 whitespace-pre-wrap text-[1.0625rem] leading-relaxed font-medium text-base-content/90">
        {highlighted ? renderHighlighted(highlighted) : text}
      </p>
    </div>
  );
}
