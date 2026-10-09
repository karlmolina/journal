// Returns a gte-small embedding for the given text, using Supabase's built-in
// AI inference (no external API key needed).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const session = new Supabase.ai.Session("gte-small");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const { input } = await req.json();
  if (typeof input !== "string" || !input.trim()) {
    return new Response(JSON.stringify({ error: "input is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const embedding = await session.run(input, {
    mean_pool: true,
    normalize: true,
  });

  return new Response(JSON.stringify({ embedding }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
