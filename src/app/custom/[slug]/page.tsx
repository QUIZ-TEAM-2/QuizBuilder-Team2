// src/app/custom/[slug]/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { ConvexHttpClient } from "convex/browser";
import { Link2Off } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

function UnavailableCustomLinkPage() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/10 px-6 py-8 text-center text-white shadow-2xl">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
          <Link2Off className="h-6 w-6 text-white/80" />
        </div>
        <h1 className="mt-5 text-xl font-semibold">Link unavailable</h1>
        <p className="mt-2 text-sm leading-6 text-white/70">
          This quiz is not published or the custom link is no longer available.
        </p>
        <Button asChild className="mt-6" variant="secondary">
          <Link href="/discover">Back to Discover</Link>
        </Button>
      </div>
    </div>
  );
}

export default async function CustomSlugRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: rawSlug } = await params;
  const slug = rawSlug.trim().toLowerCase();

  if (!slug) {
    redirect("/");
  }

  try {
    const quiz = await convex.query(api.quiz.getBySlug, { slug });

    if (quiz?.status === "published") {
      redirect(`/discover/${quiz._id}`);
    }

    return <UnavailableCustomLinkPage />;
  } catch (error: any) {
    if (error?.digest?.startsWith("NEXT_REDIRECT")) {
      throw error;
    }
    console.error("[CustomSlugRedirect] Error looking up quiz slug:", slug, error);
    return <UnavailableCustomLinkPage />;
  }
}
