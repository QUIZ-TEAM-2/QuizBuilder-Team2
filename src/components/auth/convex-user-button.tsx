"use client";

import { useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { BarChart3, LayoutGrid, LogOut, User } from "lucide-react";
import { UserAvatar } from "@/components/auth/user-avatar";

export default function ConvexUserButton() {
  const router = useRouter();
  const user = useQuery(api.auth.currentUser);
  const { signOut } = useAuthActions();

  // loading state
  if (user === undefined) {
    return null;
  }

  const displayName =
    user?.username ?? user?.name ?? user?.email ?? "User";

  const adminSuffix =
    user?.role === "admin" ? (
      <span className="italic text-slate-500"> (admin)</span>
    ) : null;

  const handleSignOut = () => {
    void signOut();
  };

  // not logged in
  if (!user) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push("/")}
        className="flex items-center gap-2 hover:bg-gray-100"
      >
        <User className="h-4 w-4" />
        <span className="hidden sm:inline-block">
          Sign in
        </span>
      </Button>
    );
  }

  // logged in
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center gap-2 hover:bg-gray-100"
        >
          <UserAvatar user={user} size="sm" />
          <span className="hidden sm:inline-block">
            {displayName}
            {adminSuffix}
          </span>
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-56" align="end">
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-2 py-1.5">
            <UserAvatar user={user} size="md" />
            <div className="min-w-0 text-sm font-medium">
              <div className="truncate">
                {displayName}
                {adminSuffix}
              </div>
            </div>
          </div>

          <div className="px-2 py-1.5 text-xs text-gray-500">
            {user.email}
          </div>

          <hr />

          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/quiz")}
            className="w-full justify-start"
          >
            <LayoutGrid className="mr-2 h-4 w-4" />
            My quizzes
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/dashboard/quizzes")}
            className="w-full justify-start"
          >
            <BarChart3 className="mr-2 h-4 w-4" />
            Analytics
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="w-full justify-start"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}