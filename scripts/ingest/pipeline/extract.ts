import { llm } from "../llm";

export async function extractContent(rawText: string): Promise<string> {
  return await llm(
    "extract-content",
    `You are a content extractor. Given raw text scraped from a web page, produce a clean, structured summary of the article in 3-5 paragraphs. Include the key points, arguments, and any specific details like company names, technologies, or metrics mentioned. Remove any navigation text, ads, cookie notices, or other non-article content. Output only the cleaned content, no commentary.`,
    rawText,
    { temperature: 0, num_predict: 1000 },
  );
}
