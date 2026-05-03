import { generateText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

const provider = createOpenAICompatible({
  name: process.env.AI_PROVIDER_NAME || "openai-compatible",
  apiKey: process.env.AI_API_KEY,
  baseURL: process.env.AI_BASE_URL || "https://api.openai.com/v1"
});

function getModel() {
  const modelName = process.env.AI_MODEL || "gpt-4o-mini";
  return typeof provider.chatModel === "function"
    ? provider.chatModel(modelName)
    : provider(modelName);
}

export async function getAssistantReply(messages) {
  if (!process.env.AI_API_KEY) {
    throw new Error("AI_API_KEY is not configured");
  }

  const cleanMessages = messages
    .filter((message) => ["user", "assistant"].includes(message.role))
    .map((message) => ({
      role: message.role,
      content: String(message.content ?? "")
    }))
    .filter((message) => message.content.trim().length > 0);

  const { text } = await generateText({
    model: getModel(),
    system: "You are a helpful assistant inside a simple learning chat app.",
    messages: cleanMessages
  });

  return text;
}
