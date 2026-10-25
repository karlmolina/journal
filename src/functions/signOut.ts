import { supabase } from "../supabase";
import { clearUserCaches } from "./userCache";
import { flushDeletes } from "./undoDelete";

// Clear this user's cached data so the next person on this device starts clean.
export default async function signOut(userId?: string) {
  // A delete still waiting behind its Undo toast goes out while signed in.
  await flushDeletes();
  clearUserCaches(userId);
  await supabase.auth.signOut();
}
