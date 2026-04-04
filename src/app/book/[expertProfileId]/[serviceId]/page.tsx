import Link from "next/link";

type PageProps = {
  params: Promise<{ expertProfileId: string; serviceId: string }>;
  searchParams: Promise<{ type?: string }>;
};

/** Placeholder for the booking flow — links from public expert services land here. */
export default async function BookServicePage({
  params,
  searchParams,
}: PageProps) {
  const { expertProfileId, serviceId } = await params;
  const { type } = await searchParams;
  const consult =
    type === "messaging" || type === "audio" || type === "video"
      ? type
      : null;

  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-100 px-4 py-16 dark:bg-zinc-950">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Book a session
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Booking for profile{" "}
          <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">
            {expertProfileId}
          </code>
          , service{" "}
          <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">
            {serviceId}
          </code>
          {consult ? (
            <>
              , type <span className="font-medium">{consult}</span>
            </>
          ) : null}
          . Full scheduling and payment will be wired here.
        </p>
        <Link
          href={`/experts/${expertProfileId}`}
          className="mt-6 inline-block text-sm font-semibold text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-100"
        >
          ← Back to expert
        </Link>
      </div>
    </div>
  );
}
