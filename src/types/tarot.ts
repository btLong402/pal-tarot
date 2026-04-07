export type TarotContext = "general" | "love" | "career" | "finance";

export type TarotMeaning = Record<TarotContext, string>;

export interface TarotCardData {
  id: string;
  name: string;
  arcana: "Major" | "Minor";
  suit: "None" | "Wands" | "Cups" | "Swords" | "Pentacles";
  meanings: TarotMeaning;
  image: string;
}

export type SpreadType = "daily" | "past-present-future" | "problem-cause-solution";

export interface SpreadDefinition {
  id: SpreadType;
  label: string;
  description: string;
  positions: string[];
}
