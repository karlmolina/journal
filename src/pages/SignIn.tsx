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
      <h1 className="text-4xl font-bold">Journal8</h1>
      <GoogleSignInButton onClick={handleSignIn} />
    </div>
  );
}
