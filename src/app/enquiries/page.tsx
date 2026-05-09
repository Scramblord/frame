import Navbar from "@/components/Navbar";
import { createClient } from "@/lib/supabase/server";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ConsumerEnquiriesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/enquiries");
  }

  const { data: enquiries } = await supabase
    .from("enquiries")
    .select("*")
    .eq("consumer_user_id", user.id)
    .order("updated_at", { ascending: false });

  const enquiryIds = (enquiries ?? []).map((e) => e.id as string);
  const expertIds = [...new Set((enquiries ?? []).map((e) => e.expert_user_id as string))];
  const serviceIds = [...new Set((enquiries ?? []).map((e) => e.service_id as string))];

  const [{ data: messages }, { data: experts }, { data: services }] = await Promise.all([
    enquiryIds.length > 0
      ? supabase
          .from("enquiry_messages")
          .select("enquiry_id, content, created_at, is_offer")
          .in("enquiry_id", enquiryIds)
          .order("created_at", { ascending: false })
      : {
          data: [] as {
            enquiry_id: string;
            content: string;
            created_at: string;
            is_offer: boolean;
          }[],
        },
    expertIds.length > 0
      ? supabase
          .from("profiles")
          .select("user_id, full_name, avatar_url")
          .in("user_id", expertIds)
      : {
          data: [] as {
            user_id: string;
            full_name: string | null;
            avatar_url: string | null;
          }[],
        },
    serviceIds.length > 0
      ? supabase.from("services").select("id, name").in("id", serviceIds)
      : { data: [] as { id: string; name: string }[] },
  ]);

  const lastMessageByEnquiry = new Map<
    string,
    { content: string; created_at: string; is_offer: boolean }
  >();
  for (const m of messages ?? []) {
    if (!lastMessageByEnquiry.has(m.enquiry_id)) {
      lastMessageByEnquiry.set(m.enquiry_id, {
        content: m.content,
        created_at: m.created_at,
        is_offer: m.is_offer,
      });
    }
  }
  const expertMap = new Map((experts ?? []).map((p) => [p.user_id, p]));
  const serviceMap = new Map((services ?? []).map((s) => [s.id, s.name]));

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-bold text-[var(--color-text)]">Your enquiries</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Conversations with Senseis about flexible timing services.
        </p>

        {(enquiries ?? []).length === 0 ? (
          <div className="mt-6 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-sm text-[var(--color-text-muted)]">
            No enquiries yet. Browse Senseis to get started.
          </div>
        ) : (
          <ul className="mt-6 space-y-3">
            {(enquiries ?? []).map((enquiry) => {
              const msg = lastMessageByEnquiry.get(enquiry.id);
              const preview = msg?.is_offer
                ? "Booking offer sent"
                : msg?.content?.trim()
                ? msg.content.length > 80
                  ? `${msg.content.slice(0, 80)}...`
                  : msg.content
                : "No messages yet";
              const expertRow = expertMap.get(enquiry.expert_user_id);
              const expertName = expertRow?.full_name?.trim() ?? "Sensei";
              const expertInitials = expertName
                .split(/\s+/)
                .map((w: string) => w[0])
                .join("")
                .slice(0, 2)
                .toUpperCase();
              return (
                <li key={enquiry.id}>
                  <Link
                    href={`/enquiries/${enquiry.id}`}
                    className="block rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-sm)] transition hover:border-[var(--color-border-strong)]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-1 gap-3">
                        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-zinc-900">
                          {expertRow?.avatar_url ? (
                            <Image
                              src={expertRow.avatar_url}
                              alt=""
                              fill
                              className="object-cover"
                              sizes="44px"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-white">
                              {expertInitials}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[var(--color-text)]">
                            {expertName} · {serviceMap.get(enquiry.service_id) ?? "Service"}
                          </p>
                          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                            {preview}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-accent)]">
                          {String(enquiry.status).replace(/_/g, " ")}
                        </p>
                        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                          {new Date(msg?.created_at ?? enquiry.updated_at).toLocaleString(
                            "en-GB",
                            { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" },
                          )}
                        </p>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
