import { cookieHeader } from '../../_lib/auth.js';

// 奉獻、記帳登入互相獨立：帶 tier 只登出該頁，不帶則全部登出
export async function onRequestPost({ request }) {
  const body = await request.json().catch(() => ({}));
  const headers = new Headers();
  if (body.tier !== 'ledger') headers.append('Set-Cookie', cookieHeader('session_income', '', 0));
  if (body.tier !== 'income') headers.append('Set-Cookie', cookieHeader('session_ledger', '', 0));
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify({ ok: true }), { headers });
}
