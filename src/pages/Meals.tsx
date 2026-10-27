import { Suspense } from "react";
import { NavLink, Outlet } from "react-router-dom";
import TopBar from "../components/TopBar";
import ErrorBanner from "../components/ErrorBanner";
import { useAuth } from "../context/AuthContext";
import signOut from "../functions/signOut";
import useMeals from "../hooks/useMeals";

const TABS = [
  { to: "/meals", label: "Plan", end: true },
  { to: "/meals/groceries", label: "Groceries" },
  { to: "/meals/library", label: "Library" },
];

// Shell for the meals section: the top bar, its own tabs, and the page. The
// meals are loaded here once and shared with every page through the outlet.
export default function Meals() {
  const { user } = useAuth();
  const meals = useMeals(user?.id);

  return (
    <div className="max-w-xl mx-auto px-2 sm:px-6 min-h-dvh flex flex-col pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <TopBar
        userPhoto={
          user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture
        }
        onSignOut={() => signOut(user?.id)}
      />
      <nav className="flex gap-0.5 sm:gap-1 overflow-x-auto scrollbar-none mb-3 -mx-2 px-2 sm:mx-0 sm:px-0">
        {TABS.map(({ to, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `shrink-0 rounded-full px-2.5 sm:px-4 py-1.5 text-sm font-bold transition ${
                isActive
                  ? "bg-base-content text-base-100"
                  : "text-base-content/60 dark:text-base-content/80 hover:bg-base-content/8 hover:text-base-content dark:hover:text-base-content"
              }`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
      {meals.error && (
        <div className="mb-3">
          <ErrorBanner message={meals.error} onDismiss={meals.dismissError} />
        </div>
      )}
      <Suspense
        fallback={
          <div className="flex justify-center py-8 text-base-content/40 dark:text-base-content/70">
            <span className="loading loading-spinner loading-md"></span>
          </div>
        }
      >
        <Outlet context={meals} />
      </Suspense>
    </div>
  );
}
