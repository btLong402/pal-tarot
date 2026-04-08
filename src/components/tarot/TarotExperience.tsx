"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { RotateCcw, Sparkles, WandSparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { TAROT_CARDS, TAROT_CARD_MAP } from "@/src/data/cards";
import { SPREADS, SPREAD_OPTIONS } from "@/src/data/spreads";
import type { SpreadDefinition, SpreadType, TarotCardData } from "@/src/types/tarot";

type ReadingMode = "classic" | "question";
type RitualStage = "setup" | "connecting" | "deck" | "reveal";
type DeckPhase = "shuffling" | "spread";

type DrawnCard = {
  cardId: string;
  positionIndex: number;
  isFlipped: boolean;
};

function shuffleIds(ids: string[]): string[] {
  const clone = [...ids];
  for (let i = clone.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
}

function shuffledPose(index: number, seed: number, deckWidth: number) {
  const wave = Math.sin(index * 1.87 + seed * 0.61);
  const wave2 = Math.cos(index * 0.93 + seed * 1.13);
  const spreadX = Math.min(154, Math.max(52, deckWidth * 0.32));
  const spreadY = Math.min(92, Math.max(34, deckWidth * 0.2));

  return {
    x: wave * spreadX,
    y: wave2 * spreadY - spreadY / 2,
    rotate: wave * 20,
  };
}

function getCard(cardId: string): TarotCardData | undefined {
  return TAROT_CARD_MAP.get(cardId);
}

function buildCustomPositions(count: number) {
  return Array.from({ length: count }, (_, index) => `Lá ${index + 1}`);
}

export default function TarotExperience() {
  const [readingMode, setReadingMode] = useState<ReadingMode>("classic");
  const [question, setQuestion] = useState("");
  const [spreadType, setSpreadType] = useState<SpreadType>("past-present-future");
  const [customCardCount, setCustomCardCount] = useState(3);
  const [ritualStage, setRitualStage] = useState<RitualStage>("setup");
  const [deckPhase, setDeckPhase] = useState<DeckPhase>("shuffling");
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const [deckOrder, setDeckOrder] = useState<string[]>(() => TAROT_CARDS.map((card) => card.id));
  const [drawnCards, setDrawnCards] = useState<DrawnCard[]>([]);
  const [aiReading, setAiReading] = useState("");
  const [displayedReading, setDisplayedReading] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [aiError, setAiError] = useState("");
  const [deckWidth, setDeckWidth] = useState(360);

  const timeoutsRef = useRef<number[]>([]);
  const deckAreaRef = useRef<HTMLDivElement>(null);
  const carouselViewportRef = useRef<HTMLDivElement>(null);

  const spreadOptions = useMemo(
    () =>
      readingMode === "question"
        ? SPREAD_OPTIONS
        : SPREAD_OPTIONS.filter((option) => option.id !== "custom"),
    [readingMode],
  );
  const spread = useMemo<SpreadDefinition>(() => {
    const baseSpread = SPREADS[spreadType];

    if (readingMode !== "question" || spreadType !== "custom") {
      return baseSpread;
    }

    return {
      ...baseSpread,
      label: `${customCardCount} lá - Custom theo câu hỏi`,
      positions: buildCustomPositions(customCardCount),
    };
  }, [customCardCount, readingMode, spreadType]);
  const targetCount = spread.positions.length;
  const drawnIds = useMemo(() => new Set(drawnCards.map((item) => item.cardId)), [drawnCards]);
  const sortedDrawnCards = useMemo(
    () => [...drawnCards].sort((a, b) => a.positionIndex - b.positionIndex),
    [drawnCards],
  );

  const allSelected = drawnCards.length === targetCount;
  const allFlipped = allSelected && sortedDrawnCards.every((item) => item.isFlipped);
  const canStartRitual =
    readingMode === "classic" || (readingMode === "question" && question.trim().length > 0);
  const canPickCards = ritualStage === "deck" && deckPhase === "spread" && !allSelected;
  const canRequestAi = allFlipped && !isGenerating;

  const deckForDisplay = useMemo(
    () => deckOrder.map((id) => ({ id, hidden: drawnIds.has(id) })),
    [deckOrder, drawnIds],
  );
  const visibleDeck = useMemo(
    () => deckForDisplay.filter((slot) => !slot.hidden),
    [deckForDisplay],
  );
  const infiniteDeck = useMemo(() => {
    if (visibleDeck.length === 0) {
      return [] as Array<{ id: string; originalIndex: number }>;
    }

    return Array.from({ length: visibleDeck.length * 3 }, (_, index) => {
      const originalIndex = index % visibleDeck.length;

      return {
        id: visibleDeck[originalIndex].id,
        originalIndex,
      };
    });
  }, [visibleDeck]);

  const clearTimers = () => {
    timeoutsRef.current.forEach((timerId) => window.clearTimeout(timerId));
    timeoutsRef.current = [];
  };

  useEffect(() => {
    return () => clearTimers();
  }, []);

  useEffect(() => {
    const element = deckAreaRef.current;
    if (!element) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width;
      if (next && Number.isFinite(next)) {
        setDeckWidth(next);
      }
    });

    observer.observe(element);
    setDeckWidth(element.getBoundingClientRect().width || 360);

    return () => observer.disconnect();
  }, [ritualStage]);

  useEffect(() => {
    if (readingMode === "classic" && spreadType === "custom") {
      setSpreadType("past-present-future");
    }
  }, [readingMode, spreadType]);

  useEffect(() => {
    if (ritualStage === "deck" && allSelected) {
      setRitualStage("reveal");
    }
  }, [allSelected, ritualStage]);

  useEffect(() => {
    if (!aiReading) {
      setDisplayedReading("");
      setIsStreaming(false);
      return;
    }

    setDisplayedReading("");
    setIsStreaming(true);

    let index = 0;
    const total = aiReading.length;
    const chunkSize = Math.max(1, Math.floor(total / 220));

    const timer = window.setInterval(() => {
      index = Math.min(total, index + chunkSize);
      setDisplayedReading(aiReading.slice(0, index));

      if (index >= total) {
        setIsStreaming(false);
        window.clearInterval(timer);
      }
    }, 18);

    return () => window.clearInterval(timer);
  }, [aiReading]);

  useEffect(() => {
    if (ritualStage !== "deck" || deckPhase !== "spread") {
      return;
    }

    const viewport = carouselViewportRef.current;
    if (!viewport || visibleDeck.length === 0) {
      return;
    }

    const segmentWidth = viewport.scrollWidth / 3;
    if (!segmentWidth) {
      return;
    }

    viewport.scrollLeft = segmentWidth;
  }, [deckPhase, ritualStage, visibleDeck.length]);

  const onCarouselScroll = () => {
    const viewport = carouselViewportRef.current;
    if (!viewport) {
      return;
    }

    const segmentWidth = viewport.scrollWidth / 3;
    if (!segmentWidth) {
      return;
    }

    if (viewport.scrollLeft < segmentWidth * 0.5) {
      viewport.scrollLeft += segmentWidth;
    } else if (viewport.scrollLeft > segmentWidth * 1.5) {
      viewport.scrollLeft -= segmentWidth;
    }
  };

  const startRitual = () => {
    if (!canStartRitual) {
      return;
    }

    clearTimers();
    setRitualStage("connecting");
    setDeckPhase("shuffling");
    setDrawnCards([]);
    setAiReading("");
    setDisplayedReading("");
    setIsStreaming(false);
    setAiError("");
    setIsGenerating(false);
    setDeckOrder((prev) => shuffleIds(prev));
    setShuffleSeed((prev) => prev + 1);

    const connectingTimer = window.setTimeout(() => {
      setRitualStage("deck");
      setDeckPhase("shuffling");

      const spreadTimer = window.setTimeout(() => {
        setDeckPhase("spread");
      }, 1200);

      timeoutsRef.current.push(spreadTimer);
    }, 3000);

    timeoutsRef.current.push(connectingTimer);
  };

  const resetSession = () => {
    clearTimers();
    setReadingMode("classic");
    setQuestion("");
    setSpreadType("past-present-future");
    setCustomCardCount(3);
    setRitualStage("setup");
    setDeckPhase("shuffling");
    setShuffleSeed(0);
    setDeckOrder(TAROT_CARDS.map((card) => card.id));
    setDrawnCards([]);
    setAiReading("");
    setDisplayedReading("");
    setIsStreaming(false);
    setAiError("");
    setIsGenerating(false);
  };

  const onPickCard = (cardId: string) => {
    if (!canPickCards || drawnIds.has(cardId)) {
      return;
    }

    setDrawnCards((prev) => {
      if (prev.length >= targetCount) {
        return prev;
      }
      return [...prev, { cardId, positionIndex: prev.length, isFlipped: false }];
    });
  };

  const onFlipCard = (cardId: string) => {
    setDrawnCards((prev) =>
      prev.map((item) =>
        item.cardId === cardId && !item.isFlipped ? { ...item, isFlipped: true } : item,
      ),
    );
  };

  const onGenerateReading = async () => {
    if (!canRequestAi) {
      return;
    }

    const cardsPayload = sortedDrawnCards
      .map((item) => {
        const card = getCard(item.cardId);
        const position = spread.positions[item.positionIndex];

        if (!card) {
          return null;
        }

        return {
          id: card.id,
          name: card.name,
          position,
          meaning: card.meanings.general,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    setIsGenerating(true);
    setAiError("");
    setAiReading("");
    setDisplayedReading("");
    setIsStreaming(false);

    try {
      const fallbackQuestion =
        "Không có câu hỏi cụ thể. Hãy luận giải dựa trên năng lượng tổng quan của trải bài.";

      const response = await fetch("/api/gemini/read", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: question.trim() || fallbackQuestion,
          spreadLabel:
            readingMode === "question"
              ? `${spread.label} - Trải bài theo câu hỏi`
              : `${spread.label} - Trải bài trực giác`,
          cards: cardsPayload,
        }),
      });

      const data = (await response.json()) as {
        reading?: string;
        error?: string;
        model?: string;
      };

      if (!response.ok || !data.reading) {
        throw new Error(data.error ?? "Không thể tạo luận giải lúc này.");
      }

      setAiReading(data.reading);
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "Đã xảy ra lỗi không xác định.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="relative overflow-hidden">
      <div className="grain-overlay" aria-hidden="true" />
      <div className="dynamic-bg" aria-hidden="true" />

      <main className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header className="rounded-[1.5rem] border border-amber-100/18 bg-black/30 p-5 backdrop-blur-md lg:p-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-100/20 bg-amber-100/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-amber-100/80">
            <Sparkles size={14} />
            Pal Tarot
          </div>
          <h1 className="mt-3 font-title text-3xl leading-tight text-amber-50 sm:text-4xl">
            Trải bài đơn giản, dễ theo dõi
          </h1>
          <p className="mt-2 text-sm leading-7 text-amber-100/75">
            Chọn kiểu trải bài, kết nối, chọn lá, mở lá và nhận luận giải AI.
          </p>
        </header>

        <section className="rounded-[1.5rem] border border-amber-100/18 bg-black/35 p-5 backdrop-blur-md sm:p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setReadingMode("classic")}
              className={`rounded-xl border px-4 py-3 text-left transition ${
                readingMode === "classic"
                  ? "border-amber-200/60 bg-amber-100/12 text-amber-50"
                  : "border-amber-100/16 bg-black/16 text-amber-100/80"
              }`}
            >
              Trải bài trực giác
            </button>
            <button
              type="button"
              onClick={() => setReadingMode("question")}
              className={`rounded-xl border px-4 py-3 text-left transition ${
                readingMode === "question"
                  ? "border-amber-200/60 bg-amber-100/12 text-amber-50"
                  : "border-amber-100/16 bg-black/16 text-amber-100/80"
              }`}
            >
              Trải bài theo câu hỏi
            </button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {spreadOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setSpreadType(option.id)}
                className={`rounded-xl border px-3 py-3 text-left text-sm transition ${
                  spreadType === option.id
                    ? "border-amber-200/60 bg-amber-100/12 text-amber-50"
                    : "border-amber-100/16 bg-black/16 text-amber-100/80"
                }`}
              >
                <p className="font-medium">{option.label}</p>
                <p className="mt-1 text-xs opacity-80">{option.description}</p>
              </button>
            ))}
          </div>

          {readingMode === "question" ? (
            <div className="mt-4">
              <textarea
                className="min-h-28 w-full rounded-xl border border-amber-100/16 bg-black/20 p-4 text-base leading-7 text-amber-50 outline-none transition placeholder:text-amber-100/35 focus:border-amber-300/60 focus:ring-2 focus:ring-amber-300/25"
                placeholder="Nhập câu hỏi của bạn..."
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
              />

              {spreadType === "custom" ? (
                <div className="mt-3 rounded-xl border border-amber-100/16 bg-black/20 p-3 sm:p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-amber-100">Số lá muốn rút: {customCardCount}</p>
                    <p className="text-xs text-amber-100/65">Tùy chọn từ 1 đến 10 lá</p>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    step={1}
                    value={customCardCount}
                    onChange={(event) => {
                      const next = Number.parseInt(event.target.value, 10);
                      if (Number.isFinite(next)) {
                        setCustomCardCount(Math.min(10, Math.max(1, next)));
                      }
                    }}
                    className="mt-3 w-full accent-amber-200"
                    aria-label="Chọn số lá bài cho spread custom"
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={startRitual}
              disabled={!canStartRitual || ritualStage === "connecting"}
              className="inline-flex min-h-10 items-center gap-2 rounded-full bg-amber-200 px-4 py-2 font-semibold text-zinc-950 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Sparkles size={15} />
              {ritualStage === "connecting" ? "Đang kết nối..." : "Bắt đầu"}
            </button>
            <button
              type="button"
              onClick={resetSession}
              className="inline-flex min-h-10 items-center gap-2 rounded-full border border-amber-100/22 px-4 py-2 text-amber-100/90 transition hover:bg-amber-100/10"
            >
              <RotateCcw size={15} />
              Làm mới
            </button>
          </div>
        </section>

        {ritualStage === "connecting" ? (
          <section className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 backdrop-blur-md">
            <div className="w-full max-w-lg rounded-[1.5rem] border border-amber-100/20 bg-black/60 p-8 text-center shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
              <motion.div
                className="mx-auto mb-4 h-14 w-14 rounded-full border border-amber-200/45"
                animate={{ rotate: 360, scale: [1, 1.08, 1] }}
                transition={{ duration: 2.2, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
              />
                <h3 className="font-title text-2xl text-amber-50">Đang kết nối tâm linh với bạn...</h3>
                <div className="mt-5 space-y-2 rounded-lg border border-amber-100/16 bg-amber-100/5 p-4">
                  <p className="text-sm text-amber-100/85">Hãy yên tĩnh và tập trung:</p>
                  <ul className="space-y-1.5 text-xs text-amber-100/75">
                    <li>• Hít thở sâu và từng bước</li>
                    <li>• Tập trung vào câu hỏi của bạn (nếu có)</li>
                    <li>• Hình dung năng lượng bài Tarot</li>
                    <li>• Để tâm hồn hướng dẫn quá trình</li>
                  </ul>
                </div>
            </div>
          </section>
        ) : null}

        {ritualStage === "deck" ? (
          <section className="rounded-[1.5rem] border border-amber-100/18 bg-black/35 p-5 backdrop-blur-md sm:p-6">
            <p className="text-sm text-amber-100/80">
              {deckPhase === "shuffling"
                ? "Bộ bài đang xáo..."
                : `Chọn ${targetCount} lá bài (${drawnCards.length}/${targetCount})`}
            </p>
            {deckPhase === "spread" ? (
              <p className="mt-1 text-xs text-amber-100/60">Cuộn ngang kiểu carousel để chọn lá bài.</p>
            ) : null}

            <div
              ref={deckAreaRef}
              className="relative mt-4 min-h-[24rem] overflow-hidden rounded-2xl bg-gradient-to-b from-black/10 to-black/20 lg:min-h-[30rem]"
            >
              <AnimatePresence mode="wait">
                {deckPhase === "shuffling" ? (
                  <motion.div
                    key="deck-shuffling"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                    className="absolute inset-0"
                  >
                    <div className="pointer-events-none absolute inset-x-8 bottom-3 h-6 rounded-full bg-black/45 blur-xl" aria-hidden="true" />
                    {deckForDisplay.map((slot, index) => {
                      if (slot.hidden) {
                        return null;
                      }

                      const randomPose = shuffledPose(index, shuffleSeed, deckWidth);

                      return (
                        <motion.button
                          key={slot.id}
                          type="button"
                          aria-label={`Chọn lá ${index + 1}`}
                          onClick={() => onPickCard(slot.id)}
                          disabled
                          className="absolute left-1/2 top-[56%] w-[7.5rem] aspect-[300/527] -translate-x-1/2 -translate-y-1/2 cursor-not-allowed rounded-xl bg-[url('/images/cards/CardBacks.jpg')] bg-cover bg-center shadow-[0_12px_28px_rgba(0,0,0,0.45)] outline-none will-change-transform opacity-95 lg:w-[8.75rem]"
                          animate={{ x: randomPose.x, y: randomPose.y, rotate: randomPose.rotate }}
                          transition={{
                            type: "tween",
                            duration: 0.18,
                            ease: "easeOut",
                          }}
                          style={{ zIndex: index + 1 }}
                        />
                      );
                    })}
                  </motion.div>
                ) : (
                  <motion.div
                    key="deck-carousel"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.26, ease: "easeOut" }}
                    className="absolute inset-0 flex items-center"
                  >
                    <div
                      ref={carouselViewportRef}
                      onScroll={onCarouselScroll}
                      className="w-full overflow-x-auto px-3 py-4 [scrollbar-width:thin]"
                    >
                      <div className="mx-auto flex w-max snap-x snap-mandatory gap-3 rounded-2xl bg-black/20 px-3 py-4">
                        {infiniteDeck.map((slot, index) => {
                          return (
                            <button
                              key={`${slot.id}-${index}`}
                              type="button"
                              aria-label={`Chọn lá ${slot.originalIndex + 1}`}
                              onClick={() => onPickCard(slot.id)}
                              disabled={!canPickCards}
                              className="aspect-[300/527] w-[6.5rem] shrink-0 snap-center cursor-pointer rounded-xl bg-[url('/images/cards/CardBacks.jpg')] bg-cover bg-center shadow-[0_12px_28px_rgba(0,0,0,0.45)] outline-none transition-transform focus-visible:ring-2 focus-visible:ring-amber-300 active:scale-[0.98] disabled:cursor-not-allowed sm:w-[7rem] lg:w-[8rem]"
                            />
                          );
                        })}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </section>
        ) : null}

        {ritualStage === "reveal" ? (
          <section className="rounded-[1.5rem] border border-amber-100/18 bg-black/35 p-5 backdrop-blur-md sm:p-6">
            <h3 className="font-title text-2xl text-amber-100">Mở bài</h3>
            <div className={`mt-5 grid gap-5 ${targetCount === 1 ? "sm:grid-cols-1" : "sm:grid-cols-3"}`}>
              {sortedDrawnCards.map((item) => {
                const card = getCard(item.cardId);
                const positionLabel = spread.positions[item.positionIndex] ?? `Vị trí ${item.positionIndex + 1}`;

                if (!card) {
                  return null;
                }

                return (
                  <div key={item.cardId} className="flex flex-col items-center gap-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-amber-100/75">{positionLabel}</p>

                    <button
                      type="button"
                      onClick={() => onFlipCard(item.cardId)}
                      className="group relative aspect-[300/527] w-full max-w-[11rem] cursor-pointer [perspective:1200px]"
                    >
                      <motion.div
                        initial={false}
                        animate={{ rotateY: item.isFlipped ? 180 : 0 }}
                        transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.75 }}
                        className="absolute inset-0 rounded-2xl will-change-transform [transform-style:preserve-3d]"
                        style={{ transformOrigin: "center center" }}
                      >
                        <div className="absolute inset-0 overflow-hidden rounded-2xl bg-[url('/images/cards/CardBacks.jpg')] bg-cover bg-center shadow-[0_16px_38px_rgba(0,0,0,0.5)] [backface-visibility:hidden]" />
                        <div className="absolute inset-0 overflow-hidden rounded-2xl bg-zinc-900 shadow-[0_16px_38px_rgba(0,0,0,0.55)] [backface-visibility:hidden] [transform:rotateY(180deg)]">
                          <Image src={card.image} alt={card.name} fill sizes="170px" className="rounded-2xl object-cover" />
                          <div className="absolute inset-x-2 bottom-2 rounded-xl bg-black/65 px-2.5 py-1.5 text-xs text-amber-100 backdrop-blur-sm">
                            {card.name}
                          </div>
                        </div>
                      </motion.div>
                    </button>

                    <div className="w-full rounded-xl border border-amber-100/16 bg-black/20 px-3 py-3 text-sm leading-6 text-amber-100/85">
                      {item.isFlipped ? card.meanings.general : "Nhấn để mở lá bài này."}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 rounded-xl border border-amber-100/16 bg-black/20 p-4">
              <button
                type="button"
                onClick={onGenerateReading}
                disabled={!canRequestAi}
                className="inline-flex min-h-10 items-center gap-2 rounded-full bg-amber-200 px-4 py-2 font-semibold text-zinc-900 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <WandSparkles size={15} />
                {isGenerating ? "PAL đang luận giải..." : "Luận giải ngay"}
              </button>

              {aiError ? (
                <p className="mt-3 rounded-xl border border-rose-300/35 bg-rose-950/30 px-4 py-3 text-sm text-rose-100">
                  {aiError}
                </p>
              ) : null}

              <div className="mt-4 text-sm leading-7 text-amber-50/95">
                {displayedReading ? (
                  <>
                    <div className="space-y-3">
                      <ReactMarkdown
                        components={{
                          h2: ({ children }) => <h3 className="mt-4 font-title text-2xl text-amber-50 first:mt-0">{children}</h3>,
                          h3: ({ children }) => <h4 className="mt-3 font-title text-xl text-amber-100">{children}</h4>,
                          p: ({ children }) => <p className="whitespace-pre-wrap text-amber-50/95">{children}</p>,
                          ul: ({ children }) => <ul className="list-disc space-y-1.5 pl-5 text-amber-50/95">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal space-y-1.5 pl-5 text-amber-50/95">{children}</ol>,
                          li: ({ children }) => <li className="pl-1">{children}</li>,
                          hr: () => <hr className="my-3 border-amber-100/20" />,
                          strong: ({ children }) => <strong className="font-semibold text-amber-100">{children}</strong>,
                          em: ({ children }) => <em className="text-amber-100/90 italic">{children}</em>,
                          blockquote: ({ children }) => (
                            <blockquote className="rounded-xl border-l-2 border-amber-300/55 bg-amber-100/5 px-3 py-2 text-amber-100/90">
                              {children}
                            </blockquote>
                          ),
                        }}
                      >
                        {displayedReading}
                      </ReactMarkdown>
                      {isStreaming ? <span className="inline-block animate-pulse text-amber-200">▋</span> : null}
                    </div>
                  </>
                ) : (
                  <p>{isGenerating ? "PAL đang trả lời..." : "Luận giải AI sẽ xuất hiện ở đây sau khi bạn mở đủ lá bài."}</p>
                )}
              </div>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
