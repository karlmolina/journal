import { useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { savePendingInvite } from "../functions/pendingInvite";

// Opening /invite/<code> remembers the code and sends you on: to sign-in when
// signed out, otherwise to the journal, where the invite screen redeems it.
export default function InviteLink() {
  const { code } = useParams();
  const { user, loading } = useAuth();

  // Saved before the first render so the next page already sees it.
  useState(() => code && savePendingInvite(code));

  if (loading)
    return (
      <div className="flex justify-center items-center h-dvh">
        <span
          className="loading loading-spinner loading-md text-base-content/40"
          aria-label="Loading"
        ></span>
      </div>
    );
  return <Navigate to={user ? "/journal" : "/signin"} replace />;
}
