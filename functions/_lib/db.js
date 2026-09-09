export function uid() {
  return crypto.randomUUID();
}

export function nowISO() {
  return new Date().toISOString();
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers }
  });
}

export function badRequest(msg) {
  return json({ error: msg }, 400);
}

export function unauthorized() {
  return json({ error: '需要登入' }, 401);
}

export async function saveDataUrlImage(env, dataUrl, prefix) {
  const match = /^data:(.+);base64,(.*)$/.exec(dataUrl || '');
  if (!match) return null;
  const [, mime, b64] = match;
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const key = `${prefix}/${uid()}.png`;
  await env.FILES.put(key, bytes, { httpMetadata: { contentType: mime || 'image/png' } });
  return key;
}
