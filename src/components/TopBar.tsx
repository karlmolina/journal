import { useEffect, useState } from "react";
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

export default function TopBar({ userPhoto, onSignOut }: TopBarProps) {
  const photo = useCachedPhoto(userPhoto);

  // TopBar mounts after ThemeRoot (e.g. once auth/data finishes loading), so
  // bind the theme buttons here too.
  useEffect(() => {
    themeChange(false);
  }, []);

  return (
    <div className="flex justify-between items-center py-2 sm:py-4">
      <h1 className="text-2xl ml-2 sm:ml-0">Journal8</h1>

      <div className="flex items-center">
        {/* Theme dropdown */}
        <div className="dropdown dropdown-end">
          <button tabIndex={0} className="btn btn-ghost btn-circle">
            <ThemeSwatch theme="light" />
          </button>
          <ul
            tabIndex={0}
            className="menu-sm menu flex-nowrap bg-base-100 rounded-box shadow dropdown-content max-h-[80vh] overflow-y-auto w-55 border border-base-content/20 rounded-md"
          >
            {themes.map((theme) => (
              <li key={theme}>
                {/* theme-change automatically switches theme and saves in localStorage */}
                <button
                  className="gap-3 px-2"
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
          <div tabIndex={0} className="btn btn-ghost btn-circle avatar">
            <div className="w-8 rounded-full">
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
            className="menu menu-sm dropdown-content bg-base-100 rounded-md mt-3 w-52 p-2 shadow border border-base-content/20"
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
