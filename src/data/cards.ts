import cardsJson from "@/public/cards.json";
import type { TarotCardData } from "@/src/types/tarot";

export const TAROT_CARDS = cardsJson as TarotCardData[];

export const TAROT_CARD_MAP = new Map(
  TAROT_CARDS.map((card) => [card.id, card] as const),
);
