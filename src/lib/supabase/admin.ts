import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client — bypasses RLS. Use only in trusted server contexts
 * (e.g. Stripe webhooks). Requires SUPABASE_SERVICE_ROLE_KEY.
 */
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for admin access",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
