// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import App from "./App";
import SignIn from "./pages/SignIn";
import Journal from "./pages/Journal";
import Workouts from "./pages/Workouts";
import "./index.css";
import { AuthProvider } from "./context/AuthProvider";
import Root from "./components/ThemeRoot";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Root>
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="/signin" element={<SignIn />} />
            <Route path="/journal" element={<Journal />} />
            <Route path="/workouts" element={<Workouts />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Root>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
