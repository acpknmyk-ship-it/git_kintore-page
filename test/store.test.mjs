import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import * as S from '../store.js';

const at = (s) => new Date(`2026-01-${s}T10:00:00Z`);

test('セットを足すと、その日のその種目の連番が付く', () => {
  let sets = [];
  sets = S.addSet(sets, { date: '2026-01-05', ex: 'bench_press', weight: 40, reps: 10 }, at('05'));
  sets = S.addSet(sets, { date: '2026-01-05', ex: 'bench_press', weight: 40, reps: 8 }, at('05'));
  sets = S.addSet(sets, { date: '2026-01-05', ex: 'squat', weight: null, reps: 15 }, at('05'));
  assert.deepEqual(S.setsOf(sets, '2026-01-05', 'bench_press').map((r) => r.set_no), [1, 2]);
  assert.equal(S.setsOf(sets, '2026-01-05', 'squat')[0].weight, null);
  assert.equal(S.unsynced(sets).length, 3);
});

test('直す・消すと未送信に戻り、消した行は一覧に出ない', () => {
  let sets = S.addSet([], { date: '2026-01-05', ex: 'bench_press', weight: 600, reps: 10 }, at('05'));
  const id = sets[0].id;
  sets = S.markSynced(sets, sets.map(S.toWire));
  assert.equal(S.unsynced(sets).length, 0);
  sets = S.editSet(sets, id, { weight: 60, reps: 10 }, at('06'));
  assert.equal(sets[0].weight, 60);
  assert.equal(S.unsynced(sets).length, 1);
  sets = S.deleteSet(sets, id, at('07'));
  assert.equal(S.setsOf(sets, '2026-01-05', 'bench_press').length, 0);
  assert.equal(sets.length, 1, '消した事実を送るため、行は残す');
});

test('消したあとに足すセットの番号は、消した行と重ならない', () => {
  let sets = S.addSet([], { date: '2026-01-05', ex: 'squat', weight: null, reps: 10 }, at('05'));
  sets = S.deleteSet(sets, sets[0].id, at('05'));
  sets = S.addSet(sets, { date: '2026-01-05', ex: 'squat', weight: null, reps: 12 }, at('05'));
  assert.equal(S.setsOf(sets, '2026-01-05', 'squat')[0].set_no, 2);
});

test('前回の記録は、指定した日より前のいちばん新しい日', () => {
  let sets = [];
  sets = S.addSet(sets, { date: '2026-01-02', ex: 'deadlift', weight: 50, reps: 5 }, at('02'));
  sets = S.addSet(sets, { date: '2026-01-05', ex: 'deadlift', weight: 55, reps: 5 }, at('05'));
  sets = S.addSet(sets, { date: '2026-01-08', ex: 'deadlift', weight: 60, reps: 5 }, at('08'));
  assert.equal(S.lastSession(sets, 'deadlift', '2026-01-08').date, '2026-01-05');
  assert.equal(S.lastSession(sets, 'deadlift', '2026-01-02'), null);
  assert.equal(S.lastSession(sets, 'squat', '2026-01-08'), null);
});

test('メモは 1 日 1 種目に 1 つ。空にすると消える', () => {
  let sets = S.setMemo([], '2026-01-05', 'squat', ' ひざが少し痛い ', at('05'));
  assert.equal(S.getMemo(sets, '2026-01-05', 'squat'), 'ひざが少し痛い');
  sets = S.setMemo(sets, '2026-01-05', 'squat', '問題なし', at('06'));
  assert.equal(sets.length, 1);
  assert.equal(S.getMemo(sets, '2026-01-05', 'squat'), '問題なし');
  sets = S.setMemo(sets, '2026-01-05', 'squat', '', at('07'));
  assert.equal(S.getMemo(sets, '2026-01-05', 'squat'), '');
  assert.equal(sets[0].deleted, true);
});

test('送ったあとに端末で直した行は、未送信のまま残る', () => {
  let sets = S.addSet([], { date: '2026-01-05', ex: 'squat', weight: null, reps: 10 }, at('05'));
  const sent = sets.map(S.toWire);
  sets = S.editSet(sets, sets[0].id, { weight: null, reps: 12 }, at('06'));
  sets = S.markSynced(sets, sent);
  assert.equal(S.unsynced(sets).length, 1);
});

test('受け取った行の取り込み：新しいほうが勝ち、端末の新しい変更は残る', () => {
  let sets = S.addSet([], { date: '2026-01-05', ex: 'squat', weight: null, reps: 10 }, at('05'));
  const mine = sets[0];
  const older = { ...S.toWire(mine), reps: 1, updated_at: at('04').toISOString() };
  sets = S.mergeRemote(sets, [older]);
  assert.equal(sets[0].reps, 10);
  const newer = { ...S.toWire(mine), reps: 20, updated_at: at('09').toISOString() };
  const other = { id: 'x1', kind: 'set', date: '2026-01-06', ex: 'pushup', set_no: 1, weight: null, reps: 5, memo: '', updated_at: at('06').toISOString(), deleted: false };
  sets = S.mergeRemote(sets, [newer, other]);
  assert.equal(sets.find((r) => r.id === mine.id).reps, 20);
  assert.equal(sets.length, 2);
  assert.equal(S.unsynced(sets).length, 0);
});

test('入力の確かめ', () => {
  assert.equal(S.checkSet({ weight: 60, reps: 10 }, 'barbell'), null);
  assert.equal(S.checkSet({ weight: null, reps: 10 }, 'body'), null);
  assert.ok(S.checkSet({ weight: null, reps: 10 }, 'dumbbell'));
  assert.ok(S.checkSet({ weight: 600, reps: 10 }, 'barbell'));
  assert.ok(S.checkSet({ weight: 60, reps: 0 }, 'barbell'));
  assert.ok(S.checkSet({ weight: 60, reps: 2.5 }, 'barbell'));
  assert.ok(S.checkSet({ weight: 60, reps: null }, 'barbell'));
});

test('履歴は新しい日が先', () => {
  let sets = [];
  sets = S.addSet(sets, { date: '2026-01-02', ex: 'squat', weight: null, reps: 10 }, at('02'));
  sets = S.addSet(sets, { date: '2026-01-05', ex: 'squat', weight: null, reps: 10 }, at('05'));
  sets = S.setMemo(sets, '2026-01-05', 'squat', 'よい', at('05'));
  const days = S.byDate(sets);
  assert.deepEqual(days.map((d) => d.date), ['2026-01-05', '2026-01-02']);
  assert.equal(days[0].items[0].memo, 'よい');
});

test('種目の一覧：id が重ならず、絵のファイルと部位の名前がそろっている', () => {
  const data = JSON.parse(readFileSync(new URL('../exercises.json', import.meta.url), 'utf8'));
  const ids = data.exercises.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length);
  const groups = new Set(data.groups.map((g) => g.id));
  const body = readFileSync(new URL('../img/body.svg', import.meta.url), 'utf8');
  for (const e of data.exercises) {
    assert.match(e.id, /^[a-z0-9_]+$/);
    assert.ok(groups.has(e.group), e.id);
    assert.ok(['barbell', 'dumbbell', 'body'].includes(e.kind), e.id);
    assert.ok(['reps', 'sec'].includes(e.unit), e.id);
    if (e.img) assert.ok(existsSync(new URL('../' + e.img, import.meta.url)), e.img);
    assert.ok(e.muscles.length > 0, e.id);
    for (const m of e.muscles) {
      assert.ok(data.muscles[m], `${e.id}: ${m}`);
      assert.ok(body.includes(`data-m="${m}"`), `図に ${m} が無い`);
    }
  }
});
