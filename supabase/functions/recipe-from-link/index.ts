// Reads the recipe out of a recipe web page for the Meals tab. Most recipe
// sites embed it as schema.org Recipe data (JSON-LD) for search engines, so
// no AI is needed: the page is fetched here (browsers can't, because of
// CORS) and the recipe's parts are sent back as plain text for the app to
// parse. Pages without that data return { found: false } with the page's
// title, and the app falls back to the chatbot prompt.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_BYTES = 3_000_000;
const TIMEOUT_MS = 10_000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

// Only members of the app may use this; PostgREST checks the token.
async function isMember(req: Request) {
  const auth = req.headers.get("authorization");
  const apikey =
    req.headers.get("apikey") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!auth) return false;
  const res = await fetch(
    `${Deno.env.get("SUPABASE_URL")}/rest/v1/rpc/is_member`,
    {
      method: "POST",
      headers: {
        authorization: auth,
        apikey,
        "content-type": "application/json",
      },
      body: "{}",
    },
  );
  return res.ok && (await res.json()) === true;
}

// Public web pages only: no local or private network addresses.
function allowedUrl(text: string) {
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (!["http:", "https:"].includes(url.protocol) || url.port) return null;
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".internal") ||
    host.endsWith(".local") ||
    !host.includes(".") ||
    /^\[/.test(host) ||
    /^(0|10|127|169\.254|172\.(1[6-9]|2\d|3[01])|192\.168|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7]))\./.test(
      host,
    ) ||
    /^\d+$/.test(host)
  )
    return null;
  return url;
}

async function readPage(url: URL) {
  const res = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      "user-agent":
        "Mozilla/5.0 (compatible; JournalRecipeImport/1.0; +https://github.com/karlmolina/journal)",
      accept: "text/html,application/xhtml+xml",
    },
  });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  if (!allowedUrl(res.url)) throw new Error("Redirected to a private address");
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.length;
  }
  reader.cancel().catch(() => {});
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    bytes.set(c.subarray(0, Math.min(c.length, size - at)), at);
    at += c.length;
  }
  return new TextDecoder().decode(bytes);
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  frac12: "½",
  frac14: "¼",
  frac34: "¾",
  deg: "°",
  ndash: "–",
  mdash: "—",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  hellip: "…",
};

// Text from the page, without tags or HTML entities.
function plain(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (m, e: string) =>
      e[0] === "#"
        ? String.fromCodePoint(
            e[1].toLowerCase() === "x"
              ? parseInt(e.slice(2), 16)
              : Number(e.slice(1)),
          )
        : (ENTITIES[e.toLowerCase()] ?? m),
    )
    .replace(/\s+/g, " ")
    .trim();
}

type Node = Record<string, unknown>;

const isRecipe = (n: Node) =>
  [n["@type"]].flat().some((t) => typeof t === "string" && /recipe$/i.test(t));

function findRecipe(value: unknown): Node | null {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const v of value) {
      const found = findRecipe(v);
      if (found) return found;
    }
    return null;
  }
  const node = value as Node;
  if (isRecipe(node)) return node;
  return findRecipe(node["@graph"]) ?? findRecipe(node.mainEntity);
}

// Instructions come as one string, a list of strings, HowToSteps, or
// HowToSections of steps.
function steps(value: unknown): string[] {
  if (typeof value === "string")
    return value
      .split(/\r?\n|(?<=\.)\s+(?=\d+[.)]\s)/)
      .map(plain)
      .filter(Boolean);
  if (Array.isArray(value)) return value.flatMap(steps);
  if (value && typeof value === "object") {
    const n = value as Node;
    if (n.itemListElement) return steps(n.itemListElement);
    return [plain(n.text ?? n.name)].filter(Boolean);
  }
  return [];
}

function servings(value: unknown): number | null {
  for (const v of [value].flat()) {
    const n = parseInt(String(v ?? ""), 10);
    if (n > 0 && n <= 50) return n;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  if (!(await isMember(req))) return json({ error: "unauthorized" }, 401);

  let url: URL | null = null;
  try {
    url = allowedUrl(String((await req.json()).url ?? "").trim());
  } catch {
    // Falls through to the bad_url answer.
  }
  if (!url) return json({ error: "bad_url" }, 400);

  let html: string;
  try {
    html = await readPage(url);
  } catch (err) {
    console.log("recipe-from-link fetch failed", url.href, String(err));
    return json({ found: false, reason: "unreachable" });
  }

  let recipe: Node | null = null;
  for (const m of html.matchAll(
    /<script[^>]*type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      recipe = findRecipe(JSON.parse(m[1].trim()));
    } catch {
      // Some sites ship broken JSON-LD; try the next block.
    }
    if (recipe) break;
  }
  const title = plain(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]);

  if (!recipe) return json({ found: false, title });
  const ingredients = [recipe.recipeIngredient ?? recipe.ingredients]
    .flat()
    .map(plain)
    .filter(Boolean);
  return json({
    found: ingredients.length > 0,
    title,
    name: plain(recipe.name) || title,
    servings: servings(recipe.recipeYield),
    total_time: recipe.totalTime ?? null,
    cook_time: recipe.cookTime ?? null,
    prep_time: recipe.prepTime ?? null,
    ingredients,
    steps: steps(recipe.recipeInstructions),
    url: url.href,
  });
});
