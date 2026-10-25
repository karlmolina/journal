// The prompt the Plan tab copies for any chatbot, and the reader for the
// chatbot's reply. Both are short lines of text rather than JSON, because
// phone clipboards cut off long text: one exercise is one line like
//   [A][1] Split squat | 3x8 | 25 | 60 | 3x12 at 40 lb | Add 2 reps a week | Knee over toes
import type { Exercise } from "../hooks/useExercises";
import { today, type Injury } from "../hooks/useInjuries";
import type {
  PlannedExercise,
  PlannedSession,
  PlanRequest,
  WorkoutPlan,
} from "../hooks/useWorkoutPlans";
import type { Workout } from "../hooks/useWorkouts";
import { libraryRegion, regionLabel } from "./bodyRegions";

type Plan = WorkoutPlan["plan"];

const FOUR_WEEKS_MS = 28 * 86_400_000;

const COACH = `You're a strength coach with a physical therapy background. Write a weekly training plan for me; I'll paste your reply into my workout app.

Fit my goals, days, minutes and equipment. Work around my injuries: favour the rehab exercises listed for them, keep loads and ranges pain-free, and never load an injury with high pain. Use my recent sets for starting loads. Use exact names from my library when one fits, otherwise short standard names. Put warm-ups in the sessions. Use supersets where they save time or suit the goal (2 exercises, or a circuit of 3-6); the app does one set of each in turn, then rests, so give them the same sets and rest. Every exercise gets a goal for the next 6-8 weeks and one progression rule; progress injured areas by pain, not the calendar. Don't diagnose anything.`;

const REVISING = `My current plan is below in the same format. Make the change I ask for, however big or small, keep everything else as it is, and reply with the whole plan.`;

const FORMAT = `Reply with only one code block in exactly this format, nothing else:

# Plan title
> Two or three sentences on the approach and how to progress week to week.
! A safety note specific to me (one line each, or none)
## Day | Focus | Minutes
Name | SetsxReps | Weight | Rest | Goal | Progression | Cue

One "##" line per session, then one line per exercise:
- SetsxReps: "3x8-10", "3x30 sec" or "1x5 km". For one-side exercises it's per side.
- Weight: pounds to use now, or "-" for bodyweight, timed or cardio work.
- Rest: seconds after each set (after the round in a superset).
- Goal: short and concrete, like "3x10 at 65 lb" or "Run 5k without stopping".
- Progression: one rule, like "Add 5 lb once every set hits 10 reps".
- Cue: one short tip, or leave it empty.
- Start the name with [A], [B]... for exercises in the same superset (list them together), and with [1] for exercises done one arm or leg at a time.

Example:
## Mon | Lower body | 45
Goblet squat | 3x8-10 | 35 | 90 | 3x10 at 50 lb | Add 5 lb when all sets hit 10 | Sit between heels
[A][1] Split squat | 2x8 | - | 0 | 2x12 | Add 2 reps a week |
[A] Dead bug | 2x10 | - | 60 | 3x12 slow | Add 2 reps a week | Low back down`;

const lb = (n: number | null | undefined) => (n == null ? "-" : String(n));

// One exercise as a reply line, so a revision starts from the same format.
function exerciseLine(e: PlannedExercise) {
  const tags =
    (e.superset?.trim() ? `[${e.superset.trim().toUpperCase()}]` : "") +
    (e.unilateral ? "[1]" : "");
  return [
    `${tags ? `${tags} ` : ""}${e.name}`,
    `${e.sets}x${e.reps}`,
    lb(e.weight),
    e.rest_seconds,
    e.goal ?? "",
    e.progression ?? "",
    e.notes ?? "",
  ]
    .join(" | ")
    .trimEnd();
}

export function planToText(plan: Plan) {
  return [
    `# ${plan.title}`,
    ...(plan.summary ? [`> ${plan.summary}`] : []),
    ...plan.safety_notes.map((n) => `! ${n}`),
    ...plan.sessions.flatMap((s) => [
      `## ${s.day} | ${s.focus} | ${s.duration_minutes}`,
      ...s.exercises.map(exerciseLine),
    ]),
  ].join("\n");
}

