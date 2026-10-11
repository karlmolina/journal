// Embeds journal entries. Body is either { entryId } for one entry, or
// { backfill: true } to embed a batch of the caller's entries that lack one.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, embed, json } from "../_shared/embed.ts";

const BACKFILL_BATCH = 10;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Forward the caller's JWT so RLS restricts everything to their own rows.
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
  );

  const { entryId, backfill } = await req.json().catch(() => ({}));

  let query = supabase.from("entries").select("id, text");
  if (entryId) query = query.eq("id", entryId);
  else if (backfill) query = query.is("embedding", null).limit(BACKFILL_BATCH);
  else return json({ error: "entryId or backfill required" }, 400);

  const { data: rows, error } = await query;
  if (error) return json({ error: error.message }, 500);

  for (const row of rows) {
    const embedding = await embed(row.text);
    const { error: updateError } = await supabase
      .from("entries")
      .update({ embedding })
      .eq("id", row.id);
    if (updateError) return json({ error: updateError.message }, 500);
  }

  return json({ embedded: rows.length, done: !backfill || rows.length < BACKFILL_BATCH });
});
