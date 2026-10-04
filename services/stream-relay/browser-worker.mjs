import { chromium } from 'playwright';
import { createInterface } from 'node:readline';

// This file runs ONLY inside an ephemeral, network-disabled, non-root container.
// All browser HTTP goes through RPC to the relay's DNS-pinned, allowlisted broker.
const input = createInterface({ input: process.stdin });
const pending = new Map();
let start;
const job = new Promise((resolve) => { start = resolve; });
input.on('line', (line) => {
  const message = JSON.parse(line);
  if (message.job) start(message.job);
  else {
    const resolve = pending.get(message.id);
    pending.delete(message.id);
    resolve?.(message);
  }
});
function send(value) { process.stdout.write(`${JSON.stringify(value)}\n`); }
let sequence = 0;
const task = await job;
const browser = await chromium.launch({
  chromiumSandbox: true,
  args: ['--disable-background-networking', '--disable-extensions', '--disable-sync', '--disable-quic'],
});
const context = await browser.newContext({ userAgent: task.userAgent, serviceWorkers: 'block', acceptDownloads: false });
let mainPage;
let found;
const result = new Promise((resolve) => { found = resolve; });
context.on('page', (page) => { if (mainPage && page !== mainPage) void page.close(); });
await context.addInitScript(() => {
  window.open = () => null;
  window.RTCPeerConnection = undefined;
  window.WebSocket = undefined;
});
await context.route('**/*', async (route) => {
  try {
    const request = route.request();
    if (request.frame().page() !== mainPage || !['document', 'script', 'xhr', 'fetch', 'stylesheet', 'media'].includes(request.resourceType())) return route.abort();
    if (/\.m3u8(?:\?|$)/i.test(request.url())) {
      send({ found: request.url() });
      found();
      return route.abort();
    }
    const id = ++sequence;
    const response = await new Promise((resolve) => {
      pending.set(id, resolve);
      send({ id, url: request.url(), method: request.method(), body: request.postData(), contentType: request.headers()['content-type'], resourceType: request.resourceType() });
    });
    if (response.error) return route.abort();
    const content = Buffer.from(response.body, 'base64');
    if (/mpegurl/i.test(response.headers['content-type'] || '') || content.subarray(0, 7).toString() === '#EXTM3U') {
      send({ found: request.url() });
      found();
      return route.abort();
    }
    await route.fulfill({ status: response.status, headers: response.headers, body: content });
  } catch { await route.abort().catch(() => {}); }
});
mainPage = await context.newPage();
const timer = setTimeout(() => { send({ error: 'The provider did not expose a playable HLS stream within 35 seconds.' }); found(); }, 35_000);
try {
  await mainPage.goto(task.url, { waitUntil: 'domcontentloaded', timeout: 20_000 });
  // Some players defer network activity until their own play control is activated.
  void (async () => {
    for (let attempt = 0; attempt < 12; attempt++) {
      for (const frame of mainPage.frames()) {
        const button = frame.locator('.jw-icon-playback, .vjs-big-play-button, [aria-label="Play"], [title="Play"]').first();
        if (await button.isVisible().catch(() => false)) await button.click({ timeout: 500 }).catch(() => {});
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  })();
  await result;
} catch { send({ error: 'The isolated provider page could not load.' }); }
finally { clearTimeout(timer); await browser.close(); input.close(); }
