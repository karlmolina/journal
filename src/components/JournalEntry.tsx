import formatDate from "../functions/formatDate";

// The database wraps search matches in these private-use characters.
const MATCH_START = "\ue000";
const MATCH_END = "\ue001";

function renderHighlighted(highlighted: string) {
  // Splitting on a capture group puts the matched text at odd indexes.
  return highlighted
    .split(new RegExp(`${MATCH_START}(.*?)${MATCH_END}`, "gs"))
    .map((part, i) =>
      i % 2 === 1 ? (
        <mark key={i} className="bg-primary/30 text-inherit rounded-sm">
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
      className="card bg-base-100 border-base-content/20 border"
    >
      <div className="card-body text-base p-2 sm:p-4">
        <div className="text-sm text-gray-400 flex items-center gap-2">
          {formatDate(createdAt)}
          {status === "saving" && (
            <span className="loading loading-spinner loading-xs"></span>
          )}
          {status === "failed" && (
            <>
              <span className="text-error">Not saved</span>
              <button
                type="button"
                className="btn btn-link btn-xs p-0 min-h-0 h-auto"
                onClick={onRetry}
              >
                Retry
              </button>
            </>
          )}
        </div>
        <p className="whitespace-pre-wrap">
          {highlighted ? renderHighlighted(highlighted) : text}
        </p>
      </div>
    </div>
  );
}
