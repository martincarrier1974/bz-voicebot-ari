import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ADMIN_COOKIE_NAME = "bz_admin_session";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLogin = pathname === "/login";
  const isPublicAsset =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".");

  if (isPublicAsset) {
    return NextResponse.next();
  }

  const isAuthenticated =
    request.cookies.get(ADMIN_COOKIE_NAME)?.value ===
    (process.env.ADMIN_SESSION_SECRET || "bz-admin-session-dev");

  if (!isAuthenticated && !isLogin) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isAuthenticated && isLogin) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api).*)"],
};
