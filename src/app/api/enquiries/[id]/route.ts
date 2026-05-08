import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: enquiry, error: enquiryErr } = await supabase
    .from("enquiries")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (enquiryErr || !enquiry) {
    return NextResponse.json({ error: "Enquiry not found" }, { status: 404 });
  }

  if (enquiry.consumer_user_id !== user.id && enquiry.expert_user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [{ data: messages, error: messagesErr }, { data: offers, error: offersErr }] =
    await Promise.all([
      supabase
        .from("enquiry_messages")
        .select("*")
        .eq("enquiry_id", id)
        .order("created_at", { ascending: true }),
      supabase
        .from("bookings")
        .select(
          "id, status, session_type, scheduled_at, duration_minutes, total_amount, offer_sent_at, offer_expires_at",
        )
        .eq("source_enquiry_id", id)
        .order("offer_sent_at", { ascending: false }),
    ]);

  if (messagesErr || offersErr) {
    return NextResponse.json(
      { error: messagesErr?.message ?? offersErr?.message ?? "Load failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    enquiry,
    messages: messages ?? [],
    offers: offers ?? [],
  });
}
