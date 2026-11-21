import { validDay } from './model.mjs';

export const STUDY_KEY = 'mira.study';
export const SETTINGS_KEY = 'mira.settings';
export const defaults = { version: 1, goal: 7200, palette: 'pink', theme: 'auto', limits: [59, 119, 239] };
const integerBetween = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
const timestamp = value => integerBetween(value, 0, 253402300799999);

function read(storage, key) {
  const item = storage.getItem(key);
  try {
    return JSON.parse(item);
  } catch {
    return null;
  }
}

export function validLimits(limits) {
  return Array.isArray(limits) && limits.length === 3 &&
    limits.every((value, index) => integerBetween(value, 1, 999999) && (index === 0 || value > limits[index - 1]));
}

export function readSettings(storage) {
  const saved = read(storage, SETTINGS_KEY);
  if (saved?.version !== 1) return { ...defaults, limits: [...defaults.limits] };
  return {
    version: 1,
    goal: integerBetween(saved.goal, 60, 35999940) && saved.goal % 60 === 0 ? saved.goal : defaults.goal,
    palette: ['pink', 'red', 'lavender'].includes(saved.palette) ? saved.palette : defaults.palette,
    theme: ['auto', 'light', 'dark'].includes(saved.theme) ? saved.theme : defaults.theme,
    limits: validLimits(saved.limits) ? saved.limits : [...defaults.limits],
  };
}

function validSession(entry) {
  return typeof entry?.id === 'string' && entry.id.length > 0 && validDay(entry.day) &&
    integerBetween(entry.seconds, 1, Number.MAX_SAFE_INTEGER) && ['timer', 'manual'].includes(entry.source) &&
    typeof entry.createdAt === 'string' && Number.isFinite(Date.parse(entry.createdAt)) &&
    typeof entry.updatedAt === 'string' && Number.isFinite(Date.parse(entry.updatedAt));
}

function validTimer(timer) {
  return typeof timer?.id === 'string' && timer.id.length > 0 && Array.isArray(timer.periods) &&
    timer.periods.every(period => Array.isArray(period) && period.length === 2 &&
      timestamp(period[0]) && timestamp(period[1]) && period[1] >= period[0]) &&
    ((timer.start === null && timer.checkpoint === null) ||
      (timestamp(timer.start) && timestamp(timer.checkpoint) && timer.checkpoint >= timer.start));
}

export function readStudy(storage) {
  const saved = read(storage, STUDY_KEY);
  const sessions = new Map();
  if (saved?.version === 1 && Array.isArray(saved.sessions)) {
    for (const entry of saved.sessions) {
      if (validSession(entry)) sessions.set(entry.id, entry);
    }
  }
  return {
    version: 1,
    sessions: [...sessions.values()],
    timer: saved?.version === 1 && validTimer(saved.timer) ? saved.timer : null,
  };
}

export function saveSettings(storage, settings) {
  storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function saveStudy(storage, study) {
  storage.setItem(STUDY_KEY, JSON.stringify(study));
}
