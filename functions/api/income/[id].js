import { requireTier } from '../../_lib/auth.js';
import { uid, nowISO, json, badRequest, unauthorized, saveDataUrlImage } from '../../_lib/db.js';

export async function onRequestGet({ request, env, params }) {
  const session = await requireTier(request, env, 'income');
  if (!session) return unauthorized();
  const row = await env.DB.prepare('SELECT * FROM income_sessions WHERE id=?').bind(params.id).first();
  if (!row) return json({ error: '找不到' }, 404);
  const po = await env.DB.prepare('SELECT * FROM personal_offerings WHERE session_id=? ORDER BY rowid').bind(row.id).all();
  row.personal_offerings = po.results;
  return json({ session: row });
}

export async function onRequestPatch({ request, env, params }) {
  const session = await requireTier(request, env, 'income');
  if (!session) return unauthorized();
  const body = await request.json().catch(() => ({}));
  const row = await env.DB.prepare('SELECT * FROM income_sessions WHERE id=?').bind(params.id).first();
  if (!row) return json({ error: '找不到紀錄' }, 404);
  if (row.status === 'archived') return badRequest('此紀錄已歸檔，無法修改');

  const action = body.action;

  if (action === 'update') {
    const num = v => Number(v) || 0;
    await env.DB.prepare(
      `UPDATE income_sessions SET session_date=?, opener_name=?, amount_general=?, amount_fulltime=?, amount_taiwan_gospel=?, amount_overseas=?, amount_other=?, other_note=? WHERE id=?`
    ).bind(
      body.session_date || row.session_date, body.opener_name || row.opener_name, num(body.amount_general), num(body.amount_fulltime),
      num(body.amount_taiwan_gospel), num(body.amount_overseas), num(body.amount_other), body.other_note ?? row.other_note, row.id
    ).run();
    return json({ ok: true });
  }

  if (action === 'add_offering') {
    if (!body.person_name) return badRequest('缺少奉獻人姓名');
    await env.DB.prepare('INSERT INTO personal_offerings (id, session_id, church_name, person_name, bag_count, created_at) VALUES (?,?,?,?,?,?)')
      .bind(uid(), row.id, body.church_name || '', String(body.person_name).slice(0, 100), Number(body.bag_count) || 1, nowISO()).run();
    return json({ ok: true });
  }

  if (action === 'remove_offering') {
    if (!body.offering_id) return badRequest('缺少項目編號');
    const off = await env.DB.prepare('SELECT * FROM personal_offerings WHERE id=? AND session_id=?').bind(body.offering_id, row.id).first();
    if (off && off.recipient_signature_key) return badRequest('此項目已簽收，無法刪除');
    await env.DB.prepare('DELETE FROM personal_offerings WHERE id=? AND session_id=?').bind(body.offering_id, row.id).run();
    return json({ ok: true });
  }

  if (action === 'sign_incharge') {
    const key = await saveDataUrlImage(env, body.signature, 'signatures');
    if (!key) return badRequest('缺少負責弟兄簽名');
    await env.DB.prepare('UPDATE income_sessions SET incharge_signature_key=?, incharge_signed_at=? WHERE id=?')
      .bind(key, nowISO(), row.id).run();
    return json({ ok: true });
  }

  if (action === 'sign_offering') {
    if (!body.offering_id) return badRequest('缺少項目編號');
    const key = await saveDataUrlImage(env, body.signature, 'signatures');
    if (!key) return badRequest('缺少簽收簽名');
    await env.DB.prepare('UPDATE personal_offerings SET recipient_signature_key=?, signed_at=? WHERE id=? AND session_id=?')
      .bind(key, nowISO(), body.offering_id, row.id).run();
    return json({ ok: true });
  }

  if (action === 'archive') {
    if (!row.incharge_signature_key) return badRequest('需先由負責弟兄簽名');
    const pending = await env.DB.prepare('SELECT COUNT(*) as c FROM personal_offerings WHERE session_id=? AND recipient_signature_key IS NULL')
      .bind(row.id).first();
    if (pending.c > 0) return badRequest('尚有個人奉獻包未經對象簽收');
    await env.DB.prepare("UPDATE income_sessions SET status='archived' WHERE id=?").bind(row.id).run();
    return json({ ok: true });
  }

  return badRequest('未知的操作');
}
