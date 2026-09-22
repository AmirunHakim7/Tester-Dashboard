// script.js — Firebase Firestore Version
// ═══════════════════════════════════════════════════════
// STRUKTUR FIRESTORE:
//   Collection "testers"   → doc {no, name, unit}
//   Collection "schedule"  → doc id: "testerNo|YYYY-MM-DD" {text, type}
// ═══════════════════════════════════════════════════════

const DEFAULT_TESTERS = [
  { no: 1, name: 'Muhd Mustain Bin Mohd Nazir', unit: 'TESTING UNIT' },
  { no: 2, name: 'Saharuddin Bin Sulaiman',     unit: 'TESTING UNIT' },
  { no: 3, name: 'Muhammad Adib Bin Shaari',    unit: 'TESTING UNIT' },
  { no: 4, name: 'Muhammad Amirun Hakim',       unit: 'TESTING UNIT' },
  { no: 6, name: 'Shafiqah Binti Mohd Azni',    unit: 'TESTING UNIT' },
  { no: 7, name: 'Muhammad Aiman - (ANPR COS)', unit: 'TESTING UNIT' },
  { no: 8, name: 'Ahmad Fikry - (LRF COS)',     unit: 'TESTING UNIT' },
  { no: 9, name: 'M. Syahrul Amri - (LRF COS)', unit: 'TESTING UNIT' },
];

let testers = [];
let schedule = {};
let currentMonday = getMonday(new Date());
let editingTesterNo = null;
let FB = null;

