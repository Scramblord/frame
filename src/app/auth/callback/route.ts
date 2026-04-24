import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.redirect(`${origin}/login?error=auth`);
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("sensei_mode")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profileError || !profile || !profile.sensei_mode) {
        return NextResponse.redirect(`${origin}/dashboard`);
      }

      const { data: expertProfile, error: expertProfileError } = await supabase
        .from("expert_profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (expertProfileError) {
        return NextResponse.redirect(`${origin}/dashboard`);
      }

      return NextResponse.redirect(
        `${origin}${expertProfile ? "/expert/dashboard" : "/expert/setup"}`,
      );
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
