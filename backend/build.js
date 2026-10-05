import { readFile, mkdir, writeFile } from 'node:fs/promises';

// Package the shared, audited Node implementation with this service's dependencies.
// Render builds from the repository root; it does not install Next.js or Prisma.
const output = new URL('./.build/', import.meta.url);
await mkdir(output, { recursive: true });
const files = [
  ['../lib/stream-serverless.mjs', 'stream-serverless.mjs'],
  ['../lib/stream-providers.mjs', 'stream-providers.mjs'],
  ['../lib/stream-movy.mjs', 'stream-movy.mjs'],
  ['../lib/stream-errors.mjs', 'stream-errors.mjs'],
  ['../lib/stream-remote.mjs', 'stream-remote.mjs'],
  ['../services/stream-relay/security.mjs', 'security.mjs'],
  ['../services/stream-relay/hls.mjs', 'hls.mjs'],
];
for (const [source, name] of files) {
  const code = (await readFile(new URL(source, import.meta.url), 'utf8')).replaceAll('../services/stream-relay/security.mjs', './security.mjs').replaceAll('../services/stream-relay/hls.mjs', './hls.mjs');
  await writeFile(new URL(name, output), code);
}
console.log('Render backend built: native Node resolver, HLS relay and cipher modules.');
