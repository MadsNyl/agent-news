import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "~/server/better-auth/server";
import { AdminContent } from "~/app/_components/admin-content";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getSession();
  if (!session?.user.isSuperAdmin) {
    redirect("/");
  }

  return (
    <Suspense>
      <AdminContent />
    </Suspense>
  );
}
