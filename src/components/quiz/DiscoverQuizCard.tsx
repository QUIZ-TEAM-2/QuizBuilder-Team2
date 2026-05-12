"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

const DEFAULT_BRAND_NAME = "VisionVerse";

type Props = {
  quiz: {
    _id: string;
    title: string;
    brandName?: string;
    brandAvatar?: string;
    coverImage?: string;
  };
};

export default function DiscoverQuizCard({
  quiz,
}: Props) {
  const router = useRouter();
  const brandName = quiz.brandName?.trim() || DEFAULT_BRAND_NAME;

  const handleOpenDetails = () => {
    router.push(`/discover/${quiz._id}`);
  };

  return (
    <button
      type="button"
      onClick={handleOpenDetails}
      className="
        block
        w-full
        overflow-hidden
        border
        border-slate-200
        rounded-xl
        bg-white
        text-left
        shadow-sm
        transition
        hover:shadow-md
      "
    >
      {quiz.coverImage ? (
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-slate-100 after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-10 after:bg-gradient-to-t after:from-white/80 after:to-transparent">
          <Image
            src={quiz.coverImage}
            alt={quiz.title}
            fill
            sizes="(min-width: 1280px) 360px, (min-width: 768px) 320px, 100vw"
            className="object-cover"
          />
        </div>
      ) : null}

      <div className="space-y-3 px-4 pb-4 pt-5">
        <h3 className="line-clamp-2 text-base font-semibold leading-snug text-slate-950">
          {quiz.title}
        </h3>

        <div className="flex items-center justify-end gap-2">
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100">
            {quiz.brandAvatar ? (
              <Image
                src={quiz.brandAvatar}
                alt={brandName}
                fill
                sizes="32px"
                className="object-cover"
              />
            ) : (
              <span className="text-xs font-semibold text-slate-500">
                {brandName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          <p className="min-w-0 max-w-[12rem] truncate text-sm font-medium text-slate-500">
            {brandName}
          </p>
        </div>
      </div>
    </button>
  );
}
