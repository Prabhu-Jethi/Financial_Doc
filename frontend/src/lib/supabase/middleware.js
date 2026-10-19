import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

/**
 * Refreshes the user's Supabase auth session token and synchronizes cookies
 * across both the Next.js request and response.
 *
 * Enforces route-level authentication:
 * - Redirects unauthenticated users trying to access protected paths (/workspace, /) to /login
 * - Redirects authenticated users on /login to /workspace
 */
export async function updateSession(request) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // IMPORTANT: Do NOT rely solely on supabase.auth.getSession() for authorization.
  // getUser() sends a request to the Supabase Auth server to revalidate the JWT signature.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isLoginPage = pathname === "/login";
  const isAuthCallback = pathname.startsWith("/auth/callback");
  const isStaticOrApi = pathname.startsWith("/_next") || pathname.startsWith("/api") || pathname.includes(".");

  if (isAuthCallback || isStaticOrApi) {
    return supabaseResponse;
  }

  // If unauthenticated and trying to access protected workspace or root
  if (!user && !isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    if (pathname !== "/") {
      url.searchParams.set("redirectedFrom", pathname);
    }
    return NextResponse.redirect(url);
  }

  // If authenticated and visiting login page, redirect to workspace
  if (user && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/workspace";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

