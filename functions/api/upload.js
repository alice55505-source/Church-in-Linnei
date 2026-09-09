import { requireTier } from '../_lib/auth.js';
import { json, badRequest, unauthorized, uid } from '../_lib/db.js';

// 中間層(奉獻收入)與最內層(記帳)皆可上傳照片（收據、轉帳截圖、存簿照片等）
export async function onRequestPost({ request, env }) {
  const session = await requireTier(request, env, 'income');
  if (!session) return unauthorized();

  const form = await request.formData().catch(() => null);
  const file = form && form.get('file');
  if (!file || typeof file === 'string') return badRequest('缺少檔案');
  if (file.size > 8 * 1024 * 1024) return badRequest('檔案過大（限 8MB）');

  const ext = ((file.name || '').split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const key = `uploads/${uid()}.${ext}`;
  await env.FILES.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type || 'application/octet-stream' } });
  return json({ ok: true, key });
}
