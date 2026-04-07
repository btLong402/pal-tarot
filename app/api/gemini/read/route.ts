import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import TAROT_SYSTEM_PROMPT from "@/src/constants/prompt";

type ReadingRequest = {
  question?: string;
  spreadLabel?: string;
  cards?: Array<{
    id?: string;
    name?: string;
    position?: string;
    meaning?: string;
  }>;
};

const MODEL_CANDIDATES = ["gemini-3-flash", "gemini-2.5-flash", "gemini-2.0-flash"];

function sanitizeText(input: string, maxLength: number): string {
  return input.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function buildUserPrompt(payload: Required<ReadingRequest>) {
  const cardsText = payload.cards
    .map(
      (card, index) =>
        `${index + 1}. Vị trí: ${card.position}\nLá bài: ${card.name}\nThông điệp cốt lõi: ${card.meaning}`,
    )
    .join("\n\n");

  return [
    "Ngữ cảnh phiên trải bài:",
    `- Câu hỏi của Lữ khách: ${payload.question}`,
    `- Kiểu trải bài: ${payload.spreadLabel}`,
    "- Dữ liệu các lá bài:",
    cardsText,
    "\nYêu cầu: Hãy viết lời luận giải liền mạch bằng tiếng Việt, đúng cấu trúc markdown đã định trong system prompt.",
  ].join("\n");
}

function toError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    return toError("Thiếu cấu hình GEMINI_API_KEY ở server.", 500);
  }

  let body: ReadingRequest;
  try {
    body = (await request.json()) as ReadingRequest;
  } catch {
    return toError("Payload không hợp lệ.", 400);
  }

  const question = typeof body.question === "string" ? sanitizeText(body.question, 1200) : "";
  const spreadLabel =
    typeof body.spreadLabel === "string" ? sanitizeText(body.spreadLabel, 120) : "";

  const cards =
    Array.isArray(body.cards) && body.cards.length > 0
      ? body.cards
          .map((card) => ({
            id: typeof card.id === "string" ? sanitizeText(card.id, 120) : "",
            name: typeof card.name === "string" ? sanitizeText(card.name, 120) : "",
            position:
              typeof card.position === "string" ? sanitizeText(card.position, 80) : "Không xác định",
            meaning:
              typeof card.meaning === "string"
                ? sanitizeText(card.meaning, 700)
                : "Ý nghĩa chưa được cung cấp.",
          }))
          .filter((card) => card.id && card.name)
      : [];

  if (!question) {
    return toError("Vui lòng nhập câu hỏi trước khi nhận thông điệp.", 400);
  }

  if (!spreadLabel || cards.length === 0) {
    return toError("Thiếu dữ liệu lá bài để tổng kết.", 400);
  }

  const payload: Required<ReadingRequest> = {
    question,
    spreadLabel,
    cards,
  };

  const userPrompt = buildUserPrompt(payload);
  const genAI = new GoogleGenerativeAI(apiKey);

  let lastError: unknown;

  for (const modelName of MODEL_CANDIDATES) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: TAROT_SYSTEM_PROMPT,
      });

      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: 0.78,
          topP: 0.95,
          maxOutputTokens: 1600,
        },
      });

      const reading = result.response.text().trim();

      if (!reading) {
        return toError("Không nhận được nội dung từ AI.", 502);
      }

      return NextResponse.json(
        {
          reading,
          model: modelName,
        },
        {
          status: 200,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    } catch (error) {
      lastError = error;
    }
  }

  console.error("Gemini generate failed", lastError);
  return toError("PAL chưa thể kết nối AI lúc này. Bạn thử lại sau ít phút nhé.", 502);
}
