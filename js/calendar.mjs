import { dateFor, localDay, shiftDay, weekdayIndex, weekdays, dateLabel, duration, monthName, shortMonth, intensity } from './model.mjs';

export function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function dayButton(day, label, state) {
  const seconds = state.totals.get(day) ?? 0;
  const button = element('button', label, 'day');
  button.type = 'button';
  button.dataset.day = day;
  button.dataset.level = intensity(seconds, state.limits);
  button.title = `${dateLabel(day)} · ${duration(seconds)}`;
  button.setAttribute('aria-label', button.title);
  button.setAttribute('aria-pressed', String(day === state.selected));
  if (day === state.today) button.setAttribute('aria-current', 'date');
  return button;
}

function replaceCalendar(container, contents) {
  const focusedDay = container.contains(document.activeElement) ? document.activeElement.dataset.day : null;
  container.replaceChildren(contents);
  if (focusedDay) container.querySelector(`[data-day="${focusedDay}"]`)?.focus({ preventScroll: true });
}

export function renderMonth(container, heading, month, state) {
  const first = dateFor(month);
  heading.textContent = monthName.format(first);
  const content = document.createDocumentFragment();
  for (const label of weekdays) content.append(element('span', label, 'weekday'));
  for (let pad = 0; pad < weekdayIndex(first); pad++) content.append(element('span'));
  for (let day = month; day.slice(0, 7) === month.slice(0, 7); day = shiftDay(day, 1)) {
    content.append(dayButton(day, String(dateFor(day).getDate()), state));
  }
  replaceCalendar(container, content);
}

export function renderYear(container, year, state) {
  const first = `${year}-01-01`;
  const content = document.createDocumentFragment();
  const active = state.selected.startsWith(year) ? state.selected : first;
  let column = 1;
  for (let day = first; day.startsWith(year); day = shiftDay(day, 1)) {
    const date = dateFor(day);
    const weekday = weekdayIndex(date);
    if (weekday === 0 && day !== first) column++;
    if (date.getDate() === 1) {
      const label = element('span', shortMonth.format(date).replace('.', ''), 'heat-month');
      label.style.gridArea = `1 / ${column}`;
      label.setAttribute('aria-hidden', 'true');
      content.append(label);
    }
    const button = dayButton(day, '', state);
    button.style.gridArea = `${weekday + 2} / ${column}`;
    button.tabIndex = day === active ? 0 : -1;
    content.append(button);
  }
  replaceCalendar(container, content);
}

export function renderLegend(container, limits) {
  const ranges = ['0 min', `Até ${limits[0]} min`, `${limits[0] + 1}–${limits[1]} min`,
    `${limits[1] + 1}–${limits[2]} min`, `${limits[2] + 1} min ou mais`];
  const markers = ranges.map((label, level) => {
    const marker = element('i');
    marker.dataset.level = level;
    marker.title = label;
    marker.setAttribute('aria-hidden', 'true');
    return marker;
  });
  container.setAttribute('aria-label', `Legenda de intensidade. ${ranges.join('; ')}`);
  container.replaceChildren(element('span', 'Menos'), ...markers, element('span', 'Mais'));
}
