// One-time migration of journal entries from Firestore to Supabase.
//
// Usage:
//   bun scripts/migrate-firestore-to-supabase.ts [--dry-run]
//
// Environment (Bun loads .env automatically):
//   GOOGLE_APPLICATION_CREDENTIALS  Path to a Firebase service account JSON key
//   VITE_SUPABASE_URL               Supabase project URL
//   SUPABASE_SECRET_KEY       Supabase secret key (bypasses RLS)
//
// Users are matched by email. A Firebase user with no Supabase account yet gets
// one created with a confirmed email; Supabase links it to their Google
// identity on first sign-in. Entry IDs are derived from the Firestore doc IDs,
// so re-running the script skips entries that were already copied.

import { createHash } from "node:crypto";
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { createClient } from "@supabase/supabase-js";

const dryRun = process.argv.includes("--dry-run");
const BATCH_SIZE = 500;
// Fixed namespace for UUIDv5 IDs generated from Firestore doc IDs.
const NAMESPACE = "6f1c2a4e-8b3d-4f5a-9c7e-1d2b3a4c5e6f";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

function uuidV5(name: string): string {
  const ns = Buffer.from(NAMESPACE.replace(/-/g, ""), "hex");
  const hash = createHash("sha1").update(ns).update(name).digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

requireEnv("GOOGLE_APPLICATION_CREDENTIALS");
initializeApp({ credential: applicationDefault() });
const firestore = getFirestore();
const firebaseAuth = getAuth();
const supabase = createClient(
  requireEnv("VITE_SUPABASE_URL"),
  requireEnv("SUPABASE_SECRET_KEY"),
  { auth: { persistSession: false, autoRefreshToken: false } },
);

async function loadSupabaseUsersByEmail(): Promise<Map<string, string>> {
  const byEmail = new Map<string, string>();
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) throw error;
    for (const user of data.users) {
      if (user.email) byEmail.set(user.email.toLowerCase(), user.id);
    }
    if (data.users.length < 1000) return byEmail;
  }
}

async function main() {
  console.log(dryRun ? "Dry run: nothing will be written.\n" : "");

  const snapshot = await firestore.collection("entries").get();
  console.log(`Found ${snapshot.size} Firestore entries.`);

  // Map Firebase uid -> email.
  const firebaseUids = [
    ...new Set(snapshot.docs.map((doc) => doc.get("userId") as string)),
  ].filter(Boolean);
  const emailByUid = new Map<string, string>();
  for (let i = 0; i < firebaseUids.length; i += 100) {
    const result = await firebaseAuth.getUsers(
      firebaseUids.slice(i, i + 100).map((uid) => ({ uid })),
    );
    for (const user of result.users) {
      if (user.email) emailByUid.set(user.uid, user.email.toLowerCase());
    }
  }

  // Map Firebase uid -> Supabase user id, creating Supabase users as needed.
  const supabaseIdByEmail = await loadSupabaseUsersByEmail();
  const supabaseIdByUid = new Map<string, string>();
  for (const uid of firebaseUids) {
    const email = emailByUid.get(uid);
    if (!email) {
      console.warn(`Skipping Firebase user ${uid}: no email on record.`);
      continue;
    }
    let supabaseId = supabaseIdByEmail.get(email);
    if (!supabaseId) {
      console.log(`Creating Supabase user for ${email}.`);
      if (dryRun) {
        supabaseId = "(new user)";
      } else {
        const { data, error } = await supabase.auth.admin.createUser({
          email,
          email_confirm: true,
        });
        if (error) throw error;
        supabaseId = data.user.id;
      }
    }
    supabaseIdByUid.set(uid, supabaseId);
  }

  const rows = [];
  let skipped = 0;
  for (const doc of snapshot.docs) {
    const userId = supabaseIdByUid.get(doc.get("userId"));
    const text = doc.get("text");
    if (!userId || typeof text !== "string") {
      skipped++;
      continue;
    }
    // Entries written while offline may lack a server timestamp.
    const createdAt =
      (doc.get("createdAt") as Timestamp | undefined)?.toDate() ??
      doc.createTime.toDate();
    rows.push({
      id: uuidV5(doc.id),
      user_id: userId,
      text,
      created_at: createdAt.toISOString(),
    });
  }

  console.log(`Prepared ${rows.length} entries (${skipped} skipped).`);
  if (dryRun) return;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const { error } = await supabase
      .from("entries")
      .upsert(rows.slice(i, i + BATCH_SIZE), {
        onConflict: "id",
        ignoreDuplicates: true,
      });
    if (error) throw error;
    console.log(
      `Copied ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}`,
    );
  }
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
