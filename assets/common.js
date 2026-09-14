async function registerSW() {
  if ('serviceWorker' in navigator) {
    try { await navigator.serviceWorker.register('/sw.js'); } catch (e) {}
  }
}

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - base64.length % 4) % 4);
  const base64safe = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64safe);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

async function enablePushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    toast('此瀏覽器不支援推播通知', true);
    return false;
  }
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { toast('未取得通知權限', true); return false; }
    const reg = await navigator.serviceWorker.ready;
    const { key } = await api('/api/push/vapid-public-key');
    if (!key) { toast('系統尚未設定推播金鑰（VAPID_PUBLIC_KEY）', true); return false; }
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) });
    }
    await api('/api/push/subscribe', { method: 'POST', body: { subscription: sub.toJSON() } });
    toast('已啟用提醒通知');
    return true;
  } catch (e) {
    toast(e.message || '啟用通知失敗', true);
    return false;
  }
}

async function api(path, options = {}) {
  const opts = Object.assign({ credentials: 'include' }, options);
  if (opts.body && typeof opts.body !== 'string' && !(opts.body instanceof FormData)) {
    opts.body = JSON.stringify(opts.body);
    opts.headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
  }
  const res = await fetch(path, opts);
  let data = null;
  try { data = await res.json(); } catch (e) {}
  if (!res.ok) {
    const err = new Error((data && data.error) || `錯誤 (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

function fmtMoney(n) {
  n = Number(n) || 0;
  return 'NT$ ' + Math.round(n).toLocaleString();
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function thisMonthStr() {
  return new Date().toISOString().slice(0, 7);
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// 刪除類操作用：需手動輸入「刪除」兩個字才視為確認，避免誤按
function confirmDelete(message) {
  const input = prompt((message || '確定要刪除嗎？此動作無法復原。') + '\n\n請輸入「刪除」兩個字以確認：');
  return input === '刪除';
}

function toast(msg, isError) {
  let el = document.getElementById('__toast');
  if (!el) {
    el = document.createElement('div');
    el.id = '__toast';
    el.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:999;padding:12px 20px;border-radius:12px;font-weight:700;font-size:17px;color:#fff;transition:opacity .2s;max-width:90vw;text-align:center;box-shadow:0 4px 16px rgba(0,0,0,.15);';
    document.body.appendChild(el);
  }
  el.style.background = isError ? '#dc2626' : '#059669';
  el.textContent = msg;
  el.style.opacity = '1';
  clearTimeout(el.__t);
  el.__t = setTimeout(() => { el.style.opacity = '0'; }, 2600);
}

function makeSignaturePad(canvas) {
  const ctx = canvas.getContext('2d');
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#1e293b';
  let drawing = false, hasDrawn = false, last = null;

  // 畫布底色填白，避免存出透明背景的 PNG，在深色底的預覽視窗變成一片全黑
  function fillWhite() {
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }
  fillWhite();

  function pos(e) {
    const rect = canvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return {
      x: (t.clientX - rect.left) * (canvas.width / rect.width),
      y: (t.clientY - rect.top) * (canvas.height / rect.height)
    };
  }
  function start(e) { e.preventDefault(); drawing = true; last = pos(e); }
  function move(e) {
    if (!drawing) return;
    e.preventDefault();
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last = p;
    hasDrawn = true;
  }
  function end() { drawing = false; }

  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', move);
  canvas.addEventListener('mouseup', end);
  canvas.addEventListener('mouseleave', end);
  canvas.addEventListener('touchstart', start, { passive: false });
  canvas.addEventListener('touchmove', move, { passive: false });
  canvas.addEventListener('touchend', end);

  return {
    clear() { ctx.clearRect(0, 0, canvas.width, canvas.height); fillWhite(); hasDrawn = false; },
    isEmpty() { return !hasDrawn; },
    getDataURL() { return canvas.toDataURL('image/png'); }
  };
}

async function uploadFile(file) {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch('/api/upload', { method: 'POST', credentials: 'include', body: fd });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '上傳失敗');
  return data.key;
}

function fileUrl(key) {
  return key ? '/api/files/' + key : '';
}

// 點圖片放大預覽用；點任意處關閉
function openImagePreview(url) {
  if (!url) return;
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:600;display:flex;align-items:center;justify-content:center;padding:20px;';
  overlay.innerHTML = `<img src="${url}" style="max-width:100%;max-height:100%;border-radius:12px;background:#fff;">`;
  overlay.addEventListener('click', () => overlay.remove());
  document.body.appendChild(overlay);
}

// 簡易簽名對話框；resolve(dataURL) 或使用者取消則 resolve(null)
// 防止手誤連點造成多個簽名框疊在一起（疊起來時按「取消」只會關掉最上面那個，
// 看起來像按不掉）：同時間只允許一個簽名框存在。
let __signatureOverlayOpen = false;
function askForSignature(title) {
  document.querySelectorAll('[data-sig-overlay]').forEach(el => el.remove());
  if (__signatureOverlayOpen) return Promise.resolve(null);
  __signatureOverlayOpen = true;
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.dataset.sigOverlay = '1';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:500;display:flex;align-items:flex-end;justify-content:center;';
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:20px 20px 0 0;width:100%;max-width:480px;padding:20px;">
        <h3 style="font-weight:900;font-size:18px;color:#334155;margin-bottom:10px;">${esc(title || '請簽名')}</h3>
        <canvas width="440" height="180" style="width:100%;height:180px;background:#f8fafc;border:1.5px dashed #cbd5e1;border-radius:12px;touch-action:none;"></canvas>
        <div style="display:flex;gap:8px;margin-top:12px;">
          <button data-act="clear" style="flex:1;padding:12px;border-radius:10px;background:#f1f5f9;color:#475569;font-weight:800;font-size:16px;border:none;">清除</button>
          <button data-act="cancel" style="flex:1;padding:12px;border-radius:10px;background:#f1f5f9;color:#475569;font-weight:800;font-size:16px;border:none;">取消</button>
          <button data-act="ok" style="flex:2;padding:12px;border-radius:10px;background:#4f46e5;color:#fff;font-weight:800;font-size:16px;border:none;">確認簽名</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const canvas = overlay.querySelector('canvas');
    const pad = makeSignaturePad(canvas);
    function close(value) {
      overlay.remove();
      __signatureOverlayOpen = false;
      resolve(value);
    }
    overlay.querySelector('[data-act="clear"]').addEventListener('click', () => pad.clear());
    overlay.querySelector('[data-act="cancel"]').addEventListener('click', () => close(null));
    overlay.querySelector('[data-act="ok"]').addEventListener('click', () => {
      if (pad.isEmpty()) { toast('請先簽名', true); return; }
      close(pad.getDataURL());
    });
  });
}
