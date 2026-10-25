// Writes a workout plan with Gemini from the person's goals, injuries and
// recent training, and saves it to workout_plans. Runs as a Supabase Edge
// Function so the Gemini API key never reaches the browser.
//
// Needs the GEMINI_API_KEY secret (from Google AI Studio):
//   supabase secrets set GEMINI_API_KEY=...
// GEMINI_MODEL optionally picks another model, e.g. gemini-2.5-pro on a key
// that still has access to it.
import { createClient } from "npm:@supabase/supabase-js@2.117.3";

// Free AI Studio keys no longer get Gemini 2.5 Pro, so the default is a model
// the free tier still covers.
const DEFAULT_MODEL = "gemini-3.8-flash";
const DAILY_PLAN_LIMIT = 20;
// Edge Functions are cut off at 150 seconds, so give up on Gemini before that
// and send a clear error instead of a dropped connection.
const GEMINI_TIMEOUT_MS = 120_000;
// Gemini often answers 503 "high demand" for a few seconds at a time, so an
// overloaded or failed call is retried after these waits, within the timeout.
const RETRY_DELAYS_MS = [2_000, 5_000];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

const PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "summary", "sessions", "safety_notes"],
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    sessions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["day", "focus", "duration_minutes", "exercises"],
        properties: {
          day: { type: "string" },
          focus: { type: "string" },
          duration_minutes: { type: "integer" },
          exercises: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: [
                "name",
                "sets",
                "reps",
                "weight",
                "rest_seconds",
                "notes",
                "goal",
                "goal_weight",
                "progression",
                "unilateral",
                "superset",
              ],
              properties: {
                name: { type: "string" },
                sets: { type: "integer" },
                reps: { type: "string" },
                weight: { type: ["number", "null"] },
                rest_seconds: { type: "integer" },
                notes: { type: "string" },
                goal: { type: "string" },
                goal_weight: { type: ["number", "null"] },
                progression: { type: "string" },
                unilateral: { type: "boolean" },
                superset: { type: "string" },
              },
            },
          },
        },
      },
    },
    safety_notes: { type: "array", items: { type: "string" } },
  },
};

const SYSTEM = `You are a strength and conditioning coach with a physical therapy background, writing a weekly training plan for one person inside their personal workout app.

Write a plan that fits their goals, the days and minutes they have, and their equipment. Work around their current injuries: favour the rehab and prevention exercises listed for the injured area, keep loads and ranges pain-free, and never prescribe movements that obviously load an injury with high pain. Use their recent training to pick sensible starting loads and to build on what they already do.

When an exercise from their library fits, use its exact name so it links to the instructions they already have. Keep names short and standard otherwise. "reps" can be a count ("8-10"), a time ("30 sec") or a distance. Use "notes" for one short cue, or "" when nothing needs saying. Put warm-ups inside sessions as exercises. Set "unilateral" to true for exercises done one arm or one leg at a time (like single-leg Romanian deadlifts, split squats or one-arm rows); the app then has them do each set as a left side and a right side, so "sets" and "reps" are per side. Library exercises marked unilateral are done that way. Use supersets where they save time or suit the goal, like pairing opposing muscle groups or a strength move with a mobility drill: give each exercise in a superset the same "superset" letter ("A", then "B" for the next superset) and list them one after another; use "" for exercises not in one. The app has them do one set of each in turn with no rest between, then rest after the round, so give the exercises in a superset the same "sets" and use "rest_seconds" for the rest after the round.

Give every exercise a progression toward a goal. "weight" is the load in pounds to use now, based on their recent sets when they have done it (null for bodyweight, timed or cardio work). "goal" is where this exercise should get to over the next 6 to 8 weeks, short and concrete, like "3 × 10 at 65 lb", "3 × 60 sec holds" or "Run 5k without stopping". "goal_weight" is the goal's load in pounds, or null when the goal isn't a weight. "progression" is the one rule for moving toward the goal, like "Add 5 lb once every set reaches 10 reps" or "Add 10 sec per hold each week while pain stays at 3/10 or less". For injured areas, progress by pain response, not by the calendar.

"summary" is two or three sentences on the plan's approach and how to progress it week to week. "safety_notes" lists brief points specific to this person (for example when to stop or see a professional because of an injury); leave it empty if there is nothing specific. You are not diagnosing anything.

Sometimes you are given their current plan and a change they want. Then return the whole plan with that change made, however big or small: swapping exercises, changing days, sets, reps, rest, length, focus or difficulty, or rebuilding it. Keep everything they didn't ask to change as it is, and update "summary" and "safety_notes" if the change affects them.`;

interface Body {
  goals?: string;
  days_per_week?: number;
  minutes_per_session?: number;
  equipment?: string;
  // To revise an existing plan instead of writing a new one.
  plan_id?: string;
  instruction?: string;
}

interface Plan {
  sessions: unknown[];
}

