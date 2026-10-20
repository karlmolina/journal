import type { Side } from "../../hooks/useInjuries";
import { painFill, placeKey, placeLabel } from "../../functions/bodyRegions";

type Shape =
  | { kind: "rect"; x: number; y: number; w: number; h: number; r: number }
  | { kind: "ellipse"; cx: number; cy: number; rx: number; ry: number };

interface Part {
  region: string;
  // For paired parts, which side of the drawing it's on (viewer's left/right).
  pair?: "a" | "b";
  shape: Shape;
}

const rect = (
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): Shape => ({
  kind: "rect",
  x,
  y,
  w,
  h,
  r,
});
const ellipse = (cx: number, cy: number, rx: number, ry: number): Shape => ({
  kind: "ellipse",
  cx,
  cy,
  rx,
  ry,
});

// Mirror a shape drawn on the viewer's left across the centerline (x = 100).
const mirror = (s: Shape): Shape =>
  s.kind === "rect" ? { ...s, x: 200 - s.x - s.w } : { ...s, cx: 200 - s.cx };

const paired = (region: string, left: Shape): Part[] => [
  { region, pair: "a", shape: left },
  { region, pair: "b", shape: mirror(left) },
];

// Not clickable: just there so the figure reads as a body.
const DECOR: Shape[] = [
  ellipse(100, 30, 19, 23),
  rect(47, 90, 17, 44, 8),
  mirror(rect(47, 90, 17, 44, 8)),
  rect(43, 152, 15, 40, 7),
  mirror(rect(43, 152, 15, 40, 7)),
];

const limbs = (upperLeg: string, lowerLeg: string): Part[] => [
  ...paired("shoulder", ellipse(62, 80, 14, 11)),
  ...paired("elbow", ellipse(53, 143, 10, 10)),
  ...paired("wrist_hand", ellipse(50, 205, 10, 14)),
  ...paired(upperLeg, rect(77, 196, 21, 60, 10)),
  ...paired("knee", ellipse(88, 267, 12, 11)),
  ...paired(lowerLeg, rect(79, 280, 18, 60, 9)),
  ...paired("ankle_foot", ellipse(88, 354, 12, 10)),
];

const FRONT: Part[] = [
  { region: "neck", shape: rect(90, 51, 20, 16, 6) },
  { region: "chest", shape: rect(76, 70, 48, 44, 14) },
  { region: "core", shape: rect(79, 117, 42, 48, 12) },
  ...paired("hip", rect(78, 168, 21, 25, 10)),
  ...limbs("quad", "calf"),
];

const BACK: Part[] = [
  { region: "neck", shape: rect(90, 51, 20, 16, 6) },
  { region: "upper_back", shape: rect(76, 70, 48, 44, 14) },
  { region: "lower_back", shape: rect(79, 117, 42, 48, 12) },
  ...paired("glute", rect(78, 168, 21, 25, 10)),
  ...limbs("hamstring", "calf"),
];

// Facing you, the person's right is on your left; from behind, on your right.
const sideOf = (part: Part, view: "front" | "back"): Side =>
  !part.pair
    ? "center"
    : (part.pair === "a") === (view === "front")
      ? "right"
      : "left";

function ShapeEl({ shape, className }: { shape: Shape; className: string }) {
  return shape.kind === "rect" ? (
    <rect
      x={shape.x}
      y={shape.y}
      width={shape.w}
      height={shape.h}
      rx={shape.r}
      className={className}
    />
  ) : (
    <ellipse
      cx={shape.cx}
      cy={shape.cy}
      rx={shape.rx}
      ry={shape.ry}
      className={className}
    />
  );
}

interface FigureProps {
  view: "front" | "back";
  // Latest pain per place with an active injury (null = no check-in).
  marked: Map<string, number | null>;
  selected: string | null;
  onSelect: (region: string, side: Side) => void;
}

function Figure({ view, marked, selected, onSelect }: FigureProps) {
  const parts = view === "front" ? FRONT : BACK;
  return (
    <figure className="flex-1 flex flex-col items-center">
      <svg
        viewBox="30 0 140 372"
        className="w-full max-w-44"
        role="group"
        aria-label={`Body, ${view}`}
      >
        {DECOR.map((s, i) => (
          <ShapeEl key={i} shape={s} className="fill-base-content/8" />
        ))}
        {parts.map((part) => {
          const side = sideOf(part, view);
          const key = placeKey(part.region, side);
          const label = placeLabel(part.region, side);
          const isSelected = selected === key;
          const fill = marked.has(key)
            ? painFill(marked.get(key)!)
            : "fill-base-content/15 hover:fill-primary/40";
          return (
            <g
              key={`${key}-${part.pair ?? ""}`}
              role="button"
              tabIndex={0}
              aria-label={label}
              aria-pressed={isSelected}
              className="cursor-pointer outline-none [&:focus-visible>*]:stroke-primary"
              onClick={() => onSelect(part.region, side)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(part.region, side);
                }
              }}
            >
              <title>{label}</title>
              <ShapeEl
                shape={part.shape}
                className={`${fill} transition-colors ${
                  isSelected
                    ? "stroke-base-content stroke-[2.5]"
                    : "stroke-[2.5]"
                }`}
              />
            </g>
          );
        })}
      </svg>
      <figcaption className="text-xs font-bold tracking-wide text-base-content/55">
        {view === "front" ? "Front" : "Back"}
      </figcaption>
    </figure>
  );
}

interface BodyMapProps {
  marked: Map<string, number | null>;
  selected: string | null;
  onSelect: (region: string, side: Side) => void;
}

export default function BodyMap(props: BodyMapProps) {
  return (
    <div className="flex gap-2">
      <Figure view="front" {...props} />
      <Figure view="back" {...props} />
    </div>
  );
}
