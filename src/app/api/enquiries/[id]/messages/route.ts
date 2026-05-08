import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

type SendMessageBody = {
  content?: string;
};

const MAX_CONTENT_LENGTH = 20000;

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: SendMessageBody;
  try {
    body = (await request.json()) as SendMessageBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const content = body.content?.trim() ?? "";
  if (!content) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    return NextResponse.json({ error: "content is too long" }, { status: 400 });
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

  if (enquiry.status === "closed" || enquiry.status === "booked" || enquiry.status === "expired") {
    return NextResponse.json(
      { error: "This enquiry is not open for new messages" },
      { status: 400 },
    );
  }

  const { data: inserted, error: insertErr } = await supabase
    .from("enquiry_messages")
    .insert({
      enquiry_id: id,
      sender_id: user.id,
      content,
      is_offer: false,
    })
    .select("*")
    .single();

  if (insertErr || !inserted) {
    return NextResponse.json(
      { error: insertErr?.message ?? "Could not send message" },
      { status: 500 },
    );
  }

  return NextResponse.json({ message: inserted });
}
