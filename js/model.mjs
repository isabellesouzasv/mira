export const weekdays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const number = new Intl.NumberFormat('pt-BR');
const fullDate = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' });
export const monthName = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
export const shortMonth = new Intl.DateTimeFormat('pt-BR', { month: 'short' });

export function localDay(date = new Date()) {
  return [String(date.getFullYear()).padStart(4, '0'), date.getMonth() + 1, date.getDate()]
    .map(part => String(part).padStart(2, '0')).join('-');
}

export function dateFor(day) {
  const [year, month, date] = day.split('-').map(Number);
  const result = new Date(0);
  result.setFullYear(year, month - 1, date);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function validDay(day) {
  return typeof day === 'string' && /^\d{4}-\d\d-\d\d$/.test(day) &&
    !day.startsWith('0000') && localDay(dateFor(day)) === day;
}

export function shiftDay(day, count) {
  const date = dateFor(day);
  date.setDate(date.getDate() + count);
  return localDay(date);
}

export const weekdayIndex = date => (date.getDay() + 6) % 7;
export const dateLabel = day => fullDate.format(dateFor(day));
export const dayCount = count => `${number.format(count)} ${count === 1 ? 'dia' : 'dias'}`;

export function duration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds / 60) % 60;
  const remainder = seconds % 60;
  return [hours && `${number.format(hours)}h`, minutes && `${minutes}min`, remainder && `${remainder}s`]
    .filter(Boolean).join(' ') || '0 min';
}

export function clockText(seconds) {
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    .map(part => String(part).padStart(2, '0')).join(':');
}

export function totalsFor(sessions) {
  const totals = new Map();
  for (const session of sessions) {
    totals.set(session.day, (totals.get(session.day) ?? 0) + session.seconds);
  }
  return totals;
}

export function streaks(totals, today) {
  const days = [...totals].filter(([day, total]) => total > 0 && day <= today).map(([day]) => day).sort();
  let previous, chain = 0, longest = 0;
  for (const day of days) {
    chain = previous === shiftDay(day, -1) ? chain + 1 : 1;
    longest = Math.max(longest, chain);
    previous = day;
  }
  return { longest, current: previous === today || previous === shiftDay(today, -1) ? chain : 0 };
}

export function recentWeek(totals, today) {
  return Array.from({ length: 7 }, (_, index) => {
    const day = shiftDay(today, index - 6);
    return { day, label: weekdays[weekdayIndex(dateFor(day))], seconds: totals.get(day) ?? 0 };
  });
}

export function statistics(totals, today) {
  const date = dateFor(today);
  const weekday = weekdayIndex(date);
  const week = Array.from({ length: 7 }, (_, index) => ({
    day: shiftDay(today, index - weekday), label: weekdays[index],
  })).map(entry => ({ ...entry, seconds: entry.day <= today ? totals.get(entry.day) ?? 0 : 0 }));
  const month = [...totals].filter(([day]) => day.startsWith(today.slice(0, 7)) && day <= today);
  const weekTotal = week.reduce((sum, entry) => sum + entry.seconds, 0);
  const monthTotal = month.reduce((sum, [, seconds]) => sum + seconds, 0);
  return {
    week, weekTotal, monthTotal,
    weekAverage: Math.round(weekTotal / (weekday + 1)),
    monthAverage: Math.round(monthTotal / date.getDate()),
    studiedDays: [...totals].filter(([day, seconds]) => day <= today && seconds > 0).length,
    ...streaks(totals, today),
  };
}

export function intensity(seconds, limits) {
  if (seconds === 0) return 0;
  const index = limits.findIndex(limit => seconds < (limit + 1) * 60);
  return index === -1 ? 4 : index + 1;
}

export function sessionRecord(id, day, seconds, source, now, previous) {
  const timestamp = new Date(now).toISOString();
  return { id, day, seconds, source, createdAt: previous?.createdAt ?? timestamp, updatedAt: timestamp };
}
