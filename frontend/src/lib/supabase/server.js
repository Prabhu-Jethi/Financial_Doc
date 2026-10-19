import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Creates a request-scoped server Supabase client for Server Components,
 * Route Handlers, and Server Actions. Uses cookie storage to read and write
 * authenticated session tokens without leaking credentials.
 */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key",
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll called from a Server Component can be safely ignored
            // because session cookies are refreshed in middleware.js.
          }
        },
      },
    }
  );
}

