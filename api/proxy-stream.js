// Stateless same-origin HLS relay for a standalone Vercel Node deployment.
import { handleProxyRequest, nodeHandler } from '../lib/stream-serverless.mjs';

export { handleProxyRequest };
export default nodeHandler(handleProxyRequest);
