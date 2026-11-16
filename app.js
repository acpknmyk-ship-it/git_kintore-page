// 画面と通信。記録の計算は store.js に置く。
import * as S from './store.js';

export const APP_VERSION = '0.1.0';
const KEY_SETS = 'kintore.sets';
const KEY_CFG = 'kintore.cfg';
const CHUNK = 200; // 1 回の送信で送る行数の上限

const $app = document.getElementById('app');
const $bar = document.getElementById('syncbar');

let data = { groups: [], muscles: {}, exercises: [] };
let bodySvg = '';
let sets = load(KEY_SETS, []);
let cfg = load(KEY_CFG, { url: '', token: '', cursor: '', lastSyncAt: '', pcAt: '' });
let ui = { date: S.todayStr(), group: 'all', editId: null, syncing: false, syncError: '' };

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function save() {
  try {
    localStorage.setItem(KEY_SETS, JSON.stringify(sets));
    localStorage.setItem(KEY_CFG, JSON.stringify(cfg));
  } catch (e) {
    alert('端末に保存できませんでした。空き容量を確かめてください。\n' + e.message);
  }
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const exOf = (id) => data.exercises.find((e) => e.id === id);
const KIND = {
  barbell: { label: 'バーベル', note: 'バーの重さを含めた合計の kg を入れます。', step: 2.5 },
  dumbbell: { label: 'ダンベル', note: '片手 1 個の重さ（kg）を入れます。', step: 1 },
  body: { label: '自重', note: '重さは入れず、回数だけ記録します。', step: 0 },
};
const dateLabel = (d) => {
  const [y, m, day] = d.split('-').map(Number);
  const w = '日月火水木金土'[new Date(y, m - 1, day).getDay()];
  return `${m}/${day}（${w}）`;
};

function bodyMap(muscles) {
  let svg = bodySvg;
  for (const m of muscles) svg = svg.replaceAll(`class="m" data-m="${m}"`, `class="m on" data-m="${m}"`);
  return svg;
}

// ---------- 通信 ----------

async function post(body) {
  const res = await fetch(cfg.url, {
    method: 'POST',
    // text/plain にして、ブラウザの事前確認（preflight）を避ける
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ token: cfg.token, sent_at: new Date().toISOString(), client: 'app', ...body }),
    redirect: 'follow',
  });
  let json;
  try { json = await res.json(); } catch { throw new Error(`送り先の返事を読めませんでした（${res.status}）`); }
  if (!json.ok) throw new Error(json.error || '送り先でエラーになりました');
  return json;
}

async function sync() {
  if (ui.syncing) return;
  if (!cfg.url || !cfg.token) return;
  ui.syncing = true; ui.syncError = ''; renderBar();
  try {
    let pending = S.unsynced(sets).map(S.toWire);
    do {
      const part = pending.slice(0, CHUNK);
      pending = pending.slice(CHUNK);
      const json = await post({ action: 'sync', since: cfg.cursor || '', rows: part });
      sets = S.mergeRemote(S.markSynced(sets, part), json.rows || []);
      cfg.cursor = json.cursor || cfg.cursor;
      cfg.pcAt = json.pc_at || cfg.pcAt;
      cfg.lastSyncAt = new Date().toISOString();
      save();
    } while (pending.length);
  } catch (e) {
    ui.syncError = navigator.onLine ? e.message : '電波がありません';
  } finally {
    ui.syncing = false;
    route();
  }
}

let syncTimer = null;
function syncSoon() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(sync, 1500);
}

function renderBar() {
  const n = S.unsynced(sets).length;
  let cls = 'ok', text = '';
  if (!cfg.url || !cfg.token) { cls = 'warn'; text = `送り先が未設定です（端末の中だけに保存：${n} 件）`; }
  else if (ui.syncing) { cls = 'info'; text = '送信中…'; }
  else if (n > 0) { cls = 'warn'; text = `未送信 ${n} 件${ui.syncError ? '：' + ui.syncError : ''}`; }
  else if (ui.syncError) { cls = 'warn'; text = `受信できませんでした：${ui.syncError}`; }
  else { text = 'すべて送信済み'; }
  const btn = cfg.url && cfg.token && !ui.syncing ? '<button data-act="sync">いま送る</button>' : '';
  $bar.className = 'syncbar ' + cls;
  $bar.innerHTML = `<span>${esc(text)}</span>${btn}`;
}

