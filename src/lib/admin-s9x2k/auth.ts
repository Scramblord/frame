import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { notFound, redirect } from "next/navigation";

/** Server-only. Used for layout/pages and admin API routes. */
export function adminGateUserId(): string {
  return "7c11fcb9-f1e2-4396-b89c-c1cb151fd831";
}

/** For Server Components: redirect to login if anonymous, 404 if not admin. */
export async function requireAdminPage(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  if (user.id !== adminGateUserId()) {
    notFound();
  }
}

export type AdminApiAuth =
  | { ok: true }
  | { ok: false; response: NextResponse };

/** For Route Handlers: 401 if unauthenticated, 403 if not admin. */
export async function requireAdminApi(): Promise<AdminApiAuth> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (user.id !== adminGateUserId()) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { ok: true };
}
