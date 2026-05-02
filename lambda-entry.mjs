/**
 * Lambda Function URL handler for Astro's @astrojs/node standalone adapter.
 *
 * Importing entry.mjs starts Astro's standalone HTTP server on localhost:4321.
 * Each Lambda invocation is proxied to that local server as a real HTTP request.
 */
import http from 'node:http';
import { Buffer } from 'node:buffer';

// Importing entry.mjs triggers Astro's server startup on cold boot.
import './dist/server/entry.mjs';

const ASTRO_PORT = parseInt(process.env.PORT || '4321', 10);
const ASTRO_HOST = '127.0.0.1';

let serverReady = false;

/** Wait for Astro's HTTP server to accept connections. */
async function waitForServer(maxWaitMs = 8000) {
  if (serverReady) return;

  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const isUp = await new Promise((resolve) => {
      const req = http.request(
        { host: ASTRO_HOST, port: ASTRO_PORT, path: '/', method: 'HEAD', timeout: 500 },
        () => resolve(true),
      );
      req.on('error', () => resolve(false));
      req.on('timeout', () => { req.destroy(); resolve(false); });
      req.end();
    });

    if (isUp) {
      serverReady = true;
      return;
    }
    await new Promise((r) => setTimeout(r, 50));
  }

  throw new Error(`Astro server did not start within ${maxWaitMs}ms`);
}

function isBinaryContentType(contentType) {
  if (!contentType) return false;
  return (
    contentType.startsWith('image/') ||
    contentType.startsWith('audio/') ||
    contentType.startsWith('video/') ||
    contentType.startsWith('font/') ||
    contentType.includes('octet-stream') ||
    contentType.includes('gzip') ||
    contentType.includes('zip')
  );
}

export async function handler(event) {
  await waitForServer();

  const {
    rawPath = '/',
    rawQueryString = '',
    headers: eventHeaders = {},
    body,
    isBase64Encoded = false,
    requestContext = {},
    cookies: eventCookies = [],
  } = event;

  const method = requestContext?.http?.method || 'GET';
  const path = rawQueryString ? `${rawPath}?${rawQueryString}` : rawPath;

  const proxyHeaders = { ...eventHeaders };

  // Lambda Function URL splits cookies into an array — rejoin them.
  if (eventCookies.length > 0) {
    proxyHeaders['cookie'] = eventCookies.join('; ');
  }

  proxyHeaders['host'] = `${ASTRO_HOST}:${ASTRO_PORT}`;

  let bodyBuffer = null;
  if (body) {
    bodyBuffer = isBase64Encoded
      ? Buffer.from(body, 'base64')
      : Buffer.from(body, 'utf8');
    proxyHeaders['content-length'] = String(bodyBuffer.length);
  }

  const response = await new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: ASTRO_HOST,
        port: ASTRO_PORT,
        path,
        method,
        headers: proxyHeaders,
        timeout: 25000,
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          resolve({ statusCode: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) });
        });
      },
    );
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Proxy request timeout')); });
    if (bodyBuffer) req.write(bodyBuffer);
    req.end();
  });

  const responseHeaders = {};
  for (const [key, value] of Object.entries(response.headers)) {
    if (key === 'set-cookie') continue;
    responseHeaders[key] = Array.isArray(value) ? value.join(', ') : String(value);
  }

  const responseCookies = response.headers['set-cookie'];
  const cookiesArray = responseCookies
    ? (Array.isArray(responseCookies) ? responseCookies : [responseCookies])
    : undefined;

  const contentType = response.headers['content-type'] || '';
  const isBase64 = isBinaryContentType(String(contentType));

  const result = {
    statusCode: response.statusCode || 200,
    headers: responseHeaders,
    body: isBase64 ? response.body.toString('base64') : response.body.toString('utf8'),
    isBase64Encoded: isBase64,
  };

  if (cookiesArray) result.cookies = cookiesArray;

  return result;
}
