import { useState } from "react";

interface ErrorBannerProps {
  message: string;
  // Extra technical detail, shown small and included when copying.
  details?: string | null;
  onDismiss: () => void;
}

export default function ErrorBanner({
  message,
  details,
  onDismiss,
}: ErrorBannerProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(
        details ? `${message}\n${details}` : message,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the text is still selectable.
    }
  };

  return (
    <div
      role="alert"
      className="mb-3 flex items-center justify-between gap-3 rounded-2xl bg-error/15 px-4 py-3 text-sm font-semibold"
    >
      <div className="min-w-0 select-text">
        <p>{message}</p>
        {details && (
          <p className="mt-1 break-words font-mono text-xs font-normal opacity-80">
            {details}
          </p>
        )}
      </div>
      <div className="flex shrink-0 gap-1">
        <button
          type="button"
          className="btn btn-ghost btn-xs rounded-full font-bold"
          onClick={copy}
        >
          {copied ? "Copied" : "Copy"}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-xs rounded-full font-bold"
          onClick={onDismiss}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
