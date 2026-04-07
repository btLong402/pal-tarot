import type { SpreadDefinition, SpreadType } from "@/src/types/tarot";

export const SPREADS: Record<SpreadType, SpreadDefinition> = {
  daily: {
    id: "daily",
    label: "Rút 1 lá (Daily Card)",
    description: "Thông điệp nhanh cho ngày mới.",
    positions: ["Thông điệp hôm nay"],
  },
  "past-present-future": {
    id: "past-present-future",
    label: "Rút 3 lá (Past - Present - Future)",
    description: "Nhìn nhận sự việc theo dòng thời gian.",
    positions: ["Quá khứ", "Hiện tại", "Tương lai"],
  },
  "problem-cause-solution": {
    id: "problem-cause-solution",
    label: "Rút 3 lá (Problem - Cause - Solution)",
    description: "Tìm hướng giải quyết vấn đề cụ thể.",
    positions: ["Vấn đề", "Nguyên nhân", "Giải pháp"],
  },
};

export const SPREAD_OPTIONS = Object.values(SPREADS);
