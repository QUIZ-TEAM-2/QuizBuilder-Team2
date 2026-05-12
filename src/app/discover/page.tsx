"use client";

import Image from "next/image";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import DiscoverQuizCard from "@/components/quiz/DiscoverQuizCard";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpDown,
  ChevronRight,
  Compass,
  Gem,
  Search,
  Sparkles,
  TicketPercent,
  X,
} from "lucide-react";
import ConvexUserButton from "@/components/auth/convex-user-button";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

type DiscoverQuiz = {
  _id: string;
  title: string;
  description?: string;
  tags?: string[];
  topic?: string;
  featured?: boolean;
  featuredAt?: number;
  brandName?: string;
  brandAvatar?: string;
  coverImage?: string;
  _creationTime?: number;
  publishedAt?: number;
  viewCount?: number;
  components?: unknown[];
  background?: unknown;
};

type SortOption = "popular" | "newest";
type SortValue = SortOption | "none";
type SortDirection = "desc" | "asc";
type ExpandedSection =
  | "featured"
  | "popular"
  | "new"
  | "category"
  | "search"
  | "sort"
  | null;
type ShowcaseSection = "featured" | "popular" | "new";

type CategoryItem = {
  key: string;
  label: string;
  accent: string;
  imageSrc: string;
  tileClass: string;
};

const DISCOVER_CATEGORIES: CategoryItem[] = [
  {
    key: "general",
    label: "General",
    accent: "bg-[linear-gradient(135deg,#2d4a52_0%,#172127_100%)]",
    imageSrc: "/discover/categories/general.jpeg",
    tileClass: "md:col-span-2 md:row-span-2",
  },
  {
    key: "personality",
    label: "Personality",
    accent: "bg-[linear-gradient(135deg,#646c74_0%,#242933_100%)]",
    imageSrc: "/discover/categories/personality.jpeg",
    tileClass: "md:col-span-1 md:row-span-2",
  },
  {
    key: "beauty",
    label: "Beauty",
    accent: "bg-[linear-gradient(135deg,#6f7f89_0%,#2d3440_100%)]",
    imageSrc: "/discover/categories/beauty.jpeg",
    tileClass: "md:col-span-1 md:row-span-1",
  },
  {
    key: "fashion",
    label: "Fashion",
    accent: "bg-[linear-gradient(135deg,#695147_0%,#1d1719_100%)]",
    imageSrc: "/discover/categories/fashion.jpeg",
    tileClass: "md:col-span-1 md:row-span-1",
  },
  {
    key: "wellness",
    label: "Wellness",
    accent: "bg-[linear-gradient(135deg,#7a7451_0%,#2d241f_100%)]",
    imageSrc: "/discover/categories/wellness.jpeg",
    tileClass: "md:col-span-1 md:row-span-1",
  },
  {
    key: "education",
    label: "Education",
    accent: "bg-[linear-gradient(135deg,#4d6477_0%,#1d2530_100%)]",
    imageSrc: "/discover/categories/education.jpeg",
    tileClass: "md:col-span-1 md:row-span-1",
  },
  {
    key: "entertainment",
    label: "Entertainment",
    accent: "bg-[linear-gradient(135deg,#7f2f2f_0%,#241316_100%)]",
    imageSrc: "/discover/categories/entertainment.jpeg",
    tileClass: "md:col-span-2 md:row-span-1",
  },
  {
    key: "marketing",
    label: "Marketing",
    accent: "bg-[linear-gradient(135deg,#4f2e7b_0%,#1a1230_100%)]",
    imageSrc: "/discover/categories/marketing.jpeg",
    tileClass: "md:col-span-1 md:row-span-1",
  },
  {
    key: "lifestyle",
    label: "Lifestyle",
    accent: "bg-[linear-gradient(135deg,#0f6f92_0%,#0f2230_100%)]",
    imageSrc: "/discover/categories/lifestyle.jpeg",
    tileClass: "md:col-span-2 md:row-span-1",
  },
  {
    key: "others",
    label: "Others",
    accent: "bg-[linear-gradient(135deg,#46515d_0%,#151b22_100%)]",
    imageSrc: "/discover/categories/others.jpg",
    tileClass: "md:col-span-1 md:row-span-1",
  },
];

