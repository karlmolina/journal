// The prompt the Plan tab copies for any chatbot, and the checks its JSON
// reply has to pass before it's saved as a plan.
import type { Exercise } from "../hooks/useExercises";
import { today, type Injury } from "../hooks/useInjuries";
import type {
  PlannedExercise,
  PlannedSession,
  PlanRequest,
  WorkoutPlan,
} from "../hooks/useWorkoutPlans";
import type { Workout } from "../hooks/useWorkouts";

// Everything the app knows that a plan should take into account.
export interface PlanContext {
  today: string;
  goals: string;
  days_per_week: number;
  minutes_per_session: number;
  equipment: string;
  current_injuries: unknown[];
  workouts_last_4_weeks: number;
  recent_exercises: unknown[];
  exercise_library: unknown[];
  current_plan?: WorkoutPlan["plan"];
}

const FOUR_WEEKS_MS = 28 * 86_400_000;

export function buildPlanContext({
  request,
  injuries,
  workouts,
  exercises,
  currentPlan,
}: {
  request: PlanRequest;
  injuries: Injury[];
  // Finished workouts, any order.
  workouts: Workout[];
  exercises: Exercise[];
  currentPlan?: WorkoutPlan["plan"];
}): PlanContext {
  const since = Date.now() - FOUR_WEEKS_MS;
  const recentWorkouts = workouts
    .filter((w) => w.ended_at && Date.parse(w.started_at) >= since)
    .sort((a, b) => a.started_at.localeCompare(b.started_at));

  // Latest set per exercise over the last four weeks, and how often it was done.
  const recent = new Map<string, { times: number; latest: string }>();
  for (const w of recentWorkouts)
    for (const s of [...w.workout_sets].sort((a, b) =>
      a.created_at.localeCompare(b.created_at),
    )) {
      const entry = recent.get(s.exercise_name) ?? { times: 0, latest: "" };
      entry.times++;
      entry.latest = [
        s.weight !== null && `${s.weight} lb`,
        s.reps !== null && `${s.reps} reps`,
        s.duration_seconds !== null && `${s.duration_seconds} sec`,
        s.side && `${s.side} side`,
      ]
        .filter(Boolean)
        .join(" × ");
      recent.set(s.exercise_name, entry);
    }

  return {
    today: today(),
    goals: request.goals,
    days_per_week: request.days_per_week,
    minutes_per_session: request.minutes_per_session,
    equipment: request.equipment || "not specified",
    current_injuries: injuries
      .filter((i) => !i.healed_on)
      .map((i) => ({
        where: `${i.side === "center" ? "" : `${i.side} `}${i.region.replace("_", " ")}`,
        what: i.name,
        notes: i.notes,
        since: i.started_on,
        pain_now: i.injury_checkins.at(-1)?.pain ?? null,
        pain_at_start: i.injury_checkins[0]?.pain ?? null,
      })),
    workouts_last_4_weeks: recentWorkouts.length,
    recent_exercises: [...recent].map(([name, r]) => ({
      name,
      sets_logged: r.times,
      latest_set: r.latest,
    })),
    exercise_library: exercises.map((e) => ({
      name: e.name,
      purposes: e.purposes,
      body_regions: e.body_regions,
      dosage: e.dosage,
      unilateral: e.unilateral,
    })),
    ...(currentPlan && { current_plan: currentPlan }),
  };
}

