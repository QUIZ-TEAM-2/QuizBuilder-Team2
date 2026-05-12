"use client";
import AdminBootstrapForm from "@/components/auth/admin-bootstrap-form";
import ConvexSignIn from "@/components/auth/convex-sign-in";
import { api } from "../../convex/_generated/api";
import { useConvexAuth, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

function RedirectToQuiz() {
  const router = useRouter();

  useEffect(() => {
    router.push("/quiz");
  }, [router]);

  return null;
}

function UnauthenticatedGate() {
  const needsBootstrap = useQuery(api.bootstrap.needsAdminBootstrap);

  if (needsBootstrap === undefined) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50 text-slate-500">
        Loading…
      </div>
    );
  }

  if (needsBootstrap) {
    return <AdminBootstrapForm />;
  }

  return <ConvexSignIn />;
}

export default function HomePage() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const user = useQuery(api.auth.currentUser);

  const emailVerified =
    user != null && user.emailVerificationTime !== undefined;
  const canEnterApp = isAuthenticated && emailVerified;

  if (isLoading || (isAuthenticated && user === undefined)) {
    return (
      <main>
        <section className="relative flex h-screen w-screen flex-col items-center justify-center bg-white font-sans">
          <p className="text-slate-500 text-sm">Loading...</p>
        </section>
      </main>
    );
  }

  if (canEnterApp) {
    return (
      <main>
        <section className="relative flex h-screen w-screen flex-col bg-white font-sans">
          <RedirectToQuiz />
        </section>
      </main>
    );
  }

  return (
    <main>
      <section className="relative flex h-screen w-screen flex-col bg-white font-sans">
        {isAuthenticated ? <ConvexSignIn /> : <UnauthenticatedGate />}
      </section>
    </main>
  );
}