const normalizeCategoryValue = (value?: string) =>
  value?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";

const sortQuizzes = (
  quizzes: DiscoverQuiz[],
  sortBy: SortOption,
  direction: SortDirection = "desc"
) => {
  const items = [...quizzes];

  if (sortBy === "newest") {
    return items.sort((a, b) =>
      direction === "asc"
        ? (a._creationTime ?? 0) - (b._creationTime ?? 0)
        : (b._creationTime ?? 0) - (a._creationTime ?? 0)
    );
  }

  return items.sort((a, b) => {
    const comparison =
      (b.viewCount ?? 0) - (a.viewCount ?? 0) ||
      (b.tags?.length ?? 0) - (a.tags?.length ?? 0) ||
      (b._creationTime ?? 0) - (a._creationTime ?? 0);

    return direction === "asc" ? comparison * -1 : comparison;
  });
};

const shuffleQuizzes = (quizzes: DiscoverQuiz[]) => {
  const items = [...quizzes];

  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const currentItem = items[index];
    items[index] = items[swapIndex]!;
    items[swapIndex] = currentItem!;
  }

  return items;
};

function EditorialColumn({
  icon,
  title,
  description,
  isActive,
  onActivate,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  isActive: boolean;
  onActivate: () => void;
}) {
  return (
    <div
      onClick={onActivate}
      className={`space-y-6 rounded-[1.8rem] p-5 transition ${
        isActive
          ? "bg-white shadow-[0_16px_40px_rgba(15,23,42,0.06)]"
          : "bg-transparent"
      } cursor-pointer`}
    >
      <div className="space-y-5 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#272727]">
          {icon}
        </div>

        <div className="space-y-4 text-center">
          <h3 className="text-[2rem] font-semibold uppercase leading-none tracking-[-0.02em] text-[#202020]">
            {title}
          </h3>
          <p className="mx-auto max-w-md text-lg leading-9 text-[#4f4f4f]">
            {description}
          </p>
        </div>
      </div>

      <div className="h-5" />
    </div>
  );
}

