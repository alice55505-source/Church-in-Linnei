import { json, badRequest, uid } from '../../_lib/db.js';

// 公開：請款人上傳發票／收據照片，不需登入
export async function onRequestPost({ request, env }) {
  const form = await request.formData().catch(() => null);
  const file = form && form.get('file');
  if (!file || typeof file === 'string') return badRequest('缺少檔案');
  if (file.size > 8 * 1024 * 1024) return badRequest('檔案過大（限 8MB）');
  if (file.type && !file.type.startsWith('image/') && file.type !== 'application/pdf') {
    return badRequest('僅接受圖片或 PDF 檔案');
  }

  const ext = ((file.name || '').split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const key = `receipts/${uid()}.${ext}`;
  await env.FILES.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type || 'application/octet-stream' } });
  return json({ ok: true, key });
}
