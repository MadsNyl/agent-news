export interface Feed {
  name: string;
  url: string;
  /**
   * Dedup tie-breaker: when the same story appears across feeds, the survivor
   * is the one with the LOWEST priority number (original sources beat
   * aggregators). Ties break on longest extracted content. Tune freely.
   */
  priority: number;
}

export const FEEDS: Feed[] = [
  // Primary sources — company & research-lab blogs (win ties)
  { name: "OpenAI", url: "https://openai.com/news/rss.xml", priority: 1 },
  {
    name: "Google DeepMind",
    url: "https://deepmind.google/blog/rss.xml",
    priority: 1,
  },
  {
    name: "Hugging Face",
    url: "https://huggingface.co/blog/feed.xml",
    priority: 1,
  },
  {
    name: "LangChain",
    url: "https://www.langchain.com/blog/rss.xml",
    priority: 1,
  },

  // First-party author analysis
  {
    name: "Simon Willison",
    url: "https://simonwillison.net/atom/everything/",
    priority: 2,
  },
  {
    name: "Interconnects",
    url: "https://www.interconnects.ai/feed",
    priority: 2,
  },
  { name: "Import AI", url: "https://jack-clark.net/feed/", priority: 2 },

  // Tech publications
  {
    name: "MIT Tech Review",
    url: "https://www.technologyreview.com/feed/",
    priority: 3,
  },
  {
    name: "The Verge AI",
    url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml",
    priority: 3,
  },
  {
    name: "TechCrunch AI",
    url: "https://techcrunch.com/category/artificial-intelligence/feed/",
    priority: 3,
  },

  // Aggregator newsletters (lose ties — they syndicate the above)
  { name: "TLDR AI", url: "https://tldr.tech/api/rss/ai", priority: 4 },
  { name: "Ben's Bites", url: "https://www.bensbites.com/feed", priority: 4 },
  { name: "Last Week in AI", url: "https://lastweekin.ai/feed", priority: 4 },
];
