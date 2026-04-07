import type { SpreadDefinition, SpreadType } from "@/src/types/tarot";

export const SPREADS: Record<SpreadType, SpreadDefinition> = {
  daily: {
    id: "daily",
    label: "1 lá - Daily",
    description: "Một thông điệp ngắn, rõ cho nhịp hôm nay.",
    positions: ["Thông điệp hôm nay"],
  },
  "past-present-future": {
    id: "past-present-future",
    label: "3 lá - Quá khứ / Hiện tại / Tương lai",
    description: "Đọc sự việc theo dòng chảy thời gian để thấy xu hướng.",
    positions: ["Quá khứ", "Hiện tại", "Tương lai"],
  },
  "problem-cause-solution": {
    id: "problem-cause-solution",
    label: "3 lá - Vấn đề / Nguyên nhân / Giải pháp",
    description: "Tách bạch vấn đề và hướng xử lý một cách thực tế.",
    positions: ["Vấn đề", "Nguyên nhân", "Giải pháp"],
  },
  custom: {
    id: "custom",
    label: "Custom - Tự chọn số lá",
    description: "Dành cho trải bài theo câu hỏi, bạn tự chọn số lá cần rút.",
    positions: ["Lá 1"],
  },
};

export const SPREAD_OPTIONS = Object.values(SPREADS);
