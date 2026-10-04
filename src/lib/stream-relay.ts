import "server-only";
import type { NextRequest } from "next/server";
import { hasValidSession, SESSION_COOKIE } from "@/lib/auth-session";

export function privateStreamSession(request: NextRequest) {
  return Boolean(process.env.AUTH_SECRET && hasValidSession(request.cookies.get(SESSION_COOKIE)?.value, process.env.AUTH_SECRET));
}
