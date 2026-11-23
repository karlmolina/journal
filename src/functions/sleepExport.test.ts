import { describe, expect, it } from "vitest";
import type { SleepNight } from "../hooks/useSleep";
import { exportLine, sleepExport } from "./sleepExport";

const night = (over: Partial<SleepNight>): SleepNight => ({
  id: "1",
  night: "2026-11-18",
  quality: 7,
  bedtime: 23 * 60,
  woke_at: 7 * 60,
  fall_asleep_minutes: 0,
  get_ready_minutes: null,
  tech_free_minutes: null,
  out_of_bed_minutes: 0,
  awake_minutes: 0,
  notes: "",
  ...over,
});

describe("exportLine", () => {
  it("keeps a plain night short", () => {
    expect(exportLine(night({}))).toBe("11-18 23:00-07:00 7 8:00/8:00");
  });

  it("lists every logged field and squashes notes onto the line", () => {
    expect(
      exportLine(
        night({
          bedtime: 23 * 60 + 30,
          woke_at: 6 * 60 + 45,
          fall_asleep_minutes: 20,
          awake_minutes: 15,
          out_of_bed_minutes: 10,
          get_ready_minutes: 30,
          tech_free_minutes: 0,
          notes: "  Coffee at 4 PM\n\nwoke to noise ",
        }),
      ),
    ).toBe(
      "11-18 23:30-06:55 7 6:40/7:25 f20 a15 o10 g30 t0 | Coffee at 4 PM woke to noise",
    );
  });

  it("handles a bedtime after midnight", () => {
    expect(exportLine(night({ bedtime: 30, woke_at: 8 * 60 }))).toBe(
      "11-18 00:30-08:00 7 7:30/7:30",
    );
  });
});

describe("sleepExport", () => {
  it("is empty with no nights", () => {
    expect(sleepExport([])).toBe("");
  });

  it("puts a legend and average first, then nights newest first with year lines", () => {
    const text = sleepExport([
      night({ id: "a", night: "2025-12-31", quality: 4, bedtime: 0 }),
      night({ id: "b", night: "2026-01-02", quality: 8 }),
      night({ id: "c", night: "2026-01-01", quality: 6 }),
    ]);
    const lines = text.split("\n");
    expect(lines[0]).toBe(
      "My sleep log: 3 nights, 2025-12-31 to 2026-01-02, newest first.",
    );
    expect(lines).toContain("Average: rested 6.0, asleep 7:40, in bed 7:40");
    expect(lines.slice(-5)).toEqual([
      "2026",
      "01-02 23:00-07:00 8 8:00/8:00",
      "01-01 23:00-07:00 6 8:00/8:00",
      "2025",
      "12-31 00:00-07:00 4 7:00/7:00",
    ]);
  });

  it("fits a year of nights in a phone clipboard", () => {
    const year = Array.from({ length: 365 }, (_, i) => {
      const d = new Date(2026, 0, 1 + i);
      return night({
        id: String(i),
        night: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
        fall_asleep_minutes: 15,
        awake_minutes: 10,
        out_of_bed_minutes: 10,
        get_ready_minutes: 30,
        tech_free_minutes: 60,
      });
    });
    expect(sleepExport(year).length).toBeLessThan(25_000);
  });
});
