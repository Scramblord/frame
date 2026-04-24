"use client";

import { supabase } from "@/lib/supabase";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden
      focusable="false"
    >
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function LoginContent() {
  const searchParams = useSearchParams();
  const authError = searchParams.get("error");
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function signInWithGoogle() {
    setLoading(true);
    setLocalError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setLocalError(error.message);
      setLoading(false);
    }
  }

  const showError = authError === "auth" || localError;

  return (
    <div className="relative flex min-h-full flex-1 flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-zinc-100 to-zinc-200/90 px-6 py-16 dark:from-zinc-950 dark:to-zinc-900">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-25"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgb(113 113 122 / 0.35) 1px, transparent 0)`,
          backgroundSize: "24px 24px",
        }}
      />

      <div className="relative w-full max-w-md">
        <div className="rounded-2xl border border-zinc-200/80 bg-white/90 p-8 shadow-xl shadow-zinc-900/5 backdrop-blur-sm dark:border-zinc-700/80 dark:bg-zinc-900/90 dark:shadow-black/40">
          <div className="mb-10 text-center">
            <div className="mb-6 flex justify-center">
              <div className="flex items-center gap-2">
                <img
                  src="/Asset 4@3x.png"
                  alt=""
                  className="h-10 w-auto shrink-0"
                  width={32}
                  height={32}
                />
                <img
                  src="/Asset 5@3x.png"
                  alt="Sensei"
                  className="h-7 w-auto shrink-0"
                  width={132}
                  height={20}
                />
              </div>
            </div>
            <h1 className="font-mono text-4xl font-bold tracking-[0.35em] text-zinc-900 dark:text-zinc-50 sm:text-5xl">
              Sensei
            </h1>
            <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
              Sign in to continue
            </p>
          </div>

          {showError ? (
            <p
              className="mb-6 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-center text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
              role="alert"
            >
              {localError ??
                "Something went wrong while signing in. Please try again."}
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => void signInWithGoogle()}
            disabled={loading}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3.5 text-sm font-medium text-zinc-800 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:border-zinc-500 dark:hover:bg-zinc-700/80 dark:focus-visible:outline-zinc-300"
          >
            <GoogleIcon className="h-5 w-5 shrink-0" />
            {loading ? "Redirecting…" : "Continue with Google"}
          </button>

          <p className="mt-8 text-center text-xs leading-relaxed text-zinc-400 dark:text-zinc-500">
            By continuing, you agree to Sensei&apos;s use of authentication
            services provided by Google and Supabase.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-full flex-1 items-center justify-center bg-zinc-100 dark:bg-zinc-950">
          <p className="text-sm text-zinc-500">Loading…</p>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
