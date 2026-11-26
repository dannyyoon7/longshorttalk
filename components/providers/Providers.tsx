"use client";

import type { ReactNode } from "react";
import { MarketProvider } from "@/components/providers/MarketProvider";
import { AccountEngine, ToastProvider } from "@/components/providers/ToastProvider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <MarketProvider>
        <AccountEngine />
        {children}
      </MarketProvider>
    </ToastProvider>
  );
}