// ---------- 画面 ----------

function viewHome() {
  const today = S.byDate(sets).find((d) => d.date === ui.date);
  const done = new Map((today?.items || []).filter((i) => i.rows.length).map((i) => [i.ex, i.rows.length]));
  const chips = [{ id: 'all', name: 'すべて' }, ...data.groups]
    .map((g) => `<button class="chip ${ui.group === g.id ? 'on' : ''}" data-act="group" data-id="${g.id}">${esc(g.name)}</button>`).join('');
  const cards = data.exercises
    .filter((e) => ui.group === 'all' || e.group === ui.group)
    .map((e) => `
      <a class="card" href="#/ex/${e.id}">
        <div class="pic">${e.img ? `<img src="${esc(e.img)}" alt="" loading="lazy">` : bodyMap(e.muscles)}</div>
        <div class="cname">${esc(e.name)}</div>
        <div class="tags"><span class="tag">${KIND[e.kind].label}</span>${done.has(e.id) ? `<span class="tag done">${done.get(e.id)} セット</span>` : ''}</div>
      </a>`).join('');
  const isToday = ui.date === S.todayStr();
  return `
    <section class="daybox">
      <label>記録する日 <input type="date" id="date" value="${ui.date}" max="${S.todayStr()}"></label>
      <span class="daynote">${isToday ? '今日' : dateLabel(ui.date) + ' の記録を入れています'}${done.size ? `：${done.size} 種目` : ''}</span>
    </section>
    <div class="chips">${chips}</div>
    <div class="grid">${cards}</div>`;
}

function viewExercise(id) {
  const e = exOf(id);
  if (!e) return '<p class="empty">種目が見つかりません。</p>';
  const k = KIND[e.kind];
  const unit = e.unit === 'sec' ? '秒' : '回';
  const rows = S.setsOf(sets, ui.date, id);
  const last = S.lastSession(sets, id, ui.date);
  const editing = rows.find((r) => r.id === ui.editId) || null;
  const base = editing || rows.at(-1) || last?.rows[0] || null; // 入力欄の初期値
  const list = rows.length
    ? rows.map((r, i) => `
        <li class="${r.id === ui.editId ? 'editing' : ''}">
          <span class="no">${i + 1}</span><span class="val">${esc(S.setText(r, e))}</span>
          <button data-act="edit" data-id="${r.id}">直す</button><button data-act="del" data-id="${r.id}" class="danger">消す</button>
        </li>`).join('')
    : '<li class="empty">まだ記録がありません。</li>';
  const lastHtml = last
    ? `<div class="last"><b>前回 ${dateLabel(last.date)}</b><span>${last.rows.map((r) => esc(S.setText(r, e))).join('、')}</span>${last.memo ? `<span class="memo">メモ：${esc(last.memo)}</span>` : ''}</div>`
    : '<div class="last"><b>前回</b><span>記録なし（初めての種目）</span></div>';
  const weightInput = e.kind === 'body' ? '' : `
      <div class="field"><label for="weight">重さ（kg）</label>
        <div class="stepper"><button type="button" data-act="step" data-for="weight" data-d="${-k.step}">−${k.step}</button>
        <input id="weight" type="number" inputmode="decimal" step="0.5" min="0" value="${base?.weight ?? ''}">
        <button type="button" data-act="step" data-for="weight" data-d="${k.step}">＋${k.step}</button></div></div>`;
  return `
    <a class="back" href="#/">‹ 種目の一覧</a>
    <h2>${esc(e.name)} <span class="tag">${k.label}</span></h2>
    <div class="exhead">
      ${e.img ? `<img class="expic" src="${esc(e.img)}" alt="${esc(e.name)}の絵">` : ''}
      <div class="part">${bodyMap(e.muscles)}<div>効く場所<br><b>${e.muscles.map((m) => esc(data.muscles[m])).join('・')}</b></div></div>
    </div>
    <p class="how">${esc(e.how)}</p>
    ${lastHtml}
    <h3>${ui.date === S.todayStr() ? '今日' : dateLabel(ui.date)}の記録</h3>
    <ul class="sets">${list}</ul>
    <form id="setform" class="setform">
      <p class="note">${k.note}</p>
      ${weightInput}
      <div class="field"><label for="reps">${e.unit === 'sec' ? '秒数' : '回数'}（${unit}）</label>
        <div class="stepper"><button type="button" data-act="step" data-for="reps" data-d="-1">−1</button>
        <input id="reps" type="number" inputmode="numeric" step="1" min="1" value="${base?.reps ?? ''}">
        <button type="button" data-act="step" data-for="reps" data-d="1">＋1</button></div></div>
      <p class="error" id="formerror" role="alert"></p>
      <button class="primary" type="submit">${editing ? 'この内容に直す' : `${rows.length + 1} セット目を記録する`}</button>
      ${editing ? '<button type="button" data-act="canceledit">直すのをやめる</button>' : ''}
    </form>
    <label class="memobox">メモ（痛み・手ごたえなど）
      <textarea id="memo" rows="2" maxlength="${S.LIMITS.memoMax}">${esc(S.getMemo(sets, ui.date, id))}</textarea>
    </label>`;
}

