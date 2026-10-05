import { handleServersRequest } from "../../../../../lib/stream-serverless.mjs";

export const runtime = "nodejs";
export const maxDuration = 15;

export function GET(request: Request) { return handleServersRequest(request); }
