import { useState } from "react";
import TopBar from "../components/TopBar";
import ErrorBanner from "../components/ErrorBanner";
import NightForm from "../components/sleep/NightForm";
import { NightRow, WeekSummary } from "../components/sleep/NightList";
import { useAuth } from "../context/AuthContext";
import signOut from "../functions/signOut";
import useSleep from "../hooks/useSleep";
import { defaultNight } from "../functions/sleep";

const DEFAULT_BEDTIME = 23 * 60;
const DEFAULT_WOKE_AT = 7 * 60;

// The sleep tab: log how a night went, and look back at past nights.
export default function Sleep() {
  const { user } = useAuth();
  const { nights, loading, error, dismissError, saveNight, removeNight } =
    useSleep(user?.id);
  const [night, setNight] = useState(defaultNight);

  const existing = nights.find((n) => n.night === night);
  const lastTimes = nights[0]
    ? {
        bedtime: nights[0].bedtime,
        woke_at: nights[0].woke_at,
        fall_asleep_minutes: nights[0].fall_asleep_minutes,
        get_ready_at: nights[0].get_ready_at,
        tech_free_at: nights[0].tech_free_at,
      }
    : {
        bedtime: DEFAULT_BEDTIME,
        woke_at: DEFAULT_WOKE_AT,
        fall_asleep_minutes: 0,
        get_ready_at: null,
        tech_free_at: null,
      };

  return (
    <div className="max-w-xl mx-auto px-2 sm:px-6 min-h-dvh flex flex-col gap-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <TopBar
        userPhoto={
          user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture
        }
        onSignOut={() => signOut(user?.id)}
      />
      {error && <ErrorBanner message={error} onDismiss={dismissError} />}

      {/* The form sits in the middle of the first screen; past nights are
          below it. */}
      <div className="flex min-h-[calc(100svh-6rem)] flex-col justify-center">
        <NightForm
          // A fresh form for each night, filled from that night if it's logged,
          // and once more when the nights finish loading.
          key={`${night}:${loading}`}
          night={night}
          existing={existing}
          lastTimes={lastTimes}
          onNightChange={setNight}
          onSave={saveNight}
          onDelete={
            existing
              ? () => {
                  removeNight(existing.id);
                  setNight(defaultNight());
                }
              : undefined
          }
        />
      </div>

      <WeekSummary nights={nights} />
      {nights.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {nights.map((n) => (
            <NightRow
              key={n.id}
              night={n}
              selected={n.night === night}
              onSelect={() => {
                setNight(n.night);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            />
          ))}
        </ul>
      ) : loading ? (
        <div className="flex justify-center py-8 text-base-content/40 dark:text-base-content/70">
          <span className="loading loading-spinner loading-md"></span>
        </div>
      ) : (
        <p className="py-6 text-center text-sm font-medium text-base-content/55 dark:text-base-content/70">
          Nights you log show up here.
        </p>
      )}
    </div>
  );
}