// Short "set" text, like "95 lb x 8 (left)".
function setText(s: Workout["workout_sets"][number]) {
  const parts = [
    s.weight !== null && `${s.weight} lb`,
    s.reps !== null && `${s.reps}`,
    s.duration_seconds !== null && `${s.duration_seconds} sec`,
  ].filter(Boolean);
  return parts.join(" x ") + (s.side ? ` (${s.side})` : "");
}

export function buildPlanPrompt({
  request,
  injuries,
  workouts,
  exercises,
  currentPlan,
  instruction,
}: {
  request: PlanRequest;
  injuries: Injury[];
  // Finished workouts, any order.
  workouts: Workout[];
  exercises: Exercise[];
  // With an instruction, to revise this plan instead of writing a new one.
  currentPlan?: Plan;
  instruction?: string;
}) {
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
      entry.latest = setText(s);
      recent.set(s.exercise_name, entry);
    }

  const current = injuries.filter((i) => !i.healed_on);
  const injured = new Set(current.map((i) => libraryRegion(i.region)));
  // Rehab and prevention moves for injured areas, then everything else by
  // name only, which keeps the library to a few short lines.
  const rehab = exercises.filter(
    (e) => e.purposes.length > 0 && e.body_regions.some((r) => injured.has(r)),
  );
  const name = (e: Exercise) => (e.unilateral ? `[1] ${e.name}` : e.name);

  const about = [
    `Today: ${today()}`,
    `Goals: ${request.goals}`,
    `Schedule: ${request.days_per_week} days a week, ${request.minutes_per_session} min each`,
    `Equipment: ${request.equipment || "not specified"}`,
    current.length > 0
      ? `Injuries:\n${current
          .map((i) => {
            const pain = i.injury_checkins;
            return `- ${i.side === "center" ? "" : `${i.side} `}${regionLabel(i.region).toLowerCase()}${i.name ? `, ${i.name}` : ""}, since ${i.started_on}, pain ${pain[0]?.pain ?? "?"}/10 at start, ${pain.at(-1)?.pain ?? "?"}/10 now${i.notes ? ` (${i.notes})` : ""}`;
          })
          .join("\n")}`
      : "Injuries: none",
    recent.size > 0
      ? `Last 4 weeks: ${recentWorkouts.length} workouts. Sets logged, latest set:\n${[
          ...recent,
        ]
          .map(([n, r]) => `- ${n}: ${r.times}, ${r.latest}`)
          .join("\n")}`
      : "Last 4 weeks: no workouts logged",
    ...(rehab.length > 0
      ? [
          `Rehab for my injured areas: ${rehab
            .map((e) => (e.dosage ? `${name(e)} (${e.dosage})` : name(e)))
            .join("; ")}`,
        ]
      : []),
    `My exercise library ([1] = one side at a time): ${exercises
      .filter((e) => !rehab.includes(e))
      .map(name)
      .join("; ")}`,
  ].join("\n");

  return [
    COACH,
    FORMAT,
    `About me:\n${about}`,
    ...(currentPlan && instruction
      ? [`${REVISING}\n\n${planToText(currentPlan)}`, `Change: ${instruction}`]
      : ["Write my weekly plan."]),
  ].join("\n\n");
}

export type ImportResult =
  | { ok: true; plan: Plan }
  | { ok: false; errors: string[] };

// The plan inside the reply: the code block that has "##" sessions, or the
// whole reply when the bot left out the fences.
function planText(text: string) {
  const blocks = [...text.matchAll(/```[^\n]*\n?([\s\S]*?)(?:```|$)/g)].map(
    (m) => m[1],
  );
  return blocks.find((b) => /^\s*##/m.test(b)) ?? text;
}

// Strips list markers and markdown emphasis bots like to add.
const clean = (line: string) =>
  line
    .trim()
    .replace(/^(?:[-*•]|\d+[.)])\s+/, "")
    .replace(/\*\*|__/g, "")
    .trim();

const blank = (v: string | undefined) =>
  !v || /^(-|–|—|n\/a|none|bw|bodyweight)$/i.test(v.trim());

