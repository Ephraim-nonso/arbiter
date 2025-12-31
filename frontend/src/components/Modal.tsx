"use client";

import { useEffect } from "react";

export function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title?: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close modal"
        className="absolute inset-0 cursor-pointer bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-md rounded-3xl border border-black/10 bg-white p-5 shadow-xl dark:border-white/15 dark:bg-black">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            {title ? (
              <div className="truncate text-sm font-semibold text-black/90 dark:text-white/90">
                {title}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className="cursor-pointer rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-black hover:bg-black/5 dark:border-white/15 dark:bg-black dark:text-white dark:hover:bg-white/10"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}



