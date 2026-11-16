// 記録の入れ物と計算。画面にも通信にも依存しない（node --test で確かめる）。
//
// 1 行の形:
//   id          端末で作る一意の値（メモは memo_<日付>_<種目>）
//   kind        'set'（1 セット）または 'memo'（その日のその種目のメモ）
//   date        'YYYY-MM-DD'（端末の日付）
//   ex          種目の id
//   set_no      その日のその種目の何セット目か（メモは 0）
//   weight      kg。自重の種目は null
//   reps        回数（プランクは秒）。メモは 0
//   memo        メモの本文（セットの行は ''）
//   updated_at  最後に変えた時刻（ISO 形式）。同じ id は新しいほうが勝つ
//   deleted     消したら true（行は残し、消した事実を送る）
//   synced      送り先に届いたら true（端末の中だけで使う。送らない）

export const LIMITS = { weightMax: 500, repsMax: 9999, memoMax: 500 };

export function todayStr(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function newId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export const memoId = (date, ex) => `memo_${date}_${ex}`;

/** 入力の確かめ。問題があれば理由の文、なければ null を返す */
export function checkSet({ weight, reps }, kind) {
  if (!Number.isInteger(reps) || reps < 1 || reps > LIMITS.repsMax) return '回数は 1 以上の整数で入れてください';
  if (kind === 'body') return null;
  if (typeof weight !== 'number' || !Number.isFinite(weight) || weight <= 0) return '重さを入れてください';
  if (weight > LIMITS.weightMax) return `重さは ${LIMITS.weightMax}kg までです`;
  return null;
}

export function setsOf(sets, date, ex) {
  return sets
    .filter((r) => r.kind === 'set' && !r.deleted && r.date === date && r.ex === ex)
    .sort((a, b) => a.set_no - b.set_no);
}

/** 同じ id があれば、新しいほう（updated_at が同じか後）で置き換える */
export function upsert(sets, row) {
  const i = sets.findIndex((r) => r.id === row.id);
  if (i < 0) return [...sets, row];
  if (row.updated_at < sets[i].updated_at) return sets;
  const next = sets.slice();
  next[i] = row;
  return next;
}

export function addSet(sets, { date, ex, weight, reps }, now = new Date()) {
  const all = sets.filter((r) => r.kind === 'set' && r.date === date && r.ex === ex);
  const set_no = all.reduce((m, r) => Math.max(m, r.set_no), 0) + 1;
  const row = {
    id: newId(), kind: 'set', date, ex, set_no,
    weight: weight ?? null, reps, memo: '',
    updated_at: now.toISOString(), deleted: false, synced: false,
  };
  return upsert(sets, row);
}

export function editSet(sets, id, { weight, reps }, now = new Date()) {
  const cur = sets.find((r) => r.id === id);
  if (!cur) return sets;
  return upsert(sets, { ...cur, weight: weight ?? null, reps, updated_at: now.toISOString(), synced: false });
}

export function deleteSet(sets, id, now = new Date()) {
  const cur = sets.find((r) => r.id === id);
  if (!cur) return sets;
  return upsert(sets, { ...cur, deleted: true, updated_at: now.toISOString(), synced: false });
}

export function getMemo(sets, date, ex) {
  const r = sets.find((x) => x.id === memoId(date, ex));
  return r && !r.deleted ? r.memo : '';
}

export function setMemo(sets, date, ex, text, now = new Date()) {
  const memo = String(text).trim().slice(0, LIMITS.memoMax);
  if (memo === getMemo(sets, date, ex)) return sets;
  return upsert(sets, {
    id: memoId(date, ex), kind: 'memo', date, ex, set_no: 0, weight: null, reps: 0,
    memo, updated_at: now.toISOString(), deleted: memo === '', synced: false,
  });
}

/** その種目を、指定した日より前にいちばん最近やった日の記録。無ければ null */
export function lastSession(sets, ex, beforeDate) {
  const dates = sets
    .filter((r) => r.kind === 'set' && !r.deleted && r.ex === ex && r.date < beforeDate)
    .map((r) => r.date);
  if (!dates.length) return null;
  const date = dates.sort().at(-1);
  return { date, rows: setsOf(sets, date, ex), memo: getMemo(sets, date, ex) };
}

/** 日付ごと（新しい順）→ 種目ごとにまとめる。履歴の画面用 */
export function byDate(sets) {
  const map = new Map();
  for (const r of sets) {
    if (r.deleted) continue;
    if (!map.has(r.date)) map.set(r.date, new Map());
    const day = map.get(r.date);
    if (!day.has(r.ex)) day.set(r.ex, { rows: [], memo: '' });
    if (r.kind === 'memo') day.get(r.ex).memo = r.memo;
    else day.get(r.ex).rows.push(r);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, day]) => ({
      date,
      items: [...day.entries()].map(([ex, v]) => ({ ex, memo: v.memo, rows: v.rows.sort((a, b) => a.set_no - b.set_no) })),
    }));
}

export const unsynced = (sets) => sets.filter((r) => !r.synced);

/** 送る形にする（端末の中だけの印を外す） */
export function toWire(row) {
  const { synced, ...rest } = row;
  return rest;
}

/** 送った行に「届いた」印を付ける。送ったあとに端末で変えた行は、まだ未送信のままにする */
export function markSynced(sets, sent) {
  const at = new Map(sent.map((r) => [r.id, r.updated_at]));
  return sets.map((r) => (at.get(r.id) === r.updated_at ? { ...r, synced: true } : r));
}

/** 送り先から受け取った行を取り込む。端末のほうが新しい行はそのまま残す */
export function mergeRemote(sets, remote) {
  const map = new Map(sets.map((r) => [r.id, r]));
  for (const r of remote) {
    const cur = map.get(r.id);
    if (cur && cur.updated_at > r.updated_at) continue;
    if (cur && cur.updated_at === r.updated_at && !cur.synced) { map.set(r.id, { ...cur, synced: true }); continue; }
    map.set(r.id, { ...r, synced: true });
  }
  return [...map.values()];
}

/** 画面に出す 1 セットの文（例: 60kg × 10回） */
export function setText(row, ex) {
  const unit = ex?.unit === 'sec' ? '秒' : '回';
  return row.weight == null ? `${row.reps}${unit}` : `${row.weight}kg × ${row.reps}${unit}`;
}
