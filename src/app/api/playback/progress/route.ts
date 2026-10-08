import { playbackProgressGet, playbackProgressPost } from "@/lib/playback-api";

export const runtime = "nodejs";
export const maxDuration = 20;
export const GET = playbackProgressGet;
export const POST = playbackProgressPost;
