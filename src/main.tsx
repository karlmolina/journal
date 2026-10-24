// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import App from "./App";
import SignIn from "./pages/SignIn";
import Journal from "./pages/Journal";
import Workouts from "./pages/Workouts";
import Invites from "./pages/Invites";
import MembersOnly from "./components/MembersOnly";
import "./index.css";
import { AuthProvider } from "./context/AuthProvider";
import Root from "./components/ThemeRoot";

// The workouts pages load on first visit so the journal stays fast to open.
const Session = React.lazy(() => import("./pages/workouts/Session"));
const Library = React.lazy(() => import("./pages/workouts/Library"));
const Injuries = React.lazy(() => import("./pages/workouts/Injuries"));
const Progress = React.lazy(() => import("./pages/workouts/Progress"));
const Plan = React.lazy(() => import("./pages/workouts/Plan"));

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Root>
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="/signin" element={<SignIn />} />
            <Route
              path="/journal"
              element={
                <MembersOnly>
                  <Journal />
                </MembersOnly>
              }
            />
            <Route
              path="/workouts"
              element={
                <MembersOnly>
                  <Workouts />
                </MembersOnly>
              }
            >
              <Route index element={<Session />} />
              <Route path="library" element={<Library />} />
              <Route path="injuries" element={<Injuries />} />
              <Route path="progress" element={<Progress />} />
              <Route path="plan" element={<Plan />} />
            </Route>
            <Route
              path="/invites"
              element={
                <MembersOnly admin>
                  <Invites />
                </MembersOnly>
              }
            />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Root>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
