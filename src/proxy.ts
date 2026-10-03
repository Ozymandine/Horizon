import { NextResponse, type NextRequest } from "next/server";
import { hasValidSession, SESSION_COOKIE } from "@/lib/auth-session";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Keep browser storage and Spotify's HttpOnly refresh cookie on one origin
  // across production deploys. API calls and genuine preview builds stay local.
  if (process.env.VERCEL_ENV === "production" && request.method === "GET"
    && /^entertainment-horizon-[a-z0-9-]+\.vercel\.app$/.test(request.nextUrl.hostname)
    && !pathname.startsWith("/api/") && !pathname.startsWith("/_next/") && pathname !== "/favicon.ico") {
    return NextResponse.redirect(new URL(`${pathname}${request.nextUrl.search}`, "https://entertainment-horizon.vercel.app"), 307);
  }
  if (pathname === "/login" || pathname === "/api/auth/login" || pathname === "/api/auth/logout"
    || pathname.startsWith("/_next/") || pathname === "/favicon.ico") {
    return NextResponse.next();
  }

  const password = process.env.SITE_PASSWORD;
  const secret = process.env.AUTH_SECRET;
  if (!password || !secret) {
    return new Response("Site access is not configured.", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }

  if (hasValidSession(request.cookies.get(SESSION_COOKIE)?.value, secret)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return Response.json({ error: "Please enter the site password." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/:path*"],
};
