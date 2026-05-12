"use client";

import { type ReactNode } from "react";
import { AdminOnly, ConvexSessionGate } from "@/components/auth/convex-session-gate";

/** Platform admin routes only. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <ConvexSessionGate>
      <AdminOnly>{children}</AdminOnly>
    </ConvexSessionGate>
  );
}
