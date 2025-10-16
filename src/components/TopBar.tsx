interface TopBarProps {
  userPhoto?: string | null;
  onSignOut: () => void;
}

export default function TopBar({ userPhoto, onSignOut }: TopBarProps) {
  return (
    <div className="flex justify-between items-center mb-2 sm:mb-8">
      <h1 className="text-xl">Journal8</h1>

      {/* Profile dropdown */}
      <div className="dropdown dropdown-end">
        <div
          tabIndex={0}
          role="button"
          className="btn btn-ghost btn-circle avatar"
        >
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
          className="menu menu-sm dropdown-content bg-base-100 rounded-box mt-3 w-52 p-2 shadow"
        >
          <li>
            <button onClick={onSignOut}>Sign out</button>
          </li>
        </ul>
      </div>
    </div>
  );
}
