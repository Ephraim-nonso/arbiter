"use client";

export function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={[
        "h-5 w-5 animate-spin rounded-full border-2 border-black/15 border-t-black dark:border-white/20 dark:border-t-white",
        className ?? "",
      ].join(" ")}
      aria-label="Loading"
    />
  );
}



