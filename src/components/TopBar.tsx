import { useEffect } from "react";
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
  return (
    <div className="flex justify-between items-center mb-8">
      <h1 className="text-2xl">Journal8</h1>

      <div className="flex items-center gap-2">
        {/* Theme dropdown */}
        <div className="dropdown dropdown-end">
          <button tabIndex={0} className="btn btn-ghost btn-sm rounded-full">
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

        {/* Profile dropdown */}
        <div className="dropdown dropdown-end">
          <div tabIndex={0} className="btn btn-ghost btn-circle avatar">
            <div className="w-10 rounded-full">
              {userPhoto ? (
                <img src={userPhoto} alt="Profile" />
              ) : (
                <img
                  src="https://api.dicebear.com/7.x/initials/svg?seed=User"
                  alt="Default avatar"
                />
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