// ═══════════════════════════════════════════════════════
// TARIKH HELPERS (TIMEZONE-SAFE)
// ═══════════════════════════════════════════════════════
function toLocalDateStr(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getMonday(baseDate) {
  const d = new Date(baseDate);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function getWeekDates(monday) {
  const days = [];
  const dayNames = ['MON','TUE','WED','THU','FRI','SAT','SUN'];
  for (let i = 0; i < 7; i++) {
    const cur = new Date(monday);
    cur.setDate(monday.getDate() + i);
    cur.setHours(0, 0, 0, 0);
    days.push({
      name: dayNames[i],
      dateStr: toLocalDateStr(cur),
      isWeekend: i >= 5
    });
  }
  return days;
}

function formatShortDate(dateStr) {
  const months = ['Jan','Feb','Mac','Apr','Mei','Jun','Jul','Ogo','Sep','Okt','Nov','Dis'];
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${d}-${months[m - 1]}`;
}

function getWeekNumber(d) {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const week1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

// ═══════════════════════════════════════════════════════
// FIREBASE OPERATIONS
// ═══════════════════════════════════════════════════════

function setSyncBadge(status, text) {
  const el = document.getElementById('syncBadge');
  if (!el) return;
  el.className = 'sync-badge ' + status;
  el.innerHTML = `<i class="fas fa-circle"></i> ${text}`;
}

// Listen testers secara realtime
function listenTesters() {
  const { db, collection, onSnapshot, doc, setDoc } = FB;
  onSnapshot(collection(db, 'testers'), async (snap) => {
    if (snap.empty) {
      console.log('[QA] Firestore testers kosong, seeding default...');
      for (const t of DEFAULT_TESTERS) {
        try {
          await setDoc(doc(db, 'testers', String(t.no)), t);
        } catch(e) {
          console.error('[QA] Seed error:', e);
        }
      }
      return;
    }
    testers = snap.docs.map(d => d.data());
    testers.sort((a, b) => a.no - b.no);
    console.log('[QA] Testers updated:', testers.length);
    renderAll();
  }, (err) => {
    console.error('[QA] testers listener error:', err);
    setSyncBadge('offline', 'Offline');
  });
}

// Listen schedule secara realtime
function listenSchedule() {
  const { db, collection, onSnapshot } = FB;
  onSnapshot(collection(db, 'schedule'), (snap) => {
    schedule = {};
    snap.forEach(d => { schedule[d.id] = d.data(); });
    console.log('[QA] Schedule updated:', Object.keys(schedule).length);
    renderAll();
  }, (err) => {
    console.error('[QA] schedule listener error:', err);
  });
}

// Simpan tester
async function setTester(tester) {
  const { db, doc, setDoc } = FB;
  await setDoc(doc(db, 'testers', String(tester.no)), tester);
  console.log('[QA] Tester saved:', tester.no, tester.name);
}

// Padam tester
async function removeTester(no) {
  const { db, doc, deleteDoc } = FB;
  await deleteDoc(doc(db, 'testers', String(no)));
  console.log('[QA] Tester deleted:', no);
}

// Simpan schedule cell
async function setScheduleCell(k, data) {
  const { db, doc, setDoc, deleteDoc } = FB;
  if (!data.text && !data.type) {
    await deleteDoc(doc(db, 'schedule', k));
  } else {
    await setDoc(doc(db, 'schedule', k), data);
  }
}

// Padam banyak schedule (untuk clear minggu)
async function removeScheduleBulk(keys) {
  const { db, doc, deleteDoc } = FB;
  for (const k of keys) {
    await deleteDoc(doc(db, 'schedule', k));
  }
}

function key(testerNo, dateStr) { return `${testerNo}|${dateStr}`; }

// ═══════════════════════════════════════════════════════
// RENDER
// ═══════════════════════════════════════════════════════

function renderHeader(days) {
  const thead = document.getElementById('rosterHead');
  let row1 = `<tr>
    <th class="col-unit" rowspan="2">Unit</th>
    <th class="col-no" rowspan="2">No</th>
    <th class="col-name" rowspan="2">Name</th>
    <th class="col-action" rowspan="2"><i class="fas fa-cog"></i></th>`;
  days.forEach(d => {
    row1 += `<th class="col-day ${d.isWeekend ? 'weekend-head' : ''}">${d.name}</th>`;
  });
  row1 += `</tr>`;

  let row2 = `<tr>`;
  days.forEach(d => {
    row2 += `<th class="date-head ${d.isWeekend ? 'weekend-head' : ''}">${formatShortDate(d.dateStr)}</th>`;
  });
  row2 += `</tr>`;

  thead.innerHTML = row1 + row2;
}

function renderBody(days) {
  const tbody = document.getElementById('rosterBody');

  if (testers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${days.length + 4}" style="padding:2rem;color:#94a3b8;">
      Memuatkan tester...
    </td></tr>`;
    return;
  }

  let html = '';
  testers.forEach((t, idx) => {
    html += `<tr>`;
    if (idx === 0) {
      html += `<td class="col-unit" rowspan="${testers.length}">${t.unit || 'TESTING UNIT'}</td>`;
    }
    html += `<td class="col-no">${t.no}</td>`;
    html += `<td class="col-name" data-no="${t.no}" title="Klik untuk edit">${t.name}</td>`;
    html += `<td class="col-action"><button data-no="${t.no}" class="del-tester-btn" title="Padam tester"><i class="fas fa-trash"></i></button></td>`;

    days.forEach(d => {
      const k = key(t.no, d.dateStr);
      const cell = schedule[k] || { text: '', type: '' };
      const classes = ['cell'];
      if (cell.type) classes.push(cell.type);
      if (d.isWeekend && !cell.type) classes.push('weekend');
      if (!cell.text) classes.push('empty');

      const displayText = cell.text || (d.isWeekend ? '' : '—');
      html += `<td class="${classes.join(' ')}"
                   data-no="${t.no}"
                   data-date="${d.dateStr}"
                   data-weekend="${d.isWeekend}">
                   ${displayText}
               </td>`;
    });
    html += `</tr>`;
  });

  tbody.innerHTML = html;

  document.querySelectorAll('td.cell').forEach(cell => {
    cell.addEventListener('click', () => openModal(cell));
  });
  document.querySelectorAll('td.col-name').forEach(cell => {
    cell.addEventListener('click', () => openTesterModal(parseInt(cell.dataset.no)));
  });
  document.querySelectorAll('.del-tester-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteTester(parseInt(btn.dataset.no));
    });
  });
}

