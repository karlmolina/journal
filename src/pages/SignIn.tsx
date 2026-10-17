// src/pages/SignIn.tsx
import { supabase } from "../supabase";
import GoogleSignInButton from "../components/GoogleSignInButton";

export default function SignIn() {
  const handleSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/journal`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) console.error(error);
  };

  return (
    <div className="flex flex-col justify-center items-center h-screen space-y-6">
      <div className="text-center space-y-2 px-4">
        <h1 className="text-5xl font-extrabold tracking-tight">Journal8</h1>
        <p className="text-xl font-semibold">Journal it.</p>
        <p className="font-medium text-base-content/60 max-w-sm">
          Your private space to write things down and find them again in a snap.
        </p>
      </div>
      <GoogleSignInButton onClick={handleSignIn} />
    </div>
  );
}
