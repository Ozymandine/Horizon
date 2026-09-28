import { NextResponse, type NextRequest } from "next/server";
import { comparePasswords, createSessionToken, SESSION_COOKIE } from "@/lib/auth-session";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const password = process.env.SITE_PASSWORD;
  const secret = process.env.AUTH_SECRET;
  if (!password || !secret) return NextResponse.json({ error: "Site access is not configured." }, { status: 503 });

  const body = await request.json().catch(() => null) as { password?: unknown } | null;
  const supplied = typeof body?.password === "string" ? body.password : "";
  if (!supplied || supplied.length > 1024 || !comparePasswords(supplied, password)) {
    return NextResponse.json({ error: "That password did not match." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const { token, expires } = createSessionToken(secret);
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(expires * 1000),
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
