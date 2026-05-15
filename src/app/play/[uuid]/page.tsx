"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, Loader2 } from "lucide-react";
import PhonePreview from "@/components/editor/PhonePreview";
import { Button } from "@/components/ui/button";
import { api } from "../../../../convex/_generated/api";
import type {
  Component,
  Id,
  PageAction,
  PageBackground,
  QuestionMode,
} from "@/types";
import {
  computeRankingResultMapping,
  getRankingItemResultMappings,
  getRankingPositionWeights,
  RANKING_MAX_ITEMS,
} from "@/components/quiz/components/Ranking/types";
import {
  computeMatchingResultMapping,
  isMatchingPairMapping,
} from "@/components/quiz/components/Matching/types";
import {
  computeSliderResultMapping,
  getSliderIntervalIndex,
  getSliderIntervalResultMappings,
  getSliderResultTotals,
  normalizeSliderConfig,
} from "@/components/quiz/components/Slider/types";
import type { PageTransitionEffect } from "@/lib/pageTransitions";
import {
  createClientSessionId,
  getExperienceMetaLabel,
  getMissingQuizStateCopy,
  getQuizLoadingLabel,
  getStartExperienceLabel,
  resolveQuizPlaySurfaceFromFlag,
} from "@/lib/quiz-access-rules";
import { toast } from "sonner";

type PlayPage = {
  _id: Id<"pages"> | string;
  components?: Component[];
  background?: PageBackground;
  pageName?: string;
  transitionEffect?: PageTransitionEffect;

  // new fields for quiz play
  questionMode?: QuestionMode;
};

type PlayResponse = {
  answerBoxId: string;
  questionType?: "answerBox" | "ranking" | "input" | "matching" | "slider";
  rankingOrder?: string[];
  inputValue?: string;
  sliderValue?: number;
  sliderInterval?: number;
  matchingPairs?: Record<string, string>;
  resultMapping: Record<string, number>;
};

function getClientLanguage(): "en" | "cn" {
  try {
    const raw =
      (typeof navigator !== "undefined" ? navigator.language : "") || "";
    const lower = raw.toLowerCase();
    return lower.startsWith("zh") ? "cn" : "en";
  } catch {
    return "en";
  }
}

const logQuizPlayDebug = (label: string, payload?: Record<string, unknown>) => {
  console.log(`[quiz-play] ${label}`, payload ?? {});
};

function calculatePreviewResult(
  responsesByPage: Record<string, PlayResponse[]>,
  resultIds: string[],
) {
  const totalScores: Record<string, number> = {};

  resultIds.forEach((resultId) => {
    totalScores[resultId] = 0;
  });

  Object.values(responsesByPage).forEach((responses) => {
    responses.forEach((response) => {
      Object.entries(response.resultMapping).forEach(([resultId, score]) => {
        if (totalScores[resultId] !== undefined) {
          totalScores[resultId] += score;
        }
      });
    });
  });

  let winningResultPageId = "";
  let highestScore = -Infinity;

  resultIds.forEach((resultId) => {
    const score = totalScores[resultId] ?? 0;
    if (score > highestScore) {
      highestScore = score;
      winningResultPageId = resultId;
    }
  });

  return {
    winningResultPageId,
    totalScores,
  };
}

function slugLeadField(
  props: Record<string, unknown> | undefined,
  actionProps: Record<string, unknown> | undefined,
): string {
  const v = props?.leadField ?? actionProps?.leadField;
  return typeof v === "string" ? v.trim().toLowerCase() : "";
}

