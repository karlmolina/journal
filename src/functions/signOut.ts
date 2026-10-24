import { supabase } from "../supabase";

// Per-user caches (entries, drafts, workouts) are stored as `<key>_<userId>`;
// clear them all so the next person on this device starts clean.
export default async function signOut(userId?: string) {
  if (userId)
    for (const key of Object.keys(localStorage))
      if (key.endsWith(`_${userId}`)) localStorage.removeItem(key);
  await supabase.auth.signOut();
}
