import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "horizon_session";
const SESSION_SECONDS = 60 * 60 * 24 * 30;

export function createSessionToken(secret: string, nowSeconds = Math.floor(Date.now() / 1000)) {
  const expires = nowSeconds + SESSION_SECONDS;
  const payload = String(expires);
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return { token: `${payload}.${signature}`, expires };
}

export function hasValidSession(token: string | undefined, secret: string, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!token) return false;
  const [payload, suppliedSignature, ...extra] = token.split(".");
  if (!payload || !suppliedSignature || extra.length || !/^\d{10,12}$/.test(payload)) return false;
  const expires = Number(payload);
  if (!Number.isSafeInteger(expires) || expires <= nowSeconds) return false;
  const expectedSignature = createHmac("sha256", secret).update(payload).digest("base64url");
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function comparePasswords(supplied: string, expected: string) {
  const suppliedBytes = Buffer.from(supplied);
  const expectedBytes = Buffer.from(expected);
  return suppliedBytes.length === expectedBytes.length && timingSafeEqual(suppliedBytes, expectedBytes);
}
