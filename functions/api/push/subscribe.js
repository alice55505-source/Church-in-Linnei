import { requireTier } from '../../_lib/auth.js';
import { uid, nowISO, json, badRequest, unauthorized } from '../../_lib/db.js';

export async function onRequestPost({ request, env }) {
  const session = await requireTier(request, env, 'income');
  if (!session) return unauthorized();
  const body = await request.json().catch(() => ({}));
  const sub = body.subscription;
  if (!sub || !sub.endpoint || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) return badRequest('缺少訂閱資訊');

  const existing = await env.DB.prepare('SELECT id FROM push_subscriptions WHERE endpoint=?').bind(sub.endpoint).first();
  if (existing) return json({ ok: true });

  await env.DB.prepare('INSERT INTO push_subscriptions (id, tier, endpoint, p256dh, auth, created_at) VALUES (?,?,?,?,?,?)')
    .bind(uid(), session.tier, sub.endpoint, sub.keys.p256dh, sub.keys.auth, nowISO()).run();
  return json({ ok: true }, 201);
}
