import { type Metadata } from "next";
import { Suspense } from "react";
import { Feed } from "~/app/_components/feed";

export const metadata: Metadata = {
  title: "Videos — Agent News",
  description:
    "Watch curated videos about real-world AI agent implementations in enterprise and business.",
};

export default function VideosPage() {
  return (
    <Suspense>
      <Feed contentType="VIDEO" />
    </Suspense>
  );
}
