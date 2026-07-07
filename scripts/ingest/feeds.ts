export interface Feed {
  name: string;
  url: string;
}

export const FEEDS: Feed[] = [
  // Newsletters
  { name: "TLDR AI", url: "https://tldr.tech/api/rss/ai" },
  { name: "Import AI", url: "https://jack-clark.net/feed/" },
  { name: "Ben's Bites", url: "https://www.bensbites.com/feed" },
  { name: "Last Week in AI", url: "https://lastweekin.ai/feed" },
  { name: "Interconnects", url: "https://www.interconnects.ai/feed" },

  // Tech publications
  { name: "MIT Tech Review", url: "https://www.technologyreview.com/feed/" },
  { name: "The Verge AI", url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml" },
  { name: "VentureBeat AI", url: "https://venturebeat.com/category/ai/feed" },
  { name: "TechCrunch AI", url: "https://techcrunch.com/category/artificial-intelligence/feed/" },
  { name: "MarkTechPost", url: "https://www.marktechpost.com/feed/" },

  // Company blogs
  { name: "OpenAI", url: "https://openai.com/news/rss.xml" },
  { name: "Google DeepMind", url: "https://deepmind.google/blog/rss.xml" },
  { name: "Hugging Face", url: "https://huggingface.co/blog/feed.xml" },
  { name: "LangChain", url: "https://www.langchain.com/blog/rss.xml" },

  // Developer blogs
  { name: "Simon Willison", url: "https://simonwillison.net/atom/everything/" },
];
