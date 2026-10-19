import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * OAuth 2.0 PKCE Callback Handler.
 * Receives the authorization code from Google OAuth redirect,
 * exchanges it for a Supabase session token, saves cookies securely,
 * and redirects the user to the protected /workspace.
 */
export async function GET(request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const error = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");

  // 1. Handle OAuth cancellation or provider-level errors
  if (error) {
    console.error("[Auth Callback] Google OAuth error:", error, errorDescription);
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set(
      "error",
      errorDescription || "Google sign-in was cancelled or encountered an error."
    );
    return NextResponse.redirect(loginUrl);
  }

  // 2. Exchange authorization code for authenticated session
  if (code) {
    try {
      const supabase = createClient();
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

      if (exchangeError) {
        console.error("[Auth Callback] Code exchange failed:", exchangeError.message);
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("error", exchangeError.message);
        return NextResponse.redirect(loginUrl);
      }
    } catch (err) {
      console.error("[Auth Callback] Unexpected error during code exchange:", err);
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("error", "Failed to complete authentication. Please try again.");
      return NextResponse.redirect(loginUrl);
    }
  }

  // 3. Successful exchange: Redirect to workspace
  const next = requestUrl.searchParams.get("next") || "/workspace";
  return NextResponse.redirect(new URL(next, request.url));
}

