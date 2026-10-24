interface ErrorBannerProps {
  message: string;
  onDismiss: () => void;
}

export default function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className="mb-3 flex items-center justify-between gap-3 rounded-2xl bg-error/15 px-4 py-3 text-sm font-semibold"
    >
      <span>{message}</span>
      <button
        type="button"
        className="btn btn-ghost btn-xs rounded-full font-bold"
        onClick={onDismiss}
      >
        Dismiss
      </button>
    </div>
  );
}
