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

function toast(msg, isError) {
  let el = document.getElementById('__toast');
  if (!el) {
    el = document.createElement('div');
    el.id = '__toast';
    el.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:999;padding:10px 18px;border-radius:12px;font-weight:700;font-size:14px;color:#fff;transition:opacity .2s;max-width:90vw;text-align:center;box-shadow:0 4px 16px rgba(0,0,0,.15);';
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
  window.addEventListener('mouseup', end);
  canvas.addEventListener('touchstart', start, { passive: false });
  canvas.addEventListener('touchmove', move, { passive: false });
  canvas.addEventListener('touchend', end);

  return {
    clear() { ctx.clearRect(0, 0, canvas.width, canvas.height); hasDrawn = false; },
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

// 簡易簽名對話框；resolve(dataURL) 或使用者取消則 resolve(null)
function askForSignature(title) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:500;display:flex;align-items:flex-end;justify-content:center;';
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:20px 20px 0 0;width:100%;max-width:480px;padding:20px;">
        <h3 style="font-weight:900;font-size:14px;color:#334155;margin-bottom:10px;">${esc(title || '請簽名')}</h3>
        <canvas width="440" height="180" style="width:100%;height:180px;background:#f8fafc;border:1.5px dashed #cbd5e1;border-radius:12px;touch-action:none;"></canvas>
        <div style="display:flex;gap:8px;margin-top:12px;">
          <button data-act="clear" style="flex:1;padding:10px;border-radius:10px;background:#f1f5f9;color:#475569;font-weight:800;font-size:13px;border:none;">清除</button>
          <button data-act="cancel" style="flex:1;padding:10px;border-radius:10px;background:#f1f5f9;color:#475569;font-weight:800;font-size:13px;border:none;">取消</button>
          <button data-act="ok" style="flex:2;padding:10px;border-radius:10px;background:#4f46e5;color:#fff;font-weight:800;font-size:13px;border:none;">確認簽名</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const canvas = overlay.querySelector('canvas');
    const pad = makeSignaturePad(canvas);
    overlay.addEventListener('click', e => {
      const act = e.target.getAttribute('data-act');
      if (act === 'clear') pad.clear();
      if (act === 'cancel') { document.body.removeChild(overlay); resolve(null); }
      if (act === 'ok') {
        if (pad.isEmpty()) { toast('請先簽名', true); return; }
        const url = pad.getDataURL();
        document.body.removeChild(overlay);
        resolve(url);
      }
    });
  });
}
