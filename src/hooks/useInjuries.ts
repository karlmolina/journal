import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../supabase";
import { readUserCache, writeUserCache } from "../functions/userCache";
import { notDeleted, queueDelete } from "../functions/undoDelete";

export type Side = "left" | "right" | "center";

export interface Checkin {
  id: string;
  injury_id: string;
  checked_on: string;
  pain: number;
  notes: string | null;
}

export interface Injury {
  id: string;
  region: string;
  side: Side;
  name: string | null;
  notes: string | null;
  started_on: string;
  healed_on: string | null;
  // Oldest first.
  injury_checkins: Checkin[];
}

export interface NewInjury {
  region: string;
  side: Side;
  name: string | null;
  notes: string | null;
  started_on: string;
  pain: number;
}

const CACHE_KEY = "injuries";
const SELECT =
  "id, region, side, name, notes, started_on, healed_on, injury_checkins (id, injury_id, checked_on, pain, notes)";

// The person's own calendar date, not UTC's.
export function today() {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const sortCheckins = (i: Injury): Injury => ({
  ...i,
  injury_checkins: [...i.injury_checkins].sort((a, b) =>
    a.checked_on.localeCompare(b.checked_on),
  ),
});

const readCache = (userId: string) =>
  readUserCache<Injury[]>(CACHE_KEY, userId, []);

const writeCache = (userId: string, value: Injury[]) =>
  writeUserCache(CACHE_KEY, userId, value);

export default function useInjuries(userId?: string) {
  const [injuries, setInjuries] = useState<Injury[]>(() =>
    userId ? readCache(userId) : [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const latest = useRef(injuries);
  useEffect(() => {
    latest.current = injuries;
    if (userId) writeCache(userId, injuries);
  }, [userId, injuries]);

  const fail = useCallback((message: string, err: unknown) => {
    console.error(err);
    setError(message);
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    supabase
      .from("injuries")
      .select(SELECT)
      .order("started_on", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        setLoading(false);
        if (error) return fail("Couldn't load your injuries.", error);
        setInjuries(
          (data as Injury[]).filter(notDeleted("injuries")).map(sortCheckins),
        );
      });
    return () => {
      cancelled = true;
    };
  }, [userId, fail]);

  const replace = (id: string, fn: (i: Injury) => Injury) =>
    setInjuries((prev) => prev.map((i) => (i.id === id ? fn(i) : i)));

  const addInjury = useCallback(
    async ({ pain, ...fields }: NewInjury) => {
      const injury: Injury = {
        ...fields,
        id: crypto.randomUUID(),
        healed_on: null,
        injury_checkins: [],
      };
      const checkin: Checkin = {
        id: crypto.randomUUID(),
        injury_id: injury.id,
        checked_on: today(),
        pain,
        notes: null,
      };
      setInjuries((prev) => [
        { ...injury, injury_checkins: [checkin] },
        ...prev,
      ]);
      setError(null);
      const { error } = await supabase
        .from("injuries")
        .insert({ id: injury.id, ...fields });
      const { error: checkinError } = error
        ? { error: null }
        : await supabase.from("injury_checkins").insert(checkin);
      if (error) {
        setInjuries((prev) => prev.filter((i) => i.id !== injury.id));
        fail("Couldn't save that injury.", error);
      } else if (checkinError) {
        replace(injury.id, (i) => ({ ...i, injury_checkins: [] }));
        fail("Saved the injury, but not today's pain level.", checkinError);
      }
    },
    [fail],
  );

  // One check-in per injury per day; checking in again replaces it.
  const checkIn = useCallback(
    async (injuryId: string, pain: number, notes: string) => {
      const injury = latest.current.find((i) => i.id === injuryId);
      if (!injury) return;
      const date = today();
      const existing = injury.injury_checkins.find(
        (c) => c.checked_on === date,
      );
      const checkin: Checkin = {
        id: existing?.id ?? crypto.randomUUID(),
        injury_id: injuryId,
        checked_on: date,
        pain,
        notes: notes.trim() || null,
      };
      replace(injuryId, (i) =>
        sortCheckins({
          ...i,
          injury_checkins: [
            ...i.injury_checkins.filter((c) => c.checked_on !== date),
            checkin,
          ],
        }),
      );
      setError(null);
      const { error } = await supabase
        .from("injury_checkins")
        .upsert(checkin, { onConflict: "injury_id,checked_on" });
      if (error) {
        replace(injuryId, () => injury);
        fail("Couldn't save today's check-in.", error);
      }
    },
    [fail],
  );

  const updateInjury = useCallback(
    async (
      injuryId: string,
      changes: Partial<
        Pick<Injury, "healed_on" | "name" | "notes" | "region" | "side">
      >,
    ) => {
      const injury = latest.current.find((i) => i.id === injuryId);
      if (!injury) return;
      replace(injuryId, (i) => ({ ...i, ...changes }));
      setError(null);
      const { error } = await supabase
        .from("injuries")
        .update(changes)
        .eq("id", injuryId);
      if (error) {
        replace(injuryId, () => injury);
        fail("Couldn't update that injury.", error);
      }
    },
    [fail],
  );

  // Check-ins (and note links) stay in the database until the Undo toast
  // closes, so undo just puts the injury back in the list.
  const removeInjury = useCallback(
    (injuryId: string) => {
      const injury = latest.current.find((i) => i.id === injuryId);
      if (!injury) return;
      setInjuries((prev) => prev.filter((i) => i.id !== injuryId));
      setError(null);
      queueDelete({
        message: "Injury deleted",
        rows: [`injuries:${injuryId}`],
        commit: () => supabase.from("injuries").delete().eq("id", injuryId),
        undo: () =>
          setInjuries((prev) =>
            prev.some((i) => i.id === injuryId)
              ? prev
              : [...prev, injury].sort((a, b) =>
                  b.started_on.localeCompare(a.started_on),
                ),
          ),
        onError: (error) => fail("Couldn't delete that injury.", error),
      });
    },
    [fail],
  );

  return {
    injuries,
    loading,
    error,
    dismissError: () => setError(null),
    addInjury,
    checkIn,
    updateInjury,
    removeInjury,
  };
}
