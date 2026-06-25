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

function computeHourlyTotals(entries) {
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
  return { totals, n };
}

function fillHourlyTable(bodyId, entries) {
  const { totals, n } = computeHourlyTotals(entries);
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

function computeDailyTotals(log) {
  const byDate = {};

  for (const entry of log) {
    if (!byDate[entry.date]) byDate[entry.date] = { red: 0, green: 0, comments: 0 };
    if (entry.button === 'red' || entry.button === 'green') {
      byDate[entry.date][entry.button]++;
    }
    if (entry.comment) byDate[entry.date].comments++;
  }

  const dates = Object.keys(byDate).sort().reverse();
  return { byDate, dates };
}

function splitWeekdayWeekend(log) {
  const weekdays = [], weekends = [];
  for (const e of log) {
    const d = new Date(e.date).getDay();
    if (d >= 1 && d <= 5) weekdays.push(e); else weekends.push(e);
  }
  return { weekdays, weekends };
}

async function renderTable() {
  const log = await getAllEntries();
  const { byDate, dates } = computeDailyTotals(log);
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
  const { weekdays, weekends } = splitWeekdayWeekend(log);

  renderHourlySection('hourly-table', 'hourly-body', null, log);
  renderHourlySection('hourly-weekday-table', 'hourly-weekday-body', 'hourly-weekday-empty', weekdays);
  renderHourlySection('hourly-weekend-table', 'hourly-weekend-body', 'hourly-weekend-empty', weekends);
}

async function renderExport() {
  const log = await getAllEntries();
  const count = document.getElementById('export-count');
  const buttons = document.querySelector('.export-buttons');
  const empty = document.getElementById('export-empty');

  if (log.length === 0) {
    count.classList.add('hidden');
    buttons.classList.add('hidden');
    empty.classList.remove('hidden');
  } else {
    count.textContent = `${log.length} entr${log.length === 1 ? 'y' : 'ies'} recorded`;
    count.classList.remove('hidden');
    buttons.classList.remove('hidden');
    empty.classList.add('hidden');
  }
}

function csvCell(val) {
  const s = val == null ? '' : String(val);
  return (s.includes(',') || s.includes('"') || s.includes('\n'))
    ? '"' + s.replace(/"/g, '""') + '"'
    : s;
}

function downloadCSV(rows, filename) {
  const csv = rows.map(r => r.map(csvCell).join(',')).join('\n');
  const file = new File([csv], filename, { type: 'text/csv' });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    navigator.share({ files: [file] }).catch(() => {});
  } else {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}

function buildDailyCSV(log) {
  const { byDate, dates } = computeDailyTotals(log);
  const rows = [['Date', 'Red', 'Green', 'Comments']];
  for (const date of dates) {
    rows.push([date, byDate[date].red, byDate[date].green, byDate[date].comments]);
  }
  return rows;
}

function buildHourlyCSV(entries) {
  const { totals, n } = computeHourlyTotals(entries);
  const rows = [['Time slot', 'Total Red', 'Avg Red', 'Total Green', 'Avg Green', 'Comments']];
  for (const b of HOUR_BUCKETS) {
    const t = totals[b];
    rows.push([
      `${b}-${b + 3}h`,
      t.red,
      (t.red / n).toFixed(2),
      t.green,
      (t.green / n).toFixed(2),
      t.commentEntries.length,
    ]);
  }
  return rows;
}

function buildTableHead(headers) {
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  for (const h of headers) {
    const th = document.createElement('th');
    th.textContent = h;
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);
  return thead;
}

function buildAggregateTable(headers, rows, emptyMessage) {
  const table = document.createElement('table');
  table.appendChild(buildTableHead(headers));

  const tbody = document.createElement('tbody');
  for (const cells of rows) {
    const tr = document.createElement('tr');
    cells.forEach((cell, i) => {
      const td = document.createElement('td');
      td.textContent = cell;
      if (i === 1) td.className = 'red-cell';
      if (i === 2) td.className = 'green-cell';
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);

  if (rows.length === 0) {
    const p = document.createElement('p');
    p.className = 'section-empty';
    p.textContent = emptyMessage;
    return [table, p];
  }
  return [table];
}

function buildDailySection(log) {
  const { byDate, dates } = computeDailyTotals(log);
  const rows = dates.map(date => [date, byDate[date].red, byDate[date].green, byDate[date].comments || '']);
  return buildAggregateTable(['Date', 'Red', 'Green', 'Comments'], rows, 'No presses logged yet.');
}

const HOURLY_HEADERS = ['Time slot', 'Total Red (Avg)', 'Total Green (Avg)', 'Comments'];

function buildHourlySection(entries, emptyMessage) {
  if (entries.length === 0) {
    return buildAggregateTable(HOURLY_HEADERS, [], emptyMessage);
  }

  const { totals, n } = computeHourlyTotals(entries);
  const table = document.createElement('table');
  table.appendChild(buildTableHead(HOURLY_HEADERS));

  const tbody = document.createElement('tbody');
  for (const b of HOUR_BUCKETS) {
    const t = totals[b];
    const tr = document.createElement('tr');
    const tCell = document.createElement('td');
    tCell.textContent = `${b}–${b + 3} h`;
    const rCell = document.createElement('td');
    rCell.className = 'red-cell';
    rCell.textContent = t.red ? `${t.red} (${(t.red / n).toFixed(2)})` : '0';
    const gCell = document.createElement('td');
    gCell.className = 'green-cell';
    gCell.textContent = t.green ? `${t.green} (${(t.green / n).toFixed(2)})` : '0';
    const cCell = document.createElement('td');
    cCell.textContent = t.commentEntries.length || '';
    tr.append(tCell, rCell, gCell, cCell);
    tbody.appendChild(tr);

    for (const e of t.commentEntries) {
      const dtr = document.createElement('tr');
      dtr.className = 'comment-row';

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
      tbody.appendChild(dtr);
    }
  }
  table.appendChild(tbody);
  return [table];
}

function buildPdfReport(log) {
  const { weekdays, weekends } = splitWeekdayWeekend(log);
  const sections = [
    ['Daily logs', buildDailySection(log)],
    ['3-Hourly', buildHourlySection(log, 'No presses logged yet.')],
    ['3-hourly weekdays', buildHourlySection(weekdays, 'No weekday data yet.')],
    ['3-hourly weekends', buildHourlySection(weekends, 'No weekend data yet.')],
  ];

  return sections.map(([title, children]) => {
    const section = document.createElement('section');
    section.className = 'pdf-section';
    const h2 = document.createElement('h2');
    h2.textContent = title;
    section.append(h2, ...children);
    return section;
  });
}

async function exportPdfReport() {
  const log = await getAllEntries();
  if (log.length === 0) return;

  const report = document.getElementById('pdf-report');
  report.innerHTML = '';
  report.append(...buildPdfReport(log));

  document.body.classList.add('printing-report');

  // Give the browser a chance to paint the new layout before printing —
  // calling window.print() synchronously right after the DOM mutation can
  // make some browsers (e.g. Firefox) snapshot the page for the actual
  // print/PDF output before the change has taken effect, even though the
  // print preview itself re-renders live.
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  window.print();
}

window.addEventListener('afterprint', () => {
  // Firefox fires 'afterprint' as soon as the print dialog closes, but the
  // actual PDF file (when "Save to PDF" is chosen) is rendered asynchronously
  // afterwards. Removing the printing-report class right away can make that
  // later render pass run against the normal screen layout instead of the
  // report, producing a PDF of the export page plus blank pages. Delay the
  // cleanup so the async render has time to use the correct layout.
  setTimeout(() => {
    document.body.classList.remove('printing-report');
  }, 2000);
});

async function exportCSV() {
  const log = await getAllEntries();
  if (log.length === 0) return;

  const rows = [['Date', 'Time', 'Button', 'Comment']];
  for (const entry of log) {
    rows.push([entry.date, entry.time, entry.button, entry.comment ?? '']);
  }
  downloadCSV(rows, 'button-log.csv');
}

async function exportDailyCSV() {
  const log = await getAllEntries();
  if (log.length === 0) return;
  downloadCSV(buildDailyCSV(log), 'button-log-daily.csv');
}

async function exportHourlyCSV() {
  const log = await getAllEntries();
  if (log.length === 0) return;
  downloadCSV(buildHourlyCSV(log), 'button-log-3-hourly.csv');
}

async function exportHourlyWeekdayCSV() {
  const log = await getAllEntries();
  const { weekdays } = splitWeekdayWeekend(log);
  if (weekdays.length === 0) return;
  downloadCSV(buildHourlyCSV(weekdays), 'button-log-3-hourly-weekdays.csv');
}

async function exportHourlyWeekendCSV() {
  const log = await getAllEntries();
  const { weekends } = splitWeekdayWeekend(log);
  if (weekends.length === 0) return;
  downloadCSV(buildHourlyCSV(weekends), 'button-log-3-hourly-weekends.csv');
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

document.querySelector('.btn-red').addEventListener('click', () => logPress('red'));
document.querySelector('.btn-green').addEventListener('click', () => logPress('green'));

const EXPORTERS = {
  'pdf-report': exportPdfReport,
  raw: exportCSV,
  daily: exportDailyCSV,
  hourly: exportHourlyCSV,
  'hourly-weekday': exportHourlyWeekdayCSV,
  'hourly-weekend': exportHourlyWeekendCSV,
};

document.querySelector('.export-buttons').addEventListener('click', e => {
  const btn = e.target.closest('.export-btn');
  if (!btn) return;
  EXPORTERS[btn.dataset.export]?.();
});

const helpBtn = document.getElementById('help-btn');
const modalOverlay = document.getElementById('modal-overlay');
const modalClose = document.getElementById('modal-close');

helpBtn.addEventListener('click', () => modalOverlay.classList.remove('hidden'));
modalClose.addEventListener('click', () => modalOverlay.classList.add('hidden'));
modalOverlay.addEventListener('click', e => {
  if (e.target === modalOverlay) modalOverlay.classList.add('hidden');
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') modalOverlay.classList.add('hidden');
});
