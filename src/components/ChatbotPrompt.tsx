import { useState } from "react";
import { fieldClass } from "./styles";
import useDraft from "../hooks/useDraft";

// Copies the prompt for a chatbot. When the clipboard is blocked, the prompt
// shows in a box to copy by hand.
export function CopyPrompt({
  getPrompt,
  disabled,
}: {
  getPrompt: () => string;
  disabled?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState<string | null>(null);

  const copy = async () => {
    const prompt = getPrompt();
    try {
      await navigator.clipboard.writeText(prompt);
      setManual(null);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setManual(prompt);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        className="btn btn-primary rounded-full font-bold"
        onClick={copy}
        disabled={disabled}
      >
        {copied ? "Copied. Paste it into a chatbot" : "Copy prompt"}
      </button>
      {manual !== null && (
        <textarea
          className={`${fieldClass} resize-none font-mono text-xs`}
          rows={6}
          readOnly
          value={manual}
          onFocus={(e) => e.target.select()}
          aria-label="Prompt to copy"
        />
      )}
    </div>
  );
}

// Where the chatbot's reply goes. It's checked before anything is saved, and
// what's wrong is listed so the person can ask the bot to fix it.
export function PasteReply<T>({
  draft,
  saving,
  parse,
  onImport,
  importLabel,
}: {
  // Where a pasted reply is kept until it's imported.
  draft: string;
  saving: boolean;
  parse: (
    reply: string,
  ) => { ok: true; value: T } | { ok: false; errors: string[] };
  onImport: (value: T) => Promise<boolean>;
  importLabel: string;
}) {
  const [reply, setReply] = useDraft(draft, "reply", "");
  const [errors, setErrors] = useState<string[]>([]);

  const handleImport = async () => {
    const result = parse(reply);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors([]);
    if (await onImport(result.value)) setReply("");
  };

  return (
    <div className="flex flex-col gap-2">
      <textarea
        className={`${fieldClass} resize-none font-mono text-xs`}
        rows={4}
        placeholder="Paste the chatbot's reply here"
        value={reply}
        onChange={(e) => {
          setReply(e.target.value);
          setErrors([]);
        }}
        aria-label="Chatbot reply"
        disabled={saving}
      />
      {errors.length > 0 && (
        <div
          role="alert"
          className="rounded-xl bg-error/15 px-3 py-2 text-sm font-semibold"
        >
          <p>That reply can't be imported yet:</p>
          <ul className="mt-1 list-disc pl-5 font-medium">
            {errors.slice(0, 8).map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
          {errors.length > 8 && (
            <p className="mt-1 font-medium">…and {errors.length - 8} more.</p>
          )}
          <p className="mt-1 font-medium">
            You can paste these back to the chatbot and ask it to fix them.
          </p>
        </div>
      )}
      <button
        type="button"
        className="btn rounded-full font-bold bg-base-content/8 border-0 shadow-none"
        onClick={handleImport}
        disabled={!reply.trim() || saving}
      >
        {saving ? (
          <>
            <span className="loading loading-spinner loading-sm"></span>
            Saving…
          </>
        ) : (
          importLabel
        )}
      </button>
    </div>
  );
}
