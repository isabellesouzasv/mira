import { dateFor, localDay, shiftDay, sessionRecord } from './model.mjs';

export function newTimer(id, now) {
  return { id, periods: [], start: now, checkpoint: now };
}

export function checkpoint(timer, now) {
  return { ...timer, checkpoint: Math.max(timer.checkpoint, now) };
}

export function pause(timer, end = timer.checkpoint) {
  if (timer.start === null) return timer;
  return {
    ...timer,
    periods: [...timer.periods, [timer.start, Math.max(timer.start, end)]],
    start: null,
    checkpoint: null,
  };
}

export function resume(timer, now) {
  return { ...timer, start: now, checkpoint: now };
}

export function elapsed(timer, now) {
  if (!timer) return 0;
  const accumulated = timer.periods.reduce((sum, [start, end]) => sum + end - start, 0);
  const running = timer.start === null ? 0 : Math.max(timer.checkpoint, now) - timer.start;
  return Math.floor((accumulated + running) / 1000);
}

export function timerSessions(timer, now) {
  const days = new Map();
  for (const [start, end] of pause(timer, Math.max(timer.checkpoint ?? 0, now)).periods) {
    let cursor = start;
    while (cursor < end) {
      const day = localDay(new Date(cursor));
      const boundary = Math.min(end, +dateFor(shiftDay(day, 1)));
      days.set(day, (days.get(day) ?? 0) + boundary - cursor);
      cursor = boundary;
    }
  }
  let carry = 0;
  const sessions = [];
  for (const [day, milliseconds] of [...days].sort(([first], [second]) => first.localeCompare(second))) {
    const seconds = Math.floor((carry + milliseconds) / 1000);
    carry = (carry + milliseconds) % 1000;
    if (seconds) sessions.push(sessionRecord(`${timer.id}-${day}`, day, seconds, 'timer', now));
  }
  return sessions;
}
