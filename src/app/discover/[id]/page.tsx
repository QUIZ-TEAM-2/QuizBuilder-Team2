"use client";

import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import {
  ArrowLeft,
  Calendar,
  Loader2,
  Play,
  Sparkles,
  Tag,
} from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ConvexUserButton from "@/components/auth/convex-user-button";

const DEFAULT_BRAND_NAME = "VisionVerse";

const TOPIC_LABELS: Record<string, string> = {
  general: "General",
  personality: "Personality",
  beauty: "Beauty",
  fashion: "Fashion",
  wellness: "Wellness",
  education: "Education",
  entertainment: "Entertainment",
  marketing: "Marketing",
  lifestyle: "Lifestyle",
  others: "Others",
};

type DiscoverQuizDetail = {
  _id: string;
  title: string;
  description?: string;
  tags?: string[];
  topic?: string;
  brandName?: string;
  brandAvatar?: string;
  coverImage?: string;
  _creationTime?: number;
  publishedAt?: number;
};

const formatTag = (tag: string) =>
  tag.trim().startsWith("#") ? tag.trim() : `#${tag.trim()}`;

const formatPublishedDate = (timestamp?: number) => {
  if (!timestamp) {
    return "Not published yet";
  }

  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

function BrandAvatar({
  brandAvatar,
  brandName,
  size = "md",
}: {
  brandAvatar?: string;
  brandName: string;
  size?: "sm" | "md";
}) {
  const frameClass = size === "sm" ? "h-10 w-10" : "h-14 w-14";
  const textClass = size === "sm" ? "text-sm" : "text-base";
  const imageSize = size === "sm" ? "40px" : "56px";

  return (
    <div
      className={`relative flex ${frameClass} shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100`}
    >
      {brandAvatar ? (
        <Image
          src={brandAvatar}
          alt={brandName}
          fill
          sizes={imageSize}
          className="object-cover"
        />
      ) : (
        <span className={`${textClass} font-semibold text-slate-500`}>
          {brandName.charAt(0).toUpperCase()}
        </span>
      )}
    </div>
  );
}

function DiscoverDetailHeader() {
  const router = useRouter();

  return (
    <header className="bg-[#242424] text-white">
      <div className="mx-auto max-w-[1500px] px-4 py-5 lg:px-8">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex shrink-0 items-center gap-4 xl:min-w-[250px]">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#101010] shadow-lg shadow-black/20">
              <Sparkles className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-[1.8rem] font-semibold tracking-tight text-white">
                Discover
              </h1>
              <p className="text-sm text-white/65">Browse public quizzes</p>
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-3 lg:flex-row lg:items-center xl:justify-end">
            <Button
              variant="ghost"
              className="h-auto justify-start px-0 text-[1.05rem] font-semibold uppercase tracking-[0.08em] text-white hover:bg-transparent hover:text-[#ff3366] lg:justify-center lg:px-2"
              onClick={() => router.push("/quiz")}
            >
              My quizzes
            </Button>
            <Button
              variant="ghost"
              className="h-auto justify-start px-0 text-[1.05rem] font-semibold uppercase tracking-[0.08em] text-white hover:bg-transparent hover:text-[#ff3366] lg:justify-center lg:px-2"
              onClick={() => router.push("/dashboard/quizzes")}
            >
              Analytics
            </Button>
            <ConvexUserButton />
          </div>
        </div>
      </div>
    </header>
  );
}

function QuizDetailPageView({ quiz }: { quiz: DiscoverQuizDetail }) {
  const router = useRouter();
  const brandName = quiz.brandName?.trim() || DEFAULT_BRAND_NAME;
  const topicLabel = TOPIC_LABELS[quiz.topic ?? "general"] ?? "General";
  const publishLabel = formatPublishedDate(quiz.publishedAt ?? quiz._creationTime);
  const detailTags = quiz.tags?.filter((tag) => tag.trim().length > 0) ?? [];

  return (
    <div className="min-h-screen bg-[#fbf5f3] text-slate-950">
      <DiscoverDetailHeader />

      <main className="px-4 py-8 lg:px-8 lg:py-10">
        <div className="mx-auto max-w-[1500px]">
          <div className="rounded-[2rem] border border-[#eadfd8] bg-white shadow-[0_22px_60px_rgba(15,23,42,0.06)]">
            <div className="flex flex-col gap-4 border-b border-[#efe3dc] px-6 py-5 lg:flex-row lg:items-center lg:justify-between lg:px-8">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-500">
                  Quiz details
                </p>
              </div>

              <Button
                variant="outline"
                className="rounded-full border-[#e7ddd7] px-5 text-sm font-semibold text-slate-700 hover:bg-[#fbf5f3]"
                onClick={() => router.push("/discover")}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Discover
              </Button>
            </div>

            <div className="grid items-stretch gap-8 px-6 py-6 lg:grid-cols-[minmax(320px,0.86fr)_minmax(460px,1fr)] lg:px-8 lg:py-8">
              <section className="h-full">
                <div className="h-full rounded-[1.6rem] border border-[#ebe2dc] bg-[linear-gradient(180deg,#fbf7f4_0%,#f5ede7_100%)] p-4">
                  <div className="relative min-h-[420px] overflow-hidden rounded-[1.2rem] bg-slate-100 shadow-[0_18px_40px_rgba(15,23,42,0.12)] lg:h-full lg:min-h-[640px]">
                    {quiz.coverImage ? (
                      <Image
                        src={quiz.coverImage}
                        alt={quiz.title}
                        fill
                        priority
                        sizes="(min-width: 1280px) 34vw, (min-width: 1024px) 32vw, 100vw"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top,_#dbeafe,_#f8fafc_45%,_#e2e8f0_100%)]">
                        <div className="text-center">
                          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/70 shadow-sm">
                            <Sparkles className="h-8 w-8 text-slate-500" />
                          </div>
                          <p className="mt-4 text-sm font-semibold uppercase tracking-[0.28em] text-slate-500">
                            Cover Preview
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <section className="max-w-[680px] lg:h-full">
                <div className="flex h-full flex-col rounded-[1.6rem] border border-[#ebe2dc] bg-[#fcf8f6] p-7">
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge
                      variant="secondary"
                      className="rounded-full bg-[#eef2ff] px-3 py-1 text-sm font-medium text-[#3f5fbf]"
                    >
                      {topicLabel}
                    </Badge>
                  </div>
                  <h3 className="mt-5 text-4xl font-semibold leading-tight tracking-[-0.04em] text-slate-950">
                    {quiz.title}
                  </h3>

                  <p className="mt-6 border-t border-[#eadfd8] pt-6 text-[1.04rem] leading-8 text-slate-600">
                    {quiz.description?.trim() || "No description provided yet."}
                  </p>

                  <div className="mt-7 flex flex-col gap-6 lg:mt-auto">
                    {detailTags.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {detailTags.map((tag) => (
                          <Badge
                            key={tag}
                            variant="outline"
                            className="rounded-full border-[#ded7f0] bg-white/70 px-3 py-1 text-sm font-medium text-slate-600"
                          >
                            <Tag className="mr-1.5 h-3.5 w-3.5 text-slate-400" />
                            {formatTag(tag)}
                          </Badge>
                        ))}
                      </div>
                    ) : null}

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="flex min-w-0 items-center gap-3">
                        <BrandAvatar
                          brandAvatar={quiz.brandAvatar}
                          brandName={brandName}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                            Creator
                          </p>
                          <p className="truncate text-base font-semibold text-slate-950">
                            {brandName}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 rounded-2xl bg-white/70 px-4 py-3 text-slate-700">
                        <Calendar className="h-4 w-4 shrink-0 text-slate-400" />
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                            Published
                          </p>
                          <p className="text-base font-semibold text-slate-950">
                            {publishLabel}
                          </p>
                        </div>
                      </div>
                    </div>

                    <Button
                      className="h-14 w-full gap-2 rounded-full bg-[#ff3366] text-base font-semibold text-white shadow-[0_18px_30px_rgba(255,51,102,0.28)] hover:bg-[#e42d5d]"
                      onClick={() =>
                        router.push(
                          `/play/${quiz._id}?source=discover&returnTo=${encodeURIComponent(
                            `/discover/${quiz._id}`,
                          )}`,
                        )
                      }
                    >
                      <Play className="h-4 w-4" />
                      Play Quiz
                    </Button>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function DiscoverQuizDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string | undefined;
  const quizzes = useQuery(api.quiz.getPublishedQuizzes);
  const quiz = (quizzes as DiscoverQuizDetail[] | undefined)?.find(
    (item) => item._id === id,
  );

  if (quizzes === undefined) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[#070b14] px-4">
        <div className="flex items-center gap-2 text-white/70">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading quiz...
        </div>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[#070b14] px-4">
        <div className="w-full max-w-md rounded-2xl bg-white/10 px-6 py-8 text-center text-white/80">
          <h1 className="text-xl font-semibold text-white">Quiz not found</h1>
          <p className="mt-2 text-sm">
            This quiz is not published or the link is no longer available.
          </p>
          <Button
            className="mt-6"
            variant="secondary"
            onClick={() => router.push("/discover")}
          >
            Back to Discover
          </Button>
        </div>
      </div>
    );
  }

  return <QuizDetailPageView quiz={quiz} />;
}
