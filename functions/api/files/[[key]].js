import { requireTier } from '../../_lib/auth.js';
import { unauthorized } from '../../_lib/db.js';

export async function onRequestGet({ request, env, params }) {
  const key = Array.isArray(params.key) ? params.key.join('/') : params.key;

  // 請款發票／收據照片屬於公開層（請款本身即公開），其餘（簽名、內部上傳照片）需登入
  if (!key.startsWith('receipts/')) {
    const session = await requireTier(request, env, 'income');
    if (!session) return unauthorized();
  }

  const obj = await env.FILES.get(key);
  if (!obj) return new Response('Not found', { status: 404 });
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('Cache-Control', 'private, max-age=3600');
  return new Response(obj.body, { headers });
}
