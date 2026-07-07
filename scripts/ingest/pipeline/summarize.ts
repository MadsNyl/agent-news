import { llm } from "../llm";

export async function summarize(text: string): Promise<string> {
  const result = await llm(
    "summarize",
    "Summarize the article in exactly 2-3 sentences. Be direct and factual. Do not start with 'This article' or 'The article'. No bullet points.",
    text,
    { temperature: 0.3, num_predict: 150 },
  );
  return result || "Summary unavailable.";
}
