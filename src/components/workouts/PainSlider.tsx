import { painText } from "../../functions/bodyRegions";

const WORDS = [
  "No pain",
  "Barely there",
  "Mild",
  "Mild",
  "Moderate",
  "Moderate",
  "Distracting",
  "Strong",
  "Severe",
  "Severe",
  "Worst possible",
];

interface PainSliderProps {
  value: number;
  onChange: (pain: number) => void;
}

export default function PainSlider({ value, onChange }: PainSliderProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-semibold tracking-wide text-base-content/55">
          Pain today
        </span>
        <span className={`font-bold tabular-nums ${painText(value)}`}>
          {value}/10 · {WORDS[value]}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={10}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="range range-sm range-primary w-full"
        aria-label="Pain from 0 to 10"
      />
    </div>
  );
}
