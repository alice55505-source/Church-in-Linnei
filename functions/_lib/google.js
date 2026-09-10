// 驗證前端 Google Identity Services 回傳的 ID Token（JWT），不依賴任何第三方套件，
// 直接用 Google 公開金鑰（JWKS）以 Web Crypto 驗證簽章。

const enc = new TextEncoder();

function base64urlToBytes(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const bin = atob(str);
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

function base64urlToJSON(str) {
  return JSON.parse(new TextDecoder().decode(base64urlToBytes(str)));
}

async function fetchGoogleJWKS() {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/certs');
  if (!res.ok) throw new Error('無法取得 Google 公開金鑰');
  return res.json();
}

export async function verifyGoogleIdToken(env, credential) {
  if (!credential || credential.split('.').length !== 3) throw new Error('無效的登入憑證');
  const [headerB64, payloadB64, sigB64] = credential.split('.');
  const header = base64urlToJSON(headerB64);
  const payload = base64urlToJSON(payloadB64);

  if (!env.GOOGLE_CLIENT_ID) throw new Error('系統尚未設定 GOOGLE_CLIENT_ID');
  if (payload.aud !== env.GOOGLE_CLIENT_ID) throw new Error('憑證對象不符');
  if (payload.iss !== 'https://accounts.google.com' && payload.iss !== 'accounts.google.com') {
    throw new Error('憑證來源不符');
  }
  if (!payload.exp || Date.now() / 1000 > payload.exp) throw new Error('登入憑證已過期，請重新登入');
  if (!payload.email_verified) throw new Error('Google 信箱尚未驗證');

  const jwks = await fetchGoogleJWKS();
  const jwk = jwks.keys.find(k => k.kid === header.kid);
  if (!jwk) throw new Error('找不到對應的 Google 公開金鑰');

  const key = await crypto.subtle.importKey(
    'jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']
  );
  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5', key, base64urlToBytes(sigB64), enc.encode(`${headerB64}.${payloadB64}`)
  );
  if (!valid) throw new Error('登入憑證簽章驗證失敗');

  const allowed = (env.ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const email = String(payload.email || '').toLowerCase();
  if (!allowed.includes(email)) throw new Error('此 Google 帳號沒有管理權限');

  return { email };
}
