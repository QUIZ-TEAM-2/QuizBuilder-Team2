"use client";

import { type ReactNode } from "react";
import { ConvexSessionGate, LoggedInOnly } from "@/components/auth/convex-session-gate";

/** Creator / signed-in user dashboard area (not platform admin analytics). */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <ConvexSessionGate>
      <LoggedInOnly>{children}</LoggedInOnly>
    </ConvexSessionGate>
  );
}
