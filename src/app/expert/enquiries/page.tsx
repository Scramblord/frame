import Navbar from "@/components/Navbar";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ExpertEnquiriesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/expert/enquiries");
  }

  const { data: expertProfile } = await supabase
    .from("expert_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!expertProfile) {
    redirect("/expert/setup");
  }

  const { data: enquiries } = await supabase
    .from("enquiries")
    .select("*")
    .eq("expert_user_id", user.id)
    .order("updated_at", { ascending: false });

  const enquiryIds = (enquiries ?? []).map((e) => e.id as string);
  const consumerIds = [...new Set((enquiries ?? []).map((e) => e.consumer_user_id as string))];
  const serviceIds = [...new Set((enquiries ?? []).map((e) => e.service_id as string))];

  const [{ data: messages }, { data: consumers }, { data: services }] = await Promise.all([
    enquiryIds.length > 0
      ? supabase
          .from("enquiry_messages")
          .select("enquiry_id, content, created_at")
          .in("enquiry_id", enquiryIds)
          .order("created_at", { ascending: false })
      : { data: [] as { enquiry_id: string; content: string; created_at: string }[] },
    consumerIds.length > 0
      ? supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", consumerIds)
      : { data: [] as { user_id: string; full_name: string | null }[] },
    serviceIds.length > 0
      ? supabase.from("services").select("id, name").in("id", serviceIds)
      : { data: [] as { id: string; name: string }[] },
  ]);

  const lastMessageByEnquiry = new Map<string, { content: string; created_at: string }>();
  for (const m of messages ?? []) {
    if (!lastMessageByEnquiry.has(m.enquiry_id)) {
      lastMessageByEnquiry.set(m.enquiry_id, {
        content: m.content,
        created_at: m.created_at,
      });
    }
  }
  const consumerMap = new Map((consumers ?? []).map((p) => [p.user_id, p.full_name]));
  const serviceMap = new Map((services ?? []).map((s) => [s.id, s.name]));

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-bold text-[var(--color-text)]">Enquiries</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Student conversations waiting for your response.
        </p>

        {(enquiries ?? []).length === 0 ? (
          <div className="mt-6 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-sm text-[var(--color-text-muted)]">
            No enquiries yet.
          </div>
        ) : (
          <ul className="mt-6 space-y-3">
            {(enquiries ?? []).map((enquiry) => {
              const msg = lastMessageByEnquiry.get(enquiry.id);
              const preview = msg?.content?.trim()
                ? msg.content.length > 80
                  ? `${msg.content.slice(0, 80)}...`
                  : msg.content
                : "No messages yet";
              return (
                <li key={enquiry.id}>
                  <Link
                    href={`/expert/enquiries/${enquiry.id}`}
                    className="block rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-sm)] transition hover:border-[var(--color-border-strong)]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-[var(--color-text)]">
                          {consumerMap.get(enquiry.consumer_user_id) ?? "Student"} ·{" "}
                          {serviceMap.get(enquiry.service_id) ?? "Service"}
                        </p>
                        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                          {preview}
                        </p>
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
