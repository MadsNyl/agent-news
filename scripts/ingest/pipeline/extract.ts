import { llm } from "../llm";

export async function extractContent(rawText: string): Promise<string> {
  return await llm(
    "extract-content",
    `You are a content extractor. Given raw text scraped from a web page, produce a clean, structured summary of the MAIN article in 3-5 paragraphs. Include the key points, arguments, and any specific details like company names, technologies, or metrics mentioned.

Exclude everything that is not the main article: navigation text, ads, cookie notices, and especially SPONSORED or PROMOTIONAL content. Newsletters and blogs often embed sponsor blurbs, "presented by", "a message from our sponsor", "together with <brand>", affiliate promos, or ad sections in the middle of the text — never include these, even if they read like article content. If the page is entirely sponsored/advertising with no genuine editorial article, output exactly: SPONSORED.

Output only the cleaned article content, no commentary.`,
    rawText,
    { temperature: 0, num_predict: 1000 },
  );
}
