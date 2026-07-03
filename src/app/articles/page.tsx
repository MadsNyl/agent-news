import { type Metadata } from "next";
import { Suspense } from "react";
import { Feed } from "~/app/_components/feed";

export const metadata: Metadata = {
  title: "Articles — Agent News",
  description:
    "Browse curated articles about real-world AI agent implementations in enterprise and business.",
};

export default function ArticlesPage() {
  return (
    <Suspense>
      <Feed />
    </Suspense>
  );
}
