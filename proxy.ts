import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, SESSION_COOKIE_SECURE, isPublicAdminPath, safeNextPath } from "@/lib/model/session";

// Optimistic cookie-presence check on /admin/* (PLAN D89). Never verifies the session and never
// touches data: every admin page, action and route calls requireStaff itself. Response headers come
// from next.config.ts. Imports only next/server and lib/model/session (which imports nothing).

export function proxy(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;
  if (isPublicAdminPath(pathname)) return NextResponse.next();

  if (!request.cookies.has(SESSION_COOKIE) && !request.cookies.has(SESSION_COOKIE_SECURE)) {
    const login = new URL("/admin/login", request.url);
    login.searchParams.set("next", safeNextPath(`${pathname}${search}`));
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  // `*` = zero or more segments, so /admin itself is matched.
  matcher: ["/admin/:path*"],
};
