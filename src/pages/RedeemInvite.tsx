import { useState } from "react";
import { supabase } from "../supabase";
import { useAuth } from "../context/AuthContext";

export default function RedeemInvite() {
  const { user, refreshMembership } = useAuth();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || busy) return;
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.rpc("redeem_invite_code", {
      invite_code: code,
    });
    if (error) {
      console.error(error);
      setError("Something went wrong. Please try again.");
    } else if (!data) {
      setError("That code isn't valid or has already been used.");
    } else {
      await refreshMembership();
    }
    setBusy(false);
  };

  // Don't leave an account behind for someone who never got in.
  const handleCancel = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("delete_uninvited_account");
    if (error) console.error(error);
    await supabase.auth.signOut();
  };

  return (
    <div className="flex flex-col justify-center items-center h-screen px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm flex flex-col items-center text-center gap-6"
      >
        <div className="space-y-2">
          <h1 className="text-5xl font-extrabold tracking-tight">Journal8</h1>
          <p className="font-medium text-base-content/60">
            Journal8 is invite-only. Enter your invite code to finish creating
            your account.
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
