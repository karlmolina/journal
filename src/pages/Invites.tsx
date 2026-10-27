import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../supabase";
import { useAuth } from "../context/AuthContext";
import { readUserCache, writeUserCache } from "../functions/userCache";
import { isDeleted, queueDelete } from "../functions/undoDelete";
import { reportError } from "../functions/reportError";
import { inviteLink } from "../functions/pendingInvite";

interface InviteCode {
  code: string;
  created_at: string;
  used_at: string | null;
  used_by_email: string | null;
}

const formatDay = (date: string) =>
  new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const CACHE_KEY = "invite_codes";

// Phones get the system share sheet; desktops just copy.
const canShare = typeof navigator !== "undefined" && "share" in navigator;

export default function Invites() {
  const { user } = useAuth();
  const userId = user?.id;
  // Last known codes show instantly; the list refreshes in the background.
  const [codes, setCodes] = useState<InviteCode[] | null>(() =>
    userId ? readUserCache<InviteCode[] | null>(CACHE_KEY, userId, null) : null,
  );
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("list_invite_codes");
    if (error) {
      reportError(error, "Invites");
      setError("Couldn't load invites.");
      return;
    }
    const fresh = (data as InviteCode[]).filter(
      (c) => !isDeleted("invite_codes", c.code),
    );
    setCodes(fresh);
    if (userId) writeUserCache(CACHE_KEY, userId, fresh);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(inviteLink(code));
      setCopied(code);
      setTimeout(() => setCopied((c) => (c === code ? null : c)), 1500);
    } catch {
      // Clipboard unavailable; the link is on screen to copy by hand.
    }
  };

  const share = async (code: string) => {
    try {
      await navigator.share({
        title: "Join me on Journal8",
        text: "Here's your invite to Journal8.",
        url: inviteLink(code),
      });
    } catch {
      // Share sheet dismissed.
    }
  };

  const create = async () => {
    setCreating(true);
    setError(null);
    const { data, error } = await supabase.rpc("create_invite_code");
    if (error) {
      reportError(error, "Invites");
      setError("Couldn't create an invite.");
    } else {
      await load();
      copy(data);
    }
    setCreating(false);
  };

  // Gone from the list right away; revoked once the Undo toast closes, and
  // the reload puts it back on undo or failure.
  const revoke = (code: string) => {
    setCodes((prev) => prev?.filter((c) => c.code !== code) ?? prev);
    setError(null);
    queueDelete({
      message: "Invite revoked",
      rows: [`invite_codes:${code}`],
      commit: async () => {
        const res = await supabase.rpc("revoke_invite_code", {
          invite_code: code,
        });
        if (!res.error) load();
        return res;
      },
      undo: load,
      onError: (error) => {
        reportError(error, "Invites");
        setError("Couldn't revoke that invite.");
      },
    });
  };

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight">Invites</h1>
        <Link to="/journal" className="btn btn-ghost btn-sm rounded-full">
          Back to journal
        </Link>
      </div>

      <p className="text-sm font-medium text-base-content/60">
        Each invite link lets one person create an account. New links are copied
        to your clipboard. If a link won't open, they can type the code after
        signing in.
      </p>

      <button
        onClick={create}
        disabled={creating}
        className="btn btn-primary rounded-full self-start"
      >
        {creating ? (
          <span className="loading loading-spinner loading-sm"></span>
        ) : (
          "New invite link"
        )}
      </button>

      {error && <p className="text-sm font-medium text-error">{error}</p>}

      {codes === null ? (
        !error && (
          <div className="flex justify-center py-4 text-base-content/40">
            <span className="loading loading-spinner loading-md"></span>
          </div>
        )
      ) : codes.length === 0 ? (
        <p className="text-sm font-medium text-base-content/55">
          No invites yet.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-base-content/10">
          {codes.map((c) => (
            <li key={c.code} className="flex items-center gap-3 py-3">
              <div className="flex-1 min-w-0">
                {c.used_at ? (
                  <p className="font-mono font-bold tracking-widest">
                    {c.code}
                  </p>
                ) : (
                  <p className="font-semibold truncate select-all">
                    {inviteLink(c.code).replace(/^https?:\/\//, "")}
                  </p>
                )}
                <p className="text-sm font-medium text-base-content/55 truncate">
                  {c.used_at
                    ? `Used by ${c.used_by_email ?? "a deleted account"} on ${formatDay(c.used_at)}`
                    : `Code ${c.code} · ${formatDay(c.created_at)}`}
                </p>
              </div>
              {!c.used_at && (
                <>
                  {canShare && (
                    <button
                      onClick={() => share(c.code)}
                      className="btn btn-ghost btn-sm rounded-full"
                    >
                      Share
                    </button>
                  )}
                  <button
                    onClick={() => copy(c.code)}
                    className="btn btn-ghost btn-sm rounded-full"
                  >
                    {copied === c.code ? "Copied" : "Copy"}
                  </button>
                  <button
                    onClick={() => revoke(c.code)}
                    className="btn btn-ghost btn-sm rounded-full text-error"
                  >
                    Revoke
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
