// src/main.tsx
import React, { Suspense } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import App from "./App";
import SignIn from "./pages/SignIn";
import Journal from "./pages/Journal";
import Workouts from "./pages/Workouts";
import Invites from "./pages/Invites";
import InviteLink from "./pages/InviteLink";
import MembersOnly from "./components/MembersOnly";
import RememberPage from "./components/RememberPage";
import UndoToast from "./components/UndoToast";
import ErrorBoundary from "./components/ErrorBoundary";
import { reportError, reportUncaughtErrors } from "./functions/reportError";
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

// Sleep is its own section, loaded the same way.
const sleepPage = () => import("./pages/Sleep");
const Sleep = React.lazy(sleepPage);

// So are meals, with their own tabs like workouts.
const mealPages = {
  shell: () => import("./pages/Meals"),
  plan: () => import("./pages/meals/MealPlan"),
  groceries: () => import("./pages/meals/Groceries"),
  library: () => import("./pages/meals/Library"),
  share: () => import("./pages/meals/Share"),
};
const Meals = React.lazy(mealPages.shell);
const MealPlan = React.lazy(mealPages.plan);
const Groceries = React.lazy(mealPages.groceries);
const MealLibrary = React.lazy(mealPages.library);
const MealShare = React.lazy(mealPages.share);

const prefetchPages = () =>
  [
    ...Object.values(workoutPages),
    sleepPage,
    ...Object.values(mealPages),
  ].forEach((load) => load().catch(() => {}));
if ("requestIdleCallback" in window)
  requestIdleCallback(prefetchPages, { timeout: 5000 });
else setTimeout(prefetchPages, 2000);

reportUncaughtErrors();

// Render crashes are reported with the component stack, which says where in
// the app they happened.
const reportRenderError =
  (context: string) => (error: unknown, info: { componentStack?: string }) =>
    reportError(error, context, info.componentStack);

ReactDOM.createRoot(document.getElementById("root")!, {
  onCaughtError: reportRenderError("Render crash"),
  onUncaughtError: reportRenderError("Render crash (uncaught)"),
}).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <Root>
            <RememberPage />
            <Routes>
              <Route path="/" element={<App />} />
              <Route path="/signin" element={<SignIn />} />
              <Route path="/invite/:code" element={<InviteLink />} />
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
                path="/sleep"
                element={
                  <MembersOnly>
                    <Suspense fallback={null}>
                      <Sleep />
                    </Suspense>
                  </MembersOnly>
                }
              />
              <Route
                path="/meals"
                element={
                  <MembersOnly>
                    <Suspense fallback={null}>
                      <Meals />
                    </Suspense>
                  </MembersOnly>
                }
              >
                <Route index element={<MealPlan />} />
                <Route path="groceries" element={<Groceries />} />
                <Route path="library" element={<MealLibrary />} />
                <Route path="library/:mealId" element={<MealLibrary />} />
                <Route path="share" element={<MealShare />} />
                <Route path="share/:code" element={<MealShare />} />
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
            <UndoToast />
          </Root>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);
