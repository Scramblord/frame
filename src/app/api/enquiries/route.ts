import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type CreateEnquiryBody = {
  serviceId?: string;
};

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: enquiries, error } = await supabase
    .from("enquiries")
    .select("*")
    .or(`consumer_user_id.eq.${user.id},expert_user_id.eq.${user.id}`)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ enquiries: enquiries ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: CreateEnquiryBody;
  try {
    body = (await request.json()) as CreateEnquiryBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const serviceId = body.serviceId?.trim();
  if (!serviceId) {
    return NextResponse.json({ error: "serviceId is required" }, { status: 400 });
  }

  const { data: service, error: serviceErr } = await supabase
    .from("services")
    .select("id, expert_user_id, booking_mode, is_active")
    .eq("id", serviceId)
    .maybeSingle();

  if (serviceErr || !service) {
    return NextResponse.json({ error: "Service not found" }, { status: 404 });
  }

  if (service.expert_user_id === user.id) {
    return NextResponse.json(
      { error: "You cannot create an enquiry for your own service" },
      { status: 400 },
    );
  }

  if (service.booking_mode !== "flexible" || service.is_active !== true) {
    return NextResponse.json(
      { error: "This service is not accepting flexible enquiries" },
      { status: 400 },
    );
  }

  const { count, error: countErr } = await supabase
    .from("enquiries")
    .select("*", { head: true, count: "exact" })
    .eq("consumer_user_id", user.id)
    .eq("expert_user_id", service.expert_user_id)
    .in("status", ["open", "offer_sent"]);

  if (countErr) {
    return NextResponse.json({ error: countErr.message }, { status: 500 });
  }

  if ((count ?? 0) >= 3) {
    return NextResponse.json(
      { error: "You already have 3 active enquiries with this Sensei" },
      { status: 400 },
    );
  }

  const { data: inserted, error: insertErr } = await supabase
    .from("enquiries")
    .insert({
      consumer_user_id: user.id,
      expert_user_id: service.expert_user_id,
      service_id: service.id,
      status: "open",
    })
    .select("*")
    .single();

  if (insertErr || !inserted) {
    const uniqueConflict = insertErr?.code === "23505";
    return NextResponse.json(
      {
        error: uniqueConflict
          ? "You already have an active enquiry for this service"
          : insertErr?.message ?? "Could not create enquiry",
      },
      { status: uniqueConflict ? 409 : 500 },
    );
  }

  return NextResponse.json({ enquiry: inserted });
}
