import { requireTier } from '../../_lib/auth.js';
import { uid, nowISO, json, badRequest, unauthorized } from '../../_lib/db.js';

export async function onRequestGet({ request, env }) {
  const session = await requireTier(request, env, 'income');
  if (!session) return unauthorized();
  const { results } = await env.DB.prepare('SELECT * FROM income_sessions ORDER BY session_date DESC, created_at DESC').all();
  for (const s of results) {
    const po = await env.DB.prepare('SELECT * FROM personal_offerings WHERE session_id=? ORDER BY rowid').bind(s.id).all();
    s.personal_offerings = po.results;
  }
  return json({ sessions: results });
}

export async function onRequestPost({ request, env }) {
  const session = await requireTier(request, env, 'income');
  if (!session) return unauthorized();
  const body = await request.json().catch(() => ({}));
  const { session_date, amount_general, amount_fulltime, amount_taiwan_gospel, amount_overseas, amount_other, other_note, personal_offerings } = body;
  if (!session_date) return badRequest('缺少開奉獻箱日期');

  const num = v => Number(v) || 0;
  const id = uid();
  const now = nowISO();

  const stmts = [
    env.DB.prepare(
      `INSERT INTO income_sessions
        (id, session_date, amount_general, amount_fulltime, amount_taiwan_gospel, amount_overseas, amount_other, other_note, status, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`
    ).bind(id, session_date, num(amount_general), num(amount_fulltime), num(amount_taiwan_gospel), num(amount_overseas), num(amount_other), other_note || '', 'draft', now)
  ];

  if (Array.isArray(personal_offerings)) {
    for (const p of personal_offerings) {
      if (!p || !p.person_name) continue;
      stmts.push(
        env.DB.prepare('INSERT INTO personal_offerings (id, session_id, church_name, person_name, bag_count) VALUES (?,?,?,?,?)')
          .bind(uid(), id, p.church_name || '', String(p.person_name).slice(0, 100), Number(p.bag_count) || 1)
      );
    }
  }

  await env.DB.batch(stmts);
  return json({ ok: true, id }, 201);
}