function renderAll() {
  const days = getWeekDates(currentMonday);
  renderHeader(days);
  renderBody(days);
  updateWeekBadge(days);
}

function updateWeekBadge(days) {
  const firstStr = days[0].dateStr;
  const lastStr = days[6].dateStr;
  const week = getWeekNumber(new Date(firstStr + 'T00:00:00'));
  const todayMondayStr = toLocalDateStr(getMonday(new Date()));
  const isCurrent = firstStr === todayMondayStr;
  const label = isCurrent ? ' · Minggu Ini' : '';
  document.getElementById('weekBadge').textContent =
    `Week ${week} · ${formatShortDate(firstStr)} – ${formatShortDate(lastStr)}${label}`;
}

// ═══════════════════════════════════════════════════════
// MODAL: EDIT SEL
// ═══════════════════════════════════════════════════════

let activeCell = null;
const modal = document.getElementById('modal');
const modalText = document.getElementById('modalText');
const modalType = document.getElementById('modalType');
const modalTitle = document.getElementById('modalTitle');

function openModal(cell) {
  activeCell = cell;
  const no = cell.dataset.no;
  const dateStr = cell.dataset.date;
  const k = key(no, dateStr);
  const data = schedule[k] || { text: '', type: '' };

  const tester = testers.find(t => t.no == no);
  modalTitle.textContent = `${tester ? tester.name : '?'} — ${formatShortDate(dateStr)}`;

  modalText.value = data.text || '';
  modalType.value = data.type || '';
  modal.classList.add('active');
  setTimeout(() => modalText.focus(), 100);
}

function closeModal() {
  modal.classList.remove('active');
  activeCell = null;
}

document.getElementById('modalCancel').addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

document.getElementById('modalSave').addEventListener('click', async () => {
  if (!activeCell) return;
  const no = activeCell.dataset.no;
  const dateStr = activeCell.dataset.date;
  const k = key(no, dateStr);
  const text = modalText.value.trim();
  const type = modalType.value;

  try {
    setSyncBadge('connecting', 'Menyimpan...');
    await setScheduleCell(k, { text, type });
    setSyncBadge('online', 'Online');
    closeModal();
  } catch (err) {
    alert('Gagal simpan: ' + err.message);
    setSyncBadge('offline', 'Ralat');
  }
});

modalText.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('modalSave').click();
});

// ═══════════════════════════════════════════════════════
// MODAL: TESTER
// ═══════════════════════════════════════════════════════

const testerModal = document.getElementById('testerModal');
const testerName = document.getElementById('testerName');
const testerNo = document.getElementById('testerNo');
const testerUnit = document.getElementById('testerUnit');
const testerModalTitle = document.getElementById('testerModalTitle');
const testerDeleteBtn = document.getElementById('testerDelete');

function openTesterModal(no = null) {
  editingTesterNo = no;
  if (no !== null) {
    const t = testers.find(x => x.no === no);
    if (!t) return;
    testerModalTitle.textContent = 'Edit Tester';
    testerName.value = t.name;
    testerNo.value = t.no;
    testerUnit.value = t.unit || 'TESTING UNIT';
    testerDeleteBtn.style.display = 'block';
  } else {
    testerModalTitle.textContent = 'Tambah Tester';
    testerName.value = '';
    const maxNo = testers.length ? Math.max(...testers.map(t => t.no)) : 0;
    testerNo.value = maxNo + 1;
    testerUnit.value = testers[0]?.unit || 'TESTING UNIT';
    testerDeleteBtn.style.display = 'none';
  }
  testerModal.classList.add('active');
  setTimeout(() => testerName.focus(), 100);
}

function closeTesterModal() {
  testerModal.classList.remove('active');
  editingTesterNo = null;
}

document.getElementById('addTesterBtn').addEventListener('click', () => openTesterModal(null));
document.getElementById('testerCancel').addEventListener('click', closeTesterModal);
testerModal.addEventListener('click', (e) => { if (e.target === testerModal) closeTesterModal(); });

