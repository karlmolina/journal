import React, { useMemo, useState } from "react";
import BodyMap from "../../components/workouts/BodyMap";
import InjuryCard from "../../components/workouts/InjuryCard";
import PainSlider from "../../components/workouts/PainSlider";
import ErrorBanner from "../../components/ErrorBanner";
import { useAuth } from "../../context/AuthContext";
import useInjuries, { today, type Side } from "../../hooks/useInjuries";
import useExerciseNotes from "../../hooks/useExerciseNotes";
import { placeKey, placeLabel } from "../../functions/bodyRegions";

const fieldClass =
  "w-full min-w-0 rounded-xl bg-base-content/8 px-3 py-2.5 font-medium outline-none transition focus:bg-base-content/12 placeholder:text-base-content/45 dark:placeholder:text-base-content/65";

interface Place {
  region: string;
  side: Side;
}

function NewInjuryForm({
  place,
  onSave,
  onCancel,
}: {
  place: Place;
  onSave: (fields: {
    name: string | null;
    notes: string | null;
    started_on: string;
    pain: number;
  }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [startedOn, setStartedOn] = useState(today());
  const [pain, setPain] = useState(5);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name: name.trim() || null,
      notes: notes.trim() || null,
      started_on: startedOn || today(),
      pain,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <input
        className={fieldClass}
        placeholder="What is it? Like Sprain or Tendinitis (optional)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        aria-label="What is it"
        autoFocus
      />
      <label className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold tracking-wide text-base-content/55 dark:text-base-content/75">
          Started
        </span>
        <input
          type="date"
          className={`${fieldClass} w-auto`}
          value={startedOn}
          max={today()}
          onChange={(e) => setStartedOn(e.target.value)}
        />
      </label>
      <PainSlider value={pain} onChange={setPain} />
      <textarea
        className={`${fieldClass} resize-none`}
        rows={2}
        placeholder="How it happened, what makes it worse (optional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        aria-label="Notes"
      />
      <div className="flex gap-2">
        <button
          type="button"
          className="btn btn-ghost rounded-full font-bold flex-1"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="btn btn-primary rounded-full font-bold flex-1"
        >
          Add {placeLabel(place.region, place.side).toLowerCase()}
        </button>
      </div>
    </form>
  );
}

export default function Injuries() {
  const { user } = useAuth();
  const {
    injuries,
    loading,
    error,
    dismissError,
    addInjury,
    checkIn,
    updateInjury,
    removeInjury,
  } = useInjuries(user?.id);
  const { notesForInjury } = useExerciseNotes(user?.id);
  const [place, setPlace] = useState<Place | null>(null);
  const [adding, setAdding] = useState(false);
  const [showHealed, setShowHealed] = useState(false);
  // The injury being moved to a different spot, picked on the body map.
  const [moving, setMoving] = useState<(typeof injuries)[number] | null>(null);

  const active = injuries.filter((i) => !i.healed_on);
  const healed = injuries.filter((i) => i.healed_on);

  // Worst latest pain per place, for coloring the map.
  const marked = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const i of injuries) {
      if (i.healed_on) continue;
      const key = placeKey(i.region, i.side);
      const pain = i.injury_checkins.at(-1)?.pain ?? null;
      const prev = map.get(key);
      map.set(key, prev == null ? pain : Math.max(prev, pain ?? 0));
    }
    return map;
  }, [injuries]);

  const selectedKey = place ? placeKey(place.region, place.side) : null;
  // A side of a split region also shows injuries logged on its center.
  const atPlace = place
    ? active.filter(
        (i) =>
          placeKey(i.region, i.side) === selectedKey ||
          (i.region === place.region && i.side === "center"),
      )
    : [];
  // The rest stay listed below the selected place's injuries.
  const others = place ? active.filter((i) => !atPlace.includes(i)) : active;

  const select = (region: string, side: Side) => {
    if (moving) {
      updateInjury(moving.id, { region, side });
      setMoving(null);
      setPlace({ region, side });
      setAdding(false);
      return;
    }
    const same = selectedKey === placeKey(region, side);
    setPlace(same ? null : { region, side });
    setAdding(false);
  };

  const renderCard = (i: (typeof injuries)[number]) => (
    <InjuryCard
      key={i.id}
      injury={i}
      exerciseNotes={notesForInjury(i.id)}
      onCheckIn={(pain, notes) => checkIn(i.id, pain, notes)}
      onHealed={() => updateInjury(i.id, { healed_on: today() })}
      onReopen={() => updateInjury(i.id, { healed_on: null })}
      onDelete={() => removeInjury(i.id)}
      onMove={() => {
        setMoving(i);
        setAdding(false);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }}
    />
  );

  return (
    <div className="flex flex-col gap-3 pb-6">
      {error && <ErrorBanner message={error} onDismiss={dismissError} />}

      <section className="rounded-2xl bg-base-content/5 dark:bg-base-content/9 px-3 pt-4 pb-3">
        <BodyMap marked={marked} selected={selectedKey} onSelect={select} />
        <div className="mt-3 px-1">
          {moving ? (
            <div className="flex items-center justify-between gap-3 rounded-xl bg-primary/12 px-3 py-2">
              <p className="text-sm font-bold">
                Tap the right spot for{" "}
                {moving.name ?? placeLabel(moving.region, moving.side)}.
              </p>
              <button
                type="button"
                className="btn btn-ghost btn-sm rounded-full font-bold"
                onClick={() => setMoving(null)}
              >
                Cancel
              </button>
            </div>
          ) : place ? (
            adding ? (
              <NewInjuryForm
                place={place}
                onCancel={() => setAdding(false)}
                onSave={(fields) => {
                  addInjury({ ...place, ...fields });
                  setAdding(false);
                }}
              />
            ) : (
              <div className="flex items-center justify-between gap-3">
                <p className="font-bold">
                  {placeLabel(place.region, place.side)}
                </p>
                <button
                  type="button"
                  className="btn btn-primary btn-sm rounded-full font-bold"
                  onClick={() => setAdding(true)}
                >
                  Add injury here
                </button>
              </div>
            )
          ) : (
            <p className="text-sm font-medium text-center text-base-content/55 dark:text-base-content/75">
              Tap where it hurts to add an injury.
            </p>
          )}
        </div>
      </section>

      {loading && injuries.length === 0 && (
        <div className="flex justify-center py-4 text-base-content/40 dark:text-base-content/70">
          <span className="loading loading-spinner loading-md"></span>
        </div>
      )}

      {place && atPlace.length === 0 && !adding && (
        <p className="text-sm font-medium text-center text-base-content/55 dark:text-base-content/75 py-2">
          No current injuries here.
        </p>
      )}

      {atPlace.map(renderCard)}

      {others.length > 0 && (
        <h2 className="mt-3 ml-1 text-sm font-bold tracking-wide text-base-content/60 dark:text-base-content/80">
          {place ? "Other injuries" : "Current injuries"}
        </h2>
      )}
      {others.map(renderCard)}

      {healed.length > 0 && (
        <>
          <button
            type="button"
            className="btn btn-ghost btn-sm rounded-full font-bold self-center mt-2"
            onClick={() => setShowHealed(!showHealed)}
          >
            {showHealed ? "Hide healed" : `Show healed (${healed.length})`}
          </button>
          {showHealed && healed.map(renderCard)}
        </>
      )}
    </div>
  );
}
