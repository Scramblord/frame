import { ExpertConnectClient } from "./connect-client";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

function Fallback() {
  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-10 sm:px-6">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
    </main>
  );
}

export default function ExpertConnectPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <ExpertConnectClient />
    </Suspense>
  );
}
