"use client";

import { useAuthToken } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

const fullViewportCenter: CSSProperties = {
  minHeight: "100vh",
  width: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "1.5rem",
  boxSizing: "border-box",
};

function UnauthenticatedRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.push("/");
  }, [router]);

  return (
    <div style={fullViewportCenter} className="bg-white">
      <div className="text-center">
        <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600" />
        <p className="text-gray-500">Redirecting to login...</p>
      </div>
    </div>
  );
}

function LoadingPage({ message = "Loading..." }: { message?: string }) {
  return (
    <div style={fullViewportCenter} className="bg-white">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600" />
        <p className="text-gray-600">{message}</p>
      </div>
    </div>
  );
}

function SessionLoadTimeout({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div style={fullViewportCenter} className="bg-slate-50">
      <div className="max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{body}</p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
            onClick={() => window.location.reload()}
          >
            Reload page
          </button>
          <Link
            href="/"
            className="rounded-lg bg-slate-900 px-4 py-2 text-center text-sm font-medium text-white hover:bg-slate-800"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}

const NO_JWT_WAIT_MS = 10_000;

/**
 * JWT + Convex auth loading gate shared by /dashboard and /admin routes.
 */
export function ConvexSessionGate({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const token = useAuthToken();
  const hasJwt = token != null;

  const [noJwtWaitExceeded, setNoJwtWaitExceeded] = useState(false);
  useEffect(() => {
    if (hasJwt || !isLoading) {
      setNoJwtWaitExceeded(false);
      return;
    }
    const t = window.setTimeout(() => setNoJwtWaitExceeded(true), NO_JWT_WAIT_MS);
    return () => window.clearTimeout(t);
  }, [hasJwt, isLoading]);

  if (!isLoading && !isAuthenticated && !hasJwt) {
    return <UnauthenticatedRedirect />;
  }

  if (isLoading && !hasJwt) {
    if (noJwtWaitExceeded) {
      return (
        <SessionLoadTimeout
          title="Sign-in is taking too long"
          body="Convex did not finish starting the session. Check NEXT_PUBLIC_CONVEX_URL, run npx convex dev if needed, then reload."
        />
      );
    }
    return <LoadingPage message="Starting session…" />;
  }

  return <>{children}</>;
}

function NonAdminRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.push("/quiz");
  }, [router]);

  return (
    <div style={fullViewportCenter} className="bg-white">
      <div className="text-center">
        <p className="text-gray-500">Access denied</p>
      </div>
    </div>
  );
}

export function AdminOnly({ children }: { children: ReactNode }) {
  const userRaw = useQuery(api.auth.currentUser);
  const userRef = useRef<typeof userRaw>(undefined);
  if (userRaw !== undefined) userRef.current = userRaw;
  const user = userRaw !== undefined ? userRaw : userRef.current;

  const [sessionWaitExceeded, setSessionWaitExceeded] = useState(false);
  useEffect(() => {
    if (userRaw !== undefined) {
      setSessionWaitExceeded(false);
      return;
    }
    const t = window.setTimeout(() => setSessionWaitExceeded(true), 15_000);
    return () => window.clearTimeout(t);
  }, [userRaw]);

  if (user === undefined) {
    if (sessionWaitExceeded) {
      return (
        <SessionLoadTimeout
          title="Could not load your session"
          body="The app could not reach Convex or finish signing you in. Check your network, confirm NEXT_PUBLIC_CONVEX_URL in .env.local, then try again."
        />
      );
    }
    return <LoadingPage message="Loading your session…" />;
  }

  if (!user || user.role !== "admin") {
    return <NonAdminRedirect />;
  }

  return <>{children}</>;
}

export function LoggedInOnly({ children }: { children: ReactNode }) {
  const userRaw = useQuery(api.auth.currentUser);
  const userRef = useRef<typeof userRaw>(undefined);
  if (userRaw !== undefined) userRef.current = userRaw;
  const user = userRaw !== undefined ? userRaw : userRef.current;

  const [sessionWaitExceeded, setSessionWaitExceeded] = useState(false);
  useEffect(() => {
    if (userRaw !== undefined) {
      setSessionWaitExceeded(false);
      return;
    }
    const t = window.setTimeout(() => setSessionWaitExceeded(true), 15_000);
    return () => window.clearTimeout(t);
  }, [userRaw]);

  if (user === undefined) {
    if (sessionWaitExceeded) {
      return (
        <SessionLoadTimeout
          title="Could not load your session"
          body="The app could not reach Convex or finish signing you in. Check your network, confirm NEXT_PUBLIC_CONVEX_URL in .env.local, then try again."
        />
      );
    }
    return <LoadingPage message="Loading your session…" />;
  }

  if (!user) {
    return <UnauthenticatedRedirect />;
  }

  return <>{children}</>;
}
