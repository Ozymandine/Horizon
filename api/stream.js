// Native Vercel Node function, shared with the Next.js route.
// Tries native VidSrc RC4, then VidCore / VidLink / Embed.su data adapters.
// Only a validated HLS playlist becomes the exact { source } response.
// No browser engine, Docker process, iframe or provider JavaScript is loaded.
import { handleStreamRequest, nodeHandler } from '../lib/stream-serverless.mjs';

export { handleStreamRequest };
export default nodeHandler(handleStreamRequest);
