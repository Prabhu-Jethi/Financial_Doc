import { updateSession } from "./lib/supabase/middleware";

/**
 * Next.js Edge Middleware for session refresh and route protection.
 * Runs before any route is rendered.
 */
export async function middleware(request) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all routes except static assets, favicon, images, and public file extensions:
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

