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

// The workouts pages load on first visit so the journal stays fast to open.
const Session = React.lazy(() => import("./pages/workouts/Session"));
const Library = React.lazy(() => import("./pages/workouts/Library"));
const Injuries = React.lazy(() => import("./pages/workouts/Injuries"));

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Root>
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="/signin" element={<SignIn />} />
            <Route path="/journal" element={<Journal />} />
            <Route path="/workouts" element={<Workouts />}>
              <Route index element={<Session />} />
              <Route path="library" element={<Library />} />
              <Route path="injuries" element={<Injuries />} />
            </Route>
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Root>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
