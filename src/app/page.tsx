import { Suspense } from "react";
import { Feed } from "~/app/_components/feed";

export default function Home() {
  return (
    <Suspense>
      <Feed />
    </Suspense>
  );
}
