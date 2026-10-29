import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../supabase";
import { useAuth } from "../../context/AuthContext";
import { readUserCache, writeUserCache } from "../../functions/userCache";
import { isDeleted, queueDelete } from "../../functions/undoDelete";
import { reportError } from "../../functions/reportError";
import { LAST_PAGE_KEY } from "../../hooks/useLastPage";
import { savePendingInvite } from "../../functions/pendingInvite";
import { useMealsData } from "../../hooks/useMeals";
import { mutedClass } from "../../components/meals/MealParts";
import { cardClass } from "../../components/styles";

interface MealShare {
  // Set when you joined someone else's meals.
  owner_email: string | null;
  // Your link, when you've made one.
  code: string | null;
  // Who joined your meals.
  members: { user_id: string; email: string }[];
}

const CACHE_KEY = "meal_share";

const mealShareLink = (code: string) =>
  `${window.location.origin}/meals/share/${code}`;

// Phones get the system share sheet; desktops just copy.
const canShare = typeof navigator !== "undefined" && "share" in navigator;

// Postgres errors raised on purpose carry a message meant for people.
const friendly = (
  error: { code?: string; message: string },
  fallback: string,
) => (error.code === "P0001" ? error.message + "." : fallback);

// /meals/share shows who you share meals with and your link to invite
// someone; /meals/share/<code> is that link, asking to join.
export default function Share() {
  const { code } = useParams();
  const { user, loading } = useAuth();

  if (!user) {
    if (loading) return null;
    // Back here after signing in, through the last-page restore. The link
    // also works as an invite for someone without an account yet.
    if (code) savePendingInvite(code);
    try {
      localStorage.setItem(LAST_PAGE_KEY, window.location.pathname);
    } catch {
      // Storage disabled: they can open the link again.
    }
    return <Navigate to="/signin" replace />;
  }
  return code ? <JoinMeals code={code} /> : <ShareMeals userId={user.id} />;
}