function viewHistory() {
  const days = S.byDate(sets).filter((d) => d.items.some((i) => i.rows.length || i.memo));
  if (!days.length) return '<h2>履歴</h2><p class="empty">まだ記録がありません。</p>';
  return '<h2>履歴</h2>' + days.map((d) => `
    <section class="day">
      <h3>${d.date}（${dateLabel(d.date).slice(-2, -1)}）<button data-act="goto" data-date="${d.date}">この日を直す</button></h3>
      ${d.items.map((i) => {
        const e = exOf(i.ex);
        return `<div class="hrow"><b>${esc(e?.name || i.ex)}</b><span>${i.rows.map((r) => esc(S.setText(r, e))).join('、')}</span>${i.memo ? `<span class="memo">メモ：${esc(i.memo)}</span>` : ''}</div>`;
      }).join('')}
    </section>`).join('');
}

function viewSettings() {
  const t = (iso) => (iso ? new Date(iso).toLocaleString('ja-JP') : 'まだありません');
  return `
    <h2>設定</h2>
    <p class="note">この画面は、ホーム画面のアイコンから開いた状態で設定してください（Safari で開いたときの設定は、アイコンから開いたときには引き継がれません）。</p>
    <form id="cfgform" class="cfgform">
      <label>送り先の URL<input id="url" type="url" inputmode="url" autocomplete="off" autocapitalize="off" value="${esc(cfg.url)}" placeholder="https://script.google.com/macros/s/…/exec"></label>
      <label>合言葉<input id="token" type="password" autocomplete="off" autocapitalize="off" value="${esc(cfg.token)}"></label>
      <button class="primary" type="submit">保存して通信テスト</button>
      <p id="cfgresult" role="status"></p>
    </form>
    <dl class="info">
      <dt>端末の中の記録</dt><dd>${sets.filter((r) => !r.deleted).length} 件（未送信 ${S.unsynced(sets).length} 件）</dd>
      <dt>最後に送受信できた時刻</dt><dd>${t(cfg.lastSyncAt)}</dd>
      <dt>PC が最後に取り込んだ時刻</dt><dd>${t(cfg.pcAt)}</dd>
      <dt>版</dt><dd>${APP_VERSION}</dd>
    </dl>
    <p class="note">未送信の記録が残っているあいだは、ホーム画面のアイコンを消さないでください（端末の中の記録も消えます）。</p>
    <p class="note">絵の一部は「いらすとや」の素材です。</p>`;
}

