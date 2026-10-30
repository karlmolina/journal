import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { useAuth } from "../context/AuthContext";
import {
  readUserCache,
  removeUserCache,
  writeUserCache,
} from "../functions/userCache";

// Unsaved form input, kept per user (through the user cache) so a refresh or a
// trip to another page doesn't lose it. Each field of a form is stored under
// `draft_<scope>.<field>`; a field still at its starting value isn't stored,
// so fields you didn't touch keep following fresh data.
const PREFIX = "draft_";

const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);

// Works like useState, but comes back with the unsaved value. `scope` names
// the form (e.g. "sleep:2026-10-29"); a null scope keeps nothing. Give the
// form a React key when its scope changes, so it starts fresh.
export default function useDraft<T>(
  scope: string | null,
  field: string,
  initial: T | (() => T),
): [T, Dispatch<SetStateAction<T>>] {
  const { user } = useAuth();
  const key = scope ? `${PREFIX}${scope}.${field}` : null;
  const userId = user?.id;
  const [start] = useState(initial);
  const [value, setValue] = useState<T>(() =>
    key && userId ? readUserCache(key, userId, start) : start,
  );

  useEffect(() => {
    if (!key || !userId) return;
    if (same(value, start)) removeUserCache(key, userId);
    else writeUserCache(key, userId, value);
  }, [key, userId, value, start]);

  return [value, setValue];
}

// Drops every saved field of a form, once it's saved or cancelled, along
// with forms inside it (scopes like `<scope>:add`).
export function clearDraft(scope: string) {
  try {
    for (const key of Object.keys(localStorage))
      if (
        key.startsWith(`${PREFIX}${scope}.`) ||
        key.startsWith(`${PREFIX}${scope}:`)
      )
        localStorage.removeItem(key);
  } catch {
    // Storage disabled: nothing was kept.
  }
}
