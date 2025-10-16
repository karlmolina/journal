// src/App.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "./firebase";

export default function App() {
  const [_user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      navigate(u ? "/journal" : "/signin");
    });
    return unsub;
  }, [navigate]);

  return (
    <div className="flex justify-center items-center h-screen">
      <p className="text-gray-500 text-lg">Loading...</p>
    </div>
  );
}