function route() {
  const hash = location.hash || '#/';
  const [, page, id] = hash.split('/');
  document.querySelectorAll('nav a').forEach((a) => a.classList.toggle('on', a.dataset.page === (page || 'home') || (page === 'ex' && a.dataset.page === 'home')));
  if (page === 'ex') $app.innerHTML = viewExercise(id);
  else if (page === 'history') $app.innerHTML = viewHistory();
  else if (page === 'settings') $app.innerHTML = viewSettings();
  else $app.innerHTML = viewHome();
  $app.dataset.page = page || 'home';
  $app.dataset.ex = page === 'ex' ? id : '';
  renderBar();
}

// ---------- 操作 ----------

function num(id) {
  const el = document.getElementById(id);
  if (!el || el.value.trim() === '') return null;
  return Number(el.value);
}

document.addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-act]');
  if (!b) return;
  const act = b.dataset.act;
  if (act === 'sync') sync();
  else if (act === 'group') { ui.group = b.dataset.id; route(); }
  else if (act === 'step') {
    const el = document.getElementById(b.dataset.for);
    const v = Math.max(0, (Number(el.value) || 0) + Number(b.dataset.d));
    el.value = String(Math.round(v * 100) / 100);
  } else if (act === 'edit') { ui.editId = b.dataset.id; route(); }
  else if (act === 'canceledit') { ui.editId = null; route(); }
  else if (act === 'del') {
    if (!confirm('このセットを消しますか？')) return;
    sets = S.deleteSet(sets, b.dataset.id);
    if (ui.editId === b.dataset.id) ui.editId = null;
    save(); route(); syncSoon();
  } else if (act === 'goto') { ui.date = b.dataset.date; ui.editId = null; location.hash = '#/'; route(); }
});

document.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  if (ev.target.id === 'setform') {
    const e = exOf($app.dataset.ex);
    const input = { weight: e.kind === 'body' ? null : num('weight'), reps: num('reps') };
    const err = S.checkSet(input, e.kind);
    if (err) { document.getElementById('formerror').textContent = err; return; }
    sets = ui.editId ? S.editSet(sets, ui.editId, input) : S.addSet(sets, { date: ui.date, ex: e.id, ...input });
    ui.editId = null;
    save(); route(); syncSoon();
  } else if (ev.target.id === 'cfgform') {
    const out = document.getElementById('cfgresult');
    cfg.url = document.getElementById('url').value.trim();
    cfg.token = document.getElementById('token').value.trim();
    save();
    if (!cfg.url || !cfg.token) { out.textContent = '保存しました（送り先が空なので、通信テストはしていません）。'; renderBar(); return; }
    out.textContent = '通信テスト中…';
    try {
      await post({ action: 'ping' });
      out.textContent = '通信テストに成功しました。続けて記録を送受信します。';
      sync();
    } catch (e) {
      out.textContent = '通信テストに失敗しました：' + e.message;
    }
    renderBar();
  }
});

document.addEventListener('change', (ev) => {
  if (ev.target.id === 'date') {
    ui.date = ev.target.value || S.todayStr();
    ui.editId = null;
    route();
  } else if (ev.target.id === 'memo') {
    sets = S.setMemo(sets, ui.date, $app.dataset.ex, ev.target.value);
    save(); renderBar(); syncSoon();
  }
});

window.addEventListener('hashchange', () => { ui.editId = null; route(); window.scrollTo(0, 0); });
window.addEventListener('online', sync);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sync(); });

async function start() {
  try {
    const [d, svg] = await Promise.all([
      fetch('exercises.json').then((r) => r.json()),
      fetch('img/body.svg').then((r) => r.text()),
    ]);
    data = d;
    bodySvg = svg.replace(/<!--[\s\S]*?-->/g, '');
  } catch (e) {
    $app.innerHTML = `<p class="empty">種目の一覧を読み込めませんでした。電波のある場所で 1 度開いてください。</p>`;
    return;
  }
  route();
  sync();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}
start();
