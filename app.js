const DB_NAME = 'tracker';
const STORE = 'presses';

const dbPromise = new Promise((resolve, reject) => {
  const req = indexedDB.open(DB_NAME, 1);
  req.onupgradeneeded = e => {
    e.target.result.createObjectStore(STORE, { autoIncrement: true });
  };
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

function addEntry(entry) {
  return dbPromise.then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).add(entry);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  }));
}

function getAllEntries() {
  return dbPromise.then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}

function logPress(color) {
  const now = new Date();
  const btn = document.querySelector(`.btn-${color}`);
  btn.classList.add('pressed');
  setTimeout(() => btn.classList.remove('pressed'), 150);

  const commentEl = document.getElementById('comment-input');
  const comment = commentEl.value.trim();

  addEntry({
    date: now.toLocaleDateString('en-CA'),
    time: now.toLocaleTimeString(),
    button: color,
    comment,
  }).then(() => {
    commentEl.value = '';
  }).catch(err => console.error('Failed to save:', err));
}

function parseHour(timeStr) {
  if (!timeStr) return null;
  const m12 = timeStr.match(/(\d{1,2}):\d{2}(?::\d{2})?\s*(AM|PM)/i);
  if (m12) {
    let h = parseInt(m12[1], 10);
    if (m12[2].toUpperCase() === 'AM' && h === 12) h = 0;
    if (m12[2].toUpperCase() === 'PM' && h !== 12) h += 12;
    return h;
  }
  const m24 = timeStr.match(/^(\d{1,2}):\d{2}/);
  return m24 ? parseInt(m24[1], 10) : null;
}

const HOUR_BUCKETS = [0, 3, 6, 9, 12, 15, 18, 21];

function fillHourlyTable(bodyId, entries) {
  const totals = Object.fromEntries(HOUR_BUCKETS.map(b => [b, { red: 0, green: 0 }]));
  const days = new Set(entries.map(e => e.date));

  for (const entry of entries) {
    const h = parseHour(entry.time);
    if (h === null) continue;
    const bucket = Math.floor(h / 3) * 3;
    if (entry.button === 'red') totals[bucket].red++;
    else if (entry.button === 'green') totals[bucket].green++;
  }

  const n = days.size || 1;
  const tbody = document.getElementById(bodyId);
  tbody.innerHTML = '';

  for (const b of HOUR_BUCKETS) {
    const h1 = String(b).padStart(2, '0');
    const h2 = String(b + 2).padStart(2, '0');
    const tr = document.createElement('tr');
    const tCell = document.createElement('td');
    tCell.textContent = `${h1}:00–${h2}:59`;
    const rCell = document.createElement('td');
    rCell.className = 'red-cell';
    rCell.textContent = (totals[b].red / n).toFixed(2);
    const gCell = document.createElement('td');
    gCell.className = 'green-cell';
    gCell.textContent = (totals[b].green / n).toFixed(2);
    tr.append(tCell, rCell, gCell);
    tbody.appendChild(tr);
  }
}

async function renderTable() {
  const log = await getAllEntries();
  const byDate = {};

  for (const entry of log) {
    if (!byDate[entry.date]) byDate[entry.date] = { red: 0, green: 0, comments: 0 };
    if (entry.button === 'red' || entry.button === 'green') {
      byDate[entry.date][entry.button]++;
    }
    if (entry.comment) byDate[entry.date].comments++;
  }

  const dates = Object.keys(byDate).sort().reverse();
  const tbody = document.getElementById('log-body');
  const table = document.getElementById('log-table');
  const empty = document.getElementById('empty-msg');

  tbody.innerHTML = '';

  if (dates.length === 0) {
    table.classList.add('hidden');
    ['hourly-table', 'hourly-weekday-table', 'hourly-weekend-table'].forEach(id =>
      document.getElementById(id).classList.add('hidden')
    );
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

    const commentsCell = document.createElement('td');
    commentsCell.textContent = byDate[date].comments || '';

    const tr = document.createElement('tr');
    tr.append(dateCell, redCell, greenCell, commentsCell);
    tbody.appendChild(tr);
  }

  // 3-hourly tables
  const weekdays = log.filter(e => { const d = new Date(e.date).getDay(); return d >= 1 && d <= 5; });
  const weekends = log.filter(e => { const d = new Date(e.date).getDay(); return d === 0 || d === 6; });

  document.getElementById('hourly-table').classList.remove('hidden');
  fillHourlyTable('hourly-body', log);

  const weekdayTable = document.getElementById('hourly-weekday-table');
  if (weekdays.length > 0) {
    weekdayTable.classList.remove('hidden');
    fillHourlyTable('hourly-weekday-body', weekdays);
  } else {
    weekdayTable.classList.add('hidden');
  }

  const weekendTable = document.getElementById('hourly-weekend-table');
  if (weekends.length > 0) {
    weekendTable.classList.remove('hidden');
    fillHourlyTable('hourly-weekend-body', weekends);
  } else {
    weekendTable.classList.add('hidden');
  }
}

async function renderExport() {
  const log = await getAllEntries();
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

function csvCell(val) {
  const s = val == null ? '' : String(val);
  return (s.includes(',') || s.includes('"') || s.includes('\n'))
    ? '"' + s.replace(/"/g, '""') + '"'
    : s;
}

async function exportCSV() {
  const log = await getAllEntries();
  if (log.length === 0) return;

  const rows = [['Date', 'Time', 'Button', 'Comment']];
  for (const entry of log) {
    rows.push([entry.date, entry.time, entry.button, entry.comment ?? ''].map(csvCell));
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
