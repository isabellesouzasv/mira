import { studyCoordinator } from './coordination.mjs';
import { clockText, dateFor, dateLabel, dayCount, duration, intensity, localDay, recentWeek, sessionRecord, shiftDay, statistics, streaks, totalsFor, validDay } from './model.mjs';
import { checkpoint, elapsed, newTimer, pause, resume, timerSessions } from './timer.mjs';
import { STUDY_KEY, SETTINGS_KEY, readStudy, readSettings, saveSettings, validLimits, defaults } from './storage.mjs';
import { element, renderMonth, renderYear, renderLegend } from './calendar.mjs';

const $ = id => document.getElementById(id);
const set = (id, value) => {
  const node = $(id);
  if (node.textContent !== String(value)) node.textContent = value;
};
const systemTheme = matchMedia('(prefers-color-scheme: dark)');
const locks = navigator.locks;
const coordinator = studyCoordinator({
  getItem: key => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
}, locks);

let study = { sessions: [], timer: null };
let settings = defaults;
let totals = new Map();
let today = localDay();
let selected = today;
let month = today.slice(0, 7) + '-01';
let year = today.slice(0, 4);
let page;
let noticeTimeout;
let leaving = false;
let editing;
let deleting;

function notice(message) {
  clearTimeout(noticeTimeout);
  $('notice').hidden = false;
  set('notice', message);
  noticeTimeout = setTimeout(() => { $('notice').hidden = true; }, 4800);
}

function applyTheme() {
  const followsSystem = settings.theme === 'auto';
  const isDark = followsSystem ? systemTheme.matches : settings.theme === 'dark';
  document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
  document.documentElement.dataset.palette = settings.palette;
  $('system-theme').checked = followsSystem;
  $('dark-mode').checked = isDark;
  $('dark-mode').disabled = followsSystem;
}

function renderTimer() {
  const timer = study.timer;
  const running = timer && timer.start !== null;
  const remote = running && !coordinator.owner;
  set('clock', clockText(elapsed(timer, coordinator.owner && !leaving ? Date.now() : 0)));
  set('timer-status', !locks ? 'O cronômetro requer um navegador com Web Locks.'
    : remote ? 'Sessão em andamento em outra aba.'
    : running ? 'Sessão em andamento' : timer ? 'Sessão pausada' : 'Pronto para começar');
  set('timer-toggle', running ? 'Pausar' : timer ? 'Continuar' : 'Iniciar estudo');
  $('timer-toggle').disabled = Boolean(!locks || remote);
  $('timer-finish').hidden = !timer;
  $('timer-finish').disabled = Boolean(remote || !locks);
}

function renderHome() {
  const total = totals.get(today) ?? 0;
  const streak = streaks(totals, today).current;
  const ratio = total / settings.goal;
  set('today-label', dateLabel(today));
  set('today-total', duration(total));
  set('goal-target', `de ${duration(settings.goal)}`);
  $('goal-progress').max = settings.goal;
  $('goal-progress').value = Math.min(settings.goal, total);
  set('goal-percent', `${Math.floor(ratio * 100)}% da meta diária`);
  set('home-streak', dayCount(streak));
  set('streak-detail', streak ? 'de estudo consecutivo' : 'Sua sequência começa com o primeiro dia de estudo.');
}

function renderHistory() {
  const state = { today, selected, totals, limits: settings.limits };
  const recent = recentWeek(totals, today);
  set('recent-total', `${duration(recent.reduce((sum, entry) => sum + entry.seconds, 0))} no total`);
  renderChart($('recent-chart'), recent, settings.limits);
  renderMonth($('month-calendar'), $('month-title'), month, state);
  set('year-label', year);
  renderYear($('heat-calendar'), year, state);
  renderLegend($('legend'), settings.limits);
  $('prev-month').disabled = month === '0001-01-01';
  $('next-month').disabled = month === '9999-12-01';
  $('prev-year').disabled = year === '0001';
  $('next-year').disabled = year === '9999';
  set('heat-selection', `${dateLabel(selected)} · ${duration(totals.get(selected) ?? 0)}`);
  const sessions = study.sessions.filter(entry => entry.day === selected)
    .sort((first, second) => second.createdAt.localeCompare(first.createdAt));
  set('day-title', dateLabel(selected));
  set('day-summary', `${duration(totals.get(selected) ?? 0)} · ${sessions.length} ${sessions.length === 1 ? 'sessão' : 'sessões'}`);
  const rows = sessions.map(entry => {
    const row = element('li');
    const info = element('div');
    info.append(element('strong', duration(entry.seconds)), element('small', entry.source === 'timer' ? 'Cronômetro' : 'Registro manual'));
    const actions = element('div', undefined, 'actions');
    for (const [action, label] of [['edit', 'Editar'], ['delete', 'Excluir']]) {
      const button = element('button', label);
      button.dataset[action] = entry.id;
      button.setAttribute('aria-label', `${label.toLocaleLowerCase('pt-BR')} sessão de ${duration(entry.seconds)}`);
      actions.append(button);
    }
    row.append(info, actions);
    return row;
  });
  if (!rows.length) rows.push(element('li', 'Nenhuma sessão neste dia.', 'muted'));
  $('sessions').replaceChildren(...rows);
}

