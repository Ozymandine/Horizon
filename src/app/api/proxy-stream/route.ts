import { handleProxyRequest } from "../../../../api/proxy-stream.js";

export const runtime = "nodejs";
export const maxDuration = 30;

export function GET(request: Request) { return handleProxyRequest(request); }
