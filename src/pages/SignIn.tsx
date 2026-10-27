// src/pages/SignIn.tsx
import { supabase } from "../supabase";
import GoogleSignInButton from "../components/GoogleSignInButton";
import { reportError } from "../functions/reportError";
import { readPendingInvite } from "../functions/pendingInvite";

export default function SignIn() {
  // Came from an invite link; the code is redeemed once you're signed in.
  const invited = readPendingInvite() !== null;

  const handleSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/journal`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) reportError(error, "SignIn");
  };

  return (
    <div className="flex flex-col justify-center items-center h-dvh space-y-6">
      <div className="text-center space-y-2 px-4">
        <h1 className="text-5xl font-extrabold tracking-tight">Journal8</h1>
        <p className="text-xl font-semibold">Journal it.</p>
        <p className="font-medium text-base-content/60 max-w-sm">
          {invited
            ? "You've been invited. Sign in with Google to create your account."
            : "Your private space to write things down and find them again in a snap."}
        </p>
      </div>
      <GoogleSignInButton onClick={handleSignIn} />
    </div>
  );
}
