"use client";

import type { ReactNode } from "react";

type Props = {
  className?: string;
  children: ReactNode;
};

export function ScrollToHowItWorksButton({ className, children }: Props) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
      }}
    >
      {children}
    </button>
  );
}
