// Supabase's edge runtime ships gte-small, so no external API key is needed.
// deno-lint-ignore no-explicit-any
const session = new (globalThis as any).Supabase.ai.Session("gte-small");

export async function embed(text: string): Promise<number[]> {
  const out = await session.run(text, { mean_pool: true, normalize: true });
  return Array.from(out as ArrayLike<number>);
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
