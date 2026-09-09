import { requireTier } from '../../_lib/auth.js';
import { json, badRequest, unauthorized } from '../../_lib/db.js';

export async function onRequestPost({ request, env }) {
  const session = await requireTier(request, env, 'income');
  if (!session) return unauthorized();
  const body = await request.json().catch(() => ({}));
  if (!body.endpoint) return badRequest('缺少 endpoint');
  await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint=?').bind(body.endpoint).run();
  return json({ ok: true });
}
