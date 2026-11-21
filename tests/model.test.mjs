import test from 'node:test';
import assert from 'node:assert/strict';
import { dateFor, localDay, shiftDay, validDay, intensity, sessionRecord, totalsFor, streaks, statistics } from '../js/model.mjs';
import { checkpoint, elapsed, newTimer, pause, resume, timerSessions } from '../js/timer.mjs';
import { readStudy, readSettings, saveStudy, saveSettings, STUDY_KEY, SETTINGS_KEY, defaults, validLimits } from '../js/storage.mjs';

function memoryStorage() {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}

test('usa datas locais, respeita anos bissextos e rejeita datas inexistentes', () => {
  assert.equal(localDay(new Date(2024, 1, 29, 23, 59)), '2024-02-29');
  assert.equal(localDay(dateFor('2024-02-29')), '2024-02-29');
  assert.equal(shiftDay('2024-02-29', 1), '2024-03-01');
  assert.equal(shiftDay('2024-01-01', -1), '2023-12-31');
  assert.equal(validDay('2023-02-29'), false);
  assert.equal(validDay('2024-04-31'), false);
  assert.equal(validDay('0000-01-01'), false);
});

test('pausa, retoma e soma apenas o tempo em andamento', () => {
  const start = +new Date(2025, 2, 3, 12);
  let timer = newTimer('focus', start);
  assert.equal(elapsed(timer, start + 2650), 2);
  timer = pause(timer, start + 2650);
  assert.equal(elapsed(timer, start + 10000), 2);
  timer = resume(timer, start + 10000);
  const entries = timerSessions(timer, start + 11400);
  assert.equal(entries[0].seconds, 4);
  assert.deepEqual(timerSessions(timer, start + 11400), entries);
});

test('recupera do último checkpoint mesmo após fechar sem pagehide', () => {
  const storage = memoryStorage();
  const start = +new Date(2025, 2, 3, 12);
  saveStudy(storage, { version: 1, sessions: [], timer: checkpoint(newTimer('focus', start), start + 3475) });
  const timer = pause(readStudy(storage).timer);
  assert.equal(timer.start, null);
  assert.equal(elapsed(timer, start + 86400000), 3);
  assert.equal(timerSessions(timer, start + 86400000)[0].day, '2025-03-03');
});

test('pagehide preserva o tempo até o evento e não conta o período fechado', () => {
  const start = +new Date(2025, 2, 3, 12);
  const timer = pause(checkpoint(newTimer('focus', start), start + 1000), start + 1800);
  const resumed = resume(timer, start + 10000);
  assert.equal(timerSessions(resumed, start + 10300)[0].seconds, 2);
});

test('divide a sessão à meia-noite e mantém a soma em segundos', () => {
  const start = +new Date(2025, 2, 3, 23, 59, 58, 250);
  const entries = timerSessions(newTimer('focus', start), start + 4150);
  assert.deepEqual(entries.map(({ day, seconds }) => [day, seconds]), [
    ['2025-03-03', 1], ['2025-03-04', 3],
  ]);
  assert.equal(entries.reduce((sum, item) => sum + item.seconds, 0), 4);
  assert.notEqual(entries[0].id, entries[1].id);
});

test('meia-noite durante uma pausa não produz tempo fictício', () => {
  const start = +new Date(2025, 2, 3, 23, 59, 50);
  const paused = pause(newTimer('focus', start), start + 3000);
  const resumed = resume(paused, start + 20000);
  assert.deepEqual(timerSessions(resumed, start + 22750).map(entry => entry.seconds), [3, 2]);
  assert.deepEqual(timerSessions(newTimer('short', start), start + 999), []);
});

test('soma várias sessões e recalcula sequências após edição e exclusão', () => {
  const now = +new Date(2025, 4, 16, 15);
  const first = sessionRecord('a', '2025-05-12', 1200, 'manual', now);
  const second = sessionRecord('b', '2025-05-14', 200, 'timer', now);
  const third = sessionRecord('c', '2025-05-15', 200, 'manual', now);
  const fourth = sessionRecord('d', '2025-05-15', 400, 'manual', now);
  const totals = totalsFor([first, second, third, fourth]);
  assert.equal(totals.get('2025-05-15'), 600);
  assert.deepEqual(streaks(totals, '2025-05-16'), { current: 2, longest: 2 });
  assert.deepEqual(streaks(totals, '2025-05-17'), { current: 0, longest: 2 });
  const moved = sessionRecord(first.id, '2025-05-13', 600, first.source, now + 2000, first);
  assert.equal(moved.createdAt, first.createdAt);
  assert.notEqual(moved.updatedAt, first.updatedAt);
  assert.deepEqual(streaks(totalsFor([moved, second, third]), '2025-05-16'), { current: 3, longest: 3 });
  assert.deepEqual(streaks(totalsFor([moved, second]), '2025-05-16'), { current: 0, longest: 2 });
});

test('calcula estatísticas com dias decorridos, incluindo dias sem estudo', () => {
  const totals = new Map([['2025-05-04', 600], ['2025-05-12', 1200], ['2025-05-13', 600], ['2025-05-14', 9999]]);
  const stats = statistics(totals, '2025-05-13');
  assert.equal(stats.week[0].day, '2025-05-12');
  assert.equal(stats.week[2].seconds, 0);
  assert.equal(stats.weekTotal, 1800);
  assert.equal(stats.weekAverage, 900);
  assert.equal(stats.monthTotal, 2400);
  assert.equal(stats.monthAverage, 185);
  assert.equal(stats.studiedDays, 3);
});

test('níveis cobrem todos os segundos nas fronteiras e aceita limites personalizados', () => {
  assert.deepEqual([0, 1, 3599, 3600, 7199, 7200, 14399, 14400].map(seconds => intensity(seconds, defaults.limits)), [0, 1, 1, 2, 2, 3, 3, 4]);
  assert.deepEqual([119, 120, 180, 240].map(seconds => intensity(seconds, [1, 2, 3])), [1, 2, 3, 4]);
  assert.equal(validLimits([1, 2, 3]), true);
  assert.equal(validLimits([1, 1, 3]), false);
  assert.equal(validLimits([1, 2, 1.5]), false);
});

test('persiste meta, tema, paleta e limites separadamente dos registros', () => {
  const storage = memoryStorage();
  assert.deepEqual(readSettings(storage), defaults);
  const settings = { version: 1, goal: 5400, theme: 'dark', palette: 'lavender', limits: [15, 25, 40] };
  saveSettings(storage, settings);
  assert.deepEqual(readSettings(storage), settings);
  assert.deepEqual(readStudy(storage), { version: 1, sessions: [], timer: null });
});

test('ignora dados corrompidos, versões desconhecidas e IDs repetidos', () => {
  const storage = memoryStorage();
  const now = +new Date(2025, 2, 3, 12);
  const entry = sessionRecord('a', '2025-03-03', 600, 'manual', now);
  storage.setItem(STUDY_KEY, '{ inválido');
  assert.deepEqual(readStudy(storage).sessions, []);
  saveStudy(storage, { version: 1, sessions: [entry, entry, { ...entry, id: 'b', seconds: 0 }], timer: { periods: [] } });
  assert.deepEqual(readStudy(storage), { version: 1, sessions: [entry], timer: null });
  saveStudy(storage, { version: 999, sessions: [entry] });
  assert.deepEqual(readStudy(storage).sessions, []);
  storage.setItem(SETTINGS_KEY, JSON.stringify({ version: 1, goal: -30, palette: 'fake', theme: 'fake', limits: [2, 1, 5] }));
  assert.deepEqual(readSettings(storage), defaults);
});
