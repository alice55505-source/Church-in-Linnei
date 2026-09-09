// 以 Web Push (VAPID) 傳送「無內容」推播：瀏覽器收到後由 Service Worker 顯示通用提醒文字，
// 詳細內容仍在 App 內（income.html / ledger.html）的提醒橫幅呈現，避免需自行實作訊息內容加密。

const enc = new TextEncoder();

function base64url(bytes) {
  let str = btoa(String.fromCharCode(...new Uint8Array(bytes)));
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function importVapidPrivateKey(jwkJson) {
  const jwk = JSON.parse(jwkJson);
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
}

async function buildVapidAuthHeader(env, endpoint) {
  const aud = new URL(endpoint).origin;
  const now = Math.floor(Date.now() / 1000);
  const header = { typ: 'JWT', alg: 'ES256' };
  const claims = { aud, exp: now + 12 * 3600, sub: env.VAPID_SUBJECT || 'mailto:admin@example.com' };
  const headerB64 = base64url(enc.encode(JSON.stringify(header)));
  const claimsB64 = base64url(enc.encode(JSON.stringify(claims)));
  const signingInput = `${headerB64}.${claimsB64}`;
  const key = await importVapidPrivateKey(env.VAPID_PRIVATE_JWK);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(signingInput));
  const jwt = `${signingInput}.${base64url(sig)}`;
  return `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`;
}

export async function sendPush(env, subscription, ttlSeconds = 3600) {
  const authHeader = await buildVapidAuthHeader(env, subscription.endpoint);
  return fetch(subscription.endpoint, {
    method: 'POST',
    headers: { Authorization: authHeader, TTL: String(ttlSeconds), 'Content-Length': '0' }
  });
}
