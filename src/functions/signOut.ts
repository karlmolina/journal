import { supabase } from "../supabase";
import { clearUserCaches } from "./userCache";

// Clear this user's cached data so the next person on this device starts clean.
export default async function signOut(userId?: string) {
  clearUserCaches(userId);
  await supabase.auth.signOut();
}
