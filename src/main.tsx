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
import RememberPage from "./components/RememberPage";
import "./index.css";
import { AuthProvider } from "./context/AuthProvider";
import Root from "./components/ThemeRoot";

// The workouts pages load separately so the journal stays fast to open, then
// download in the background once it's idle so switching tabs is instant.
const workoutPages = {
  session: () => import("./pages/workouts/Session"),
  library: () => import("./pages/workouts/Library"),
  injuries: () => import("./pages/workouts/Injuries"),
  progress: () => import("./pages/workouts/Progress"),
  plan: () => import("./pages/workouts/Plan"),
};
const Session = React.lazy(workoutPages.session);
const Library = React.lazy(workoutPages.library);
const Injuries = React.lazy(workoutPages.injuries);
const Progress = React.lazy(workoutPages.progress);
const Plan = React.lazy(workoutPages.plan);

const prefetchWorkoutPages = () =>
  Object.values(workoutPages).forEach((load) => load().catch(() => {}));
if ("requestIdleCallback" in window)
  requestIdleCallback(prefetchWorkoutPages, { timeout: 5000 });
else setTimeout(prefetchWorkoutPages, 2000);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Root>
          <RememberPage />
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
              <Route path="library/:exerciseId" element={<Library />} />
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
