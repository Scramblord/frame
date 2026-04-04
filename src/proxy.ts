import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Authenticated expert app routes under `/expert/...` — not public `/experts/...` */
function isExpertAppRoute(path: string) {
  return path === "/expert" || path.startsWith("/expert/");
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAuthRoute = path.startsWith("/auth/");
  const isLogin = path === "/login";
  const isOnboarding = path.startsWith("/onboarding");

  type ProfileRow = { id: string; role: string };
  let profile: ProfileRow | null = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .maybeSingle();
    profile = data;
  }

  if (!user && (path.startsWith("/dashboard") || isExpertAppRoute(path) || isOnboarding)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user && isLogin) {
    const dest = !profile ? "/onboarding" : "/dashboard";
    return NextResponse.redirect(new URL(dest, request.url));
  }

  if (user && !profile && !isOnboarding && !isAuthRoute && !isLogin) {
    if (path.startsWith("/dashboard") || isExpertAppRoute(path)) {
      return NextResponse.redirect(new URL("/onboarding", request.url));
    }
  }

  if (user && profile && isOnboarding) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (user && profile && path === "/expert/dashboard") {
    const { data: expertRow } = await supabase
      .from("expert_profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!expertRow) {
      return NextResponse.redirect(new URL("/expert/setup", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
