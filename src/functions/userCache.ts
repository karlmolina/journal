// Per-user copies of Supabase data, so pages paint from the last known state
// and refresh in the background. Everything is stored as `<key>_<userId>`, so
// one account's data is never read under another's id, and signing out (or
// the session disappearing) can sweep a user's copies in one pass.

// The signed-in user, set by the auth hook. Only their copies are written, so
// a request that finishes after signing out (or switching accounts) can't put
// the previous account's data back.
const OWNER_KEY = "journal_cache_owner";

export function setCacheOwner(userId: string | null) {
  try {
    if (userId) localStorage.setItem(OWNER_KEY, userId);
    else localStorage.removeItem(OWNER_KEY);
  } catch {
    // Storage disabled: nothing gets cached anyway.
  }
}

export function readUserCache<T>(key: string, userId: string, fallback: T): T {
  try {
    const cached = localStorage.getItem(`${key}_${userId}`);
    return cached ? JSON.parse(cached) : fallback;
  } catch {
    return fallback;
  }
}

export function writeUserCache(key: string, userId: string, value: unknown) {
  try {
    if (localStorage.getItem(OWNER_KEY) !== userId) return;
    localStorage.setItem(`${key}_${userId}`, JSON.stringify(value));
  } catch {
    // Ignore quota / private mode errors; the cache is only a convenience.
  }
}

export function removeUserCache(key: string, userId: string) {
  try {
    localStorage.removeItem(`${key}_${userId}`);
  } catch {
    // Nothing to clear.
  }
}

// Clears every per-user copy (entries, drafts, workouts, ...) of `userId` and
// of the current owner, and forgets the owner until the next sign-in.
export function clearUserCaches(userId?: string) {
  try {
    const owner = localStorage.getItem(OWNER_KEY);
    const ids = new Set([userId, owner].filter((id): id is string => !!id));
    for (const key of Object.keys(localStorage))
      for (const id of ids)
        if (key.endsWith(`_${id}`)) localStorage.removeItem(key);
    localStorage.removeItem(OWNER_KEY);
  } catch {
    // Private mode / storage disabled: nothing was cached.
  }
}
