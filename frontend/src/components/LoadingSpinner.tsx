"use client";

import { Spinner } from "./Spinner";

export function LoadingSpinner() {
  return (
    <div className="flex min-h-[calc(100vh-84px)] items-center justify-center">
      <Spinner className="h-8 w-8" />
    </div>
  );
}

