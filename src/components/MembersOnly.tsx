import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import RedeemInvite from "../pages/RedeemInvite";

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

  // Signed-out visitors are redirected by the auth hook.
  if (!user) return <>{children}</>;

  if (!membership)
    return (
      <div className="flex justify-center items-center h-screen">
        <span
          className="loading loading-spinner loading-md text-base-content/40"
          aria-label="Loading"
        ></span>
      </div>
    );

  if (!membership.member) return <RedeemInvite />;
  if (admin && !membership.admin) return <Navigate to="/journal" replace />;
  return <>{children}</>;
}
