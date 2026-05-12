import Navbar from "@/components/Navbar";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SettingsForm from "@/app/settings/settings-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/settings");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text)]">Settings</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Manage your profile and how you appear on Sensei.
        </p>

        <div className="mt-8">
          <SettingsForm
            userId={user.id}
            initialFullName={profile?.full_name ?? null}
            initialAvatarUrl={profile?.avatar_url ?? null}
          />
        </div>
      </main>
    </div>
  );
}
