import React, { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import RedeemInvite from "../pages/RedeemInvite";
import { clearPendingInvite } from "../functions/pendingInvite";

// Shows the invite code screen to signed-in users who haven't joined yet, and
// with `admin`, sends everyone but admins back to their journal.
export default function MembersOnly({
  admin = false,
  children,
}: {
  admin?: boolean;
  children: React.ReactNode;
}) {
  const { user, membership } = useAuth();
  const member = membership?.member === true;

  // Already a member (e.g. opened an invite link while signed in): the code
  // stays unused, so forget it rather than spend it on the next account here.
  useEffect(() => {
    if (member) clearPendingInvite();
  }, [member]);

  // Signed-out visitors are redirected by the auth hook.
  if (!user) return <>{children}</>;

  if (!membership)
    return (
      <div className="flex justify-center items-center h-dvh">
        <span
          className="loading loading-spinner loading-md text-base-content/40"
          aria-label="Loading"
        ></span>
      </div>
    );

  if (!membership.member) return <RedeemInvite />;
  if (admin && !membership.admin) return <Navigate to="/journal" replace />;
  // Keyed by account so a different user remounts the pages, which then seed
  // from that user's cache instead of carrying over the previous one's data.
  return <React.Fragment key={user.id}>{children}</React.Fragment>;
}
