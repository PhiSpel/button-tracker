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
  const totals = Object.fromEntries(HOUR_BUCKETS.map(b => [b, { red: 0, green: 0, commentEntries: [] }]));
  const days = new Set(entries.map(e => e.date));

  for (const entry of entries) {
    const h = parseHour(entry.time);
    if (h === null) continue;
    const bucket = Math.floor(h / 3) * 3;
    if (entry.button === 'red') totals[bucket].red++;
    else if (entry.button === 'green') totals[bucket].green++;
    if (entry.comment) totals[bucket].commentEntries.push(entry);
  }

  const n = days.size || 1;
  const tbody = document.getElementById(bodyId);
  tbody.innerHTML = '';

  for (const b of HOUR_BUCKETS) {
    const tr = document.createElement('tr');
    const tCell = document.createElement('td');
    tCell.textContent = `${b}–${b + 3} h`;
    const rCell = document.createElement('td');
    rCell.className = 'red-cell';
    rCell.textContent = totals[b].red
      ? `${totals[b].red} (${(totals[b].red / n).toFixed(2)})`
      : '0';
    const gCell = document.createElement('td');
    gCell.className = 'green-cell';
    gCell.textContent = totals[b].green
      ? `${totals[b].green} (${(totals[b].green / n).toFixed(2)})`
      : '0';

    const cCell = document.createElement('td');
    const commented = totals[b].commentEntries;

    tr.append(tCell, rCell, gCell, cCell);
    tbody.appendChild(tr);

    if (commented.length > 0) {
      cCell.textContent = commented.length;
      cCell.className = 'comment-toggle';

      const detailRows = commented.map(e => {
        const dtr = document.createElement('tr');
        dtr.className = 'comment-row hidden';

        const dtCell = document.createElement('td');
        dtCell.textContent = `${e.date} ${e.time}`;
        dtCell.className = 'comment-time';

        const drCell = document.createElement('td');
        drCell.className = 'red-cell';
        if (e.button === 'red') drCell.textContent = '×';

        const dgCell = document.createElement('td');
        dgCell.className = 'green-cell';
        if (e.button === 'green') dgCell.textContent = '×';

        const dcCell = document.createElement('td');
        dcCell.textContent = e.comment;
        dcCell.className = 'comment-text';

        dtr.append(dtCell, drCell, dgCell, dcCell);
        return dtr;
      });

      cCell.addEventListener('click', () => {
        const opening = detailRows[0].classList.contains('hidden');
        detailRows.forEach(r => r.classList.toggle('hidden', !opening));
        cCell.classList.toggle('open', opening);
      });

      detailRows.forEach(r => tbody.appendChild(r));
    }
  }
}

function renderHourlySection(tableId, bodyId, emptyId, entries) {
  const hasData = entries.length > 0;
  document.getElementById(tableId).classList.toggle('hidden', !hasData);
  if (emptyId) document.getElementById(emptyId).classList.toggle('hidden', hasData);
  if (hasData) fillHourlyTable(bodyId, entries);
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
  const weekdays = [], weekends = [];
  for (const e of log) {
    const d = new Date(e.date).getDay();
    if (d >= 1 && d <= 5) weekdays.push(e); else weekends.push(e);
  }

  renderHourlySection('hourly-table', 'hourly-body', null, log);
  renderHourlySection('hourly-weekday-table', 'hourly-weekday-body', 'hourly-weekday-empty', weekdays);
  renderHourlySection('hourly-weekend-table', 'hourly-weekend-body', 'hourly-weekend-empty', weekends);
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
