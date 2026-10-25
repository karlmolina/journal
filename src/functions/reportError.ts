import { supabase } from "../supabase";

// Saves errors the app runs into to the client_errors table, so they can be
// read in Supabase instead of asking for a screenshot. Also logs them to the
// console as before. Reporting never throws and never reports itself.

const MAX_PER_PAGE = 30;
let sent = 0;
// The same error repeating (e.g. a crash on every render) is sent once.
const seen = new Set<string>();

function describe(err: unknown): { message: string; detail: string | null } {
  if (err instanceof Error)
    return {
      message: `${err.name}: ${err.message}`,
      detail: err.stack ?? null,
    };
  if (err && typeof err === "object") {
    // Supabase errors are plain objects: message, code, details, hint.
    const { message, ...rest } = err as { message?: unknown };
    const detail = Object.keys(rest).length ? safeJson(rest) : null;
    if (typeof message === "string") return { message, detail };
    return { message: safeJson(err), detail: null };
  }
  return { message: String(err), detail: null };
}

function safeJson(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

const clip = (text: string | null, max: number) =>
  text && text.length > max ? text.slice(0, max) : text;

export function reportError(err: unknown, context = "Error", extra?: string) {
  console.error(context, err);
  try {
    const { message, detail } = describe(err);
    const key = `${context}|${message}`;
    if (seen.has(key) || sent >= MAX_PER_PAGE) return;
    seen.add(key);
    sent += 1;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      // Only signed-in people can write; errors before sign-in stay local.
      if (!data.session) return;
      await supabase.from("client_errors").insert({
        context: clip(context, 500),
        message: clip(message || "(no message)", 2000),
        detail: clip(
          [detail, extra].filter(Boolean).join("\n\n") || null,
          8000,
        ),
        url: clip(location.pathname + location.search, 1000),
        user_agent: clip(navigator.userAgent, 500),
        build: __BUILD__,
      });
    })().catch(() => {});
  } catch {
    // Never let reporting break the app.
  }
}

// Crashes outside React and promises nobody handled.
export function reportUncaughtErrors() {
  window.addEventListener("error", (e) =>
    reportError(e.error ?? e.message, "Uncaught error"),
  );
  window.addEventListener("unhandledrejection", (e) =>
    reportError(e.reason, "Unhandled rejection"),
  );
}
