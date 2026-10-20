import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { themeChange } from "theme-change";

interface TopBarProps {
  userPhoto?: string | null;
  onSignOut: () => void;
}

const themes = [
  "light",
  "dark",
  "cupcake",
  "bumblebee",
  "emerald",
  "corporate",
  "synthwave",
  "retro",
  "cyberpunk",
  "valentine",
  "halloween",
  "garden",
  "forest",
  "aqua",
  "lofi",
  "pastel",
  "fantasy",
  "wireframe",
  "black",
  "luxury",
  "dracula",
  "cmyk",
  "autumn",
  "business",
  "acid",
  "lemonade",
  "night",
  "coffee",
  "winter",
  "dim",
  "nord",
  "sunset",
  "caramellatte",
  "abyss",
  "silk",
];

const PHOTO_CACHE_KEY = "journal_photo";
const DEFAULT_AVATAR = "https://api.dicebear.com/7.x/initials/svg?seed=User";

// Google rate-limits avatar requests and they need the network, so keep a
// data-URL copy of the photo and show that instantly on later loads.
function useCachedPhoto(src?: string | null) {
  const [cached, setCached] = useState<{ src: string; data: string } | null>(
    () => {
      try {
        return JSON.parse(localStorage.getItem(PHOTO_CACHE_KEY) ?? "null");
      } catch {
        return null;
      }
    },
  );
  const hit = cached && cached.src === src ? cached.data : null;

  useEffect(() => {
    if (!src || hit) return;
    let cancelled = false;
    fetch(src, { referrerPolicy: "no-referrer" })
      .then((res) => (res.ok ? res.blob() : Promise.reject(res.status)))
      .then(
        (blob) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          }),
      )
      .then((data) => {
        if (cancelled) return;
        setCached({ src, data });
        try {
          localStorage.setItem(PHOTO_CACHE_KEY, JSON.stringify({ src, data }));
        } catch {
          // Ignore quota / private mode errors; the cache is only a convenience.
        }
      })
      // Not cacheable (offline, CORS); the <img> still loads the URL directly.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [src, hit]);

  return hit ?? src;
}

function ThemeSwatch({ theme }: { theme: string }) {
  return (
    <div
      data-theme={theme}
      className="bg-base-100 grid grid-cols-2 gap-0.5 rounded-md p-1 shadow-sm"
    >
      <div className="bg-base-content size-1 rounded-full"></div>
      <div className="bg-primary size-1 rounded-full"></div>
      <div className="bg-secondary size-1 rounded-full"></div>
      <div className="bg-accent size-1 rounded-full"></div>
    </div>
  );
}

const SECTIONS = [
  {
    to: "/journal",
    label: "Journal",
    icon: (
      <>
        <path d="M12 20h9" />
        <path d="M16.4 3.6a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z" />
      </>
    ),
  },
  {
    to: "/workouts",
    label: "Workouts",
    icon: (
      <>
        <path d="M6.5 6.5v11" />
        <path d="M17.5 6.5v11" />
        <path d="M3 9.5v5" />
        <path d="M21 9.5v5" />
        <path d="M6.5 12h11" />
      </>
    ),
  },
];

// Switches between the journal and workouts. Icons only on narrow screens so
// the title and both menus still fit on one row.
function SectionTabs() {
  return (
    <nav className="flex items-center gap-0.5 rounded-full bg-base-content/8 p-1">
      {SECTIONS.map(({ to, label, icon }) => (
        <NavLink
          key={to}
          to={to}
          aria-label={label}
          className={({ isActive }) =>
            `flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-bold transition sm:px-3 ${
              isActive
                ? "bg-base-100 shadow-sm"
                : "text-base-content/60 hover:text-base-content"
            }`
          }
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {icon}
          </svg>
          <span className="hidden sm:inline">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export default function TopBar({ userPhoto, onSignOut }: TopBarProps) {
  const photo = useCachedPhoto(userPhoto);

  // TopBar mounts after ThemeRoot (e.g. once auth/data finishes loading), so
  // bind the theme buttons here too.
  useEffect(() => {
    themeChange(false);
  }, []);

  return (
    <div className="flex justify-between items-center gap-2 py-2 sm:py-4">
      <h1 className="text-2xl font-extrabold tracking-tight ml-2 sm:ml-0">
        Journal8
      </h1>

      <div className="flex items-center">
        <SectionTabs />

        {/* Theme dropdown */}
        <div className="dropdown dropdown-end ml-1">
          <button
            tabIndex={0}
            className="btn btn-ghost btn-circle"
            aria-label="Change theme"
          >
            <ThemeSwatch theme="light" />
          </button>
          <ul
            tabIndex={0}
            className="menu-sm menu flex-nowrap bg-base-100 rounded-2xl shadow-lg dropdown-content max-h-[80vh] overflow-y-auto w-55 border border-base-content/10 mt-1 p-1.5 font-medium"
          >
            {themes.map((theme) => (
              <li key={theme}>
                {/* theme-change automatically switches theme and saves in localStorage */}
                <button
                  className="gap-3 px-2 py-2 capitalize"
                  data-set-theme={theme}
                  data-act-class="[&_svg]:visible"
                >
                  <ThemeSwatch theme={theme} />
                  <div className="truncate">{theme}</div>{" "}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="invisible h-3 w-3 shrink-0"
                  >
                    <path d="M20.285 2l-11.285 11.567-5.286-5.011-3.714 3.716 9 8.728 15-15.285z"></path>
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Profile dropdown. The photo fills its button while the other icons are
            small glyphs, so it is inset and given extra margin to look evenly
            spaced. */}
        <div className="dropdown dropdown-end ml-2">
          <div
            tabIndex={0}
            role="button"
            aria-label="Account"
            className="btn btn-ghost btn-circle avatar"
          >
            <div className="w-8 rounded-full ring-1 ring-base-content/10">
              {photo ? (
                <img
                  src={photo}
                  alt="Profile"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = DEFAULT_AVATAR;
                  }}
                />
              ) : (
                <img src={DEFAULT_AVATAR} alt="Default avatar" />
              )}
            </div>
          </div>

          <ul
            tabIndex={0}
            className="menu dropdown-content bg-base-100 rounded-2xl mt-2 w-52 p-1.5 shadow-lg border border-base-content/10 font-medium"
          >
            <li>
              <button onClick={onSignOut}>Sign out</button>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