function ShowcaseCarousel({
  eyebrow,
  quizzes,
  onSeeMore,
}: {
  eyebrow: string;
  quizzes: DiscoverQuiz[];
  onSeeMore: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) {
      return;
    }

    const updateScrollState = () => {
      const maxScrollLeft = container.scrollWidth - container.clientWidth;
      setCanScrollLeft(container.scrollLeft > 8);
      setCanScrollRight(container.scrollLeft < maxScrollLeft - 8);
    };

    updateScrollState();
    container.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);

    return () => {
      container.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [quizzes]);

  const scrollByAmount = (direction: "left" | "right") => {
    const container = scrollRef.current;
    if (!container) {
      return;
    }

    const amount = Math.min(420, container.clientWidth * 0.9);
    container.scrollBy({
      left: direction === "right" ? amount : -amount,
      behavior: "smooth",
    });
  };

  return (
    <div className="mt-14 space-y-5">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#2b2b2b]">
          {eyebrow}
        </p>
        <button
          type="button"
          onClick={onSeeMore}
          className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-[#ff3366] transition hover:text-[#d72658]"
        >
          See More Quizzes
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      <div className="relative">
        <div
          ref={scrollRef}
          className="-mx-4 overflow-x-auto px-4 pb-3 pr-20 [scrollbar-width:none] sm:-mx-6 sm:px-6 sm:pr-24 lg:mx-0 lg:px-0 lg:pr-28 [&::-webkit-scrollbar]:hidden"
        >
          <div className="flex snap-x snap-mandatory gap-5">
            {quizzes.map((quiz) => (
              <div
                key={quiz._id}
                className="w-[320px] min-w-[320px] shrink-0 snap-start sm:w-[360px] sm:min-w-[360px]"
              >
                <DiscoverQuizCard quiz={quiz} />
              </div>
            ))}
          </div>
        </div>

        {canScrollLeft ? (
          <button
            type="button"
            onClick={() => scrollByAmount("left")}
            className="absolute -left-4 top-1/2 hidden h-28 w-10 -translate-y-1/2 items-center justify-center rounded-r-[1.2rem] bg-[#ff3366] text-white shadow-[0_14px_28px_rgba(255,51,102,0.24)] transition hover:bg-[#e42d5d] md:flex"
            aria-label={`Scroll ${eyebrow} left`}
          >
            <ChevronRight className="h-5 w-5 rotate-180" strokeWidth={2.8} />
          </button>
        ) : null}

        {canScrollRight ? (
          <button
            type="button"
            onClick={() => scrollByAmount("right")}
            className="absolute -right-4 top-1/2 hidden h-28 w-10 -translate-y-1/2 items-center justify-center rounded-l-[1.2rem] bg-[#ff3366] text-white shadow-[0_14px_28px_rgba(255,51,102,0.24)] transition hover:bg-[#e42d5d] md:flex"
            aria-label={`Scroll ${eyebrow} right`}
          >
            <ChevronRight className="h-5 w-5" strokeWidth={2.8} />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function CategoryTile({
  category,
  onActivate,
}: {
  category: CategoryItem;
  onActivate: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onActivate}
      className={`group relative overflow-hidden rounded-none ${category.tileClass} cursor-pointer`}
    >
      <div className={`absolute inset-0 ${category.accent}`} />
      <Image
        src={category.imageSrc}
        alt={category.label}
        fill
        sizes="(min-width: 768px) 25vw, 100vw"
        className="object-cover brightness-[0.62] saturate-[0.82] transition duration-500 group-hover:scale-[1.03] group-hover:brightness-100 group-hover:saturate-100"
      />
      <div className="absolute inset-0 bg-black/52 transition duration-300 group-hover:bg-black/18" />

      <div className="relative min-h-[220px] h-full md:min-h-[280px]">
        <div className="absolute inset-0 flex items-center justify-center p-5">
          <div className="inline-flex min-w-[200px] max-w-[78%] flex-col items-center justify-center gap-4 px-8 py-6 text-center transition duration-300">
            <p className="text-center text-[1.35rem] font-semibold uppercase tracking-[0.08em] text-white transition duration-300 md:text-[1.75rem]">
              {category.label}
            </p>
            <div className="mx-auto h-1.5 w-10 rounded-full bg-white transition duration-300 group-hover:w-16" />
          </div>
        </div>
      </div>
    </button>
  );
}

function HeroQuizCarousel({
  quizzes,
  activeIndex,
  onPrev,
  onNext,
  onSelect,
}: {
  quizzes: DiscoverQuiz[];
  activeIndex: number;
  onPrev: () => void;
  onNext: () => void;
  onSelect: (index: number) => void;
}) {
  const router = useRouter();

  const activeQuiz = quizzes[activeIndex];
  const activeBrandName = activeQuiz?.brandName?.trim() || "VisionVerse";

  const handleOpenDetails = () => {
    if (!activeQuiz?._id) {
      return;
    }

    router.push(`/discover/${activeQuiz._id}`);
  };

  if (quizzes.length === 0) {
    return (
      <div className="space-y-5">
        <div className="overflow-hidden rounded-[2rem] bg-white p-4 shadow-[0_28px_80px_rgba(15,23,42,0.12)]">
          <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white">
            <div className="flex aspect-[4/3] items-center justify-center bg-[#f3ece7] px-8 text-center text-slate-500">
              Quizzes will appear here
            </div>
          <div className="space-y-3 px-5 pb-5 pt-6">
            <div className="h-9 w-40 rounded-md bg-slate-100" />
            <div className="flex items-center justify-end gap-2">
              <div className="h-10 w-10 rounded-full border border-slate-200 bg-slate-100" />
                <div className="h-5 w-28 rounded-md bg-slate-100" />
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <span className="h-3.5 w-3.5 rounded-full bg-[#202020]" />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ece7e2] text-slate-500">
              <ChevronRight className="h-5 w-5 rotate-180" />
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ece7e2] text-slate-500">
              <ChevronRight className="h-5 w-5" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-[2rem] bg-white p-4 shadow-[0_28px_80px_rgba(15,23,42,0.12)]">
        <button
          type="button"
          onClick={handleOpenDetails}
          className="block w-full overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white text-left shadow-sm transition hover:shadow-md"
        >
          <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#f3ece7] after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:z-10 after:h-12 after:bg-gradient-to-t after:from-white/80 after:to-transparent">
            {quizzes.map((quiz, index) => {
              const isActive = index === activeIndex;

              return (
                <div
                  key={`${quiz._id}-${index}`}
                  className={`absolute inset-0 transition duration-500 ${
                    isActive
                      ? "translate-x-0 scale-100 opacity-100"
                      : "pointer-events-none translate-x-8 scale-[0.98] opacity-0"
                  }`}
                >
                  {quiz.coverImage ? (
                    <Image
                      src={quiz.coverImage}
                      alt={quiz.title}
                      fill
                      sizes="(min-width: 1024px) 470px, 100vw"
                      className="object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-[linear-gradient(135deg,#ece5df_0%,#d9d1cb_100%)]" />
                  )}
                </div>
              );
            })}
          </div>

          <div className="space-y-4 bg-white px-5 pb-5 pt-6">
            <h3 className="line-clamp-2 text-[1.05rem] font-semibold leading-snug text-slate-950 sm:text-[1.15rem]">
              {activeQuiz?.title || "Untitled Quiz"}
            </h3>

            <div className="flex items-center justify-end gap-3 text-[#687385]">
              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                {activeQuiz?.brandAvatar ? (
                  <Image
                    src={activeQuiz.brandAvatar}
                    alt={activeBrandName}
                    fill
                    sizes="40px"
                    className="object-cover"
                  />
                ) : (
                  <span className="text-sm font-semibold text-slate-500">
                    {(
                      activeBrandName.charAt(0) ||
                      activeQuiz?.title?.trim().charAt(0) ||
                      "Q"
                    ).toUpperCase()}
                  </span>
                )}
              </div>
              <p className="min-w-0 max-w-[12rem] truncate text-sm font-medium text-slate-500">
                {activeBrandName}
              </p>
            </div>
          </div>
        </button>
      </div>

      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          {quizzes.map((_, dotIndex) => (
            <button
              key={dotIndex}
              type="button"
              onClick={() => onSelect(dotIndex)}
              className={`h-3.5 w-3.5 rounded-full transition ${
                dotIndex === activeIndex
                  ? "bg-[#202020]"
                  : "bg-[#d0d0d0] hover:bg-[#b9b9b9]"
              }`}
              aria-label={`Show slide ${dotIndex + 1}`}
            />
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onPrev}
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ece7e2] text-slate-700 transition hover:bg-[#dfd7d0]"
            aria-label="Previous slide"
          >
            <ChevronRight className="h-5 w-5 rotate-180" />
          </button>
          <button
            type="button"
            onClick={onNext}
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ece7e2] text-slate-700 transition hover:bg-[#dfd7d0]"
            aria-label="Next slide"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DiscoverPage() {
  const router = useRouter();
  const pageTopRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const quizzes = useQuery(api.quiz.getPublishedQuizzes);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortValue>("none");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [expandedSection, setExpandedSection] = useState<ExpandedSection>(null);
  const [activeShowcase, setActiveShowcase] = useState<ShowcaseSection>("featured");
  const [heroCardIndex, setHeroCardIndex] = useState(0);
  const [activeCategory, setActiveCategory] = useState<CategoryItem | null>(null);

  const sourceQuizzes = useMemo(() => (quizzes ?? []) as DiscoverQuiz[], [quizzes]);

  const filteredQuizzes = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return sourceQuizzes;
    }

    return sourceQuizzes.filter((quiz) =>
      [
        quiz.title,
        quiz.description,
        quiz.brandName,
        quiz.topic,
        ...(quiz.tags ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [search, sourceQuizzes]);

  const featuredQuizzes = useMemo(
    () => {
      const markedFeatured = filteredQuizzes.filter((quiz) => quiz.featured);

      if (markedFeatured.length > 0) {
        return [...markedFeatured].sort((a, b) => {
          const left = b.featuredAt ?? b.publishedAt ?? b._creationTime ?? 0;
          const right = a.featuredAt ?? a.publishedAt ?? a._creationTime ?? 0;
          return left - right;
        });
      }

      return [...filteredQuizzes].sort(
        (a, b) =>
          (b.publishedAt ?? b._creationTime ?? 0) -
          (a.publishedAt ?? a._creationTime ?? 0)
      );
    },
    [filteredQuizzes]
  );
  const popularQuizzes = useMemo(() => sortQuizzes(filteredQuizzes, "popular"), [filteredQuizzes]);
  const newQuizzes = useMemo(
    () =>
      [...filteredQuizzes].sort(
        (a, b) =>
          (b.publishedAt ?? b._creationTime ?? 0) -
          (a.publishedAt ?? a._creationTime ?? 0)
      ),
    [filteredQuizzes]
  );
  const categoryQuizzes = useMemo(() => {
    if (!activeCategory) {
      return [];
    }

    const categoryKey = normalizeCategoryValue(activeCategory.key);
    const categoryLabel = normalizeCategoryValue(activeCategory.label);

    return filteredQuizzes.filter((quiz) => {
      const topic = normalizeCategoryValue(quiz.topic);
      const tags = (quiz.tags ?? []).map(normalizeCategoryValue);

      return (
        topic === categoryKey ||
        topic === categoryLabel ||
        tags.includes(categoryKey) ||
        tags.includes(categoryLabel)
      );
    });
  }, [activeCategory, filteredQuizzes]);

  const heroCarouselQuizzes = useMemo(() => {
    const pool = sourceQuizzes.length > 0 ? sourceQuizzes : featuredQuizzes;
    return shuffleQuizzes(pool).slice(0, 5);
  }, [featuredQuizzes, sourceQuizzes]);
  const activeHeroQuiz = heroCarouselQuizzes[heroCardIndex];

  const showPrevHeroCard = () => {
    if (heroCarouselQuizzes.length <= 1) {
      return;
    }

    setHeroCardIndex((current) =>
      current === 0 ? heroCarouselQuizzes.length - 1 : current - 1
    );
  };

  const showNextHeroCard = () => {
    if (heroCarouselQuizzes.length <= 1) {
      return;
    }

    setHeroCardIndex((current) => (current + 1) % heroCarouselQuizzes.length);
  };

  useEffect(() => {
    setHeroCardIndex(0);
  }, [heroCarouselQuizzes.length]);

  useEffect(() => {
    if (heroCarouselQuizzes.length <= 1) {
      return;
    }

    const timer = window.setInterval(() => {
      setHeroCardIndex((current) => (current + 1) % heroCarouselQuizzes.length);
    }, 3200);

    return () => window.clearInterval(timer);
  }, [heroCarouselQuizzes]);

  const clearSort = () => {
    setSortBy("none");
    setSortDirection("desc");
    setExpandedSection(search.trim().length > 0 ? "search" : null);
  };

  const expandSection = (section: ExpandedSection) => {
    if (section !== "category") {
      setActiveCategory(null);
    }
    setExpandedSection(section);
    pageTopRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const expandCategory = (category: CategoryItem) => {
    setActiveCategory(category);
    setExpandedSection("category");
    pageTopRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const showcaseQuizzes =
    activeShowcase === "featured"
      ? featuredQuizzes
      : activeShowcase === "popular"
        ? popularQuizzes
        : newQuizzes;

  const showcaseEyebrow =
    activeShowcase === "featured"
      ? "Featured quizzes"
      : activeShowcase === "popular"
        ? "Popular quizzes"
        : "New quizzes";
  const handleShowcaseSeeMore = () => {
    expandSection(activeShowcase);
  };

  const expandedQuizzes = useMemo(() => {
    if (expandedSection === "search") {
      return filteredQuizzes;
    }

    if (expandedSection === "sort") {
      return sortQuizzes(
        filteredQuizzes,
        sortBy === "none" ? "popular" : sortBy,
        sortDirection
      );
    }

    if (expandedSection === "featured") {
      return featuredQuizzes;
    }

    if (expandedSection === "popular") {
      return popularQuizzes;
    }

    if (expandedSection === "new") {
      return newQuizzes;
    }

    if (expandedSection === "category") {
      return categoryQuizzes;
    }

    return [];
  }, [
    categoryQuizzes,
    expandedSection,
    featuredQuizzes,
    filteredQuizzes,
    newQuizzes,
    popularQuizzes,
    sortBy,
    sortDirection,
  ]);

  const expandedEyebrow =
    expandedSection === "search"
      ? "Search results"
      : expandedSection === "sort"
        ? "Sorted results"
        : expandedSection === "featured"
          ? "Featured"
          : expandedSection === "popular"
            ? "Popular"
            : expandedSection === "category"
              ? activeCategory?.label ?? "Category"
              : "New";

  return (
    <div className="min-h-screen bg-[#fbf5f3] text-slate-950">
      <div ref={pageTopRef} className="bg-[#242424] text-white">
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
              <div className="relative">
                <Search className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/55" />
                <input
                  value={search}
                  onChange={(e) => {
                    const nextValue = e.target.value;
                    const hasQuery = nextValue.trim().length > 0;

                    setSearch(nextValue);
                    setExpandedSection(hasQuery ? "search" : null);

                    if (hasQuery) {
                      pageTopRef.current?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      });
                    }
                  }}
                  placeholder="Search quizzes"
                  className="h-14 w-full rounded-full border border-white/10 bg-white/10 pl-12 pr-4 text-base text-white outline-none backdrop-blur transition placeholder:text-white/45 focus:border-white/25 focus:bg-white/14 lg:min-w-[360px] xl:min-w-[520px]"
                />
              </div>

              {expandedSection === null ||
              expandedSection === "sort" ||
              expandedSection === "search" ? (
                <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-white/75 backdrop-blur lg:shrink-0">
                  {expandedSection !== "sort" ? (
                    <ArrowUpDown className="h-4 w-4 text-white/75" />
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setSortDirection((current) => (current === "desc" ? "asc" : "desc"));

                        if (sortBy !== "none") {
                          setExpandedSection("sort");
                          pageTopRef.current?.scrollIntoView({
                            behavior: "smooth",
                            block: "start",
                          });
                        }
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white transition hover:bg-white/20"
                      aria-label={
                        sortDirection === "desc"
                          ? "Switch to ascending sort"
                          : "Switch to descending sort"
                      }
                    >
                      <span className="text-sm font-semibold leading-none">
                        {sortDirection === "desc" ? "↓" : "↑"}
                      </span>
                    </button>
                  )}

                  <Select
                    key={sortBy}
                    value={sortBy === "none" ? undefined : sortBy}
                    onValueChange={(value) => {
                      setSortBy(value as SortOption);
                      setExpandedSection("sort");
                      pageTopRef.current?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      });
                    }}
                  >
                    <SelectTrigger className="h-auto min-w-[88px] border-0 bg-transparent px-0 py-0 text-white shadow-none focus:ring-0 focus:ring-offset-0">
                      <SelectValue placeholder="Sort" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="popular">Most popular</SelectItem>
                      <SelectItem value="newest">Newest first</SelectItem>
                    </SelectContent>
                  </Select>

                  {sortBy !== "none" ? (
                    <button
                      type="button"
                      onClick={clearSort}
                      className="flex h-7 w-7 items-center justify-center rounded-full text-white/55 transition hover:bg-white/15 hover:text-white"
                      aria-label="Clear sort"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              ) : null}

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
      </div>

      <main className="pb-24">
        {expandedSection === null ? (
          <>
            <section
              ref={heroRef}
              className="relative overflow-hidden bg-[#f7f2ee] text-white"
            >
              <div className="absolute inset-0 bg-fixed [background-image:radial-gradient(circle_at_top_left,rgba(255,255,255,0.98),rgba(255,255,255,0.9)_32%,rgba(247,242,238,0.96)_64%),linear-gradient(135deg,#f7f2ee_0%,#f1e9e3_48%,#fbf8f5_100%)]" />
              <div className="absolute inset-0 opacity-70 [background-image:linear-gradient(rgba(15,23,42,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.035)_1px,transparent_1px)] [background-size:36px_36px]" />
              <div className="absolute -left-24 top-16 h-72 w-72 rounded-full bg-[#ff3366]/10 blur-3xl" />
              <div className="absolute right-10 top-24 h-80 w-80 rounded-full bg-[#2563eb]/8 blur-3xl" />

              <div className="relative mx-auto max-w-[1500px] px-6 py-16 lg:px-12 lg:py-20">
                <div className="grid min-h-[68vh] items-center gap-12 lg:grid-cols-[minmax(340px,470px)_minmax(0,1fr)] lg:gap-20">
                  <div className="order-2 lg:order-1">
                    <div className="relative mx-auto w-full max-w-[470px]">
                      <div className="absolute -inset-6 rounded-[2.2rem] bg-[#202020]/6 blur-2xl" />
                      <div className="relative">
                        <HeroQuizCarousel
                          quizzes={heroCarouselQuizzes}
                          activeIndex={heroCardIndex}
                          onPrev={showPrevHeroCard}
                          onNext={showNextHeroCard}
                          onSelect={setHeroCardIndex}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="order-1 flex flex-col items-start justify-center text-left lg:order-2 lg:pl-10">
                    <p className="text-sm font-semibold uppercase tracking-[0.35em] text-[#5f5a57]">
                      Discover Public Quizzes
                    </p>
                    <h2 className="mt-6 max-w-4xl text-[clamp(3rem,6vw,6rem)] font-semibold uppercase leading-[0.92] tracking-[-0.04em] text-[#202020]">
                      Find Your Next Favorite Quiz
                    </h2>
                    <div className="mt-5 h-1.5 w-28 rounded-full bg-[#ff3366]" />
                    <p className="mt-8 max-w-3xl text-[1.15rem] leading-9 text-[#4e4a46] sm:text-[1.35rem]">
                      {activeHeroQuiz?.description?.trim() ||
                        "Open a public quiz, explore its flow, and discover a new example worth building from."}
                    </p>
                    <div className="mt-12 flex flex-col items-start gap-5">
                      <Button
                        className="h-14 min-w-[220px] rounded-none bg-[#ff3366] px-10 text-lg font-semibold uppercase tracking-[0.08em] text-white hover:bg-[#e42d5d]"
                        onClick={() => {
                          setActiveShowcase("featured");
                          document.getElementById("discover-sections")?.scrollIntoView({
                            behavior: "smooth",
                            block: "start",
                          });
                        }}
                      >
                        Explore Featured
                      </Button>
                      <button
                        type="button"
                        className="text-lg font-medium text-[#4e4a46] transition hover:text-[#202020]"
                        onClick={() => {
                          document.getElementById("discover-sections")?.scrollIntoView({
                            behavior: "smooth",
                            block: "start",
                          });
                        }}
                      >
                        Discover the experience
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        document.getElementById("discover-sections")?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        });
                      }}
                      className="mt-16 text-[#c68a33] transition hover:text-[#a8642b]"
                      aria-label="Scroll to discover sections"
                    >
                      <ArrowDown className="h-8 w-8" />
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section
              id="discover-sections"
              className="relative bg-[#fbf5f3] py-20 sm:py-24"
            >
              <div className="absolute inset-0 opacity-50 [background-image:radial-gradient(circle_at_1px_1px,rgba(15,23,42,0.07)_1px,transparent_0)] [background-size:22px_22px]" />
              <div className="relative mx-auto max-w-[1720px] px-4 lg:px-8">
                <div className="rounded-[2.4rem] border border-[#eadfd8] bg-[#fcf6f3] p-5 shadow-[0_22px_60px_rgba(15,23,42,0.06)] sm:p-7 lg:p-8">
                  <div className="grid gap-10 pb-8 lg:grid-cols-3">
                  <EditorialColumn
                    icon={<Gem className="h-7 w-7 text-[#242424]" />}
                    title="Featured"
                    description="Hand-picked quizzes worth opening first, with stronger visual identity and polished examples."
                    isActive={activeShowcase === "featured"}
                    onActivate={() => setActiveShowcase("featured")}
                  />
                  <EditorialColumn
                    icon={<Compass className="h-7 w-7 text-[#242424]" />}
                    title="Popular"
                    description="Browse the quizzes drawing the most real attention, ranked by public view activity."
                    isActive={activeShowcase === "popular"}
                    onActivate={() => setActiveShowcase("popular")}
                  />
                  <EditorialColumn
                    icon={<TicketPercent className="h-7 w-7 text-[#242424]" />}
                    title="New"
                    description="See the freshest published quizzes first and track what creators have just released."
                    isActive={activeShowcase === "new"}
                    onActivate={() => setActiveShowcase("new")}
                  />
                </div>

                  <ShowcaseCarousel
                    eyebrow={showcaseEyebrow}
                    quizzes={showcaseQuizzes}
                    onSeeMore={handleShowcaseSeeMore}
                  />
                </div>
              </div>
            </section>

            <section className="bg-white py-20 sm:py-24">
              <div className="mx-auto max-w-[1500px] px-6 lg:px-12">
                <div className="mx-auto max-w-4xl text-center">
                  <h3 className="text-[clamp(1.9rem,3.3vw,3.2rem)] font-semibold uppercase leading-none tracking-[-0.03em] text-[#202020]">
                    Browse By Category
                  </h3>
                  <div className="mx-auto mt-6 h-1.5 w-20 rounded-full bg-[#ff3366]" />
                </div>

                <div className="mt-14 grid gap-0 md:grid-cols-4 md:auto-rows-[185px]">
                  {DISCOVER_CATEGORIES.map((category) => (
                    <CategoryTile
                      key={category.key}
                      category={category}
                      onActivate={() => expandCategory(category)}
                    />
                  ))}
                </div>
              </div>
            </section>
          </>
        ) : (
          <section className="mx-auto max-w-[1500px] px-6 py-16 lg:px-12 lg:py-20">
            <div className="rounded-[2.2rem] border border-[#e7ddd7] bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)] sm:p-8">
              <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-500">
                    {expandedEyebrow}
                  </p>
                  <h3 className="mt-3 text-3xl font-semibold uppercase tracking-[-0.02em] text-slate-950">
                    {expandedEyebrow === "Search results"
                      ? "Matching Quizzes"
                      : expandedEyebrow === "Sorted results"
                        ? "Sorted Quizzes"
                        : `${expandedEyebrow} Quizzes`}
                  </h3>
                </div>

                <Button
                  variant="outline"
                  className="rounded-full border-slate-200 bg-white"
                  onClick={() => {
                    if (expandedSection === "search") {
                      setSearch("");
                    }
                    setActiveCategory(null);
                    clearSort();
                    setExpandedSection(null);
                  }}
                >
                  Back to Discover
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                {expandedQuizzes.map((quiz) => (
                  <DiscoverQuizCard key={quiz._id} quiz={quiz} />
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-[#eadfd8] bg-[#fbf5f3] py-8 text-center">
        <p className="text-sm font-medium text-slate-500">© 2026 QuizBuilder</p>
      </footer>
    </div>
  );
}