export default function PlayQuizPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const uuid = params?.uuid as string | undefined;
  const playSurface = resolveQuizPlaySurfaceFromFlag(
    searchParams?.get("preview"),
  );
  const isPreviewMode = playSurface === "preview";
  const playSource = searchParams?.get("source");
  const returnTo = searchParams?.get("returnTo");

  const [sessionId] = useState<string>(() =>
    createClientSessionId(playSurface, crypto.randomUUID()),
  );
  const [language] = useState<"en" | "cn">(() => getClientLanguage());
  const [quizStarted, setQuizStarted] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [resultPage, setResultPage] = useState<PlayPage | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<Component[]>([]);
  const [rankingOrderByComponent, setRankingOrderByComponent] = useState<
    Record<string, string[]>
  >({});
  const [matchingPairsByComponent, setMatchingPairsByComponent] = useState<
    Record<string, Record<string, string>>
  >({});
  const matchingPairsByComponentRef = useRef<
    Record<string, Record<string, string>>
  >({});
  const [inputValueByComponent, setInputValueByComponent] = useState<
    Record<string, string>
  >({});
  const [sliderValueByComponent, setSliderValueByComponent] = useState<
    Record<string, number>
  >({});
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [isCalculatingResults, setIsCalculatingResults] = useState(false);
  const [isDesktopViewport, setIsDesktopViewport] = useState<boolean | null>(
    () =>
      typeof window === "undefined"
        ? null
        : window.matchMedia("(min-width: 768px)").matches,
  );
  const bgmAudioRef = useRef<HTMLAudioElement>(null);
  const bgmSrcRef = useRef<string>("");
  const bgmUserMutedRef = useRef(false);
  const [bgmMuted, setBgmMuted] = useState(false);
  const [bgmBlocked, setBgmBlocked] = useState(false);
  const loggedViewSessionIdsRef = useRef(new Set<string>());
  const previewResponsesByPageRef = useRef<Record<string, PlayResponse[]>>({});

  const publicQuizQuery = useQuery(
    api.quiz.getPublicQuiz,
    uuid && !isPreviewMode ? { id: uuid as any } : "skip",
  );
  const previewQuizQuery = useQuery(
    api.quiz.getPreviewQuiz,
    uuid && isPreviewMode ? { id: uuid as any } : "skip",
  );
  const quizQuery = isPreviewMode ? previewQuizQuery : publicQuizQuery;

  const startSession = useMutation(api.quizPlay.startQuizSession);
  const recordQuizView = useMutation(api.quizPlay.recordQuizView);
  const updateSession = useMutation(api.quizPlay.updateQuizSession);
  const setQuizPageResponses = useMutation(api.quizPlay.setQuizPageResponses);
  const calculateResults = useMutation(api.quizPlay.calculateQuizResults);
  const recordCtaClickMutation = useMutation(api.quizPlay.recordCtaClick);
  const recordResultPageViewMutation = useMutation(
    api.quizPlay.recordResultPageView,
  );
  const submitQuizLeadMutation = useMutation(api.quizPlay.submitQuizLead);

  const pages = useMemo<PlayPage[]>(
    () => (quizQuery?.pages ?? []) as PlayPage[],
    [quizQuery?.pages],
  );

  const results = useMemo<PlayPage[]>(
    () => (quizQuery?.results ?? []) as PlayPage[],
    [quizQuery?.results],
  );

  const resultIds = useMemo(
    () =>
      Array.isArray((quizQuery as { resultIds?: unknown } | null)?.resultIds)
        ? (
            (quizQuery as { resultIds?: Array<string | Id<"results">> })
              .resultIds ?? []
          ).map(String)
        : results.map((result) => String(result._id)),
    [quizQuery, results],
  );

  const onboardingPage = useMemo<PlayPage | null>(
    () =>
      quizQuery?.onboardingPage ? (quizQuery.onboardingPage as PlayPage) : null,
    [quizQuery?.onboardingPage],
  );

  const totalQuestions = pages.length;
  const currentQuestionPage =
    totalQuestions > 0 ? pages[currentPageIndex] : undefined;
  const questionMode = currentQuestionPage?.questionMode ?? "single";
  const shouldShowOnboarding = !quizStarted && Boolean(onboardingPage);
  const displayPage =
    shouldShowOnboarding && onboardingPage
      ? onboardingPage
      : quizCompleted && resultPage
        ? resultPage
        : currentQuestionPage;

  const displayComponents = useMemo(
    () => (displayPage?.components ?? []) as Component[],
    [displayPage?.components],
  );

  const activeBGM = useMemo(() => {
    const component = displayComponents.find(
      (item) =>
        item.type === "bgm" && typeof item.data === "string" && item.data,
    );
    if (!component?.data) return null;

    const props = component.props ?? {};
    return {
      src: component.data,
      muted: typeof props.muted === "boolean" ? props.muted : false,
      volume:
        typeof props.volume === "number"
          ? Math.min(100, Math.max(0, props.volume))
          : 70,
      loop: typeof props.loop === "boolean" ? props.loop : true,
    };
  }, [displayComponents]);

  const isLoading = quizQuery === undefined;
  const quizNotFound = quizQuery === null;

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 768px)");
    const handleChange = (event: MediaQueryListEvent) => {
      setIsDesktopViewport(event.matches);
    };

    setIsDesktopViewport(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const playActiveBGM = useCallback(async () => {
    const audio = bgmAudioRef.current;
    if (!audio || !activeBGM) return;

    try {
      await audio.play();
      setBgmBlocked(false);
    } catch {
      setBgmBlocked(true);
    }
  }, [activeBGM]);

  useEffect(() => {
    const audio = bgmAudioRef.current;
    if (!audio) return;

    if (!activeBGM) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      bgmSrcRef.current = "";
      setBgmBlocked(false);
      return;
    }

    const sourceChanged = bgmSrcRef.current !== activeBGM.src;
    if (sourceChanged) {
      bgmSrcRef.current = activeBGM.src;
      audio.src = activeBGM.src;
      audio.load();
      if (!bgmUserMutedRef.current) {
        setBgmMuted(activeBGM.muted);
      }
    }

    const nextMuted = bgmUserMutedRef.current ? bgmMuted : activeBGM.muted;
    audio.muted = nextMuted;
    audio.volume = activeBGM.volume / 100;
    audio.loop = activeBGM.loop;

    if (nextMuted) {
      audio.pause();
      setBgmBlocked(false);
      return;
    }

    void playActiveBGM();
  }, [activeBGM, bgmMuted, playActiveBGM]);

  useEffect(() => {
    if (!activeBGM || bgmMuted) return;

    const handleFirstInteraction = () => {
      void playActiveBGM();
    };

    window.addEventListener("pointerdown", handleFirstInteraction, {
      once: true,
      capture: true,
    });
    window.addEventListener("keydown", handleFirstInteraction, {
      once: true,
      capture: true,
    });

    return () => {
      window.removeEventListener("pointerdown", handleFirstInteraction, {
        capture: true,
      });
      window.removeEventListener("keydown", handleFirstInteraction, {
        capture: true,
      });
    };
  }, [activeBGM, bgmMuted, playActiveBGM]);

  const handleBGMToggleMute = useCallback(() => {
    if (!activeBGM) return;

    if (bgmBlocked && !bgmMuted) {
      void playActiveBGM();
      return;
    }

    bgmUserMutedRef.current = true;
    setBgmMuted((current) => {
      const nextMuted = !current;
      const audio = bgmAudioRef.current;
      if (audio) {
        audio.muted = nextMuted;
        if (nextMuted) {
          audio.pause();
          setBgmBlocked(false);
        } else {
          void audio.play().then(
            () => setBgmBlocked(false),
            () => setBgmBlocked(true),
          );
        }
      }
      return nextMuted;
    });
  }, [activeBGM, bgmBlocked, bgmMuted, playActiveBGM]);

  useEffect(() => {
    if (isPreviewMode) {
      return;
    }

    if (!quizQuery?._id) {
      return;
    }

    if (loggedViewSessionIdsRef.current.has(sessionId)) {
      return;
    }

    loggedViewSessionIdsRef.current.add(sessionId);

    void recordQuizView({
      quizId: quizQuery._id,
      sessionId,
      language,
    }).catch((error) => {
      loggedViewSessionIdsRef.current.delete(sessionId);
      console.error("Failed to record quiz view", error);
    });
  }, [isPreviewMode, quizQuery?._id, recordQuizView, sessionId, language]);

  /** Result page impressions for CTR denominators */
  useEffect(() => {
    if (isPreviewMode) return;
    if (!quizCompleted || !resultPage || !quizQuery?._id) return;
    void recordResultPageViewMutation({
      quizId: quizQuery._id,
      sessionId,
      resultPageId: String(resultPage._id),
    });
  }, [
    isPreviewMode,
    quizCompleted,
    quizQuery?._id,
    recordResultPageViewMutation,
    resultPage,
    sessionId,
  ]);

  const pageDebugSummary = useMemo(
    () =>
      pages.map((page, index) => ({
        index,
        pageId: String(page._id),
        pageName: page.pageName ?? `Page ${index + 1}`,
        questionMode: page.questionMode ?? "single",
        componentCount: page.components?.length ?? 0,
      })),
    [pages],
  );

  const currentPageDebug = useMemo(
    () =>
      currentQuestionPage
        ? {
            index: currentPageIndex,
            pageId: String(currentQuestionPage._id),
            pageName:
              currentQuestionPage.pageName ?? `Page ${currentPageIndex + 1}`,
            questionMode,
            componentIds:
              currentQuestionPage.components?.map(
                (component) => component.id,
              ) ?? [],
            answerBoxIds:
              currentQuestionPage.components
                ?.filter((component) => component.action === "answerBox")
                .map((component) => component.id) ?? [],
          }
        : null,
    [currentPageIndex, currentQuestionPage, questionMode],
  );

  const handleRankingChange = useCallback(
    (componentId: string, rankingOrder: string[]) => {
      setRankingOrderByComponent((prev) => ({
        ...prev,
        [componentId]: rankingOrder,
      }));
    },
    [],
  );

  const handleTextChange = useCallback((componentId: string, text: string) => {
    setInputValueByComponent((prev) => ({
      ...prev,
      [componentId]: text,
    }));
  }, []);

  const handleMatchingChange = useCallback(
    (componentId: string, pairs: Record<string, string>) => {
      matchingPairsByComponentRef.current = {
        ...matchingPairsByComponentRef.current,
        [componentId]: pairs,
      };
      setMatchingPairsByComponent((prev) => ({
        ...prev,
        [componentId]: pairs,
      }));
    },
    [],
  );

  const handleSliderChange = useCallback(
    (componentId: string, value: number) => {
      setSliderValueByComponent((prev) => ({
        ...prev,
        [componentId]: value,
      }));
    },
    [],
  );

  /**
   * Writes quizLeads when input values look like contact capture.
   * - Result pages: any non-empty input may map heuristically to email / name / phone.
   * - Question pages: only when an input has props.collectAsLead or props/actionProps.leadField.
   */
  const maybeSubmitLeadFromInputs = useCallback(
    async (
      page: PlayPage,
      opts: { isResultPage: boolean; resultPageId?: string },
    ) => {
      if (isPreviewMode) return;
      if (!quizQuery?._id || !sessionId) return;
      const inputs = (page.components ?? []).filter((c) => c.type === "input");
      if (inputs.length === 0) return;

      const hasExplicitCapture = inputs.some((c) => {
        const p = c.props as Record<string, unknown> | undefined;
        const a = c.actionProps as Record<string, unknown> | undefined;
        const lf = slugLeadField(p, a);
        if (p?.collectAsLead === true) return true;
        return lf === "email" || lf === "name" || lf === "phone";
      });

      if (!opts.isResultPage && !hasExplicitCapture) return;

      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const phoneRe = /^\+?[\d\s\-()]{8,}$/;

      let email: string | undefined;
      let name: string | undefined;
      let phone: string | undefined;

      for (const c of inputs) {
        const raw = (inputValueByComponent[c.id] ?? "").trim();
        if (!raw) continue;
        const p = c.props as Record<string, unknown> | undefined;
        const a = c.actionProps as Record<string, unknown> | undefined;
        const lf = slugLeadField(p, a);
        const useHeuristic = opts.isResultPage || p?.collectAsLead === true;

        if (lf === "email") email = raw;
        else if (lf === "phone") phone = raw;
        else if (lf === "name") name = raw;
        else if (useHeuristic) {
          if (emailRe.test(raw)) email = email ?? raw;
          else if (phoneRe.test(raw)) phone = phone ?? raw;
          else if (!name) name = raw;
        }
      }

      if (!email && !name && !phone) return;

      try {
        await submitQuizLeadMutation({
          quizId: quizQuery._id,
          sessionId,
          email,
          name,
          phone,
          resultPageId: opts.resultPageId,
          source: opts.isResultPage ? "result_input" : "question_input",
        });
      } catch (error) {
        console.error("submitQuizLead failed", error);
      }
    },
    [
      inputValueByComponent,
      isPreviewMode,
      quizQuery?._id,
      sessionId,
      submitQuizLeadMutation,
    ],
  );

  const savePageResponses = useCallback(
    async (pageId: string, responses: PlayResponse[]) => {
      if (!quizQuery?._id || !sessionId) return;

      if (isPreviewMode) {
        previewResponsesByPageRef.current = {
          ...previewResponsesByPageRef.current,
          [pageId]: responses,
        };
        return;
      }

      await setQuizPageResponses({
        sessionId,
        quizId: quizQuery._id,
        pageId,
        responses,
      });
    },
    [isPreviewMode, quizQuery?._id, sessionId, setQuizPageResponses],
  );

  const submitInputResponsesForPlayPage = useCallback(
    async (page: PlayPage | null | undefined) => {
      if (!quizQuery || !sessionId || !page) return;

      const inputComponents = (page.components ?? []).filter(
        (component) => component.type === "input",
      );

      if (inputComponents.length === 0) return;

      const pageId = page._id?.toString() ?? "page-unknown";

      const responses = inputComponents.map((component) => ({
        answerBoxId: component.id,
        questionType: "input" as const,
        inputValue: inputValueByComponent[component.id] ?? "",
        resultMapping: {} as Record<string, number>,
      }));

      logQuizPlayDebug("input-answer-submit", {
        sessionId,
        quizId: quizQuery._id,
        pageId,
        responses,
      });

      await savePageResponses(pageId, responses);

      const isResultPage =
        quizCompleted &&
        resultPage != null &&
        String(page._id) === String(resultPage._id);

      await maybeSubmitLeadFromInputs(page, {
        isResultPage,
        resultPageId: isResultPage ? String(resultPage._id) : undefined,
      });
    },
    [
      inputValueByComponent,
      maybeSubmitLeadFromInputs,
      quizCompleted,
      quizQuery,
      resultPage,
      savePageResponses,
      sessionId,
    ],
  );

  const submitRankingResponsesForCurrentPage = useCallback(async () => {
    if (!quizQuery || !sessionId || !currentQuestionPage) return;

    const rankingComponents = (currentQuestionPage.components ?? []).filter(
      (component) => component.type === "ranking",
    );

    if (rankingComponents.length === 0) return;

    const pageId =
      currentQuestionPage._id?.toString() ?? `page-${currentPageIndex}`;

    const responses = rankingComponents.map((component) => {
      const itemIds = Array.isArray(component.props?.items)
        ? (component.props.items as Array<{ id?: string }>)
            .slice(0, RANKING_MAX_ITEMS)
            .map((item) => item.id)
            .filter(
              (id): id is string => typeof id === "string" && id.length > 0,
            )
        : [];
      const actionProps =
        typeof component.actionProps === "object" &&
        component.actionProps !== null
          ? (component.actionProps as Record<string, unknown>)
          : undefined;
      const rankingOrder = rankingOrderByComponent[component.id] ?? itemIds;
      const positionWeights = getRankingPositionWeights(
        actionProps,
        itemIds.length,
      );
      const itemResultMappings = getRankingItemResultMappings(actionProps);

      return {
        answerBoxId: component.id,
        questionType: "ranking" as const,
        rankingOrder,
        resultMapping: computeRankingResultMapping({
          rankingOrder,
          positionWeights,
          itemResultMappings,
        }),
      };
    });

    logQuizPlayDebug("ranking-answer-submit", {
      sessionId,
      quizId: quizQuery._id,
      pageId,
      responses,
    });

    await savePageResponses(pageId, responses);
  }, [
    currentPageIndex,
    currentQuestionPage,
    quizQuery,
    rankingOrderByComponent,
    savePageResponses,
    sessionId,
  ]);

  const submitInputResponsesForCurrentPage = useCallback(async () => {
    await submitInputResponsesForPlayPage(currentQuestionPage);
  }, [currentQuestionPage, submitInputResponsesForPlayPage]);

  const submitMatchingResponsesForCurrentPage = useCallback(async () => {
    if (!quizQuery || !sessionId || !currentQuestionPage) return;

    const matchingComponents = (currentQuestionPage.components ?? []).filter(
      (component) => component.type === "matching",
    );

    if (matchingComponents.length === 0) return;

    const pageId =
      currentQuestionPage._id?.toString() ?? `page-${currentPageIndex}`;

    const responses = matchingComponents.map((component) => {
      const actionProps =
        typeof component.actionProps === "object" &&
        component.actionProps !== null
          ? (component.actionProps as Record<string, unknown>)
          : undefined;

      const pairMappings = Array.isArray(actionProps?.pairMappings)
        ? actionProps.pairMappings.filter(isMatchingPairMapping)
        : [];

      const pairs = {
        ...(matchingPairsByComponent[component.id] ?? {}),
        ...(matchingPairsByComponentRef.current[component.id] ?? {}),
      };

      return {
        answerBoxId: component.id,
        questionType: "matching" as const,
        matchingPairs: pairs,
        resultMapping: computeMatchingResultMapping(pairs, pairMappings),
        debugPairs: pairs,
        debugPairMappingsCount: pairMappings.length,
      };
    });

    logQuizPlayDebug("matching-answer-submit", {
      sessionId,
      quizId: quizQuery._id,
      pageId,
      responses: responses.map(
        ({ debugPairs, debugPairMappingsCount, ...response }) => ({
          ...response,
          debugPairs,
          debugPairMappingsCount,
        }),
      ),
    });

    const cleanResponses = responses.map(
      ({
        debugPairs: _debugPairs,
        debugPairMappingsCount: _debugPairMappingsCount,
        ...response
      }) => response,
    );
    await savePageResponses(pageId, cleanResponses);
  }, [
    currentPageIndex,
    currentQuestionPage,
    matchingPairsByComponent,
    quizQuery,
    savePageResponses,
    sessionId,
  ]);

  const submitSliderResponsesForCurrentPage = useCallback(async () => {
    if (!quizQuery || !sessionId || !currentQuestionPage) return;

    const sliderComponents = (currentQuestionPage.components ?? []).filter(
      (component) => component.type === "slider",
    );

    if (sliderComponents.length === 0) return;

    const pageId =
      currentQuestionPage._id?.toString() ?? `page-${currentPageIndex}`;

    const responses = sliderComponents.map((component) => {
      const props = component.props ?? {};
      const { min, max, divisions, defaultValue } =
        normalizeSliderConfig(props);
      const sliderValue = sliderValueByComponent[component.id] ?? defaultValue;
      const sliderTick = getSliderIntervalIndex({
        value: sliderValue,
        min,
        max,
        divisions,
      });
      const actionProps =
        typeof component.actionProps === "object" &&
        component.actionProps !== null
          ? (component.actionProps as Record<string, unknown>)
          : undefined;
      const intervalResultMappings =
        getSliderIntervalResultMappings(actionProps);
      const sliderResultTotals = getSliderResultTotals(actionProps);

      return {
        answerBoxId: component.id,
        questionType: "slider" as const,
        sliderValue,
        sliderInterval: sliderTick,
        resultMapping: computeSliderResultMapping({
          value: sliderValue,
          intervalIndex: sliderTick,
          divisions,
          max,
          sliderResultTotals,
          intervalResultMappings,
        }),
      };
    });

    logQuizPlayDebug("slider-answer-submit", {
      sessionId,
      quizId: quizQuery._id,
      pageId,
      responses,
    });

    await savePageResponses(pageId, responses);
  }, [
    currentPageIndex,
    currentQuestionPage,
    quizQuery,
    savePageResponses,
    sessionId,
    sliderValueByComponent,
  ]);

  const handleStartQuiz = useCallback(async () => {
    if (quizStarted) return;
    if (!quizQuery || !sessionId) return;

    try {
      logQuizPlayDebug("quiz-pages", {
        quizId: quizQuery._id,
        totalQuestions,
        pages: pageDebugSummary,
      });
      logQuizPlayDebug("start-session", {
        quizId: quizQuery._id,
        sessionId,
        language,
      });
      if (!isPreviewMode) {
        await startSession({
          quizId: quizQuery._id,
          sessionId,
          language,
        });
      }
      setQuizStarted(true);
      setQuizCompleted(false);
      setResultPage(null);
      setCurrentPageIndex(0);
      setSelectedAnswers([]);
      previewResponsesByPageRef.current = {};
      setRankingOrderByComponent({});
      matchingPairsByComponentRef.current = {};
      setMatchingPairsByComponent({});
      setInputValueByComponent({});
      setSliderValueByComponent({});
    } catch (error) {
      console.error("Error starting quiz", error);
    }
  }, [
    language,
    isPreviewMode,
    pageDebugSummary,
    quizQuery,
    quizStarted,
    sessionId,
    startSession,
    totalQuestions,
  ]);

  const handleGoToPage = useCallback(
    async (nextIndex: number) => {
      if (quizCompleted) return;
      if (pages.length === 0) return;
      const clamped = Math.max(0, Math.min(nextIndex, pages.length - 1));

      await submitRankingResponsesForCurrentPage();
      await submitInputResponsesForCurrentPage();
      await submitMatchingResponsesForCurrentPage();
      await submitSliderResponsesForCurrentPage();

      logQuizPlayDebug("navigate-page", {
        fromIndex: currentPageIndex,
        toIndex: clamped,
        nextPage: pages[clamped]
          ? {
              pageId: String(pages[clamped]!._id),
              pageName: pages[clamped]!.pageName ?? `Page ${clamped + 1}`,
              questionMode: pages[clamped]!.questionMode ?? "single",
            }
          : null,
      });

      setCurrentPageIndex(clamped);
      setSelectedAnswers([]);

      if (!sessionId || isPreviewMode) return;
      try {
        await updateSession({
          sessionId,
          currentPageIndex: clamped,
        });
      } catch (error) {
        console.error("Failed to update quiz session", error);
      }
    },
    [
      currentPageIndex,
      isPreviewMode,
      pages,
      quizCompleted,
      sessionId,
      submitRankingResponsesForCurrentPage,
      submitInputResponsesForCurrentPage,
      submitMatchingResponsesForCurrentPage,
      submitSliderResponsesForCurrentPage,
      updateSession,
    ],
  );

  const handleFinishQuiz = useCallback(async () => {
    if (quizCompleted) return;
    if (!sessionId || !quizQuery) {
      setQuizCompleted(true);
      return;
    }

    await submitRankingResponsesForCurrentPage();
    await submitInputResponsesForCurrentPage();
    await submitMatchingResponsesForCurrentPage();
    await submitSliderResponsesForCurrentPage();

    if (!isPreviewMode) {
      try {
        await updateSession({
          sessionId,
          currentPageIndex,
          status: "completed",
        });
      } catch (error) {
        console.error("Failed to finalize session", error);
      }
    }

    if (results.length > 0) {
      setIsCalculatingResults(true);
      try {
        const outcome = isPreviewMode
          ? calculatePreviewResult(previewResponsesByPageRef.current, resultIds)
          : await calculateResults({
              sessionId,
              quizId: quizQuery._id,
            });
        if (outcome && outcome.winningResultPageId) {
          const matched = results.find(
            (page) => String(page._id) === String(outcome.winningResultPageId),
          );
          if (matched) {
            setResultPage(matched);
          }
        }
      } catch (error) {
        console.error("Failed to calculate quiz results", error);
      } finally {
        setIsCalculatingResults(false);
      }
    }

    setQuizCompleted(true);
  }, [
    calculateResults,
    currentPageIndex,
    isPreviewMode,
    quizCompleted,
    quizQuery,
    resultIds,
    results,
    sessionId,
    submitRankingResponsesForCurrentPage,
    submitInputResponsesForCurrentPage,
    submitMatchingResponsesForCurrentPage,
    submitSliderResponsesForCurrentPage,
    updateSession,
  ]);

  const handleAnswerBoxAction = useCallback(
    async (actionProps?: Record<string, unknown>, component?: Component) => {
      if (!quizQuery || !sessionId || quizCompleted) return;

      setIsProcessingAction(true);

      try {
        const resultMapping = (actionProps?.resultMapping ?? {}) as Record<
          string,
          number
        >;

        const pageId =
          currentQuestionPage?._id?.toString() ?? `page-${currentPageIndex}`;

        // ========================
        // SINGLE
        // ========================

        if (questionMode === "single") {
          logQuizPlayDebug("single-answer-submit", {
            sessionId,
            quizId: quizQuery._id,
            pageId,
            answerBoxId: component?.id ?? "unknown",
            resultMapping,
          });
          await savePageResponses(pageId, [
            {
              answerBoxId: component?.id ?? "unknown",
              resultMapping,
            },
          ]);

          const isLastPage = currentPageIndex >= pages.length - 1;

          if (isLastPage) {
            await handleFinishQuiz();
          } else {
            await handleGoToPage(currentPageIndex + 1);
          }

          return;
        }

        // ========================
        // MULTIPLE
        // ========================

        if (questionMode === "multiple") {
          setSelectedAnswers((prev) => {
            const exists = prev.some((a) => a.id === component?.id);

            const nextSelectedAnswers = exists
              ? prev.filter((a) => a.id !== component?.id)
              : [...prev, component!];

            logQuizPlayDebug("multiple-answer-toggle", {
              sessionId,
              quizId: quizQuery._id,
              pageId,
              toggledAnswerBoxId: component?.id ?? "unknown",
              toggledResultMapping: resultMapping,
              selectedAnswerBoxIds: nextSelectedAnswers.map(
                (answer) => answer.id,
              ),
              selectedResultMappings: nextSelectedAnswers.map((answer) => ({
                answerBoxId: answer.id,
                resultMapping: (answer.actionProps?.resultMapping ??
                  {}) as Record<string, number>,
              })),
            });

            return nextSelectedAnswers;
          });
        }
      } catch (error) {
        console.error("Failed to record answer", error);
      } finally {
        setIsProcessingAction(false);
      }
    },
    [
      currentPageIndex,
      currentQuestionPage,
      handleFinishQuiz,
      handleGoToPage,
      pages.length,
      quizCompleted,
      quizQuery,
      savePageResponses,
      sessionId,
      questionMode,
    ],
  );

  const submitMultipleAnswers = useCallback(async () => {
    if (!quizQuery || !sessionId) return;

    const pageId =
      currentQuestionPage?._id?.toString() ?? `page-${currentPageIndex}`;

    const responses = selectedAnswers.map((answer) => ({
      answerBoxId: answer.id,
      resultMapping: (answer.actionProps?.resultMapping ?? {}) as Record<
        string,
        number
      >,
    }));

    logQuizPlayDebug("multiple-answer-submit", {
      sessionId,
      quizId: quizQuery._id,
      pageId,
      selectedAnswerBoxIds: selectedAnswers.map((answer) => answer.id),
      responses,
    });

    await savePageResponses(pageId, responses);

    setSelectedAnswers([]);

    const isLastPage = currentPageIndex >= pages.length - 1;

    if (isLastPage) {
      await handleFinishQuiz();
    } else {
      await handleGoToPage(currentPageIndex + 1);
    }
  }, [
    currentPageIndex,
    currentQuestionPage,
    handleFinishQuiz,
    handleGoToPage,
    pages.length,
    quizQuery,
    savePageResponses,
    selectedAnswers,
    sessionId,
  ]);

  const handleComponentAction = useCallback(
    async (
      action: PageAction,
      actionProps?: Record<string, unknown>,
      component?: Component,
    ) => {
      // Prevent multiple actions while processing
      if (isProcessingAction || isCalculatingResults) return;

      logQuizPlayDebug("component-action", {
        action,
        componentId: component?.id,
        currentPage: currentPageDebug,
        actionProps,
      });

      switch (action) {
        case "startQuiz":
          await handleStartQuiz();
          break;

        case "nextPage":
          if (!quizStarted) {
            await handleStartQuiz();
          } else if (quizCompleted && resultPage && displayPage) {
            await submitInputResponsesForPlayPage(displayPage);
          } else if (!quizCompleted) {
            if (questionMode === "multiple") {
              if (selectedAnswers.length === 0) {
                toast.error("Select at least one answer before continuing");
                break;
              }

              await submitMultipleAnswers();
              break;
            }

            if (questionMode === "ranking") {
              await submitRankingResponsesForCurrentPage();
              const isLastPage = currentPageIndex >= pages.length - 1;
              if (isLastPage) {
                await handleFinishQuiz();
              } else {
                await handleGoToPage(currentPageIndex + 1);
              }
              break;
            }

            if (questionMode === "fill-in-blank") {
              await submitInputResponsesForCurrentPage();
              const isLastPage = currentPageIndex >= pages.length - 1;
              if (isLastPage) {
                await handleFinishQuiz();
              } else {
                await handleGoToPage(currentPageIndex + 1);
              }
              break;
            }

            if (questionMode === "matching") {
              await submitMatchingResponsesForCurrentPage();
              const isLastPage = currentPageIndex >= pages.length - 1;
              if (isLastPage) {
                await handleFinishQuiz();
              } else {
                await handleGoToPage(currentPageIndex + 1);
              }
              break;
            }

            if (questionMode === "slider") {
              await submitSliderResponsesForCurrentPage();
              const isLastPage = currentPageIndex >= pages.length - 1;
              if (isLastPage) {
                await handleFinishQuiz();
              } else {
                await handleGoToPage(currentPageIndex + 1);
              }
              break;
            }

            const isLastPage = currentPageIndex >= pages.length - 1;
            if (isLastPage) {
              await handleFinishQuiz();
            } else {
              await handleGoToPage(currentPageIndex + 1);
            }
          }
          break;

        case "previousPage":
          if (quizStarted && !quizCompleted && currentPageIndex > 0) {
            await handleGoToPage(currentPageIndex - 1);
          }
          break;

        case "answerBox":
          await handleAnswerBoxAction(actionProps, component);
          break;

        case "hyperlink": {
          const url = actionProps?.url as string | undefined;
          if (url) {
            window.open(url, "_blank", "noopener,noreferrer");
            if (quizQuery?._id && !isPreviewMode) {
              const pageRef =
                displayPage?._id != null ? String(displayPage._id) : undefined;
              void recordCtaClickMutation({
                quizId: quizQuery._id,
                sessionId,
                ctaKey: url,
                pageId: pageRef,
              });
            }
          }
          break;
        }

        default:
          console.warn("Unknown action:", action);
      }
    },
    [
      currentPageIndex,
      handleAnswerBoxAction,
      handleFinishQuiz,
      handleGoToPage,
      handleStartQuiz,
      quizQuery,
      sessionId,
      displayPage,
      recordCtaClickMutation,
      isPreviewMode,
      isCalculatingResults,
      isProcessingAction,
      currentPageDebug,
      pages.length,
      quizCompleted,
      quizStarted,
      questionMode,
      selectedAnswers.length,
      submitInputResponsesForCurrentPage,
      submitMultipleAnswers,
      submitRankingResponsesForCurrentPage,
      submitMatchingResponsesForCurrentPage,
      submitSliderResponsesForCurrentPage,
      submitInputResponsesForPlayPage,
      resultPage,
    ],
  );

  const handleBackNavigation = useCallback(() => {
    const fallbackHref =
      playSource === "discover"
        ? returnTo || "/discover"
        : playSource === "dashboard" || isPreviewMode
          ? "/quiz"
          : "/discover";

    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    router.push(fallbackHref);
  }, [isPreviewMode, playSource, returnTo, router]);

  const backButton = (
    <Button
      variant="ghost"
      size="sm"
      className="fixed left-4 top-4 z-30 gap-2 text-white/70 hover:bg-white/10 hover:text-white"
      onClick={handleBackNavigation}
    >
      <ArrowLeft className="h-4 w-4" />
      Back
    </Button>
  );

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center overflow-hidden bg-black">
        {backButton}
        <div className="flex items-center gap-2 text-white/70">
          <Loader2 className="h-5 w-5 animate-spin" />
          {getQuizLoadingLabel(playSurface)}
        </div>
      </div>
    );
  }

  if (quizNotFound) {
    const missingState = getMissingQuizStateCopy(playSurface);
    return (
      <div className="flex h-screen w-full items-center justify-center overflow-hidden bg-black">
        {backButton}
        <div className="rounded-2xl bg-white/10 px-6 py-8 text-center text-white/80">
          <h1 className="text-xl font-semibold">{missingState.title}</h1>
          <p className="mt-2 text-sm">{missingState.description}</p>
        </div>
      </div>
    );
  }

  if (totalQuestions === 0 && !onboardingPage) {
    return (
      <div className="flex h-screen w-full items-center justify-center overflow-hidden bg-black">
        {backButton}
        <div className="rounded-2xl bg-white/10 px-6 py-8 text-center text-white/80">
          <h1 className="text-xl font-semibold">No pages yet</h1>
          <p className="mt-2 text-sm">
            This quiz doesn&apos;t have any content yet.
          </p>
        </div>
      </div>
    );
  }

  if (!quizStarted && !onboardingPage) {
    return (
      <div className="flex h-screen w-full items-center justify-center overflow-hidden bg-black px-4">
        {backButton}
        <div className="w-full max-w-md space-y-6 rounded-3xl bg-white/10 p-8 text-center text-white shadow-xl">
          <div>
            <h1 className="text-3xl font-semibold text-white">
              {quizQuery?.title}
            </h1>
            {quizQuery?.description ? (
              <p className="mt-3 text-sm text-white/80">
                {quizQuery.description}
              </p>
            ) : null}
          </div>
          <p className="text-sm text-white/60">
            {getExperienceMetaLabel(playSurface, totalQuestions)}
          </p>
          <Button
            onClick={handleStartQuiz}
            size="lg"
            className="w-full"
            disabled={!sessionId}
          >
            {getStartExperienceLabel(playSurface)}
          </Button>
        </div>
      </div>
    );
  }

  const quizFrame = displayPage ? (
    <div className={isDesktopViewport ? "relative" : "relative h-full w-full"}>
      <PhonePreview
        components={displayComponents}
        background={displayPage.background}
        transitionEffect={displayPage.transitionEffect}
        transitionKey={String(displayPage._id)}
        transitionSequence={
          shouldShowOnboarding
            ? -1
            : quizCompleted
              ? totalQuestions
              : currentPageIndex
        }
        scale={isDesktopViewport ? 1 : undefined}
        roundedCorners={isDesktopViewport ? false : undefined}
        frameless={!isDesktopViewport}
        onComponentAction={handleComponentAction}
        matchingPairsByComponent={matchingPairsByComponent}
        onMatchingChange={handleMatchingChange}
        // New props for answer selection state
        selectedAnswers={selectedAnswers}
        rankingOrderByComponent={rankingOrderByComponent}
        onRankingChange={handleRankingChange}
        onTextChange={handleTextChange}
        sliderValueByComponent={sliderValueByComponent}
        onSliderChange={handleSliderChange}
        bgmMuted={bgmMuted}
        bgmBlocked={bgmBlocked}
        onBGMToggleMute={handleBGMToggleMute}
        currentPageNumber={Math.min(
          currentPageIndex + 1,
          Math.max(totalQuestions, 1),
        )}
        totalPages={Math.max(totalQuestions, 1)}
      />
    </div>
  ) : null;

  const emptyState = (
    <div className="flex h-full items-center justify-center bg-white/10 px-6 py-8 text-center text-white/80">
      {quizCompleted
        ? "No result page was configured for this quiz."
        : shouldShowOnboarding
          ? "This quiz's onboarding page is empty."
          : "Nothing to display on this page yet."}
    </div>
  );

  return (
    <div className="fixed inset-0 h-screen min-h-[100dvh] w-full overflow-hidden overscroll-none bg-black">
      <audio ref={bgmAudioRef} preload="auto" />
      {backButton}
      {isDesktopViewport === null ? null : isDesktopViewport ? (
        <div className="grid h-screen grid-cols-3 bg-black">
          <div />
          <div className="flex h-screen flex-col items-center justify-center">
            {quizFrame ?? emptyState}
          </div>
          <div />
        </div>
      ) : (
        <div className="fixed inset-0 h-[100dvh] min-h-[100dvh] w-full overflow-hidden overscroll-none">
          {quizFrame ?? emptyState}
        </div>
      )}
    </div>
  );
}