// The parts of a generateContent response this function reads.
interface GeminiResponse {
  error?: { status?: string; message?: string };
  promptFeedback?: { blockReason?: string };
  candidates?: {
    finishReason?: string;
    content?: { parts?: { text?: string; thought?: boolean }[] };
  }[];
  modelVersion?: string;
}

const today = () => new Date().toISOString().slice(0, 10);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return json({ error: "missing_api_key" }, 503);

  // Act as the signed-in person so row-level security applies to every query.
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: {
        headers: { Authorization: req.headers.get("Authorization") ?? "" },
      },
    },
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: "not_signed_in" }, 401);

  // Only invited members get plans, and the check comes before any Gemini call.
  const { data: member, error: memberError } = await supabase.rpc("is_member");
  if (memberError) {
    console.error(memberError);
    return json({ error: "load_failed" }, 500);
  }
  if (!member) return json({ error: "not_a_member" }, 403);

  // Every call saves a plan, so recent plans count toward a daily cap that
  // keeps one account (or a stolen session) from running up the Gemini bill.
  const { count, error: countError } = await supabase
    .from("workout_plans")
    .select("id", { count: "exact", head: true })
    .gte("created_at", new Date(Date.now() - 86_400_000).toISOString());
  if (countError) {
    console.error(countError);
    return json({ error: "load_failed" }, 500);
  }
  if ((count ?? 0) >= DAILY_PLAN_LIMIT)
    return json({ error: "daily_limit" }, 429);

  const body: Body = await req.json().catch(() => ({}));

  let goals: string | undefined;
  let days: number;
  let minutes: number;
  let equipment: string | null;
  let revising: { id: string; plan: Plan; instruction: string } | null = null;
  if (body.plan_id) {
    const instruction = body.instruction?.trim().slice(0, 2000);
    if (!instruction) return json({ error: "invalid_request" }, 400);
    const { data: current, error } = await supabase
      .from("workout_plans")
      .select("id, goals, days_per_week, minutes_per_session, equipment, plan")
      .eq("id", body.plan_id)
      .maybeSingle();
    if (error) {
      console.error(error);
      return json({ error: "load_failed" }, 500);
    }
    if (!current) return json({ error: "plan_not_found" }, 404);
    goals = current.goals;
    days = current.days_per_week;
    minutes = current.minutes_per_session;
    equipment = current.equipment;
    revising = { id: current.id, plan: current.plan, instruction };
  } else {
    goals = body.goals?.trim().slice(0, 2000);
    days = Math.round(Number(body.days_per_week));
    minutes = Math.round(Number(body.minutes_per_session));
    equipment = body.equipment?.trim().slice(0, 500) || null;
  }
  if (!goals || !(days >= 1 && days <= 7) || !(minutes >= 10 && minutes <= 240))
    return json({ error: "invalid_request" }, 400);

  const since = new Date(Date.now() - 28 * 86_400_000).toISOString();
  const [injuriesRes, workoutsRes, exercisesRes] = await Promise.all([
    supabase
      .from("injuries")
      .select(
        "region, side, name, notes, started_on, injury_checkins (checked_on, pain)",
      )
      .is("healed_on", null),
    supabase
      .from("workouts")
      .select(
        "started_at, workout_sets (exercise_name, reps, weight, duration_seconds, side)",
      )
      .not("ended_at", "is", null)
      .gte("started_at", since)
      .order("started_at"),
    supabase
      .from("exercises")
      .select("name, purposes, body_regions, dosage, unilateral"),
  ]);
  const failed = injuriesRes.error ?? workoutsRes.error ?? exercisesRes.error;
  if (failed) {
    console.error(failed);
    return json({ error: "load_failed" }, 500);
  }
  const workouts = workoutsRes.data ?? [];

  const injuries = (injuriesRes.data ?? []).map((i) => {
    const checkins = [...i.injury_checkins].sort((a, b) =>
      a.checked_on.localeCompare(b.checked_on),
    );
    return {
      where: `${i.side === "center" ? "" : `${i.side} `}${i.region.replace("_", " ")}`,
      what: i.name,
      notes: i.notes,
      since: i.started_on,
      pain_now: checkins.at(-1)?.pain ?? null,
      pain_at_start: checkins[0]?.pain ?? null,
    };
  });

  // Best set per exercise over the last four weeks, and how often it was done.
  const recent = new Map<string, { times: number; best: string }>();
  for (const w of workouts)
    for (const s of w.workout_sets) {
      const entry = recent.get(s.exercise_name) ?? { times: 0, best: "" };
      entry.times++;
      entry.best = [
        s.weight !== null && `${s.weight} lb`,
        s.reps !== null && `${s.reps} reps`,
        s.duration_seconds !== null && `${s.duration_seconds} sec`,
        s.side && `${s.side} side`,
      ]
        .filter(Boolean)
        .join(" × ");
      recent.set(s.exercise_name, entry);
    }

  const context = {
    today: today(),
    goals,
    days_per_week: days,
    minutes_per_session: minutes,
    equipment: equipment ?? "not specified",
    current_injuries: injuries,
    workouts_last_4_weeks: workouts.length,
    recent_exercises: [...recent].map(([name, r]) => ({
      name,
      sets_logged: r.times,
      latest_set: r.best,
    })),
    exercise_library: exercisesRes.data ?? [],
    ...(revising && { current_plan: revising.plan }),
  };
  const ask = revising
    ? `Change my plan like this:\n\n${revising.instruction}`
    : "Write my weekly plan.";

  const model = Deno.env.get("GEMINI_MODEL") || DEFAULT_MODEL;
  const startedAt = Date.now();
  const callGemini = () =>
    fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        signal: AbortSignal.timeout(
          GEMINI_TIMEOUT_MS - (Date.now() - startedAt),
        ),
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM }] },
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `Here is everything the app knows about me, as JSON:\n\n${JSON.stringify(context)}\n\n${ask}`,
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseJsonSchema: PLAN_SCHEMA,
            // Gemini 3 thinks hard by default, which pushed a full week's plan
            // past the 150 second limit. Older models don't take this setting.
            ...(model.startsWith("gemini-3") && {
              thinkingConfig: { thinkingLevel: "low" },
            }),
          },
        }),
      },
    ).catch((err: Error) => {
      console.error(model, `${Date.now() - startedAt} ms`, err);
      return err;
    });

  let res: Response;
  let result: GeminiResponse | null;
  for (let attempt = 0; ; attempt++) {
    const sent = await callGemini();
    if (sent instanceof Error)
      return sent.name === "TimeoutError"
        ? json({ error: "ai_timeout" }, 504)
        : json({ error: "ai_failed", detail: sent.message }, 502);
    res = sent;
    result = await res.json().catch(() => null);
    console.log(
      model,
      res.status,
      result?.candidates?.[0]?.finishReason,
      `${Date.now() - startedAt} ms`,
    );
    const delay = RETRY_DELAYS_MS[attempt];
    if (
      (res.status !== 500 && res.status !== 503) ||
      delay === undefined ||
      Date.now() - startedAt + delay > GEMINI_TIMEOUT_MS / 2
    )
      break;
    await new Promise((r) => setTimeout(r, delay));
  }
  if (!res.ok) {
    console.error(res.status, JSON.stringify(result));
    const status = result?.error?.status;
    // A quota of 0 means the key's tier doesn't include this model at all,
    // which Google reports as a 429 rather than a 404.
    if (res.status === 429 && /limit: 0\b/.test(result?.error?.message ?? ""))
      return json({ error: "model_unavailable" }, 503);
    if (res.status === 429) return json({ error: "rate_limited" }, 429);
    if (
      res.status === 401 ||
      res.status === 403 ||
      /API key/i.test(result?.error?.message ?? "")
    )
      return json({ error: "bad_api_key" }, 503);
    if (res.status === 404 || status === "NOT_FOUND")
      return json({ error: "model_unavailable" }, 503);
    const detail =
      `Gemini ${res.status} ${result?.error?.message ?? ""}`.trim();
    if (res.status === 503) return json({ error: "ai_busy", detail }, 503);
    return json({ error: "ai_failed", detail }, 502);
  }

  const candidate = result?.candidates?.[0];
  if (
    result?.promptFeedback?.blockReason ||
    candidate?.finishReason === "SAFETY"
  )
    return json({ error: "declined" }, 422);
  // Skip thought summaries; the plan is in the answer parts.
  const text = (candidate?.content?.parts ?? [])
    .filter((p) => !p.thought && p.text)
    .map((p) => p.text)
    .join("");
  let plan: Plan;
  try {
    plan = JSON.parse(text);
    if (!Array.isArray(plan.sessions)) throw new Error("no sessions");
  } catch {
    console.error("Unparseable plan", candidate?.finishReason);
    return json(
      {
        error: "ai_failed",
        detail: `Unreadable plan from Gemini (finish reason ${candidate?.finishReason})`,
      },
      502,
    );
  }

  const { data, error } = await supabase
    .from("workout_plans")
    .insert({
      goals,
      // A revision can add or drop days.
      days_per_week: revising
        ? Math.min(Math.max(plan.sessions.length, 1), 7)
        : days,
      minutes_per_session: minutes,
      equipment,
      plan,
      model: result?.modelVersion ?? model,
      revised_from: revising?.id ?? null,
      instruction: revising?.instruction ?? null,
    })
    .select(
      "id, goals, days_per_week, minutes_per_session, equipment, plan, revised_from, instruction, created_at",
    )
    .single();
  if (error) {
    console.error(error);
    return json({ error: "save_failed" }, 500);
  }
  return json(data);
});
