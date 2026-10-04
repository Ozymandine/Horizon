// Native Vercel Node function, shared with the Next.js route.
// Configure STREAM_MOVIE_EXTRACTOR_URL / STREAM_SHOW_EXTRACTOR_URL for a public data extractor.
// No browser engine, Docker process, iframe or provider JavaScript is loaded.
import { handleStreamRequest, nodeHandler } from '../lib/stream-serverless.mjs';

export { handleStreamRequest };
export default nodeHandler(handleStreamRequest);
