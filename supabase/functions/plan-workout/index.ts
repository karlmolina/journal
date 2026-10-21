// Writes a workout plan with Claude from the person's goals, injuries and
// recent training, and saves it to workout_plans. Runs as a Supabase Edge
// Function so the Anthropic API key never reaches the browser.
//
// Needs the ANTHROPIC_API_KEY secret:
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
import Anthropic from "npm:@anthropic-ai/sdk@0.136.0";
import { createClient } from "npm:@supabase/supabase-js@2.117.3";

const MODEL = "claude-opus-5-5";

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
              required: ["name", "sets", "reps", "rest_seconds", "notes"],
              properties: {
                name: { type: "string" },
                sets: { type: "integer" },
                reps: { type: "string" },
                rest_seconds: { type: "integer" },
                notes: { type: "string" },
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

When an exercise from their library fits, use its exact name so it links to the instructions they already have. Keep names short and standard otherwise. "reps" can be a count ("8-10"), a time ("30 sec") or a distance. Use "notes" for one short cue, load guidance, or "" when nothing needs saying. Put warm-ups inside sessions as exercises.

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

const today = () => new Date().toISOString().slice(0, 10);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
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
        "started_at, workout_sets (exercise_name, reps, weight, duration_seconds)",
      )
      .not("ended_at", "is", null)
      .gte("started_at", since)
      .order("started_at"),
    supabase.from("exercises").select("name, purposes, body_regions, dosage"),
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

  const client = new Anthropic({ apiKey });
  let message;
  try {
    message = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      output_config: {
        effort: "medium",
        format: { type: "json_schema", schema: PLAN_SCHEMA },
      },
      // If the model declines, let the API retry on a fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Here is everything the app knows about me, as JSON:\n\n${JSON.stringify(context, null, 2)}\n\n${ask}`,
        },
      ],
    });
  } catch (err) {
    console.error(err);
    if (err instanceof Anthropic.AuthenticationError)
      return json({ error: "bad_api_key" }, 503);
    if (err instanceof Anthropic.RateLimitError)
      return json({ error: "rate_limited" }, 429);
    return json({ error: "claude_failed" }, 502);
  }

  if (message.stop_reason === "refusal")
    return json({ error: "declined" }, 422);
  const text = message.content.find((b) => b.type === "text");
  let plan: Plan;
  try {
    plan = JSON.parse(text && "text" in text ? text.text : "");
  } catch {
    console.error("Unparseable plan", message.stop_reason);
    return json({ error: "claude_failed" }, 502);
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
      model: message.model,
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
