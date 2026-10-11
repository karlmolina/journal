// Hybrid (semantic + keyword) search over the caller's entries. Body: { query: string }.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, embed, json } from "../_shared/embed.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const { query } = await req.json().catch(() => ({}));
  if (typeof query !== "string" || !query.trim()) {
    return json({ error: "query required" }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
  );

  const { data, error } = await supabase.rpc("hybrid_search", {
    query_text: query.trim(),
    query_embedding: await embed(query.trim()),
  });
  if (error) return json({ error: error.message }, 500);

  return json({ results: data });
});
