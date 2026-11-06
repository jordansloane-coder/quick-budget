// Quick Budget -> Saturation relay.
//
// Saturation's API doesn't send CORS headers, so a web app can't call it from the browser.
// This forwards requests to Saturation and adds those headers. It stores nothing and holds
// no secrets: the caller's own API key travels in the Authorization header, and only the
// Quick Budget site is allowed to use the relay.

const UPSTREAM = 'https://next-api.saturation.io';
const ALLOWED_ORIGINS = ['https://jordansloane-coder.github.io'];

export const config = { path: '/v1/*' };

const cors = (origin) => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Idempotency-Key',
  'Access-Control-Expose-Headers': 'Retry-After, Idempotency-Replayed',
  'Access-Control-Max-Age': '86400',
  Vary: 'Origin',
});

export default async (req) => {
  const origin = req.headers.get('origin') || '';
  if (!ALLOWED_ORIGINS.includes(origin)) {
    return new Response('Forbidden', { status: 403 });
  }
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors(origin) });
  }

  const url = new URL(req.url);
  const headers = new Headers();
  for (const h of ['authorization', 'content-type', 'idempotency-key', 'accept']) {
    const v = req.headers.get(h);
    if (v) headers.set(h, v);
  }

  let res;
  try {
    const hasBody = !['GET', 'HEAD'].includes(req.method);
    res = await fetch(UPSTREAM + url.pathname + url.search, {
      method: req.method,
      headers,
      body: hasBody ? await req.arrayBuffer() : undefined,
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, code: 'relay_error', message: 'Relay could not reach Saturation.' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', ...cors(origin) },
    });
  }

  const out = new Headers(cors(origin));
  for (const h of ['content-type', 'retry-after', 'idempotency-replayed']) {
    const v = res.headers.get(h);
    if (v) out.set(h, v);
  }
  return new Response(res.body, { status: res.status, headers: out });
};
