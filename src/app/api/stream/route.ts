import { handleStreamRequest } from "../../../../api/stream.js";

export const runtime = "nodejs";
export const maxDuration = 30;

// Next projects discover App Router routes rather than root /api/*.js files.
export function GET(request: Request) { return handleStreamRequest(request); }
export function POST(request: Request) { return handleStreamRequest(request); }
