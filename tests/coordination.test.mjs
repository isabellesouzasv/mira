import test from 'node:test';
import assert from 'node:assert/strict';
import { studyCoordinator } from '../js/coordination.mjs';
import { readStudy } from '../js/storage.mjs';
import { elapsed, newTimer, pause, timerSessions } from '../js/timer.mjs';
import { sessionRecord } from '../js/model.mjs';

const locks = navigator.locks;

function memoryStorage() {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}

test('duas abas só conseguem iniciar e finalizar um cronômetro compartilhado', { skip: !locks }, async () => {
  const storage = memoryStorage();
  const first = studyCoordinator(storage, locks);
  const second = studyCoordinator(storage, locks);
  const start = +new Date(2025, 2, 3, 12);
  let ready;
  const started = new Promise(resolve => { ready = resolve; });
  const active = first.claim(async token => {
    await first.transact(study => {
      study.timer = newTimer('first', start);
      return true;
    });
    ready();
    await token.lifetime;
  });

  await started;
  try {
    let secondStarted = false;
    await second.claim(() => { secondStarted = true; });
    assert.equal(secondStarted, false);
    assert.equal(readStudy(storage).timer.id, 'first');

    await first.transact(study => {
      study.timer = pause(study.timer, start + 3100);
      return true;
    });
  } finally {
    first.release();
    await active;
  }

  const finish = coordinator => coordinator.claim(() => coordinator.transact(study => {
    if (!study.timer) return false;
    assert.equal(elapsed(study.timer, start + 10000), 3);
    study.sessions.push(...timerSessions(study.timer, start + 10000));
    study.timer = null;
    return true;
  }));

  await Promise.all([finish(first), finish(second)]);
  await finish(second);
  const result = readStudy(storage);
  assert.equal(result.timer, null);
  assert.deepEqual(result.sessions.map(entry => entry.seconds), [3]);
});

test('alterações simultâneas em abas diferentes preservam os dois registros', { skip: !locks }, async () => {
  const storage = memoryStorage();
  const now = +new Date(2025, 2, 3, 12);
  const record = id => studyCoordinator(storage, locks).transact(study => {
    study.sessions.push(sessionRecord(id, '2025-03-03', 600, 'manual', now));
    return true;
  });
  await Promise.all([record('a'), record('b')]);
  assert.deepEqual(readStudy(storage).sessions.map(entry => entry.id).sort(), ['a', 'b']);
});
