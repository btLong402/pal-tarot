import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error("Missing GEMINI_API_KEY environment variable");
}

async function listModels() {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to list models: ${response.status} ${errorText}`);
  }

  const modelList = (await response.json()) as {
    models?: Array<{ name: string; supportedGenerationMethods?: string[] }>;
  };

  console.log("Danh sách model bạn có thể dùng:");
  (modelList.models ?? []).forEach((m) => {
    console.log(`- ID: ${m.name} | Methods: ${m.supportedGenerationMethods}`);
  });
}

listModels();