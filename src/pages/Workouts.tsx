import { NavLink, Outlet } from "react-router-dom";
import TopBar from "../components/TopBar";
import { useAuth } from "../context/AuthContext";
import signOut from "../functions/signOut";

const TABS = [
  { to: "/workouts", label: "Workout", end: true },
  { to: "/workouts/library", label: "Library" },
];

// Shell for the workouts section: the top bar, its own tabs, and the page.
export default function Workouts() {
  const { user } = useAuth();

  return (
    <div className="max-w-xl mx-auto px-2 sm:px-6 min-h-dvh flex flex-col">
      <TopBar
        userPhoto={
          user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture
        }
        onSignOut={() => signOut(user?.id)}
      />
      <nav className="flex gap-1 overflow-x-auto scrollbar-none mb-3 -mx-2 px-2 sm:mx-0 sm:px-0">
        {TABS.map(({ to, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `shrink-0 rounded-full px-4 py-1.5 text-sm font-bold transition ${
                isActive
                  ? "bg-base-content text-base-100"
                  : "text-base-content/60 hover:bg-base-content/8 hover:text-base-content"
              }`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
