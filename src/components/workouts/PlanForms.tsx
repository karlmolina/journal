import React, { useState } from "react";
import Chip from "../Chip";
import { CopyPrompt, PasteReply } from "../ChatbotPrompt";
import type { PlanRequest, WorkoutPlan } from "../../hooks/useWorkoutPlans";
import { parsePlanReply } from "../../functions/planPrompt";
import { cardClass, fieldClass } from "../styles";

const DAYS = [2, 3, 4, 5, 6];
const MINUTES = [20, 30, 45, 60, 90];

const label =
  "text-xs font-semibold tracking-wide text-base-content/55 dark:text-base-content/75";

const parsePlan = (reply: string) => {
  const result = parsePlanReply(reply);
  return result.ok ? { ok: true as const, value: result.plan } : result;
};

const Step = ({ n, children }: { n: number; children: React.ReactNode }) => (
  <p className={label}>
    {n}. {children}
  </p>
);

export function PlanForm({
  initial,
  saving,
  buildPrompt,
  onSavePreferences,
  onImport,
  onCancel,
}: {
  initial: PlanRequest;
  saving: boolean;
  buildPrompt: (request: PlanRequest) => string;
  onSavePreferences: (request: PlanRequest) => void;
  onImport: (
    plan: WorkoutPlan["plan"],
    request: PlanRequest,
  ) => Promise<boolean>;
  onCancel?: () => void;
}) {
  const [goals, setGoals] = useState(initial.goals);
  const [days, setDays] = useState(initial.days_per_week);
  const [minutes, setMinutes] = useState(initial.minutes_per_session);
  const [equipment, setEquipment] = useState(initial.equipment);

  const request = (): PlanRequest => ({
    goals: goals.trim(),
    days_per_week: days,
    minutes_per_session: minutes,
    equipment: equipment.trim(),
  });

  return (
    <div className={`${cardClass} flex flex-col gap-3`}>
      <div>
        <h2 className="font-bold">Plan my training</h2>
        <p className="text-sm font-medium text-base-content/55 dark:text-base-content/75">
          Copy a prompt with your goals, injuries and recent workouts into any
          chatbot, then paste its reply back here.
        </p>
      </div>
      <textarea
        className={`${fieldClass} resize-none`}
        rows={3}
        placeholder="Your goals, like: Get back to running 5k without my knee hurting, and build some upper body strength."
        value={goals}
        onChange={(e) => setGoals(e.target.value)}
        onBlur={() => onSavePreferences(request())}
        aria-label="Goals"
      />
      <div className="flex flex-col gap-1.5">
        <span className={label}>Days a week</span>
        <div className="flex flex-wrap gap-1.5">
          {DAYS.map((d) => (
            <Chip key={d} selected={days === d} onClick={() => setDays(d)}>
              {d}
            </Chip>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className={label}>Minutes per workout</span>
        <div className="flex flex-wrap gap-1.5">
          {MINUTES.map((m) => (
            <Chip
              key={m}
              selected={minutes === m}
              onClick={() => setMinutes(m)}
            >
              {m}
            </Chip>
          ))}
        </div>
      </div>
      <textarea
        className={`${fieldClass} resize-none`}
        rows={2}
        placeholder="Equipment, like dumbbells and a band (optional)"
        value={equipment}
        onChange={(e) => setEquipment(e.target.value)}
        onBlur={() => onSavePreferences(request())}
        aria-label="Equipment"
      />
      <Step n={1}>
        Copy the prompt into ChatGPT, Claude, Gemini or another chatbot
      </Step>
      <CopyPrompt
        disabled={!goals.trim()}
        getPrompt={() => {
          onSavePreferences(request());
          return buildPrompt(request());
        }}
      />
      <Step n={2}>Paste its reply</Step>
      <PasteReply
        saving={saving}
        parse={parsePlan}
        importLabel="Import plan"
        onImport={(plan) => {
          onSavePreferences(request());
          return onImport(plan, request());
        }}
      />
      {onCancel && (
        <button
          type="button"
          className="btn btn-ghost rounded-full font-bold"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </button>
      )}
    </div>
  );
}

export function ReviseForm({
  saving,
  buildPrompt,
  onImport,
}: {
  saving: boolean;
  buildPrompt: (instruction: string) => string;
  onImport: (
    plan: WorkoutPlan["plan"],
    instruction: string,
  ) => Promise<boolean>;
}) {
  const [instruction, setInstruction] = useState("");

  return (
    <div className={`${cardClass} flex flex-col gap-3`}>
      <div>
        <h2 className="font-bold">Change this plan</h2>
        <p className="text-sm font-medium text-base-content/55 dark:text-base-content/75">
          Say what to change. The prompt includes this plan, so the chatbot
          keeps the rest, and your current version stays under earlier plans.
        </p>
      </div>
      <textarea
        className={`${fieldClass} resize-none`}
        rows={3}
        placeholder="Like: Swap running for cycling, make Day 3 shorter, and add more core work."
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        aria-label="What to change"
      />
      <Step n={1}>Copy the prompt into a chatbot</Step>
      <CopyPrompt
        disabled={!instruction.trim()}
        getPrompt={() => buildPrompt(instruction.trim())}
      />
      <Step n={2}>Paste its reply</Step>
      <PasteReply
        saving={saving}
        parse={parsePlan}
        importLabel="Import plan"
        onImport={async (plan) => {
          const ok = await onImport(
            plan,
            instruction.trim() || "Changed in a chatbot",
          );
          if (ok) setInstruction("");
          return ok;
        }}
      />
    </div>
  );
}
