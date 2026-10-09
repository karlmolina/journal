// Fills in missing embeddings so older entries show up in semantic search.
//
// Usage:
//   bun scripts/backfill-embeddings.ts
//
// Environment (Bun loads .env automatically):
//   VITE_SUPABASE_URL          Supabase project URL
//   SUPABASE_SERVICE_ROLE_KEY  Supabase service role key (bypasses RLS)
//
// Requires the `embed` Edge Function to be deployed. Safe to re-run: only
// entries without an embedding are processed.

import { createClient } from "@supabase/supabase-js";

const BATCH_SIZE = 50;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

const supabase = createClient(
  requireEnv("VITE_SUPABASE_URL"),
  requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false, autoRefreshToken: false } },
);

let done = 0;
for (;;) {
  const { data: rows, error } = await supabase
    .from("entries")
    .select("id, text")
    .is("embedding", null)
    .limit(BATCH_SIZE);
  if (error) throw error;
  if (rows.length === 0) break;

  for (const row of rows) {
    const { data, error: embedError } = await supabase.functions.invoke<{
      embedding: number[];
    }>("embed", { body: { input: row.text } });
    if (embedError || !data) throw embedError ?? new Error("No embedding");

    const { error: updateError } = await supabase
      .from("entries")
      .update({ embedding: data.embedding })
      .eq("id", row.id);
    if (updateError) throw updateError;
    done++;
  }
  console.log(`Embedded ${done} entries`);
}

console.log(`Done. Embedded ${done} entries.`);
