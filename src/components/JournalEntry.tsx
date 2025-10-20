import formatDate from "../functions/formatDate";

interface JournalEntryProps {
  text: string;
  createdAt: Date;
  refProp?: (node: HTMLDivElement | null) => void;
}

export default function JournalEntry({
  text,
  createdAt,
  refProp,
}: JournalEntryProps) {
  return (
    <div
      ref={refProp}
      className="card bg-base-100 border-base-content/20 border"
    >
      <div className="card-body text-base p-2 sm:p-4">
        <div className="text-sm text-gray-400">{formatDate(createdAt)}</div>
        <p className="whitespace-pre-wrap">{text}</p>
      </div>
    </div>
  );
}
