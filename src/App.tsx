// src/App.tsx
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

export default function App() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) navigate(user ? "/journal" : "/signin");
  }, [user, loading, navigate]);

  return (
    <div className="flex justify-center items-center h-screen">
      <p className="text-gray-500 text-lg">Loading...</p>
    </div>
  );
}
