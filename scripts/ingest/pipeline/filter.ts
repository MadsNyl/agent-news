import { llm } from "../llm";

const FILTER_SYSTEM = `You are a content relevance filter for an AI news platform focused on enterprise and business applications of AI.

Answer only YES or NO.

An article is relevant if it covers ANY of these topics:
- AI agents, agentic AI, or multi-agent systems
- AI-powered automation in business, enterprise, or software development
- AI tools, platforms, or infrastructure used by companies
- Real-world AI deployments, case studies, or production use cases
- AI strategy, adoption, or transformation in organizations
- Developer tools powered by AI (coding agents, copilots, etc.)
- AI in specific industries (fintech, healthcare, e-commerce, etc.)
- LLM applications, RAG, prompt engineering, or AI engineering practices
- AI safety, governance, or compliance in enterprise contexts

An article is NOT relevant if it is:
- Pure academic ML research with no practical application
- Consumer product reviews or personal gadget news
- General tech news unrelated to AI
- Cryptocurrency or blockchain (unless AI-related)
- Sponsored content or advertisements`;

interface FilterInput {
  title: string;
  description?: string;
  content: string;
}

export async function filterRelevance(input: FilterInput): Promise<boolean> {
  const parts = [
    `Title: ${input.title}`,
    input.description ? `Description: ${input.description}` : "",
    `\nContent:\n${input.content}`,
  ].filter(Boolean).join("\n");

  const result = await llm(
    "filter",
    FILTER_SYSTEM,
    `Is this article relevant?\n\n${parts}`,
    { temperature: 0, num_predict: 10 },
  );
  return result.toUpperCase().includes("YES");
}
