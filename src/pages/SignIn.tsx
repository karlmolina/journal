// src/pages/SignIn.tsx
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../firebase";
import { useNavigate } from "react-router-dom";
import GoogleSignInButton from "../components/GoogleSignInButton";

export default function SignIn() {
  const navigate = useNavigate();

  const handleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      navigate("/journal");
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex flex-col justify-center items-center h-screen space-y-6">
      <h1 className="text-4xl font-bold">Journal8</h1>
      <GoogleSignInButton onClick={handleSignIn} />
    </div>
  );
}