// Reads a reply in the format above. Lines that aren't part of the format
// (a bot's "Here's your plan!") are skipped; anything that would break the
// plan is listed so it can be pasted back to the bot.
export function parsePlanReply(reply: string): ImportResult {
  if (!reply.trim()) return { ok: false, errors: ["Paste the reply first."] };
  const lines = planText(reply).split(/\r?\n/);

  let title = "";
  const summary: string[] = [];
  const safety: string[] = [];
  const sessions: PlannedSession[] = [];
  const errors: string[] = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (/^##(?!#)/.test(line)) {
      const where = `Session ${sessions.length + 1}`;
      const [day, focus, minutes] = line
        .replace(/^##\s*/, "")
        .split("|")
        .map((p) => p.trim());
      const mins = parseInt(minutes ?? "", 10);
      if (!day) errors.push(`${where}: the day is missing.`);
      if (!focus) errors.push(`${where} (${day}): the focus is missing.`);
      if (!(mins > 0))
        errors.push(`${where} (${day}): minutes should be a number.`);
      sessions.push({
        day: day ?? "",
        focus: focus ?? "",
        duration_minutes: mins > 0 ? mins : 0,
        exercises: [],
      });
    } else if (/^#(?!#)/.test(line)) {
      title ||= clean(line.replace(/^#\s*/, ""));
    } else if (line.startsWith(">")) {
      summary.push(line.replace(/^>\s*/, ""));
    } else if (line.startsWith("!")) {
      const note = line.replace(/^!\s*/, "");
      if (note) safety.push(note);
    } else if (sessions.length > 0 && line.includes("|")) {
      const session = sessions[sessions.length - 1];
      const fields = clean(line)
        .split("|")
        .map((p) => p.trim());
      let name = fields[0] ?? "";
      let superset = "";
      let unilateral = false;
      for (let tag; (tag = name.match(/^\[([^\]]*)\]\s*/)); ) {
        const t = tag[1].trim().toUpperCase();
        if (t === "1") unilateral = true;
        else if (/^[A-Z]$/.test(t)) superset = t;
        name = name.slice(tag[0].length);
      }
      const at = `${session.day || `Session ${sessions.length}`}, ${name || `exercise ${session.exercises.length + 1}`}`;
      const setsReps = (fields[1] ?? "").match(/^(\d+)\s*[x×]\s*(.+)$/i);
      const weight = blank(fields[2]) ? null : parseFloat(fields[2]);
      const rest = blank(fields[3]) ? 0 : parseInt(fields[3], 10);
      const goal = fields[4] ?? "";
      const goalWeight = goal.match(/(\d+(?:\.\d+)?)\s*(?:lb|lbs|pounds)\b/i);
      if (!name) errors.push(`${at}: the name is missing.`);
      if (!setsReps || Number(setsReps[1]) < 1)
        errors.push(`${at}: sets and reps should look like "3x8-10".`);
      if (weight !== null && !(weight > 0))
        errors.push(`${at}: weight should be a number of pounds or "-".`);
      if (!(rest >= 0)) errors.push(`${at}: rest should be seconds.`);
      session.exercises.push({
        name,
        sets: setsReps ? Number(setsReps[1]) : 1,
        reps: setsReps ? setsReps[2].trim() : "",
        weight: weight !== null && weight > 0 ? weight : null,
        rest_seconds: rest >= 0 ? rest : 0,
        goal,
        goal_weight: goalWeight ? Number(goalWeight[1]) : null,
        progression: fields[5] ?? "",
        notes: fields.slice(6).join(" | "),
        unilateral,
        superset,
      });
    }
  }

  if (sessions.length === 0)
    return {
      ok: false,
      errors: [
        /^\s*[{[]/.test(planText(reply))
          ? "That's JSON. Copy a new prompt and send it, so the bot answers in the app's format."
          : "Couldn't find any sessions (lines starting with \"##\"). Paste the bot's whole reply.",
      ],
    };
  if (!title) errors.unshift('The title line (starting with "#") is missing.');
  for (const s of sessions)
    if (s.exercises.length === 0)
      errors.push(
        `${s.day || "A session"} has no exercises. The reply may have been cut off.`,
      );

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    plan: {
      title,
      summary: summary.join(" "),
      sessions,
      safety_notes: safety,
    },
  };
}