function renderStatistics() {
  const result = statistics(totals, today);
  const indicators = [
    ['Total neste mês', duration(result.monthTotal)],
    ['Média diária do mês', duration(result.monthAverage)],
    ['Dias estudados no histórico', dayCount(result.studiedDays)],
    ['Sequência atual', dayCount(result.current)],
    ['Maior sequência', dayCount(result.longest)],
  ];
  $('statistics').replaceChildren(...indicators.map(([label, value]) => {
    const card = element('section', undefined, 'card');
    card.append(element('h2', label), element('p', value, 'metric'));
    return card;
  }));
}

function renderChart(container, entries, limits) {
  const max = Math.max(1, ...entries.map(entry => entry.seconds));
  container.replaceChildren(...entries.map(entry => {
    const item = element('li');
    const track = element('div', undefined, 'chart-track');
    const bar = element('div', undefined, 'chart-bar');
    const label = element('time', entry.label);
    label.dateTime = entry.day;
    label.title = dateLabel(entry.day).toLocaleLowerCase('pt-BR');
    if (entry.day === today) label.setAttribute('aria-current', 'date');
    bar.dataset.level = intensity(entry.seconds, limits);
    bar.style.height = `${entry.seconds / max * 100}%`;
    track.setAttribute('aria-hidden', 'true');
    track.append(bar);
    item.append(label, track, element('span', duration(entry.seconds)));
    return item;
  }));
}

function renderPage() {
  const currentDay = localDay();
  if (currentDay !== today && selected === today) chooseDay(currentDay);
  today = currentDay;
  if (page === 'inicio') renderHome();
  if (page === 'historico') renderHistory();
  if (page === 'estatisticas') renderStatistics();
}

