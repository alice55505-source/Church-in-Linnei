import { cookieHeader } from '../../_lib/auth.js';

export async function onRequestPost() {
  const headers = new Headers();
  headers.append('Set-Cookie', cookieHeader('session_income', '', 0));
  headers.append('Set-Cookie', cookieHeader('session_ledger', '', 0));
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify({ ok: true }), { headers });
}