export const PLAN_SCHEMA = {
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

const COACH = `You are a strength and conditioning coach with a physical therapy background, writing a weekly training plan for one person. Your answer is imported into their personal workout app.

Write a plan that fits their goals, the days and minutes they have, and their equipment. Work around their current injuries: favour the rehab and prevention exercises listed for the injured area, keep loads and ranges pain-free, and never prescribe movements that obviously load an injury with high pain. Use their recent training to pick sensible starting loads and to build on what they already do.

When an exercise from their library fits, use its exact name so it links to the instructions they already have. Keep names short and standard otherwise. "reps" can be a count ("8-10"), a time ("30 sec") or a distance. Use "notes" for one short cue, or "" when nothing needs saying. Put warm-ups inside sessions as exercises. Set "unilateral" to true for exercises done one arm or one leg at a time (like single-leg Romanian deadlifts, split squats or one-arm rows); the app then has them do each set as a left side and a right side, so "sets" and "reps" are per side. Library exercises marked unilateral are done that way. Use supersets where they save time or suit the goal: two exercises (like opposing muscle groups, or a strength move with a mobility drill) or more (a circuit or giant set of three to six exercises, like a conditioning finisher). Give each exercise in a superset the same "superset" letter ("A", then "B" for the next superset) and list them one after another; use "" for exercises not in one. The app has them do one set of each in turn with no rest between, then rest after the round, so give the exercises in a superset the same "sets" and use "rest_seconds" for the rest after the round.

Give every exercise a progression toward a goal. "weight" is the load in pounds to use now, based on their recent sets when they have done it (null for bodyweight, timed or cardio work). "goal" is where this exercise should get to over the next 6 to 8 weeks, short and concrete, like "3 × 10 at 65 lb", "3 × 60 sec holds" or "Run 5k without stopping". "goal_weight" is the goal's load in pounds, or null when the goal isn't a weight. "progression" is the one rule for moving toward the goal, like "Add 5 lb once every set reaches 10 reps" or "Add 10 sec per hold each week while pain stays at 3/10 or less". For injured areas, progress by pain response, not by the calendar.

"summary" is two or three sentences on the plan's approach and how to progress it week to week. "safety_notes" lists brief points specific to this person (for example when to stop or see a professional because of an injury); leave it empty if there is nothing specific. You are not diagnosing anything.`;

const REVISING = `You are given their current plan and a change they want. Return the whole plan with that change made, however big or small: swapping exercises, changing days, sets, reps, rest, length, focus or difficulty, or rebuilding it. Keep everything they didn't ask to change as it is, and update "summary" and "safety_notes" if the change affects them.`;

const FORMAT = `Reply with only the plan as one JSON object in a \`\`\`json code block, with no other text. It must match this JSON Schema exactly: every listed field present, the types shown, and no extra fields.`;

export function buildPlanPrompt(context: PlanContext, instruction?: string) {
  const ask = instruction
    ? `Change my plan like this:\n\n${instruction}`
    : "Write my weekly plan.";
  return [
    COACH,
    ...(instruction ? [REVISING] : []),
    FORMAT,
    "```json\n" + JSON.stringify(PLAN_SCHEMA, null, 2) + "\n```",
    "Here is everything my workout app knows about me, as JSON:",
    "```json\n" + JSON.stringify(context, null, 2) + "\n```",
    ask,
  ].join("\n\n");
}

export type ImportResult =
  | { ok: true; plan: WorkoutPlan["plan"] }
  | { ok: false; errors: string[] };

// Chatbots wrap JSON in ``` fences or add a sentence around it, so this finds
// the object: inside a fence if there is one, otherwise from the first "{"
// to the last "}".
export function extractJson(text: string): string | null {
  const fenced = [...text.matchAll(/```(?:json|JSON)?\s*\n?([\s\S]*?)```/g)]
    .map((m) => m[1].trim())
    .find((body) => body.startsWith("{"));
  const source = fenced ?? text;
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start < 0) return null;
  // No closing brace usually means the reply was cut off; parsing what's
  // there reports that.
  return end > start ? source.slice(start, end + 1) : source.slice(start);
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

// Checks a pasted reply against PLAN_SCHEMA. Small slips a person couldn't
// fix by hand anyway (a number for reps, a numeric string for sets, a missing
// optional field) are corrected; anything that would break the plan is listed.
export function parsePlanReply(text: string): ImportResult {
  if (!text.trim()) return { ok: false, errors: ["Paste the reply first."] };
  const json = extractJson(text);
  if (!json)
    return {
      ok: false,
      errors: [
        "Couldn't find a JSON object in that. Paste the chatbot's whole reply, including the part in { }.",
      ],
    };
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (err) {
    return {
      ok: false,
      errors: [
        `That JSON doesn't parse (${(err as Error).message}). It may have been cut off; ask the chatbot to send the whole plan again.`,
      ],
    };
  }
  // Some bots nest the answer, like { "plan": { ... } }.
  if (isObject(raw) && !("sessions" in raw) && isObject(raw.plan))
    raw = raw.plan;
  if (!isObject(raw))
    return { ok: false, errors: ["The reply should be one JSON object."] };

  const errors: string[] = [];
  const text_ = (v: unknown) =>
    typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : null;
  const whole = (v: unknown) => {
    const n = typeof v === "string" && v.trim() ? Number(v) : v;
    return typeof n === "number" && Number.isFinite(n) ? Math.round(n) : null;
  };
  const weight = (v: unknown) => {
    if (v === null || v === undefined || v === "") return null;
    const n = typeof v === "string" ? parseFloat(v) : v;
    return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null;
  };

  const title = text_(raw.title);
  if (!title) errors.push("“title” is missing.");
  const summary = text_(raw.summary) ?? "";
  const safety = Array.isArray(raw.safety_notes)
    ? raw.safety_notes.map(text_).filter((n): n is string => !!n)
    : [];

  const sessions: PlannedSession[] = [];
  if (!Array.isArray(raw.sessions) || raw.sessions.length === 0)
    errors.push("“sessions” should be a list with at least one workout.");
  else
    raw.sessions.forEach((s: unknown, i: number) => {
      const where = `Session ${i + 1}`;
      if (!isObject(s)) {
        errors.push(`${where} isn't an object.`);
        return;
      }
      const day = text_(s.day);
      const focus = text_(s.focus);
      const minutes = whole(s.duration_minutes);
      if (!day) errors.push(`${where}: “day” is missing.`);
      if (!focus) errors.push(`${where}: “focus” is missing.`);
      if (minutes === null || minutes <= 0)
        errors.push(
          `${where}: “duration_minutes” should be a number of minutes.`,
        );
      const exercises: PlannedExercise[] = [];
      if (!Array.isArray(s.exercises) || s.exercises.length === 0)
        errors.push(
          `${where}: “exercises” should be a list with at least one exercise.`,
        );
      else
        s.exercises.forEach((e: unknown, j: number) => {
          const at = `${where}, exercise ${j + 1}`;
          if (!isObject(e)) {
            errors.push(`${at} isn't an object.`);
            return;
          }
          const name = text_(e.name);
          const sets = whole(e.sets);
          const reps = text_(e.reps);
          const rest = e.rest_seconds == null ? 0 : whole(e.rest_seconds);
          const label = name ? `${at} (${name})` : at;
          if (!name) errors.push(`${at}: “name” is missing.`);
          if (sets === null || sets < 1)
            errors.push(
              `${label}: “sets” should be a whole number, 1 or more.`,
            );
          if (!reps) errors.push(`${label}: “reps” is missing.`);
          if (rest === null || rest < 0)
            errors.push(
              `${label}: “rest_seconds” should be a number of seconds.`,
            );
          if (
            e.unilateral !== undefined &&
            e.unilateral !== null &&
            typeof e.unilateral !== "boolean"
          )
            errors.push(`${label}: “unilateral” should be true or false.`);
          exercises.push({
            name: name ?? "",
            sets: sets ?? 1,
            reps: reps ?? "",
            rest_seconds: rest ?? 0,
            notes: text_(e.notes) ?? "",
            weight: weight(e.weight),
            goal: text_(e.goal) ?? "",
            goal_weight: weight(e.goal_weight),
            progression: text_(e.progression) ?? "",
            unilateral: e.unilateral === true,
            superset: (text_(e.superset) ?? "").toUpperCase(),
          });
        });
      sessions.push({
        day: day ?? "",
        focus: focus ?? "",
        duration_minutes: minutes ?? 0,
        exercises,
      });
    });

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    plan: { title: title!, summary, sessions, safety_notes: safety },
  };
}
