"use client";

import { type ReactNode } from "react";
import { ConvexSessionGate, LoggedInOnly } from "@/components/auth/convex-session-gate";
import { DashboardThemeScope } from "@/components/theme/DashboardTheme";

/** Creator / signed-in user dashboard area (not platform admin analytics). */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <ConvexSessionGate>
      <LoggedInOnly>
        <DashboardThemeScope>{children}</DashboardThemeScope>
      </LoggedInOnly>
    </ConvexSessionGate>
  );
}
