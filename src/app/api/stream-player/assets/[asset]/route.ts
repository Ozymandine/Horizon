import { readFile } from "node:fs/promises";
import path from "node:path";
import type { NextRequest } from "next/server";
import { PLAYER_CSS, PLAYER_SCRIPT } from "@/lib/stream-player";
import { PLAYER_CORE_SCRIPT } from "@/lib/player-display";
import { privateStreamSession } from "@/lib/stream-relay";

export const runtime = "nodejs";
const assets: Record<string, { read: () => Promise<string>; type: string }> = {
  "plyr.min.js": { read: () => readFile(path.join(process.cwd(), "node_modules/plyr/dist/plyr.min.js"), "utf8"), type: "text/javascript" },
  "plyr.css": { read: () => readFile(path.join(process.cwd(), "node_modules/plyr/dist/plyr.css"), "utf8"), type: "text/css" },
  "plyr.svg": { read: () => readFile(path.join(process.cwd(), "node_modules/plyr/dist/plyr.svg"), "utf8"), type: "image/svg+xml" },
  "hls.min.js": { read: () => readFile(path.join(process.cwd(), "node_modules/hls.js/dist/hls.min.js"), "utf8"), type: "text/javascript" },
};

export async function GET(request: NextRequest, context: { params: Promise<{ asset: string }> }) {
  if (!privateStreamSession(request)) return Response.json({ error: "Sign in to Horizon to play." }, { status: 401 });
  const { asset } = await context.params;
  let content: string;
  let type: string;
  if (asset === "player.css") { content = PLAYER_CSS; type = "text/css"; }
  else if (asset === "player.js") { content = PLAYER_SCRIPT; type = "text/javascript"; }
  else if (asset === "player-core.js") { content = PLAYER_CORE_SCRIPT; type = "text/javascript"; }
  else if (Object.hasOwn(assets, asset)) {
    content = await assets[asset].read();
    type = assets[asset].type;
  } else return new Response(null, { status: 404 });
  return new Response(content, { headers: { "Content-Type": `${type}; charset=utf-8`, "Cache-Control": "private, no-cache, must-revalidate", "X-Content-Type-Options": "nosniff" } });
}
