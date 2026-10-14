"use client";

import { type ReactNode } from "react";
import { AdminOnly, ConvexSessionGate } from "@/components/auth/convex-session-gate";
import { DashboardThemeScope } from "@/components/theme/DashboardTheme";

/** Platform admin routes only. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <ConvexSessionGate>
      <AdminOnly>
        <DashboardThemeScope>{children}</DashboardThemeScope>
      </AdminOnly>
    </ConvexSessionGate>
  );
}
