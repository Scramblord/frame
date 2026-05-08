import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(_: Request, { params }: Params) {
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
    .select("id, consumer_user_id, expert_user_id, status")
    .eq("id", id)
    .maybeSingle();

  if (enquiryErr || !enquiry) {
    return NextResponse.json({ error: "Enquiry not found" }, { status: 404 });
  }

  if (enquiry.consumer_user_id !== user.id && enquiry.expert_user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const nowIso = new Date().toISOString();

  const { error: cancelErr } = await supabase
    .from("bookings")
    .update({ status: "cancelled", cancelled_at: nowIso })
    .eq("source_enquiry_id", enquiry.id)
    .eq("status", "offer_pending");

  if (cancelErr) {
    return NextResponse.json(
      { error: cancelErr.message ?? "Could not cancel pending offer" },
      { status: 500 },
    );
  }

  const { data: updated, error: updateErr } = await supabase
    .from("enquiries")
    .update({ status: "closed" })
    .eq("id", enquiry.id)
    .select("*")
    .single();

  if (updateErr || !updated) {
    return NextResponse.json(
      { error: updateErr?.message ?? "Could not close enquiry" },
      { status: 500 },
    );
  }

  return NextResponse.json({ enquiry: updated });
}
