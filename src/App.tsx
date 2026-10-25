// src/App.tsx
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { readLastPage } from "./hooks/useLastPage";

export default function App() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading)
      navigate(user ? (readLastPage() ?? "/journal") : "/signin", {
        replace: true,
      });
  }, [user, loading, navigate]);

  return (
    <div className="flex justify-center items-center h-dvh">
      <span
        className="loading loading-spinner loading-md text-base-content/40"
        aria-label="Loading"
      ></span>
    </div>
  );
}
