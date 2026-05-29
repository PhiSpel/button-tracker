const STORAGE_KEY = 'button_log';

function logPress(color) {
  const now = new Date();
  const entry = {
    date: now.toLocaleDateString('en-CA'),
    time: now.toLocaleTimeString(),
    button: color,
  };
  const log = getLog();
  log.push(entry);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(log));

  const btn = document.querySelector(`.btn-${color}`);
  btn.classList.add('pressed');
  setTimeout(() => btn.classList.remove('pressed'), 150);
}

function getLog() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function renderTable() {
  const log = getLog();
  const byDate = {};

  for (const entry of log) {
    if (!byDate[entry.date]) byDate[entry.date] = { red: 0, green: 0 };
    if (entry.button === 'red' || entry.button === 'green') {
      byDate[entry.date][entry.button]++;
    }
  }

  const dates = Object.keys(byDate).sort().reverse();
  const tbody = document.getElementById('log-body');
  const table = document.getElementById('log-table');
  const empty = document.getElementById('empty-msg');

  tbody.innerHTML = '';

  if (dates.length === 0) {
    table.classList.add('hidden');
    empty.classList.remove('hidden');
    return;
  }

  table.classList.remove('hidden');
  empty.classList.add('hidden');

  for (const date of dates) {
    const dateCell = document.createElement('td');
    dateCell.textContent = date;

    const redCell = document.createElement('td');
    redCell.className = 'red-cell';
    redCell.textContent = byDate[date].red;

    const greenCell = document.createElement('td');
    greenCell.className = 'green-cell';
    greenCell.textContent = byDate[date].green;

    const tr = document.createElement('tr');
    tr.append(dateCell, redCell, greenCell);
    tbody.appendChild(tr);
  }
}

function renderExport() {
  const log = getLog();
  const count = document.getElementById('export-count');
  const btn = document.querySelector('.export-btn');
  const empty = document.getElementById('export-empty');

  if (log.length === 0) {
    count.classList.add('hidden');
    btn.classList.add('hidden');
    empty.classList.remove('hidden');
  } else {
    count.textContent = `${log.length} entr${log.length === 1 ? 'y' : 'ies'} recorded`;
    count.classList.remove('hidden');
    btn.classList.remove('hidden');
    empty.classList.add('hidden');
  }
}

function exportCSV() {
  const log = getLog();
  if (log.length === 0) return;

  const rows = [['Date', 'Time', 'Button']];
  for (const entry of log) {
    rows.push([entry.date, entry.time, entry.button]);
  }
  const csv = rows.map(r => r.join(',')).join('\n');
  const file = new File([csv], 'button-log.csv', { type: 'text/csv' });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    navigator.share({ files: [file] }).catch(() => {});
  } else {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'button-log.csv';
    a.click();
    URL.revokeObjectURL(url);
  }
}

const tabs = document.querySelectorAll('.tab');
const pages = document.querySelectorAll('.page');

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const page = tab.dataset.page;
    tabs.forEach(t => t.classList.remove('active'));
    pages.forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`page-${page}`).classList.add('active');
    if (page === 'log') renderTable();
    if (page === 'export') renderExport();
  });
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
}
