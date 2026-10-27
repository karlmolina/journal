import { useEffect, useRef, useState } from "react";
import { supabase } from "../supabase";
import { useAuth } from "../context/AuthContext";
import { reportError } from "../functions/reportError";
import {
  clearPendingInvite,
  readPendingInvite,
} from "../functions/pendingInvite";

export default function RedeemInvite() {
  const { user, refreshMembership } = useAuth();
  // A code from an invite link is filled in and redeemed straight away.
  const [code, setCode] = useState(() => readPendingInvite() ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoRedeemed = useRef(false);

  const redeem = async (invite: string, fromLink: boolean) => {
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.rpc("redeem_invite_code", {
      invite_code: invite,
    });
    if (error) {
      reportError(error, "RedeemInvite");
      setError("Something went wrong. Please try again.");
    } else if (!data) {
      // Used or revoked; a retry won't help, so don't try it again next time.
      clearPendingInvite();
      setCode("");
      setError(
        fromLink
          ? "This invite link has already been used or was revoked. Ask for a new one, or enter a code."
          : "That code isn't valid or has already been used.",
      );
    } else {
      clearPendingInvite();
      await refreshMembership();
    }
    setBusy(false);
  };

  useEffect(() => {
    const invite = readPendingInvite();
    if (!invite || autoRedeemed.current) return;
    autoRedeemed.current = true;
    redeem(invite, true);
    // Only once, when the screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || busy) return;
    redeem(code, false);
  };

  // Don't leave an account behind for someone who never got in.
  const handleCancel = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("delete_uninvited_account");
    if (error) reportError(error, "RedeemInvite");
    await supabase.auth.signOut();
  };

  return (
    <div className="flex flex-col justify-center items-center h-dvh px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm flex flex-col items-center text-center gap-6"
      >
        <div className="space-y-2">
          <h1 className="text-5xl font-extrabold tracking-tight">Journal8</h1>
          <p className="font-medium text-base-content/60">
            Journal8 is invite-only. Open your invite link or enter your invite
            code to finish creating your account.
          </p>
        </div>

        <div className="w-full space-y-2">
          <input
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setError(null);
            }}
            placeholder="Invite code"
            aria-label="Invite code"
            autoFocus
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className="input input-lg w-full rounded-full text-center font-mono tracking-widest uppercase"
          />
          {error && <p className="text-sm font-medium text-error">{error}</p>}
        </div>

        <button
          type="submit"
          disabled={busy || !code.trim()}
          className="btn btn-primary btn-lg rounded-full w-full"
        >
          {busy ? (
            <span className="loading loading-spinner loading-sm"></span>
          ) : (
            "Join"
          )}
        </button>

        <p className="text-sm font-medium text-base-content/55">
          Signed in as {user?.email}.{" "}
          <button
            type="button"
            onClick={handleCancel}
            disabled={busy}
            className="link"
          >
            Use a different account
          </button>
        </p>
      </form>
    </div>
  );
}
