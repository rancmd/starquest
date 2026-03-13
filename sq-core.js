// ============================================================
// STARQUEST — CORE: Supabase + Auth + Shared Utils
// All pages include this file first.
// ============================================================

const SUPABASE_URL = 'https://xyvqlpzlgkyylvxdeiiy.supabase.co';
const SUPABASE_KEY = 'sb_publishable_BdIEzaevyWXQLBcl7gqMaQ_AvOAjBN_';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Session (localStorage) ────────────────────────────────
function getSession() {
  try { return JSON.parse(localStorage.getItem('sq_session')) || null; } catch { return null; }
}
function saveSession(user) {
  localStorage.setItem('sq_session', JSON.stringify(user));
}
function clearSession() {
  localStorage.removeItem('sq_session');
}

// ── Password hashing ──────────────────────────────────────
async function hashPass(pass) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pass + 'starquest_salt'));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

// ── Progress helpers ──────────────────────────────────────
async function loadProgress(userId) {
  const { data, error } = await sb.from('progress').select('*').eq('user_id', userId);
  if (error) { console.error('loadProgress:', error); return {}; }
  const map = {};
  (data || []).forEach(r => {
    map[r.topic_id] = { stars: r.stars, score: r.score, points: r.points, attempts: r.attempts || 1 };
  });
  return map;
}

async function saveProgress(userId, topicId, { stars, score, points }) {
  const prev = await sb.from('progress').select('*').eq('user_id', userId).eq('topic_id', topicId).maybeSingle();
  const prevData = prev.data;

  // Only save if it's an improvement
  if (prevData && prevData.stars > stars) return false;
  if (prevData && prevData.stars === stars && prevData.score >= score) return false;

  const { error } = await sb.from('progress').upsert({
    user_id:  userId,
    topic_id: topicId,
    score,
    stars,
    points,
    attempts: (prevData ? prevData.attempts || 0 : 0) + 1,
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id,topic_id' });

  if (error) { console.error('saveProgress:', error); return false; }
  return true;
}

// ── Loading overlay ───────────────────────────────────────
function showLoading(msg = 'טוען...') {
  let el = document.getElementById('sq-loading');
  if (!el) {
    el = document.createElement('div');
    el.id = 'sq-loading';
    el.style.cssText = 'position:fixed;inset:0;background:rgba(26,26,46,0.6);z-index:9998;display:flex;align-items:center;justify-content:center;';
    el.innerHTML = `<div style="background:white;border-radius:16px;padding:28px 40px;font-family:Heebo,sans-serif;font-size:16px;font-weight:800;color:#1A1A2E;text-align:center;box-shadow:0 8px 40px rgba(0,0,0,0.2);">${msg}</div>`;
    document.body.appendChild(el);
  } else {
    el.querySelector('div').textContent = msg;
    el.style.display = 'flex';
  }
}
function hideLoading() {
  const el = document.getElementById('sq-loading');
  if (el) el.style.display = 'none';
}

// ── Toast ─────────────────────────────────────────────────
let _toastTimer;
function showToast(msg) {
  let t = document.getElementById('sq-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'sq-toast';
    t.style.cssText = 'position:fixed;bottom:28px;right:50%;transform:translateX(50%) translateY(80px);background:#1A1A2E;color:white;padding:12px 24px;border-radius:100px;font-family:Heebo,sans-serif;font-size:14px;font-weight:800;z-index:9999;transition:transform 0.3s cubic-bezier(0.34,1.56,0.64,1);pointer-events:none;white-space:nowrap;';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.transform = 'translateX(50%) translateY(0)';
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { t.style.transform = 'translateX(50%) translateY(80px)'; }, 2800);
}

// ── Guard: redirect to login if not logged in ─────────────
function requireAuth() {
  const session = getSession();
  if (!session) {
    window.location.href = 'index.html';
    return null;
  }
  return session;
}

// ── Compute totals from progress map ─────────────────────
function computeTotals(progress) {
  const vals = Object.values(progress);
  return {
    totalPoints: vals.reduce((s, p) => s + (p.points || 0), 0),
    totalStars:  vals.reduce((s, p) => s + (p.stars  || 0), 0),
    doneCount:   vals.filter(p => (p.stars || 0) > 0).length,
  };
}
