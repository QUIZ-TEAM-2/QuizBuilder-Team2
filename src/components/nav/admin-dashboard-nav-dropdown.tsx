"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function itemClass(active: boolean) {
  return cn(
    "block rounded-md px-3 py-2 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-100 hover:text-slate-950",
    active && "bg-slate-100 text-slate-950",
  );
}

/** Same primary styling as the admin dashboard trigger; navigates straight to the creator dashboard. */
export function UserDashboardNavButton() {
  return (
    <Button asChild variant="default" className="bg-slate-900 text-white hover:bg-slate-800">
      <Link href="/dashboard/quizzes">Dashboard</Link>
    </Button>
  );
}

export function AdminDashboardNavDropdown() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const userActive = pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  const adminActive = pathname.startsWith("/admin/dashboard");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="default"
          className="bg-slate-900 text-white hover:bg-slate-800"
          aria-expanded={open}
          aria-haspopup="menu"
        >
          Dashboard
          <ChevronDown className="ml-1 h-4 w-4 opacity-90" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-56 p-1 shadow-md"
        align="start"
        side="bottom"
        sideOffset={8}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <nav className="flex flex-col gap-0.5" aria-label="Dashboard menu">
          <Link
            href="/dashboard/quizzes"
            className={itemClass(userActive)}
            onClick={() => setOpen(false)}
          >
            User Dashboard
          </Link>
          <Link
            href="/admin/dashboard"
            className={itemClass(adminActive)}
            onClick={() => setOpen(false)}
          >
            Admin Dashboard
          </Link>
        </nav>
      </PopoverContent>
    </Popover>
  );
}