function navigate() {
  const pages = ['inicio', 'historico', 'estatisticas', 'configuracoes'];
  const previous = page;
  page = pages.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'inicio';
  for (const id of pages) {
    $(id).hidden = id !== page;
    const link = document.querySelector(`nav [href="#${id}"]`);
    if (id === page) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  renderPage();
  if (page === 'configuracoes' && previous !== page) renderSettingsForm();
  if (previous && previous !== page) {
    $(page).querySelector('h1').focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
}

function updateStudy(next, sessionsChanged = false) {
  study = next;
  if (sessionsChanged) {
    totals = totalsFor(study.sessions);
    renderPage();
  }
  renderTimer();
}

// Finalizing writes the records and clears the timer in one transaction.
function transact(change, sessionsChanged = false) {
  return coordinator.transact(change, next => updateStudy(next, sessionsChanged));
}

function recover(next) {
  if (!next.timer || next.timer.start === null) return false;
  next.timer = pause(next.timer);
  return true;
}

function withOwner(action) {
  return coordinator.claim(async token => {
    await transact(next => leaving ? false : action(next));
    if (!leaving && study.timer?.start != null) await token.lifetime;
  }, () => !leaving).finally(renderTimer);
}

function id() {
  return crypto.randomUUID();
}

function reportStorageError() {
  notice('Não foi possível acessar os dados do Mira neste navegador.');
}

$('timer-toggle').addEventListener('click', () => {
  const token = coordinator.owner;
  if (token && study.timer?.start != null) {
    transact(next => {
      if (coordinator.owner !== token || !next.timer || next.timer.start === null) return false;
      next.timer = pause(next.timer, Math.max(Date.now(), next.timer.checkpoint));
      return true;
    }).then(() => coordinator.release(token)).catch(reportStorageError);
  } else {
    withOwner(next => {
      recover(next);
      next.timer = next.timer ? resume(next.timer, Date.now()) : newTimer(id(), Date.now());
      return true;
    }).catch(reportStorageError);
  }
});

$('timer-finish').addEventListener('click', () => {
  let saved = false;
  function finish(next) {
    if (!next.timer) return false;
    const entries = timerSessions(next.timer, Date.now());
    if (!entries.length) {
      notice('Estude por pelo menos um segundo para salvar a sessão.');
      return false;
    }
    const existing = new Set(next.sessions.map(entry => entry.id));
    next.sessions.push(...entries.filter(entry => !existing.has(entry.id)));
    next.timer = null;
    saved = true;
    return true;
  }
  const token = coordinator.owner;
  const operation = token && study.timer?.start != null
    ? transact(next => coordinator.owner === token && finish(next), true)
      .then(() => { if (saved) coordinator.release(token); })
    : coordinator.claim(() => transact(next => {
      const recovered = recover(next);
      return finish(next) || recovered;
    }, true));
  operation.then(() => { if (saved) notice('Sessão de estudo registrada.'); }).catch(reportStorageError);
});

function tryRecover() {
  if (study.timer?.start != null && !coordinator.owner) withOwner(recover).catch(reportStorageError);
}

setInterval(() => {
  if (today !== localDay()) renderPage();
  renderTimer();
}, 250);

setInterval(() => {
  if (leaving) return;
  if (!coordinator.owner) {
    tryRecover();
    return;
  }
  const token = coordinator.owner;
  const sampledAt = Date.now();
  transact(next => {
    if (coordinator.owner !== token || !next.timer || next.timer.start === null) return false;
    next.timer = checkpoint(next.timer, sampledAt);
    return true;
  }).catch(reportStorageError);
}, 1000);

addEventListener('pagehide', () => {
  leaving = true;
  if (!coordinator.owner) return;
  const end = Date.now();
  const token = coordinator.owner;
  transact(next => {
    if (coordinator.owner !== token || !next.timer || next.timer.start === null) return false;
    next.timer = pause(next.timer, Math.max(end, next.timer.checkpoint));
    return true;
  }).catch(reportStorageError).finally(() => coordinator.release(token));
});

addEventListener('pageshow', () => {
  leaving = false;
  tryRecover();
});

addEventListener('storage', event => {
  try {
    if (event.key === STUDY_KEY || event.key === null) {
      const next = readStudy(localStorage);
      updateStudy(next, JSON.stringify(next.sessions) !== JSON.stringify(study.sessions));
    }
    if (event.key === SETTINGS_KEY || event.key === null) {
      settings = readSettings(localStorage);
      applyTheme();
      renderPage();
    }
  } catch {
    reportStorageError();
  }
});

function chooseDay(day) {
  selected = day;
  month = day.slice(0, 7) + '-01';
  year = day.slice(0, 4);
}

for (const calendar of [$('month-calendar'), $('heat-calendar')]) {
  calendar.addEventListener('click', event => {
    if (!event.target.dataset.day) return;
    chooseDay(event.target.dataset.day);
    renderHistory();
  });
}

$('heat-calendar').addEventListener('keydown', event => {
  const offsets = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -7, ArrowRight: 7 };
  const offset = offsets[event.key];
  const day = event.target.dataset.day;
  if (!day || !offset) return;
  event.preventDefault();
  const target = $('heat-calendar').querySelector(`[data-day="${shiftDay(day, offset)}"]`);
  if (target) {
    event.target.tabIndex = -1;
    target.tabIndex = 0;
    target.focus();
  }
});

function changeMonth(offset) {
  const target = dateFor(month);
  target.setMonth(target.getMonth() + offset);
  month = localDay(target);
  year = month.slice(0, 4);
  renderHistory();
}

for (const [name, offset] of [['prev', -1], ['next', 1]]) {
  $(`${name}-month`).addEventListener('click', () => changeMonth(offset));
  $(`${name}-year`).addEventListener('click', () => {
    year = String(Number(year) + offset).padStart(4, '0');
    renderHistory();
    $('heat-calendar').parentElement.scrollLeft = 0;
  });
}

const settingsForm = $('settings-form');
const sessionForm = $('session-form');

for (const button of document.querySelectorAll('[data-close]')) {
  button.addEventListener('click', () => button.closest('dialog').close());
}

function fillDuration(form, seconds) {
  form.elements.hours.value = Math.floor(seconds / 3600);
  form.elements.minutes.value = Math.floor(seconds / 60) % 60;
}

function formDuration(form) {
  return (form.elements.hours.valueAsNumber * 60 + form.elements.minutes.valueAsNumber) * 60;
}

function renderSettingsForm() {
  fillDuration(settingsForm, settings.goal);
  settingsForm.elements.palette.value = settings.palette;
  settings.limits.forEach((value, index) => { settingsForm.elements[`level${index + 1}`].value = value; });
  set('settings-error', '');
  set('appearance-error', '');
}

function changeTheme(theme) {
  try {
    const next = { ...readSettings(localStorage), theme };
    saveSettings(localStorage, next);
    settings = next;
    set('appearance-error', '');
  } catch {
    set('appearance-error', 'Não foi possível salvar o tema.');
  }
  applyTheme();
}

$('dark-mode').addEventListener('change', event => {
  if (settings.theme !== 'auto') changeTheme(event.target.checked ? 'dark' : 'light');
});

$('system-theme').addEventListener('change', event => {
  changeTheme(event.target.checked ? 'auto' : (systemTheme.matches ? 'dark' : 'light'));
});

settingsForm.addEventListener('submit', event => {
  event.preventDefault();
  const goal = formDuration(settingsForm);
  const limits = [1, 2, 3].map(index => settingsForm.elements[`level${index}`].valueAsNumber);
  if (!(goal > 0) || !validLimits(limits)) {
    set('settings-error', 'Informe uma meta maior que zero e três limites em ordem crescente.');
    return;
  }
  try {
    const next = { ...readSettings(localStorage), goal, limits, palette: settingsForm.elements.palette.value };
    saveSettings(localStorage, next);
    settings = next;
    applyTheme();
    renderPage();
    set('settings-error', '');
    notice('Configurações salvas.');
  } catch {
    set('settings-error', 'Não foi possível salvar as configurações.');
  }
});

function openSession(entry) {
  editing = entry?.id;
  const now = localDay();
  sessionForm.elements.date.max = now;
  sessionForm.elements.date.value = entry?.day ?? (selected <= now ? selected : now);
  fillDuration(sessionForm, entry?.seconds ?? 0);
  set('session-title', entry ? 'Editar sessão' : 'Adicionar sessão');
  set('session-error', '');
  const remainder = (entry?.seconds ?? 0) % 60;
  set('session-remainder', remainder ? `Os ${remainder}s do registro serão preservados.` : '');
  $('session-dialog').showModal();
}

$('session-add').addEventListener('click', () => openSession());

$('sessions').addEventListener('click', event => {
  const { edit, delete: remove } = event.target.dataset;
  if (edit) {
    const entry = study.sessions.find(item => item.id === edit);
    if (entry) openSession(entry);
  }
  if (remove) {
    deleting = remove;
    $('delete-dialog').showModal();
  }
});

sessionForm.addEventListener('submit', async event => {
  event.preventDefault();
  const day = sessionForm.elements.date.value;
  const wholeMinutes = formDuration(sessionForm);
  const sessionId = editing;
  if (!validDay(day) || day > localDay()) {
    set('session-error', 'Informe uma data válida até hoje.');
    return;
  }
  if (sessionForm.querySelector('[type="submit"]').disabled) return;
  sessionForm.querySelector('[type="submit"]').disabled = true;
  try {
    let error;
    await transact(next => {
      const previous = next.sessions.find(entry => entry.id === sessionId);
      const seconds = wholeMinutes + (previous?.seconds ?? 0) % 60;
      if (sessionId && !previous) {
        error = 'Esta sessão já foi excluída.';
        return false;
      }
      if (!(seconds > 0)) {
        error = 'Informe uma duração maior que zero.';
        return false;
      }
      const entry = sessionRecord(sessionId ?? id(), day, seconds, previous?.source ?? 'manual', Date.now(), previous);
      next.sessions = next.sessions.filter(item => item.id !== sessionId);
      next.sessions.push(entry);
      return true;
    }, true);
    if (error) {
      set('session-error', error);
      return;
    }
    $('session-dialog').close();
    chooseDay(day);
    renderPage();
    $('session-add').focus();
    notice(sessionId ? 'Sessão atualizada.' : 'Sessão adicionada.');
  } catch {
    set('session-error', 'Não foi possível salvar a sessão.');
  } finally {
    sessionForm.querySelector('[type="submit"]').disabled = false;
  }
});

$('delete-form').addEventListener('submit', async event => {
  event.preventDefault();
  const sessionId = deleting;
  const submit = $('delete-form').querySelector('[type="submit"]');
  if (submit.disabled) return;
  submit.disabled = true;
  try {
    await transact(next => {
      next.sessions = next.sessions.filter(entry => entry.id !== sessionId);
      return true;
    }, true);
    $('delete-dialog').close();
    $('session-add').focus();
    notice('Sessão excluída.');
  } catch {
    $('delete-dialog').close();
    reportStorageError();
  } finally {
    submit.disabled = false;
  }
});

systemTheme.addEventListener('change', applyTheme);
addEventListener('hashchange', navigate);
if (typeof ResizeObserver === 'function') {
  const nav = document.querySelector('.bottom-nav');
  new ResizeObserver(() => {
    document.documentElement.style.setProperty('--nav-height', `${nav.getBoundingClientRect().height}px`);
  }).observe(nav);
}
try {
  settings = readSettings(localStorage);
  updateStudy(readStudy(localStorage), true);
  tryRecover();
} catch {
  reportStorageError();
}
applyTheme();
navigate();