document.getElementById('testerSave').addEventListener('click', async () => {
  const name = testerName.value.trim();
  const no = parseInt(testerNo.value);
  const unit = testerUnit.value.trim() || 'TESTING UNIT';

  if (!name) { alert('Sila isi nama tester.'); return; }
  if (!no || no < 1) { alert('No. tidak sah.'); return; }

  const dup = testers.find(t => t.no === no && t.no !== editingTesterNo);
  if (dup) { alert(`No. ${no} sudah digunakan oleh ${dup.name}.`); return; }

  try {
    setSyncBadge('connecting', 'Menyimpan...');
    if (editingTesterNo !== null && editingTesterNo !== no) {
      await removeTester(editingTesterNo);
    }
    await setTester({ no, name, unit });
    setSyncBadge('online', 'Online');
    closeTesterModal();
  } catch (err) {
    alert('Gagal simpan: ' + err.message);
    setSyncBadge('offline', 'Ralat');
  }
});

testerDeleteBtn.addEventListener('click', () => {
  if (editingTesterNo === null) return;
  deleteTester(editingTesterNo);
  closeTesterModal();
});

testerName.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('testerSave').click();
});

async function deleteTester(no) {
  const t = testers.find(x => x.no === no);
  if (!t) return;
  if (!confirm(`Padam tester "${t.name}"? Semua task dia akan turut dipadam.`)) return;

  try {
    setSyncBadge('connecting', 'Memadam...');
    await removeTester(no);
    const keysToDelete = Object.keys(schedule).filter(k => k.startsWith(`${no}|`));
    await removeScheduleBulk(keysToDelete);
    setSyncBadge('online', 'Online');
  } catch (err) {
    alert('Gagal padam: ' + err.message);
    setSyncBadge('offline', 'Ralat');
  }
}

// ═══════════════════════════════════════════════════════
// NAVIGASI MINGGU
// ═══════════════════════════════════════════════════════

document.getElementById('prevWeekBtn').addEventListener('click', () => {
  currentMonday.setDate(currentMonday.getDate() - 7);
  currentMonday.setHours(0, 0, 0, 0);
  renderAll();
});
document.getElementById('nextWeekBtn').addEventListener('click', () => {
  currentMonday.setDate(currentMonday.getDate() + 7);
  currentMonday.setHours(0, 0, 0, 0);
  renderAll();
});
document.getElementById('todayBtn').addEventListener('click', () => {
  currentMonday = getMonday(new Date());
  renderAll();
});

// ═══════════════════════════════════════════════════════
// CLEAR MINGGU SEMASA
// ═══════════════════════════════════════════════════════

document.getElementById('clearAllBtn').addEventListener('click', async () => {
  const days = getWeekDates(currentMonday);
  const startStr = days[0].dateStr;
  const endStr = days[6].dateStr;

  const keysToDelete = Object.keys(schedule).filter(k => {
    const datePart = k.split('|')[1];
    return datePart >= startStr && datePart <= endStr;
  });

  if (keysToDelete.length === 0) { alert('Tiada data untuk dipadam minggu ini.'); return; }
  if (!confirm(`Padam semua data untuk minggu ${formatShortDate(startStr)} – ${formatShortDate(endStr)}?`)) return;

  try {
    setSyncBadge('connecting', 'Memadam...');
    await removeScheduleBulk(keysToDelete);
    setSyncBadge('online', 'Online');
  } catch (err) {
    alert('Gagal padam: ' + err.message);
    setSyncBadge('offline', 'Ralat');
  }
});

// ═══════════════════════════════════════════════════════
// INIT — tunggu Firebase ready
// ═══════════════════════════════════════════════════════

window.addEventListener('firebase-ready', () => {
  console.log('[QA] Firebase ready, mula listen...');
  FB = window.FB;
  setSyncBadge('connecting', 'Menyambung...');

  listenTesters();
  listenSchedule();

  // Update badge jadi online bila dah 2 saat tanpa error
  setTimeout(() => {
    setSyncBadge('online', 'Online');
  }, 2000);

  renderAll();
});