function ShareMeals({ userId }: { userId: string }) {
  const meals = useMealsData();
  const admin = useAuth().membership?.admin === true;
  const [share, setShare] = useState<MealShare | null>(() =>
    readUserCache<MealShare | null>(CACHE_KEY, userId, null),
  );
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_meal_share");
    if (error) {
      reportError(error, "Meal sharing");
      setError("Couldn't load who you share meals with.");
      return;
    }
    const fresh = data as MealShare;
    const next = {
      ...fresh,
      owner_email: isDeleted("meal_shares", userId) ? null : fresh.owner_email,
      members: fresh.members.filter(
        (m) => !isDeleted("meal_shares", m.user_id),
      ),
    };
    setShare(next);
    writeUserCache(CACHE_KEY, userId, next);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(mealShareLink(code));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable; the link is on screen to copy by hand.
    }
  };

  const shareSheet = async (code: string) => {
    try {
      await navigator.share({
        title: "Share meals",
        text: "Join my meal plan and grocery list on Journal8.",
        url: mealShareLink(code),
      });
    } catch {
      // Share sheet dismissed.
    }
  };

  const newLink = async () => {
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.rpc("create_meal_share_code");
    if (error) {
      reportError(error, "Meal sharing");
      setError(friendly(error, "Couldn't make a link."));
    } else {
      await load();
      copy(data);
    }
    setBusy(false);
  };

  // Ends a share once the Undo toast closes: yours in someone else's meals
  // (member is you), or someone in yours.
  const endShare = (memberId: string, message: string) => {
    const leaving = memberId === userId;
    setShare(
      (s) =>
        s && {
          ...s,
          owner_email: leaving ? null : s.owner_email,
          members: s.members.filter((m) => m.user_id !== memberId),
        },
    );
    setError(null);
    queueDelete({
      message,
      rows: [`meal_shares:${memberId}`],
      commit: async () => {
        const res = await supabase
          .from("meal_shares")
          .delete()
          .eq("member_id", memberId);
        if (!res.error) {
          load();
          if (leaving) meals.reload();
        }
        return res;
      },
      undo: load,
      onError: (err) => {
        reportError(err, "Meal sharing");
        setError("Couldn't change who you share meals with.");
        load();
      },
    });
  };

  if (!share)
    return error ? (
      <p className="text-sm font-medium text-error">{error}</p>
    ) : (
      <div className="flex justify-center py-8 text-base-content/40 dark:text-base-content/70">
        <span className="loading loading-spinner loading-md"></span>
      </div>
    );

  if (share.owner_email)
    return (
      <div className="flex flex-col gap-3">
        <div className={cardClass}>
          <p className="font-bold">
            You're sharing meals with {share.owner_email}
          </p>
          <p className={`${mutedClass} mt-1`}>
            You both see and change the same plan, grocery list and library.
            Your own meals are kept aside and come back if you leave.
          </p>
          <button
            onClick={() => endShare(userId, "Left shared meals")}
            className="btn btn-ghost btn-sm rounded-full text-error mt-3 -ml-3"
          >
            Leave
          </button>
        </div>
        {error && <p className="text-sm font-medium text-error">{error}</p>}
      </div>
    );

  return (
    <div className="flex flex-col gap-3">
      <div className={cardClass}>
        <p className="font-bold">Share your meals</p>
        <p className={`${mutedClass} mt-1`}>
          {admin
            ? "Anyone who opens your link can join, and it works as an invite for someone without an account."
            : "Anyone with an account who opens your link can join."}{" "}
          You'll both see and change the same plan, grocery list and library.
        </p>
        {share.code ? (
          <div className="mt-3 flex flex-wrap items-center gap-1">
            <p className="font-semibold truncate select-all min-w-0 flex-1 basis-full sm:basis-0">
              {mealShareLink(share.code).replace(/^https?:\/\//, "")}
            </p>
            {canShare && (
              <button
                onClick={() => shareSheet(share.code!)}
                className="btn btn-ghost btn-sm rounded-full"
              >
                Share
              </button>
            )}
            <button
              onClick={() => copy(share.code!)}
              className="btn btn-ghost btn-sm rounded-full"
            >
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              onClick={newLink}
              disabled={busy}
              className="btn btn-ghost btn-sm rounded-full"
            >
              New link
            </button>
          </div>
        ) : (
          <button
            onClick={newLink}
            disabled={busy}
            className="btn btn-primary rounded-full mt-3"
          >
            {busy ? (
              <span className="loading loading-spinner loading-sm"></span>
            ) : (
              "Make a share link"
            )}
          </button>
        )}
        {share.code && (
          <p className={`${mutedClass} mt-1`}>
            A new link stops the old one working; people who joined stay.
          </p>
        )}
      </div>

      {error && <p className="text-sm font-medium text-error">{error}</p>}

      {share.members.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {share.members.map((m) => (
            <li
              key={m.user_id}
              className="flex items-center gap-2 rounded-2xl bg-base-content/5 dark:bg-base-content/9 pl-3 pr-2 py-2"
            >
              <span className="min-w-0 flex-1 truncate font-bold">
                {m.email}
              </span>
              <button
                onClick={() => endShare(m.user_id, "Removed from your meals")}
                className="btn btn-ghost btn-sm rounded-full text-error"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function JoinMeals({ code }: { code: string }) {
  const meals = useMealsData();
  const navigate = useNavigate();
  // undefined while checking, null when the link doesn't work.
  const [owner, setOwner] = useState<string | null | undefined>(undefined);
  const [bring, setBring] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .rpc("meal_share_owner_email", { share_code: code })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) reportError(error, "Meal sharing");
        setOwner((data as string | null) ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  const join = async () => {
    setJoining(true);
    setError(null);
    const { data, error } = await supabase.rpc("join_meal_share", {
      share_code: code,
      bring_recipes: bring && meals.meals.length > 0,
    });
    setJoining(false);
    if (error || !data) {
      if (error) reportError(error, "Meal sharing");
      setError(
        error
          ? friendly(error, "Couldn't join those meals.")
          : "This link doesn't work anymore.",
      );
      return;
    }
    meals.reload();
    navigate("/meals", { replace: true });
  };

  if (owner === undefined)
    return (
      <div className="flex justify-center py-8 text-base-content/40 dark:text-base-content/70">
        <span className="loading loading-spinner loading-md"></span>
      </div>
    );

  if (owner === null)
    return (
      <div className={cardClass}>
        <p className="font-bold">This link doesn't work anymore</p>
        <p className={`${mutedClass} mt-1`}>
          Ask for a new one. Links stop working when a new one is made.
        </p>
        <Link
          to="/meals"
          className="btn btn-ghost btn-sm rounded-full mt-3 -ml-3"
        >
          Back to meals
        </Link>
      </div>
    );

  return (
    <div className={cardClass}>
      <p className="font-bold">Share meals with {owner}?</p>
      <p className={`${mutedClass} mt-1`}>
        You'll both see and change the same plan, grocery list and library. Your
        own meals are kept aside and come back if you leave.
      </p>
      {meals.meals.length > 0 && (
        <label className="mt-3 flex items-center gap-2 font-medium cursor-pointer">
          <input
            type="checkbox"
            className="checkbox checkbox-sm"
            checked={bring}
            onChange={(e) => setBring(e.target.checked)}
          />
          Add a copy of my recipes to the shared library
        </label>
      )}
      {error && <p className="text-sm font-medium text-error mt-3">{error}</p>}
      <div className="mt-4 flex gap-2">
        <button
          onClick={join}
          disabled={joining}
          className="btn btn-primary rounded-full"
        >
          {joining ? (
            <span className="loading loading-spinner loading-sm"></span>
          ) : (
            "Join"
          )}
        </button>
        <Link to="/meals" replace className="btn btn-ghost rounded-full">
          Not now
        </Link>
      </div>
    </div>
  );
}
