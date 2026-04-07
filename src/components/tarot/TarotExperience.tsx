"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Sparkles, Shuffle, RotateCcw, Flame, WandSparkles } from "lucide-react";
import { TAROT_CARDS, TAROT_CARD_MAP } from "@/src/data/cards";
import { SPREADS, SPREAD_OPTIONS } from "@/src/data/spreads";
import type { SpreadType, TarotCardData } from "@/src/types/tarot";

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

function cardArc(index: number, total: number) {
  const ratio = total > 1 ? index / (total - 1) : 0.5;
  const angle = -34 + ratio * 68;
  const radius = 280;
  const radians = (angle * Math.PI) / 180;

  return {
    x: Math.sin(radians) * radius,
    y: Math.cos(radians) * 44,
    rotate: angle * 0.65,
  };
}

function shuffledPose(index: number, seed: number) {
  const wave = Math.sin(index * 1.87 + seed * 0.61);
  const wave2 = Math.cos(index * 0.93 + seed * 1.13);

  return {
    x: wave * 160,
    y: wave2 * 90 - 40,
    rotate: wave * 18,
  };
}

function getCard(cardId: string): TarotCardData | undefined {
  return TAROT_CARD_MAP.get(cardId);
}

export default function TarotExperience() {
  const [question, setQuestion] = useState("");
  const [spreadType, setSpreadType] = useState<SpreadType>("past-present-future");
  const [deckOrder, setDeckOrder] = useState<string[]>(() =>
    TAROT_CARDS.map((card) => card.id),
  );
  const [isShuffled, setIsShuffled] = useState(false);
  const [isShuffling, setIsShuffling] = useState(false);
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const [drawnCards, setDrawnCards] = useState<DrawnCard[]>([]);
  const [focusCardId, setFocusCardId] = useState<string | null>(null);
  const [aiReading, setAiReading] = useState("");
  const [typedReading, setTypedReading] = useState("");
  const [aiModel, setAiModel] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiError, setAiError] = useState("");

  const spread = SPREADS[spreadType];
  const targetCount = spread.positions.length;
  const drawnIds = useMemo(() => new Set(drawnCards.map((item) => item.cardId)), [drawnCards]);
  const canDraw = isShuffled && !isShuffling && drawnCards.length < targetCount;
  const sortedDrawnCards = useMemo(
    () => [...drawnCards].sort((a, b) => a.positionIndex - b.positionIndex),
    [drawnCards],
  );
  const allCardsFlipped =
    sortedDrawnCards.length === targetCount && sortedDrawnCards.every((item) => item.isFlipped);
  const canRequestAi = allCardsFlipped && question.trim().length > 0 && !isGenerating;

  const deckForDisplay = useMemo(
    () => deckOrder.map((id) => ({ id, hidden: drawnIds.has(id) })),
    [deckOrder, drawnIds],
  );

  const onShuffle = () => {
    setIsShuffling(true);
    setFocusCardId(null);
    setDrawnCards([]);
    setAiReading("");
    setTypedReading("");
    setAiModel("");
    setAiError("");
    setDeckOrder((prev) => shuffleIds(prev));
    setShuffleSeed((prev) => prev + 1);

    window.setTimeout(() => {
      setIsShuffled(true);
      setIsShuffling(false);
    }, 1000);
  };

  const onReset = () => {
    setQuestion("");
    setSpreadType("past-present-future");
    setDeckOrder(TAROT_CARDS.map((card) => card.id));
    setDrawnCards([]);
    setFocusCardId(null);
    setIsShuffled(false);
    setIsShuffling(false);
    setAiReading("");
    setTypedReading("");
    setAiModel("");
    setAiError("");
    setIsGenerating(false);
  };

  const onDraw = (cardId: string) => {
    if (!canDraw || drawnIds.has(cardId)) {
      return;
    }

    setDrawnCards((prev) => {
      if (prev.length >= targetCount) {
        return prev;
      }
      return [...prev, { cardId, positionIndex: prev.length, isFlipped: false }];
    });
  };

  const onFlip = (cardId: string) => {
    setDrawnCards((prev) =>
      prev.map((item) =>
        item.cardId === cardId ? { ...item, isFlipped: !item.isFlipped } : item,
      ),
    );
    setFocusCardId((prev) => (prev === cardId ? null : cardId));
  };

  useEffect(() => {
    if (!aiReading) {
      setTypedReading("");
      return;
    }

    let index = 0;
    const step = Math.max(1, Math.floor(aiReading.length / 420));
    setTypedReading("");

    const timer = window.setInterval(() => {
      index = Math.min(aiReading.length, index + step);
      setTypedReading(aiReading.slice(0, index));

      if (index >= aiReading.length) {
        window.clearInterval(timer);
      }
    }, 18);

    return () => window.clearInterval(timer);
  }, [aiReading]);

  const onGenerateMessage = async () => {
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
    setTypedReading("");
    setAiModel("");

    try {
      const response = await fetch("/api/gemini/read", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: question.trim(),
          spreadLabel: spread.label,
          cards: cardsPayload,
        }),
      });

      const data = (await response.json()) as {
        reading?: string;
        error?: string;
        model?: string;
      };

      if (!response.ok || !data.reading) {
        throw new Error(data.error ?? "Không thể tạo thông điệp lúc này.");
      }

      setAiModel(data.model ?? "gemini-3-flash");
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

      <main className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-8 lg:py-12">
        <header className="rounded-2xl border border-amber-200/20 bg-black/30 p-6 backdrop-blur-md">
          <p className="text-xs uppercase tracking-[0.4em] text-amber-200/80">Pal Tarot</p>
          <h1 className="mt-2 font-title text-4xl text-amber-50 sm:text-5xl">Không gian của sự chiêm nghiệm</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-amber-100/75 sm:text-base">
            Hãy để trực giác của bạn dẫn lối. Chọn kiểu trải bài, xáo bộ bài và rút những lá có kết nối với câu chuyện bạn đang mang theo.
          </p>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <article className="rounded-2xl border border-amber-100/20 bg-black/35 p-5 backdrop-blur-md sm:p-6">
            <div className="mb-3 flex items-center gap-2 text-amber-200">
              <Sparkles size={18} />
              <h2 className="font-title text-2xl">The Question</h2>
            </div>
            <label className="mb-2 block text-sm text-amber-100/80" htmlFor="question-input">
              Nhập điều bạn đang trăn trở
            </label>
            <textarea
              id="question-input"
              className="min-h-28 w-full rounded-xl border border-amber-200/30 bg-black/25 p-3 text-base text-amber-50 outline-none transition focus:border-amber-300 focus:ring-2 focus:ring-amber-300/30"
              placeholder="Ví dụ: Mình đang phân vân giữa ở lại công việc cũ hay bắt đầu một hướng đi mới..."
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
            />

            <div className="mt-5 space-y-2">
              <p className="text-sm text-amber-100/80">Chọn kiểu trải bài</p>
              <div className="grid gap-2 sm:grid-cols-1">
                {SPREAD_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      setSpreadType(option.id);
                      setDrawnCards([]);
                      setFocusCardId(null);
                    }}
                    className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                      spreadType === option.id
                        ? "border-amber-200 bg-amber-100/10 text-amber-50"
                        : "border-amber-100/20 bg-black/20 text-amber-100/80 hover:border-amber-100/40"
                    }`}
                  >
                    <p className="font-medium">{option.label}</p>
                    <p className="text-xs opacity-80">{option.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onShuffle}
                disabled={isShuffling}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-amber-200 px-4 py-2 font-semibold text-zinc-900 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <Shuffle size={16} />
                {isShuffling ? "Đang xáo bài..." : "Xáo bài"}
              </button>
              <button
                type="button"
                onClick={onReset}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-amber-100/30 px-4 py-2 text-amber-100/90 transition hover:bg-amber-100/10"
              >
                <RotateCcw size={16} />
                Làm mới phiên
              </button>
            </div>

            <div className="mt-4 text-xs text-amber-100/70">
              {canDraw
                ? `Hãy rút ${targetCount - drawnCards.length} lá nữa từ bộ bài.`
                : "Nhấn Xáo bài trước khi rút để đánh thức năng lượng ngẫu nhiên."}
            </div>
          </article>

          <article className="rounded-2xl border border-amber-100/20 bg-black/35 p-5 backdrop-blur-md sm:p-6">
            <div className="mb-3 flex items-center gap-2 text-amber-200">
              <Flame size={18} />
              <h2 className="font-title text-2xl">Sơ đồ trải bài</h2>
            </div>
            <div className={`grid gap-4 ${targetCount === 1 ? "sm:grid-cols-1" : "sm:grid-cols-3"}`}>
              {spread.positions.map((position, index) => {
                const drawn = drawnCards.find((item) => item.positionIndex === index);
                const card = drawn ? getCard(drawn.cardId) : undefined;
                const isDimmed = Boolean(focusCardId && focusCardId !== drawn?.cardId);

                return (
                  <div key={position} className="flex flex-col items-center gap-2">
                    <p className="text-xs uppercase tracking-[0.2em] text-amber-100/80">{position}</p>
                    <button
                      type="button"
                      disabled={!drawn}
                      onClick={() => drawn && onFlip(drawn.cardId)}
                      className="group relative h-60 w-40 [perspective:1200px]"
                    >
                      <motion.div
                        animate={{ rotateY: drawn?.isFlipped ? 180 : 0 }}
                        transition={{ duration: 0.6, ease: "easeInOut" }}
                        className={`absolute inset-0 rounded-xl transition ${
                          isDimmed ? "opacity-35" : "opacity-100"
                        } [transform-style:preserve-3d]`}
                      >
                        <div className="absolute inset-0 rounded-xl border border-amber-100/25 bg-[url('/images/cards/CardBacks.jpg')] bg-cover bg-center shadow-[0_16px_38px_rgba(0,0,0,0.5)] [backface-visibility:hidden]" />
                        <div className="absolute inset-0 rounded-xl border border-amber-100/30 bg-zinc-900 shadow-[0_16px_38px_rgba(0,0,0,0.55)] [backface-visibility:hidden] [transform:rotateY(180deg)]">
                          {card ? (
                            <>
                              <Image
                                src={card.image}
                                alt={card.name}
                                fill
                                sizes="160px"
                                className="rounded-xl object-cover"
                              />
                              <div className="absolute inset-x-2 bottom-2 rounded-md bg-black/65 px-2 py-1 text-xs text-amber-100 backdrop-blur-sm">
                                {card.name}
                              </div>
                            </>
                          ) : null}
                        </div>
                      </motion.div>
                    </button>

                    <p className="min-h-10 text-center text-xs text-amber-100/70">
                      {!drawn ? "Chưa rút" : drawn.isFlipped ? "Đã lật" : "Nhấn để lật"}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 rounded-xl border border-amber-100/20 bg-black/20 p-3 text-sm text-amber-100/85">
              {focusCardId ? (
                <>
                  <p className="font-semibold text-amber-50">{getCard(focusCardId)?.name}</p>
                  <p className="mt-1 leading-6">
                    {getCard(focusCardId)?.meanings.general ?? "Ý nghĩa đang được cập nhật."}
                  </p>
                </>
              ) : (
                <p>Chạm vào một lá đã rút để lật 3D và xem thông điệp cơ bản.</p>
              )}
            </div>
          </article>
        </section>

        <section className="relative min-h-[320px] rounded-2xl border border-amber-100/20 bg-black/35 p-5 backdrop-blur-md sm:p-8">
          <h2 className="font-title text-2xl text-amber-100">Bộ bài ảo 78 lá</h2>
          <p className="mt-1 text-sm text-amber-100/70">
            {isShuffling
              ? "Năng lượng đang chuyển động..."
              : canDraw
                ? "Nhấn vào lá bạn cảm thấy có kết nối để rút vào sơ đồ trải bài."
                : "Xáo bài để bắt đầu rút lá."}
          </p>

          <div className="relative mt-8 h-[240px]">
            {deckForDisplay.map((slot, index) => {
              if (slot.hidden) {
                return null;
              }

              const base = cardArc(index, deckForDisplay.length);
              const random = shuffledPose(index, shuffleSeed);

              return (
                <motion.button
                  key={slot.id}
                  type="button"
                  aria-label={`Rút lá số ${index + 1}`}
                  onClick={() => onDraw(slot.id)}
                  disabled={!canDraw}
                  className="absolute left-1/2 top-[56%] h-36 w-24 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-lg border border-amber-100/20 bg-[url('/images/cards/CardBacks.jpg')] bg-cover bg-center shadow-[0_10px_28px_rgba(0,0,0,0.45)] outline-none transition focus-visible:ring-2 focus-visible:ring-amber-300 disabled:cursor-not-allowed"
                  animate={
                    isShuffling
                      ? { x: random.x, y: random.y, rotate: random.rotate }
                      : { x: base.x, y: base.y, rotate: base.rotate }
                  }
                  transition={{ duration: isShuffling ? 0.28 : 0.5, ease: "easeInOut" }}
                  style={{ zIndex: index + 1 }}
                  whileHover={!isShuffling && canDraw ? { y: base.y - 16 } : undefined}
                />
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-amber-100/20 bg-black/35 p-5 backdrop-blur-md sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-title text-2xl text-amber-100">The Healing Message</h2>
              <p className="mt-1 text-sm text-amber-100/70">
                Lật toàn bộ lá bài rồi nhấn nhận thông điệp để PAL kết nối câu chuyện của bạn bằng Gemini.
              </p>
            </div>
            <button
              type="button"
              onClick={onGenerateMessage}
              disabled={!canRequestAi}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-amber-200 px-4 py-2 font-semibold text-zinc-900 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <WandSparkles size={16} />
              {isGenerating ? "PAL đang viết thông điệp..." : "Nhận thông điệp"}
            </button>
          </div>

          {!question.trim() ? (
            <p className="mt-4 text-sm text-amber-100/70">
              Hãy nhập câu hỏi trước để PAL có đủ ngữ cảnh cá nhân hóa.
            </p>
          ) : null}

          {!allCardsFlipped ? (
            <p className="mt-4 text-sm text-amber-100/70">
              Bạn cần lật đủ {targetCount} lá trong sơ đồ trước khi gọi AI tổng kết.
            </p>
          ) : null}

          {aiError ? (
            <p className="mt-4 rounded-xl border border-rose-300/35 bg-rose-950/30 px-4 py-3 text-sm text-rose-100">
              {aiError}
            </p>
          ) : null}

          <div className="mt-4 min-h-40 rounded-xl border border-amber-100/20 bg-black/25 p-4">
            {typedReading ? (
              <>
                <p className="mb-2 text-xs uppercase tracking-[0.2em] text-amber-100/60">
                  {aiModel ? `Powered by ${aiModel}` : "PAL Reader"}
                </p>
                <p className="whitespace-pre-wrap text-sm leading-7 text-amber-50">
                  {typedReading}
                  {typedReading.length < aiReading.length ? (
                    <span className="ml-1 inline-block animate-pulse">|</span>
                  ) : null}
                </p>
              </>
            ) : (
              <p className="text-sm leading-7 text-amber-100/70">
                Thông điệp từ PAL sẽ xuất hiện ở đây theo hiệu ứng typewriter.
              </p>
            )}
          </div>
        </section>

        <footer className="pb-2 text-center text-xs text-amber-100/60">
          An Thành Tarot cung cấp thông điệp mang tính chất chiêm nghiệm và giải trí. Không thay thế lời khuyên chuyên môn.
        </footer>
      </main>
    </div>
  );
}
