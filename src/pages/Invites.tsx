import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../supabase";

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

export default function Invites() {
  const [codes, setCodes] = useState<InviteCode[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("list_invite_codes");
    if (error) {
      console.error(error);
      setError("Couldn't load invite codes.");
      return;
    }
    setCodes(data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied((c) => (c === code ? null : c)), 1500);
    } catch {
      // Clipboard unavailable; the code is on screen to copy by hand.
    }
  };

  const create = async () => {
    setCreating(true);
    setError(null);
    const { data, error } = await supabase.rpc("create_invite_code");
    if (error) {
      console.error(error);
      setError("Couldn't create an invite code.");
    } else {
      await load();
      copy(data);
    }
    setCreating(false);
  };

  const revoke = async (code: string) => {
    setError(null);
    const { error } = await supabase.rpc("revoke_invite_code", {
      invite_code: code,
    });
    if (error) {
      console.error(error);
      setError("Couldn't revoke that code.");
    }
    await load();
  };

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight">Invite codes</h1>
        <Link to="/journal" className="btn btn-ghost btn-sm rounded-full">
          Back to journal
        </Link>
      </div>

      <p className="text-sm font-medium text-base-content/60">
        Each code lets one person create an account. New codes are copied to
        your clipboard.
      </p>

      <button
        onClick={create}
        disabled={creating}
        className="btn btn-primary rounded-full self-start"
      >
        {creating ? (
          <span className="loading loading-spinner loading-sm"></span>
        ) : (
          "New invite code"
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
          No invite codes yet.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-base-content/10">
          {codes.map((c) => (
            <li key={c.code} className="flex items-center gap-3 py-3">
              <div className="flex-1 min-w-0">
                <p className="font-mono font-bold tracking-widest">{c.code}</p>
                <p className="text-sm font-medium text-base-content/55 truncate">
                  {c.used_at
                    ? `Used by ${c.used_by_email ?? "a deleted account"} on ${formatDay(c.used_at)}`
                    : `Unused · created ${formatDay(c.created_at)}`}
                </p>
              </div>
              {!c.used_at && (
                <>
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
