import React from "react";

// A crash while rendering would otherwise leave a blank page. This shows what
// went wrong and a way back; the error itself is reported by the root's
// onCaughtError in main.tsx.
export default class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="flex flex-col items-center justify-center gap-3 h-dvh px-6 text-center">
        <h1 className="text-lg font-bold">Something went wrong</h1>
        <p className="text-sm text-base-content/70 max-w-sm">
          The error was saved so it can be fixed. Reloading usually gets you
          going again; your workout is kept.
        </p>
        <p className="font-mono text-xs opacity-70 break-words max-w-sm select-text">
          {error.message}
        </p>
        <button
          type="button"
          className="btn btn-primary rounded-full font-bold"
          onClick={() => location.reload()}
        >
          Reload
        </button>
      </div>
    );
  }
}
