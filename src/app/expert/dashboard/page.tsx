export default function ExpertDashboardPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center bg-zinc-50 px-6 py-16 font-sans dark:bg-zinc-950">
      <p className="font-mono text-sm font-semibold tracking-[0.2em] text-zinc-900 dark:text-zinc-100">
        FRAME
      </p>
      <h1 className="mt-4 text-xl font-semibold text-zinc-800 dark:text-zinc-200">
        Expert dashboard
      </h1>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        Your sessions and availability will show here.
      </p>
    </div>
  );
}
