import { GoogleGenAI } from "@google/genai";
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

const MODEL_CANDIDATES = ["gemini-3-flash-preview", "gemini-3.1-flash-lite-preview", "gemini-3.1-flash-preview"];

type GeminiSdkError = {
  status?: number;
  message?: string;
  errorDetails?: Array<{
    "@type"?: string;
    retryDelay?: string;
  }>;
};

type GeminiFinishReason = "MAX_TOKENS" | "STOP" | "SAFETY" | "RECITATION" | string;

function needsContinuation(finishReason: GeminiFinishReason | undefined) {
  return finishReason === "MAX_TOKENS";
}

function buildContinuationPrompt(fullPrompt: string, partialAnswer: string) {
  const tail = partialAnswer.slice(-900);

  return [
    "Bạn đang viết dở phần luận giải tarot và bị ngắt do giới hạn token.",
    "Nhiệm vụ: tiếp tục viết phần còn lại ngay sau đoạn đã có, không lặp lại nội dung cũ.",
    "Nếu đã đủ ý thì chỉ cần viết đoạn kết ngắn gọn, trọn câu.",
    "",
    "Bối cảnh gốc:",
    fullPrompt,
    "",
    "Đoạn đã viết đến đây:",
    tail,
  ].join("\n");
}

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
    "Luôn hoàn tất đầy đủ các phần và kết thúc bằng câu trọn nghĩa, không dừng giữa câu.",
  ].join("\n");
}

function toError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function parseRetryDelaySeconds(value?: string): number | null {
  if (!value) {
    return null;
  }

  const match = value.match(/^(\d+)s$/);
  if (!match) {
    return null;
  }

  const seconds = Number.parseInt(match[1], 10);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

function getQuotaContext(error: unknown) {
  const sdkError = error as GeminiSdkError;
  const status = typeof sdkError?.status === "number" ? sdkError.status : undefined;
  const message = error instanceof Error ? error.message : "";
  const isQuotaError =
    status === 429 || /quota|too many requests|rate limit/i.test(message);

  if (!isQuotaError) {
    return null;
  }

  const retryInfo = sdkError?.errorDetails?.find(
    (item) => item?.["@type"] === "type.googleapis.com/google.rpc.RetryInfo",
  );

  return {
    retryAfterSeconds: parseRetryDelaySeconds(retryInfo?.retryDelay),
  };
}

function isModelUnsupported(error: unknown) {
  const sdkError = error as GeminiSdkError;
  const status = typeof sdkError?.status === "number" ? sdkError.status : undefined;
  const message = error instanceof Error ? error.message : "";

  return status === 404 || /not found|not supported for generatecontent/i.test(message);
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

  if (!spreadLabel || cards.length === 0) {
    return toError("Thiếu dữ liệu lá bài để tổng kết.", 400);
  }

  const normalizedQuestion =
    question || "Không có câu hỏi cụ thể. Hãy luận giải dựa trên năng lượng chung của trải bài.";

  const payload: Required<ReadingRequest> = {
    question: normalizedQuestion,
    spreadLabel,
    cards,
  };

  const userPrompt = buildUserPrompt(payload);
  const genAI = new GoogleGenAI({ apiKey });

  let lastError: unknown;
  let quotaRetryAfterSeconds: number | null = null;
  let hasUnsupportedModel = false;

  for (const modelName of MODEL_CANDIDATES) {
    try {
      let promptForModel = userPrompt;
      let reading = "";

      for (let i = 0; i < 3; i += 1) {
        const result = await genAI.models.generateContent({
          model: modelName,
          contents: [{ role: "user", parts: [{ text: promptForModel }] }],
          config: {
            systemInstruction: TAROT_SYSTEM_PROMPT,
            temperature: 0.78,
            topP: 0.95,
            maxOutputTokens: 2400,
          },
        });

        const chunk = result.text?.trim() ?? "";
        if (chunk) {
          reading = `${reading}${reading ? "\n\n" : ""}${chunk}`.trim();
        }

        const finishReason = result.candidates?.[0]?.finishReason as
          | GeminiFinishReason
          | undefined;

        if (!needsContinuation(finishReason)) {
          break;
        }

        promptForModel = buildContinuationPrompt(userPrompt, reading);
      }

      if (!reading) {
        continue;
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
      console.error(`Gemini generate failed (${modelName})`, error);

      const quotaContext = getQuotaContext(error);
      if (quotaContext) {
        quotaRetryAfterSeconds = quotaContext.retryAfterSeconds ?? quotaRetryAfterSeconds;
      }

      if (isModelUnsupported(error)) {
        hasUnsupportedModel = true;
      }
    }
  }

  if (quotaRetryAfterSeconds !== null) {
    const retrySeconds = quotaRetryAfterSeconds;
    const retryText = retrySeconds > 0 ? ` Vui lòng thử lại sau khoảng ${retrySeconds} giây.` : "";

    return NextResponse.json(
      {
        error: `PAL đang chạm giới hạn quota của Gemini.${retryText}`,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(retrySeconds),
          "Cache-Control": "no-store",
        },
      },
    );
  }

  if (hasUnsupportedModel) {
    return toError("Model hiện tại chưa được hỗ trợ trên project này. PAL đã thử model dự phòng nhưng chưa thành công.", 503);
  }

  console.error("Gemini generate failed", lastError);
  return toError("PAL chưa thể kết nối AI lúc này. Bạn thử lại sau ít phút nhé.", 502);
}
