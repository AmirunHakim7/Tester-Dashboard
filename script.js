// script.js — Full version + Mobile Touch + Keyboard Nav + Context Menu + Screenshot Fix
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

const WEEKS_BEFORE_ARCHIVE = 4;
const TRASH_RETENTION_DAYS = 30;
let archiveChecked = false;
let archiveLoaded = new Set();

let testers = [];
let schedule = {};
let trashItems = [];
let currentMonday = getMonday(new Date());
let editingTesterNo = null;
let FB = null;
let searchQuery = '';

// CHART
let charts = { bar: null, doughnut: null, line: null };
const CHART_COLORS = {
  office: '#10b981', wfh: '#3b82f6', al: '#f59e0b',
  mc: '#ef4444', task: '#8b5cf6', public: '#eab308', 
  others: '#f97316', kosong: '#cbd5e1'
};

// KEYBOARD NAVIGATION
let focusedCell = null;

// MOBILE DETECTION
const IS_MOBILE = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
                  || window.matchMedia('(max-width: 768px)').matches;

// ═══════════════════════════════════════════════════════
// TOAST NOTIFICATION
// ═══════════════════════════════════════════════════════

function ensureToastContainer() {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  return container;
}

function showToast(type, title, message, duration = 3000) {
  const container = ensureToastContainer();
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const icons = {
    success: 'fa-check-circle',
    error: 'fa-times-circle',
    warning: 'fa-exclamation-triangle',
    info: 'fa-info-circle'
  };
  
  toast.innerHTML = `
    <i class="fas ${icons[type] || 'fa-info-circle'} toast-icon"></i>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      ${message ? `<div class="toast-message">${message}</div>` : ''}
    </div>
    <button class="toast-close"><i class="fas fa-times"></i></button>
  `;
  
  container.appendChild(toast);
  
  const removeToast = () => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 300);
  };
  
  toast.querySelector('.toast-close').addEventListener('click', removeToast);
  
  if (duration > 0) {
    setTimeout(removeToast, duration);
  }
}

// ═══════════════════════════════════════════════════════
// LOADING SKELETON
// ═══════════════════════════════════════════════════════

function showSkeletonLoader(days) {
  const tbody = document.getElementById('rosterBody');
  if (!tbody) return;
  
  const rowCount = 8;
  let html = '';
  
  for (let r = 0; r < rowCount; r++) {
    html += `<tr>`;
    if (r === 0) {
      html += `<td class="col-unit" rowspan="${rowCount}">
        <div class="col-unit-inner">TESTING UNIT</div>
      </td>`;
    }
    html += `<td class="col-no"><div class="skeleton-no"></div></td>`;
    html += `<td class="col-name"><div class="skeleton-name"></div></td>`;
    html += `<td class="col-action"></td>`;
    
    days.forEach(d => {
      const classes = ['cell', 'empty'];
      if (d.isWeekend) classes.push('weekend');
      html += `<td class="${classes.join(' ')}">
        <div class="skeleton-cell"></div>
      </td>`;
    });
    html += `<td class="col-summary al-sum"></td>`;
    html += `<td class="col-summary mc-sum"></td>`;
    html += `</tr>`;
  }
  
  tbody.innerHTML = html;
}

// TARIKH HELPERS
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
    days.push({ name: dayNames[i], dateStr: toLocalDateStr(cur), isWeekend: i >= 5 });
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

function expandDates(dateStr, dateEnd) {
  const dates = [];
  const start = new Date(dateStr + 'T00:00:00');
  const end = new Date((dateEnd || dateStr) + 'T00:00:00');
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(toLocalDateStr(d));
  }
  return dates;
}

function getTimeAgo(date) {
  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 60) return 'baru sahaja';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} minit lalu`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} jam lalu`;
  const day = Math.floor(hr / 24);
  return `${day} hari lalu`;
}

function getArchiveCutoffDate() {
  const cutoff = getMonday(new Date());
  cutoff.setDate(cutoff.getDate() - (WEEKS_BEFORE_ARCHIVE * 7));
  cutoff.setHours(0, 0, 0, 0);
  return cutoff;
}

function isArchivedDate(dateStr) {
  const cutoffStr = toLocalDateStr(getArchiveCutoffDate());
  return dateStr < cutoffStr;
}

// ═══════════════════════════════════════════════════════
// WEEK NAVIGATION
// ═══════════════════════════════════════════════════════

function syncWeekPicker() {
  const picker = document.getElementById('weekPicker');
  if (!picker) return;
  
  const todayMondayStr = toLocalDateStr(getMonday(new Date()));
  const currentMondayStr = toLocalDateStr(currentMonday);
  
  if (todayMondayStr === currentMondayStr) {
    picker.value = toLocalDateStr(new Date());
  } else {
    picker.value = currentMondayStr;
  }
}

function initWeekNavigation() {
  const picker = document.getElementById('weekPicker');
  if (!picker) return;

  picker.addEventListener('change', (e) => {
    const val = e.target.value;
    if (!val) return;
    const picked = new Date(val + 'T00:00:00');
    if (isNaN(picked.getTime())) return;
    currentMonday = getMonday(picked);
    clearSelection();
    renderAll();
    syncWeekPicker();
  });

  document.querySelectorAll('.quick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const n = parseInt(btn.dataset.jump, 10);
      if (isNaN(n)) return;
      currentMonday.setDate(currentMonday.getDate() + (n * 7));
      currentMonday.setHours(0, 0, 0, 0);
      clearSelection();
      renderAll();
      syncWeekPicker();
    });
  });
}

// FIREBASE
function setSyncBadge(status, text) {
  const el = document.getElementById('syncBadge');
  if (!el) return;
  el.className = 'sync-badge ' + status;
  el.innerHTML = `<i class="fas fa-circle"></i> ${text}`;
}

function listenTesters() {
  const { db, collection, onSnapshot, doc, setDoc } = FB;
  onSnapshot(collection(db, 'testers'), async (snap) => {
    if (snap.empty) {
      for (const t of DEFAULT_TESTERS) {
        try { await setDoc(doc(db, 'testers', String(t.no)), t); } catch(e) {}
      }
      return;
    }
    testers = snap.docs.map(d => d.data());
    testers.sort((a, b) => a.no - b.no);
    renderAll();
  }, (err) => { setSyncBadge('offline', 'Offline'); });
}

function listenSchedule() {
  const { db, collection, onSnapshot } = FB;
  onSnapshot(collection(db, 'schedule'), (snap) => {
    schedule = {};
    snap.forEach(d => { schedule[d.id] = d.data(); });
    renderAll();
    if (!archiveChecked) setTimeout(() => autoArchiveOldData(), 3000);
  }, (err) => {});
}

function listenTrash() {
  const { db, collection, onSnapshot } = FB;
  onSnapshot(collection(db, 'trash'), (snap) => {
    trashItems = snap.docs.map(d => d.data());
    trashItems.sort((a, b) => b.deletedAtMs - a.deletedAtMs);
    updateTrashCount();
    const tm = document.getElementById('trashModal');
    if (tm && tm.parentNode) renderTrashModal();
  }, (err) => {});
}

async function setTester(tester) {
  const { db, doc, setDoc } = FB;
  await setDoc(doc(db, 'testers', String(tester.no)), tester);
}

async function removeTester(no) {
  const { db, doc, deleteDoc } = FB;
  await deleteDoc(doc(db, 'testers', String(no)));
}

async function setScheduleCell(k, data) {
  const { db, doc, setDoc, deleteDoc } = FB;
  const datePart = k.split('|')[1];
  const isArchive = isArchivedDate(datePart);
  const collectionName = isArchive ? 'schedule_archive' : 'schedule';
  if (!data.text && !data.type) {
    await deleteDoc(doc(db, 'schedule', k));
    await deleteDoc(doc(db, 'schedule_archive', k));
  } else {
    await setDoc(doc(db, collectionName, k), data);
  }
}

async function removeScheduleBulk(keys) {
  const { db, doc, deleteDoc } = FB;
  for (const k of keys) {
    await deleteDoc(doc(db, 'schedule', k));
    await deleteDoc(doc(db, 'schedule_archive', k));
  }
}

function key(testerNo, dateStr) { return `${testerNo}|${dateStr}`; }

// AL / MC HELPER
function kiraALMC(testerNo) {
  const days = getWeekDates(currentMonday);
  let al = 0, mc = 0;
  const alDays = [], mcDays = [];
  days.forEach(d => {
    const cell = schedule[key(testerNo, d.dateStr)];
    if (cell?.type === 'al') { al++; alDays.push(d.name); }
    else if (cell?.type === 'mc') { mc++; mcDays.push(d.name); }
  });
  return { al, mc, alDays, mcDays };
}

// AUTO-ARCHIVE
async function autoArchiveOldData() {
  if (archiveChecked) return;
  archiveChecked = true;
  const { db, collection, doc, setDoc, deleteDoc, getDocs } = FB;
  const cutoffStr = toLocalDateStr(getArchiveCutoffDate());
  try {
    const snap = await getDocs(collection(db, 'schedule'));
    const toArchive = [];
    snap.forEach(d => {
      const datePart = d.id.split('|')[1];
      if (datePart && datePart < cutoffStr) toArchive.push({ id: d.id, data: d.data() });
    });
    if (toArchive.length === 0) return;
    for (const item of toArchive) {
      try {
        await setDoc(doc(db, 'schedule_archive', item.id), item.data);
        await deleteDoc(doc(db, 'schedule', item.id));
      } catch (err) {}
    }
  } catch (err) { archiveChecked = false; }
}

async function loadArchiveForWeek(monday) {
  const { db, collection, getDocs } = FB;
  const days = getWeekDates(monday);
  const startStr = days[0].dateStr;
  const weekKey = startStr;
  if (archiveLoaded.has(weekKey)) return;
  archiveLoaded.add(weekKey);
  try {
    const snap = await getDocs(collection(db, 'schedule_archive'));
    let loaded = 0;
    snap.forEach(d => {
      const datePart = d.id.split('|')[1];
      if (datePart >= startStr && datePart <= days[6].dateStr) {
        schedule[d.id] = d.data();
        loaded++;
      }
    });
    if (loaded > 0) renderAll();
  } catch (err) { archiveLoaded.delete(weekKey); }
}

// TRASH
function generateTrashId() {
  return `trash_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

async function saveToTrash(type, data) {
  const { db, doc, setDoc } = FB;
  const trashId = generateTrashId();
  const trashItem = {
    id: trashId, type: type, data: data,
    deletedAt: new Date().toISOString(),
    deletedAtMs: Date.now()
  };
  try { await setDoc(doc(db, 'trash', trashId), trashItem); } catch (err) {}
}

function updateTrashCount() {
  const btn = document.getElementById('trashBtn');
  if (!btn) return;
  const existing = btn.querySelector('.trash-count');
  if (existing) existing.remove();
  if (trashItems.length > 0) {
    const badge = document.createElement('span');
    badge.className = 'trash-count';
    badge.textContent = trashItems.length > 99 ? '99+' : trashItems.length;
    btn.appendChild(badge);
  }
}

async function restoreFromTrash(trashId) {
  const item = trashItems.find(t => t.id === trashId);
  if (!item) return;
  const { db, doc, setDoc, deleteDoc } = FB;
  try {
    if (item.type === 'tester') {
      const tester = item.data.tester;
      await setDoc(doc(db, 'testers', String(tester.no)), tester);
      if (item.data.schedule) {
        for (const k of Object.keys(item.data.schedule)) {
          const datePart = k.split('|')[1];
          const collName = isArchivedDate(datePart) ? 'schedule_archive' : 'schedule';
          await setDoc(doc(db, collName, k), item.data.schedule[k]);
        }
      }
    } else if (item.type === 'schedule_bulk' || item.type === 'week') {
      const cells = item.data.cells || [];
      for (const cell of cells) {
        const datePart = cell.key.split('|')[1];
        const collName = isArchivedDate(datePart) ? 'schedule_archive' : 'schedule';
        await setDoc(doc(db, collName, cell.key), cell.value);
      }
    }
    await deleteDoc(doc(db, 'trash', trashId));
    showToast('success', 'Berjaya restore');
  } catch (err) { 
    showToast('error', 'Gagal restore', err.message);
  }
}

async function deletePermanently(trashId) {
  if (!confirm('Padam item ini secara kekal?')) return;
  const { db, doc, deleteDoc } = FB;
  try { 
    await deleteDoc(doc(db, 'trash', trashId)); 
    showToast('success', 'Item dipadam');
  } catch (err) {
    showToast('error', 'Gagal padam', err.message);
  }
}

async function autoPurgeTrash() {
  if (trashItems.length === 0) return;
  const { db, doc, deleteDoc } = FB;
  const cutoff = Date.now() - (TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const toPurge = trashItems.filter(t => t.deletedAtMs < cutoff);
  for (const item of toPurge) {
    try { await deleteDoc(doc(db, 'trash', item.id)); } catch (err) {}
  }
}

function openTrashModal() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay active';
  overlay.id = 'trashModal';
  overlay.innerHTML = `
    <div class="modal trash-modal">
      <div class="trash-header">
        <h3 style="margin:0;"><i class="fas fa-trash-can"></i> Trash</h3>
        <button id="closeTrashBtn" class="btn-secondary" style="flex:0 0 auto; padding:.5rem 1rem; font-size:.85rem;">
          <i class="fas fa-times"></i> Tutup
        </button>
      </div>
      <p style="color:#64748b; font-size:.8rem; margin-bottom:1rem;">
        Item auto-padam selepas <strong>${TRASH_RETENTION_DAYS} hari</strong>.
      </p>
      <div class="trash-body" id="trashBody"></div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById('closeTrashBtn').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  renderTrashModal();
}

function renderTrashModal() {
  const body = document.getElementById('trashBody');
  if (!body) return;
  if (trashItems.length === 0) {
    body.innerHTML = `<div class="trash-empty"><i class="fas fa-trash-can"></i><p>Trash kosong</p></div>`;
    return;
  }
  let html = '';
  trashItems.forEach(item => {
    const timeAgo = getTimeAgo(new Date(item.deletedAt));
    let title = '', meta = '';
    if (item.type === 'tester') {
      title = `👤 ${item.data.tester.name}`;
      const sc = item.data.schedule ? Object.keys(item.data.schedule).length : 0;
      meta = `Tester + ${sc} task · ${timeAgo}`;
    } else if (item.type === 'schedule_bulk' || item.type === 'week') {
      const count = item.data.cells ? item.data.cells.length : 0;
      title = `📅 ${count} sel`;
      meta = `${item.data.weekLabel || item.data.label || 'Bulk'} · ${timeAgo}`;
    }
    html += `
      <div class="trash-item">
        <div class="trash-item-info">
          <div class="trash-title">${title}</div>
          <div class="trash-meta"><i class="fas fa-clock"></i>${meta}</div>
        </div>
        <div class="trash-item-actions">
          <button class="trash-btn restore" data-id="${item.id}"><i class="fas fa-rotate-left"></i> Restore</button>
          <button class="trash-btn delete" data-id="${item.id}"><i class="fas fa-trash"></i></button>
        </div>
      </div>
    `;
  });
  body.innerHTML = html;
  body.querySelectorAll('.trash-btn.restore').forEach(btn => {
    btn.addEventListener('click', () => restoreFromTrash(btn.dataset.id));
  });
  body.querySelectorAll('.trash-btn.delete').forEach(btn => {
    btn.addEventListener('click', () => deletePermanently(btn.dataset.id));
  });
}

function showConfirmModal(title, message, onConfirm) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay active';
  overlay.innerHTML = `
    <div class="modal">
      <div class="confirm-icon"><i class="fas fa-exclamation-triangle"></i></div>
      <div class="confirm-title">${title}</div>
      <div class="confirm-message">${message}</div>
      <div class="modal-actions">
        <button id="confirmCancel" class="btn-secondary">Batal</button>
        <button id="confirmOk" class="btn-danger-full"><i class="fas fa-trash"></i> Ya, Padam</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById('confirmCancel').addEventListener('click', () => overlay.remove());
  document.getElementById('confirmOk').addEventListener('click', () => {
    overlay.remove();
    if (onConfirm) onConfirm();
  });
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}

// LEAVE REPORT MODAL — CARD LAYOUT
function openLeaveReport() {
  const days = getWeekDates(currentMonday);
  const weekNum = getWeekNumber(currentMonday);
  const range = `${formatShortDate(days[0].dateStr)} – ${formatShortDate(days[6].dateStr)}`;

  const rows = [];
  let totalAL = 0, totalMC = 0;
  testers.forEach(t => {
    const { al, mc, alDays, mcDays } = kiraALMC(t.no);
    if (al > 0 || mc > 0) {
      rows.push({ tester: t, al, mc, alDays, mcDays });
      totalAL += al;
      totalMC += mc;
    }
  });

  let bodyHtml = '';

  bodyHtml += `
    <div class="leave-summary-row">
      <div class="leave-summary-card al-card">
        <i class="fas fa-plane-departure"></i>
        <div>
          <div class="num">${totalAL}</div>
          <div class="lbl">Jumlah Hari AL</div>
        </div>
      </div>
      <div class="leave-summary-card mc-card">
        <i class="fas fa-notes-medical"></i>
        <div>
          <div class="num">${totalMC}</div>
          <div class="lbl">Jumlah Hari MC</div>
        </div>
      </div>
    </div>
  `;

  if (rows.length === 0) {
    bodyHtml += `<div class="leave-empty">
      <i class="fas fa-check-circle"></i>
      <p>Tiada AL atau MC minggu ini 🎉</p>
    </div>`;
  } else {
    bodyHtml += `<div class="leave-list">`;
    rows.forEach(r => {
      const tags = [];
      r.alDays.forEach(d => {
        tags.push(`<span class="leave-tag al-tag"><i class="fas fa-plane-departure"></i>${d}</span>`);
      });
      r.mcDays.forEach(d => {
        tags.push(`<span class="leave-tag mc-tag"><i class="fas fa-notes-medical"></i>${d}</span>`);
      });

      const totalDays = r.al + r.mc;
      const countClass = r.al > 0 && r.mc === 0 ? 'al-cnt' : (r.mc > 0 && r.al === 0 ? 'mc-cnt' : 'al-cnt');
      const countLbl = r.al > 0 && r.mc === 0 ? 'Hari AL' : (r.mc > 0 && r.al === 0 ? 'Hari MC' : 'Hari');

      bodyHtml += `
        <div class="leave-item">
          <div class="leave-no">${r.tester.no}</div>
          <div class="leave-info">
            <div class="leave-name">${r.tester.name}</div>
            <div class="leave-tags">${tags.join('')}</div>
          </div>
          <div class="leave-count ${countClass}">
            <div class="cnt">${totalDays}</div>
            <div class="lbl">${countLbl}</div>
          </div>
        </div>
      `;
    });
    bodyHtml += `</div>`;
  }

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay active';
  overlay.innerHTML = `
    <div class="modal leave-modal">
      <div class="leave-header">
        <div>
          <h3 style="margin:0;"><i class="fas fa-clipboard-check"></i> Laporan Cuti & MC</h3>
          <p style="margin:.2rem 0 0; color:#64748b; font-size:.8rem;">
            Week ${weekNum} · ${range}
          </p>
        </div>
        <button id="closeLeaveBtn" class="btn-secondary" style="flex:0 0 auto; padding:.5rem 1rem;">
          <i class="fas fa-times"></i> Tutup
        </button>
      </div>
      <div class="leave-body">${bodyHtml}</div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById('closeLeaveBtn').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}

// ANALYTICS
function kiraStatistikMinggu(monday) {
  const days = getWeekDates(monday);
  const stats = { office: 0, wfh: 0, al: 0, mc: 0, task: 0, public: 0, others: 0, kosong: 0, total: 0 };
  testers.forEach(t => {
    days.forEach(d => {
      const k = key(t.no, d.dateStr);
      const cell = schedule[k];
      const type = cell?.type || '';
      stats.total++;
      if (type === 'office') stats.office++;
      else if (type === 'wfh') stats.wfh++;
      else if (type === 'al') stats.al++;
      else if (type === 'mc') stats.mc++;
      else if (type === 'task') stats.task++;
      else if (type === 'public') stats.public++;
      else if (type === 'others') stats.others++;
      else if (!d.isWeekend) stats.kosong++;
    });
  });
  return stats;
}

function renderAnalytics() {
  if (typeof Chart === 'undefined') {
    console.error('[Analytics] Chart.js tak load');
    return;
  }

  const days = getWeekDates(currentMonday);
  const stats = kiraStatistikMinggu(currentMonday);

  document.getElementById('analyticsWeek').textContent = `Week ${getWeekNumber(currentMonday)}`;
  document.getElementById('analyticsRange').textContent =
    `${formatShortDate(days[0].dateStr)} – ${formatShortDate(days[6].dateStr)}`;

  Object.values(charts).forEach(c => { if (c) c.destroy(); });
  Chart.defaults.font.family = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  Chart.defaults.color = '#64748b';

  charts.bar = new Chart(document.getElementById('chartBar').getContext('2d'), {
    type: 'bar',
    data: {
      labels: ['🏢 Office', '🏠 WFH', '✈️ Cuti', '📝 MC', '🛣️ Site', '📚 Others'],
      datasets: [{
        data: [stats.office, stats.wfh, stats.al, stats.mc, stats.task, stats.others],
        backgroundColor: [
          CHART_COLORS.office, CHART_COLORS.wfh, CHART_COLORS.al,
          CHART_COLORS.mc, CHART_COLORS.task, CHART_COLORS.others
        ],
        borderRadius: 8, borderSkipped: false, barThickness: 40
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 1200, easing: 'easeOutQuart' },
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: '#1e293b', padding: 10, borderRadius: 8, displayColors: false, callbacks: { label: (ctx) => `${ctx.parsed.y} sel` } }
      },
      scales: {
        y: { beginAtZero: true, grid: { color: '#f1f5f9', drawBorder: false }, ticks: { font: { size: 11 }, stepSize: 5 } },
        x: { grid: { display: false }, ticks: { font: { size: 11, weight: '600' } } }
      }
    }
  });

  const doughnutData = [stats.office, stats.wfh, stats.al, stats.mc, stats.task, stats.others].filter(v => v > 0);
  const doughnutLabels = [
    { label: 'Office', value: stats.office, color: CHART_COLORS.office },
    { label: 'WFH', value: stats.wfh, color: CHART_COLORS.wfh },
    { label: 'Cuti', value: stats.al, color: CHART_COLORS.al },
    { label: 'MC', value: stats.mc, color: CHART_COLORS.mc },
    { label: 'Site', value: stats.task, color: CHART_COLORS.task },
    { label: 'Others', value: stats.others, color: CHART_COLORS.others }
  ].filter(x => x.value > 0);

  charts.doughnut = new Chart(document.getElementById('chartDoughnut').getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: doughnutLabels.length > 0 ? doughnutLabels.map(x => x.label) : ['Tiada data'],
      datasets: [{
        data: doughnutData.length > 0 ? doughnutData : [1],
        backgroundColor: doughnutLabels.length > 0 ? doughnutLabels.map(x => x.color) : ['#e2e8f0'],
        borderWidth: 3, borderColor: '#fff', hoverOffset: 8
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 1200, animateRotate: true, animateScale: true, easing: 'easeOutQuart' },
      plugins: {
        legend: { position: 'right', labels: { padding: 12, font: { size: 11, weight: '600' }, usePointStyle: true, pointStyle: 'circle' } },
        tooltip: {
          backgroundColor: '#1e293b', padding: 10, borderRadius: 8, displayColors: false,
          callbacks: {
            label: (ctx) => {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct = total > 0 ? Math.round((ctx.parsed / total) * 100) : 0;
              return `${ctx.label}: ${ctx.parsed} (${pct}%)`;
            }
          }
        }
      }
    }
  });

  const weeks = [], officeData = [], wfhData = [], taskData = [];
  for (let i = 3; i >= 0; i--) {
    const monday = new Date(currentMonday);
    monday.setDate(monday.getDate() - (i * 7));
    monday.setHours(0, 0, 0, 0);
    const s = kiraStatistikMinggu(monday);
    weeks.push(`W${getWeekNumber(monday)}`);
    officeData.push(s.office);
    wfhData.push(s.wfh);
    taskData.push(s.task);
  }

  charts.line = new Chart(document.getElementById('chartLine').getContext('2d'), {
    type: 'line',
    data: {
      labels: weeks,
      datasets: [
        { label: '🏢 Office', data: officeData, borderColor: CHART_COLORS.office, backgroundColor: 'rgba(16,185,129,.1)', tension: 0.4, fill: true, borderWidth: 3, pointRadius: 6, pointBackgroundColor: '#fff', pointBorderColor: CHART_COLORS.office, pointBorderWidth: 3, pointHoverRadius: 8 },
        { label: '🏠 WFH', data: wfhData, borderColor: CHART_COLORS.wfh, backgroundColor: 'rgba(59,130,246,.1)', tension: 0.4, fill: true, borderWidth: 3, pointRadius: 6, pointBackgroundColor: '#fff', pointBorderColor: CHART_COLORS.wfh, pointBorderWidth: 3, pointHoverRadius: 8 },
        { label: '🛣️ Site', data: taskData, borderColor: CHART_COLORS.task, backgroundColor: 'rgba(139,92,246,.1)', tension: 0.4, fill: true, borderWidth: 3, pointRadius: 6, pointBackgroundColor: '#fff', pointBorderColor: CHART_COLORS.task, pointBorderWidth: 3, pointHoverRadius: 8 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 1500, easing: 'easeOutQuart' },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top', align: 'end', labels: { padding: 12, font: { size: 11, weight: '600' }, usePointStyle: true, pointStyle: 'circle' } },
        tooltip: { backgroundColor: '#1e293b', padding: 10, borderRadius: 8 }
      },
      scales: {
        y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { font: { size: 11 }, stepSize: 5 } },
        x: { grid: { display: false }, ticks: { font: { size: 11, weight: '600' } } }
      }
    }
  });
}

function openAnalyticsModal() {
  const modal = document.getElementById('analyticsModal');
  modal.classList.add('active');
  setTimeout(() => renderAnalytics(), 100);
}

function closeAnalyticsModal() {
  document.getElementById('analyticsModal').classList.remove('active');
  Object.values(charts).forEach(c => { if (c) c.destroy(); });
  charts = { bar: null, doughnut: null, line: null };
}

function initAnalytics() {
  const btn = document.getElementById('analyticsBtn');
  const closeBtn = document.getElementById('analyticsCloseBtn');
  const modal = document.getElementById('analyticsModal');
  if (!btn) return;
  btn.addEventListener('click', openAnalyticsModal);
  closeBtn.addEventListener('click', closeAnalyticsModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeAnalyticsModal(); });
}

// SEARCH
function getFilteredTesters() {
  if (!searchQuery) return testers;
  return testers.filter(t => t.name.toLowerCase().includes(searchQuery));
}

// STATISTIK
function kiraStatistik(days) {
  const stats = { tester: testers.length, office: 0, wfh: 0, al: 0, mc: 0, task: 0, public: 0, others: 0, kosong: 0 };
  testers.forEach(t => {
    days.forEach(d => {
      const k = key(t.no, d.dateStr);
      const cell = schedule[k];
      const type = cell?.type || '';
      if (type === 'office') stats.office++;
      else if (type === 'wfh') stats.wfh++;
      else if (type === 'al') stats.al++;
      else if (type === 'mc') stats.mc++;
      else if (type === 'task') stats.task++;
      else if (type === 'public') stats.public++;
      else if (type === 'others') stats.others++;
      else if (!d.isWeekend) stats.kosong++;
    });
  });
  return stats;
}

function renderStatistik(days) {
  const s = kiraStatistik(days);
  document.getElementById('statTester').textContent = s.tester;
  document.getElementById('statOffice').textContent = s.office;
  document.getElementById('statWfh').textContent = s.wfh;
  document.getElementById('statCuti').textContent = s.al;
  document.getElementById('statMc').textContent = s.mc;
  document.getElementById('statTask').textContent = s.task;
  document.getElementById('statKosong').textContent = s.kosong;
  const statOthersEl = document.getElementById('statOthers');
  if (statOthersEl) statOthersEl.textContent = s.others;
}

// RENDER
function renderHeader(days) {
  const thead = document.getElementById('rosterHead');
  const todayStr = toLocalDateStr(new Date());
  let row1 = `<tr>
    <th class="col-unit" rowspan="2">Unit</th>
    <th class="col-no" rowspan="2">No</th>
    <th class="col-name" rowspan="2">Name</th>
    <th class="col-action" rowspan="2"><i class="fas fa-cog"></i></th>`;
  days.forEach(d => {
    const isToday = d.dateStr === todayStr;
    const classes = ['col-day'];
    if (d.isWeekend) classes.push('weekend-head');
    if (isToday) classes.push('today-head');
    row1 += `<th class="${classes.join(' ')}">${d.name}</th>`;
  });
  row1 += `<th class="col-summary al-sum" rowspan="2" title="Jumlah hari AL minggu ini">AL</th>`;
  row1 += `<th class="col-summary mc-sum" rowspan="2" title="Jumlah hari MC minggu ini">MC</th>`;
  row1 += `</tr>`;

  let row2 = `<tr>`;
  days.forEach(d => {
    const isToday = d.dateStr === todayStr;
    const classes = ['date-head'];
    if (d.isWeekend) classes.push('weekend-head');
    if (isToday) classes.push('today-head');
    row2 += `<th class="${classes.join(' ')}">${formatShortDate(d.dateStr)}</th>`;
  });
  row2 += `</tr>`;
  thead.innerHTML = row1 + row2;
}

function renderBody(days) {
  const tbody = document.getElementById('rosterBody');
  const todayStr = toLocalDateStr(new Date());
  const filteredTesters = getFilteredTesters();

  if (testers.length === 0) {
    showSkeletonLoader(days);
    return;
  }
  if (filteredTesters.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${days.length + 6}" style="padding:2rem;color:#94a3b8;text-align:center;">🔍 Tiada tester sepadan dengan "<strong>${searchQuery}</strong>"</td></tr>`;
    return;
  }

  let html = '';
  filteredTesters.forEach((t, idx) => {
    let alCount = 0, mcCount = 0;
    days.forEach(d => {
      const cell = schedule[key(t.no, d.dateStr)];
      if (cell?.type === 'al') alCount++;
      else if (cell?.type === 'mc') mcCount++;
    });

    html += `<tr>`;
    if (idx === 0) {
      html += `<td class="col-unit" rowspan="${filteredTesters.length}"><div class="col-unit-inner">${t.unit || 'TESTING UNIT'}</div></td>`;
    }
    html += `<td class="col-no">${t.no}</td>`;
    const isMatch = searchQuery && t.name.toLowerCase().includes(searchQuery);
    html += `<td class="col-name ${isMatch ? 'search-match' : ''}" data-no="${t.no}" title="Klik untuk edit">${t.name}</td>`;
    html += `<td class="col-action"><button data-no="${t.no}" class="del-tester-btn" title="Padam tester"><i class="fas fa-trash"></i></button></td>`;

    let i = 0;
    while (i < days.length) {
      const d = days[i];
      const k = key(t.no, d.dateStr);
      const cell = schedule[k] || { text: '', type: '' };

      let span = 1;
      if (cell.text && cell.type && cell.type !== 'weekend') {
        let j = i + 1;
        while (j < days.length) {
          const nextD = days[j];
          const nextK = key(t.no, nextD.dateStr);
          const nextCell = schedule[nextK] || { text: '', type: '' };
          if (nextCell.text === cell.text && nextCell.type === cell.type && !nextD.isWeekend) {
            span++;
            j++;
          } else break;
        }
      }

      let isTodayCell = false;
      for (let s = 0; s < span; s++) {
        if (days[i + s].dateStr === todayStr) { isTodayCell = true; break; }
      }

      const classes = ['cell'];
      if (cell.type) classes.push(cell.type);
      if (d.isWeekend && !cell.type) classes.push('weekend');
      if (!cell.text) classes.push('empty');
      if (isTodayCell) classes.push('today-cell');

      const displayText = cell.text || (d.isWeekend ? '' : '—');
      let dateLabel = formatShortDate(d.dateStr);
      if (span > 1) {
        const lastD = days[i + span - 1];
        dateLabel = `${formatShortDate(d.dateStr)} → ${formatShortDate(lastD.dateStr)}`;
      }

      html += `<td class="${classes.join(' ')}"
                   colspan="${span}"
                   data-no="${t.no}"
                   data-date="${d.dateStr}"
                   data-date-end="${days[i + span - 1].dateStr}"
                   data-span="${span}"
                   data-weekend="${d.isWeekend}"
                   tabindex="0"
                   title="${dateLabel}">
                   ${displayText}
               </td>`;
      i += span;
    }

    html += `<td class="col-summary al-sum ${alCount === 0 ? 'empty-sum' : ''}" title="${alCount > 0 ? alCount + ' hari AL' : 'Tiada AL'}">${alCount || '—'}</td>`;
    html += `<td class="col-summary mc-sum ${mcCount === 0 ? 'empty-sum' : ''}" title="${mcCount > 0 ? mcCount + ' hari MC' : 'Tiada MC'}">${mcCount || '—'}</td>`;

    html += `</tr>`;
  });

  tbody.innerHTML = html;

  document.querySelectorAll('td.col-name').forEach(cell => {
    cell.addEventListener('click', () => openTesterModal(parseInt(cell.dataset.no)));
  });
  document.querySelectorAll('.del-tester-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteTesterWithTrash(parseInt(btn.dataset.no));
    });
  });

  attachCellEvents();
  refreshSelectionAfterRender();
  attachKeyboardNav();
}

function renderAll() {
  const days = getWeekDates(currentMonday);
  renderHeader(days);
  renderBody(days);
  updateWeekBadge(days);
  renderStatistik(days);
  updateTodayBanner();
  syncWeekPicker();
  if (currentMonday < getArchiveCutoffDate()) loadArchiveForWeek(currentMonday);
}

function updateTodayBanner() {
  const banner = document.getElementById('todayBanner');
  const label = document.getElementById('todayLabel');
  if (!banner || !label) return;
  const today = new Date();
  const hariNama = ['Ahad','Isnin','Selasa','Rabu','Khamis','Jumaat','Sabtu'];
  const bulanNama = ['Jan','Feb','Mac','Apr','Mei','Jun','Jul','Ogo','Sep','Okt','Nov','Dis'];
  label.textContent = `${hariNama[today.getDay()]}, ${today.getDate()}-${bulanNama[today.getMonth()]}-${today.getFullYear()}`;
  const todayMondayStr = toLocalDateStr(getMonday(today));
  const currentMondayStr = toLocalDateStr(currentMonday);
  banner.style.display = (todayMondayStr === currentMondayStr) ? 'flex' : 'none';
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

// MODAL: EDIT SEL
let activeCell = null;
const modal = document.getElementById('modal');
const modalText = document.getElementById('modalText');
const modalType = document.getElementById('modalType');
const modalTitle = document.getElementById('modalTitle');

function openModal(cell) {
  activeCell = cell;
  const no = cell.dataset.no;
  const dateStr = cell.dataset.date;
  const dateEnd = cell.dataset.dateEnd || dateStr;
  const span = parseInt(cell.dataset.span || 1);
  const k = key(no, dateStr);
  const data = schedule[k] || { text: '', type: '' };
  const tester = testers.find(t => t.no == no);

  let title = `${tester ? tester.name : '?'} — `;
  if (span > 1) title += `${formatShortDate(dateStr)} → ${formatShortDate(dateEnd)} (${span} hari)`;
  else title += formatShortDate(dateStr);
  modalTitle.textContent = title;
  modalText.value = data.text || '';
  modalType.value = data.type || '';
  modal.classList.add('active');
  setTimeout(() => modalText.focus(), 100);
}

function closeModal() {
  modal.classList.remove('active');
  activeCell = null;
  if (focusedCell) {
    setTimeout(() => focusedCell.focus(), 50);
  }
}

document.getElementById('modalCancel').addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

document.getElementById('modalSave').addEventListener('click', async () => {
  if (!activeCell) return;
  const no = activeCell.dataset.no;
  const dateStr = activeCell.dataset.date;
  const dateEnd = activeCell.dataset.dateEnd || dateStr;
  const text = modalText.value.trim();
  const type = modalType.value;
  try {
    setSyncBadge('connecting', 'Menyimpan...');
    const dates = expandDates(dateStr, dateEnd);
    for (const dStr of dates) {
      await setScheduleCell(key(no, dStr), { text, type });
    }
    setSyncBadge('online', 'Online');
    showToast('success', 'Berjaya disimpan');
    closeModal();
  } catch (err) {
    showToast('error', 'Gagal simpan', err.message);
    setSyncBadge('offline', 'Ralat');
  }
});

modalText.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('modalSave').click();
});

// MODAL: TESTER
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

  if (!name) { showToast('warning', 'Sila isi nama tester'); return; }
  if (!no || no < 1) { showToast('warning', 'No. tidak sah'); return; }

  const dup = testers.find(t => t.no === no && t.no !== editingTesterNo);
  if (dup) { showToast('warning', `No. ${no} sudah digunakan`, dup.name); return; }

  try {
    setSyncBadge('connecting', 'Menyimpan...');
    if (editingTesterNo !== null && editingTesterNo !== no) await removeTester(editingTesterNo);
    await setTester({ no, name, unit });
    setSyncBadge('online', 'Online');
    showToast('success', editingTesterNo ? 'Tester dikemaskini' : 'Tester ditambah', name);
    closeTesterModal();
  } catch (err) {
    showToast('error', 'Gagal simpan', err.message);
  }
});

testerDeleteBtn.addEventListener('click', () => {
  if (editingTesterNo === null) return;
  closeTesterModal();
  deleteTesterWithTrash(editingTesterNo);
});

testerName.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('testerSave').click();
});

async function deleteTesterWithTrash(no) {
  const t = testers.find(x => x.no === no);
  if (!t) return;
  const testerSchedule = {};
  Object.keys(schedule).forEach(k => {
    if (k.startsWith(`${no}|`)) testerSchedule[k] = schedule[k];
  });
  const sc = Object.keys(testerSchedule).length;
  showConfirmModal(
    'Padam Tester?',
    `Padam <strong>${t.name}</strong>?<br>Bersama <strong>${sc} task</strong>.<br><br>
     <em style="color:#059669;">💡 Masuk Trash — boleh restore dalam ${TRASH_RETENTION_DAYS} hari.</em>`,
    async () => {
      try {
        setSyncBadge('connecting', 'Memadam...');
        await saveToTrash('tester', { tester: t, schedule: testerSchedule });
        await removeTester(no);
        await removeScheduleBulk(Object.keys(testerSchedule));
        setSyncBadge('online', 'Online');
        showToast('success', 'Tester dipadam', t.name);
      } catch (err) {
        showToast('error', 'Gagal padam', err.message);
      }
    }
  );
}

async function clearWeekWithTrash() {
  const days = getWeekDates(currentMonday);
  const startStr = days[0].dateStr;
  const endStr = days[6].dateStr;
  const keysToDelete = Object.keys(schedule).filter(k => {
    const datePart = k.split('|')[1];
    return datePart >= startStr && datePart <= endStr;
  });
  if (keysToDelete.length === 0) { 
    showToast('info', 'Tiada data untuk dipadam');
    return; 
  }
  const weekLabel = `${formatShortDate(startStr)} – ${formatShortDate(endStr)}`;
  showConfirmModal(
    'Clear Minggu?',
    `Padam <strong>${keysToDelete.length} sel</strong> untuk minggu<br><strong>${weekLabel}</strong>?<br><br>
     <em style="color:#059669;">💡 Boleh restore dari Trash.</em>`,
    async () => {
      try {
        setSyncBadge('connecting', 'Memadam...');
        const cells = keysToDelete.map(k => ({ key: k, value: schedule[k] }));
        await saveToTrash('week', { cells: cells, weekLabel: weekLabel });
        await removeScheduleBulk(keysToDelete);
        setSyncBadge('online', 'Online');
        showToast('success', 'Minggu dibersihkan', `${keysToDelete.length} sel`);
      } catch (err) {
        showToast('error', 'Gagal padam', err.message);
      }
    }
  );
}

// NAVIGASI MINGGU
document.getElementById('prevWeekBtn').addEventListener('click', () => {
  currentMonday.setDate(currentMonday.getDate() - 7);
  currentMonday.setHours(0, 0, 0, 0);
  clearSelection();
  renderAll();
});
document.getElementById('nextWeekBtn').addEventListener('click', () => {
  currentMonday.setDate(currentMonday.getDate() + 7);
  currentMonday.setHours(0, 0, 0, 0);
  clearSelection();
  renderAll();
});
document.getElementById('todayBtn').addEventListener('click', () => {
  currentMonday = getMonday(new Date());
  clearSelection();
  renderAll();
});

document.getElementById('archiveBtn').addEventListener('click', async () => {
  if (!confirm(`Auto-archive data > ${WEEKS_BEFORE_ARCHIVE} minggu?`)) return;
  const btn = document.getElementById('archiveBtn');
  const originalText = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Archiving...';
  btn.disabled = true;
  archiveChecked = false;
  await autoArchiveOldData();
  btn.innerHTML = '<i class="fas fa-check"></i> Selesai!';
  showToast('success', 'Archive selesai');
  setTimeout(() => {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }, 2000);
});

document.getElementById('trashBtn').addEventListener('click', openTrashModal);
document.getElementById('clearAllBtn').addEventListener('click', clearWeekWithTrash);

// COPY MINGGU LEPAS
function copyPreviousWeek() {
  const prevMonday = new Date(currentMonday);
  prevMonday.setDate(prevMonday.getDate() - 7);
  prevMonday.setHours(0, 0, 0, 0);
  const prevDays = getWeekDates(prevMonday);
  const currDays = getWeekDates(currentMonday);
  const toCopy = [];
  testers.forEach(t => {
    prevDays.forEach((pd, idx) => {
      const pk = key(t.no, pd.dateStr);
      const prevCell = schedule[pk];
      if (prevCell && (prevCell.text || prevCell.type)) {
        const cd = currDays[idx];
        const ck = key(t.no, cd.dateStr);
        const currCell = schedule[ck];
        if (!currCell || (!currCell.text && !currCell.type)) {
          toCopy.push({
            testerNo: t.no, testerName: t.name,
            currDateStr: cd.dateStr, currDateLabel: formatShortDate(cd.dateStr),
            text: prevCell.text, type: prevCell.type
          });
        }
      }
    });
  });
  if (toCopy.length === 0) {
    showToast('info', 'Tiada data untuk disalin');
    return;
  }
  paparModalCopy(toCopy);
}

function paparModalCopy(toCopy) {
  const grouped = {};
  toCopy.forEach(item => {
    if (!grouped[item.testerNo]) grouped[item.testerNo] = { name: item.testerName, items: [] };
    grouped[item.testerNo].items.push(item);
  });
  let html = '';
  Object.values(grouped).forEach(g => {
    html += `<div class="row">
      <span class="name">${g.name.split(' ').slice(0, 3).join(' ')}</span>
      <span class="detail">${g.items.length} sel: ${g.items.map(i => i.currDateLabel).join(', ')}</span>
    </div>`;
  });
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay active';
  overlay.innerHTML = `
    <div class="modal" style="max-width:520px;">
      <h3><i class="fas fa-copy"></i> Copy Minggu Lepas</h3>
      <div class="copy-warning"><strong>${toCopy.length} sel</strong> akan disalin.</div>
      <div class="copy-summary">${html}</div>
      <div class="modal-actions">
        <button id="copyCancelBtn" class="btn-secondary">Batal</button>
        <button id="copyConfirmBtn" class="btn-primary"><i class="fas fa-check"></i> Copy Sekarang</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById('copyCancelBtn').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.getElementById('copyConfirmBtn').addEventListener('click', async () => {
    const btn = document.getElementById('copyConfirmBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyalin...';
    let berjaya = 0;
    for (const item of toCopy) {
      try {
        await setScheduleCell(key(item.testerNo, item.currDateStr), { text: item.text, type: item.type });
        berjaya++;
      } catch (err) {}
    }
    overlay.remove();
    showToast('success', 'Berjaya copy', `${berjaya}/${toCopy.length} sel disalin`);
  });
}

// SEARCH
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');

searchInput.addEventListener('input', (e) => {
  searchQuery = e.target.value.trim().toLowerCase();
  clearSearchBtn.style.display = searchQuery ? 'flex' : 'none';
  renderAll();
});
clearSearchBtn.addEventListener('click', () => {
  searchInput.value = '';
  searchQuery = '';
  clearSearchBtn.style.display = 'none';
  renderAll();
  searchInput.focus();
});

// ═══════════════════════════════════════════════════════
// SCREENSHOT — FIX MOBILE FULL TABLE
// ═══════════════════════════════════════════════════════
const screenshotBtn = document.getElementById('screenshotBtn');
screenshotBtn.addEventListener('click', async () => {
  console.log('[Screenshot] Button clicked');
  
  if (typeof html2canvas === 'undefined') { 
    showToast('error', 'Library html2canvas tak load');
    return; 
  }
  
  const originalText = screenshotBtn.innerHTML;
  screenshotBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyediakan...';
  screenshotBtn.classList.add('loading');
  
  try {
    document.body.classList.add('screenshot-mode');
    
    // Tunggu DOM repaint
    await new Promise(r => setTimeout(r, 400));
    
    const target = document.querySelector('.table-card');
    if (!target) throw new Error('Table card tak jumpa');
    
    // Simpan style asal untuk restore
    const wrapper = target.querySelector('.table-wrapper');
    const table = target.querySelector('table');
    const originalWrapperStyle = {};
    const originalTableStyle = {};
    
    if (wrapper) {
      ['overflow', 'maxHeight', 'height', 'width'].forEach(prop => {
        originalWrapperStyle[prop] = wrapper.style[prop];
      });
      wrapper.style.overflow = 'visible';
      wrapper.style.maxHeight = 'none';
      wrapper.style.height = 'auto';
      wrapper.style.width = 'auto';
    }
    
    if (table) {
      ['minWidth', 'width'].forEach(prop => {
        originalTableStyle[prop] = table.style[prop];
      });
      table.style.minWidth = 'auto';
      table.style.width = 'auto';
    }
    
    // Tunggu render
    await new Promise(r => setTimeout(r, 300));
    
    const fullWidth = target.scrollWidth;
    const fullHeight = target.scrollHeight;
    console.log('[Screenshot] Target size:', fullWidth, 'x', fullHeight);
    
    const canvas = await html2canvas(target, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      logging: false,
      allowTaint: true,
      scrollX: 0,
      scrollY: 0,
      windowWidth: fullWidth,
      windowHeight: fullHeight,
      width: fullWidth,
      height: fullHeight
    });
    
    console.log('[Screenshot] Canvas size:', canvas.width, 'x', canvas.height);
    
    // Restore
    if (wrapper) {
      Object.keys(originalWrapperStyle).forEach(prop => {
        wrapper.style[prop] = originalWrapperStyle[prop];
      });
    }
    if (table) {
      Object.keys(originalTableStyle).forEach(prop => {
        table.style[prop] = originalTableStyle[prop];
      });
    }
    
    document.body.classList.remove('screenshot-mode');
    
    const weekNum = getWeekNumber(currentMonday);
    const firstDay = formatShortDate(getWeekDates(currentMonday)[0].dateStr);
    const lastDay = formatShortDate(getWeekDates(currentMonday)[6].dateStr);
    const fileName = `QA-Roster_Week${weekNum}_${firstDay}-${lastDay}.png`;
    
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = fileName;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      console.log('[Screenshot] Downloaded:', fileName);
    }, 'image/png');
    
    screenshotBtn.innerHTML = '<i class="fas fa-check"></i> Selesai!';
    showToast('success', 'Screenshot disimpan', fileName);
    
    setTimeout(() => {
      screenshotBtn.innerHTML = originalText;
      screenshotBtn.classList.remove('loading');
    }, 2000);
    
  } catch (err) {
    console.error('[Screenshot] ERROR:', err);
    document.body.classList.remove('screenshot-mode');
    showToast('error', 'Gagal screenshot', err.message);
    screenshotBtn.innerHTML = originalText;
    screenshotBtn.classList.remove('loading');
  }
});

// DUPLICATE + BULK EDIT
let selectedCells = new Set();
let lastClickedCell = null;
let clipboard = null;
const contextMenu = document.getElementById('contextMenu');
const bulkBar = document.getElementById('bulkBar');
const bulkCount = document.getElementById('bulkCount');

function clearSelection() {
  selectedCells.forEach(c => { if (c && c.classList) c.classList.remove('selected'); });
  selectedCells.clear();
  bulkBar.classList.remove('active');
  updateBulkCount();
}
function updateBulkCount() {
  bulkCount.textContent = selectedCells.size;
  if (selectedCells.size >= 2) bulkBar.classList.add('active');
  else bulkBar.classList.remove('active');
}
function toggleCellSelection(cell, forceAdd = false) {
  if (selectedCells.has(cell) && !forceAdd) {
    selectedCells.delete(cell);
    cell.classList.remove('selected');
  } else {
    selectedCells.add(cell);
    cell.classList.add('selected');
  }
  updateBulkCount();
}
function refreshSelectionAfterRender() {
  if (selectedCells.size === 0) return;
  const selectedKeys = new Set();
  selectedCells.forEach(c => {
    if (c && c.dataset) selectedKeys.add(`${c.dataset.no}|${c.dataset.date}`);
  });
  selectedCells.clear();
  document.querySelectorAll('td.cell').forEach(cell => {
    const k = `${cell.dataset.no}|${cell.dataset.date}`;
    if (selectedKeys.has(k)) {
      selectedCells.add(cell);
      cell.classList.add('selected');
    }
  });
  updateBulkCount();
}

// ATTACH CELL EVENTS
function attachCellEvents() {
  document.querySelectorAll('td.cell').forEach(cell => {
    if (IS_MOBILE) {
      let longPressTimer = null;
      let touchStartX = 0;
      let touchStartY = 0;
      let isScrolling = false;
      let didLongPress = false;
      let touchMoved = false;

      cell.addEventListener('click', (e) => {
        if (didLongPress) { didLongPress = false; return; }
        if (isScrolling || touchMoved) return;
        e.preventDefault();
        e.stopPropagation();
        setFocusedCell(cell);
        lastClickedCell = cell;
        openModal(cell);
      });

      cell.addEventListener('touchstart', (e) => {
        const touch = e.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        isScrolling = false;
        didLongPress = false;
        touchMoved = false;

        longPressTimer = setTimeout(() => {
          if (isScrolling || touchMoved) return;
          didLongPress = true;
          lastClickedCell = cell;
          setFocusedCell(cell);
          const t = e.touches[0] || e.changedTouches[0];
          if (t) showContextMenu(t.pageX, t.pageY, cell);
          if (navigator.vibrate) navigator.vibrate(50);
        }, 550);
      }, { passive: true });

      cell.addEventListener('touchmove', (e) => {
        const touch = e.touches[0];
        const dx = Math.abs(touch.clientX - touchStartX);
        const dy = Math.abs(touch.clientY - touchStartY);
        if (dx > 8 || dy > 8) {
          isScrolling = true;
          touchMoved = true;
          if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
          }
        }
      }, { passive: true });

      cell.addEventListener('touchend', () => {
        if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
      });

      cell.addEventListener('touchcancel', () => {
        if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
        isScrolling = false;
        didLongPress = false;
        touchMoved = false;
      });

    } else {
      cell.addEventListener('mousedown', (e) => {
        if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
          e.preventDefault();
        }
      });

      cell.addEventListener('click', (e) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault(); e.stopPropagation();
          toggleCellSelection(cell);
          lastClickedCell = cell;
          setFocusedCell(cell);
          return;
        }
        if (e.shiftKey && lastClickedCell) {
          e.preventDefault(); e.stopPropagation();
          rangeSelect(lastClickedCell, cell);
          setFocusedCell(cell);
          return;
        }
        e.preventDefault(); e.stopPropagation();
        clearSelection();
        setFocusedCell(cell);
        lastClickedCell = cell;
      });

      cell.addEventListener('dblclick', (e) => {
        e.preventDefault(); e.stopPropagation();
        openModal(cell);
      });

      cell.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!selectedCells.has(cell)) clearSelection();
        lastClickedCell = cell;
        setFocusedCell(cell);
        showContextMenu(e.pageX, e.pageY, cell);
      });
    }
  });
}

function rangeSelect(startCell, endCell) {
  const allCells = Array.from(document.querySelectorAll('td.cell'));
  const startIdx = allCells.indexOf(startCell);
  const endIdx = allCells.indexOf(endCell);
  if (startIdx === -1 || endIdx === -1) return;
  const [from, to] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
  for (let i = from; i <= to; i++) {
    const c = allCells[i];
    if (!selectedCells.has(c)) {
      selectedCells.add(c);
      c.classList.add('selected');
    }
  }
  updateBulkCount();
}

function showContextMenu(x, y, cell) {
  contextMenu.classList.add('active');
  contextMenu.style.left = Math.min(x, window.innerWidth - 240) + 'px';
  contextMenu.style.top = Math.min(y, window.innerHeight - 220) + 'px';
}
function hideContextMenu() { contextMenu.classList.remove('active'); }

document.addEventListener('mousedown', (e) => {
  if (contextMenu.contains(e.target)) return;
  if (e.target.closest('td.cell')) return;
  hideContextMenu();
});
document.addEventListener('touchstart', (e) => {
  if (contextMenu.contains(e.target)) return;
  if (e.target.closest('td.cell')) return;
  hideContextMenu();
}, { passive: true });
document.addEventListener('scroll', hideContextMenu, true);

function copyCell(cell) {
  const no = cell.dataset.no;
  const data = schedule[key(no, cell.dataset.date)] || { text: '', type: '' };
  clipboard = { text: data.text || '', type: data.type || '' };
  cell.style.transition = 'none';
  cell.style.outline = '3px solid #10b981';
  setTimeout(() => { cell.style.outline = ''; cell.style.transition = ''; }, 400);
  showToast('info', 'Copied', clipboard.text || '(kosong)');
}

async function pasteToCells(cells) {
  if (!clipboard) { showToast('warning', 'Tiada apa untuk paste'); return; }
  const targets = cells.map(cell => ({
    no: cell.dataset.no,
    dates: expandDates(cell.dataset.date, cell.dataset.dateEnd)
  }));
  try {
    setSyncBadge('connecting', 'Menyimpan...');
    for (const t of targets) {
      for (const dStr of t.dates) {
        await setScheduleCell(key(t.no, dStr), { text: clipboard.text, type: clipboard.type });
      }
    }
    setSyncBadge('online', 'Online');
    showToast('success', 'Pasted');
  } catch (err) {
    showToast('error', 'Gagal paste', err.message);
  }
}

document.getElementById('ctxCopy').addEventListener('click', () => {
  if (selectedCells.size > 0) copyCell(Array.from(selectedCells)[0]);
  else if (lastClickedCell) copyCell(lastClickedCell);
  hideContextMenu();
});
document.getElementById('ctxPaste').addEventListener('click', async () => {
  const targets = selectedCells.size > 0 ? Array.from(selectedCells) : (lastClickedCell ? [lastClickedCell] : []);
  if (targets.length > 0) await pasteToCells(targets);
  hideContextMenu();
});
document.getElementById('ctxDuplicate').addEventListener('click', async () => {
  if (!lastClickedCell) { hideContextMenu(); return; }
  const cell = lastClickedCell;
  const no = cell.dataset.no;
  const data = schedule[key(no, cell.dataset.date)] || { text: '', type: '' };
  const allCells = Array.from(document.querySelectorAll('td.cell'));
  const idx = allCells.indexOf(cell);
  let nextCell = null;
  for (let i = idx + 1; i < allCells.length; i++) {
    if (allCells[i].dataset.no === no) { nextCell = allCells[i]; break; }
    else break;
  }
  if (!nextCell) { hideContextMenu(); return; }
  try {
    setSyncBadge('connecting', 'Menyimpan...');
    await setScheduleCell(key(nextCell.dataset.no, nextCell.dataset.date), data);
    setSyncBadge('online', 'Online');
    showToast('success', 'Duplicated');
  } catch (err) {
    showToast('error', 'Gagal duplicate', err.message);
  }
  hideContextMenu();
});
document.getElementById('ctxClear').addEventListener('click', async () => {
  const targets = selectedCells.size > 0 ? Array.from(selectedCells) : (lastClickedCell ? [lastClickedCell] : []);
  if (targets.length === 0) { hideContextMenu(); return; }
  if (!confirm(`Clear ${targets.length} sel?`)) { hideContextMenu(); return; }
  const targetsData = targets.map(cell => ({
    no: cell.dataset.no,
    dates: expandDates(cell.dataset.date, cell.dataset.dateEnd)
  }));
  try {
    setSyncBadge('connecting', 'Memadam...');
    for (const t of targetsData) {
      for (const dStr of t.dates) {
        await setScheduleCell(key(t.no, dStr), { text: '', type: '' });
      }
    }
    setSyncBadge('online', 'Online');
    showToast('success', 'Cleared');
  } catch (err) {
    showToast('error', 'Gagal clear', err.message);
  }
  hideContextMenu();
});

const bulkEditBtn = document.getElementById('bulkEditBtn');
const bulkClearBtn = document.getElementById('bulkClearBtn');
const bulkCancelBtn = document.getElementById('bulkCancelBtn');

bulkEditBtn.addEventListener('click', openBulkEditModal);

bulkClearBtn.addEventListener('click', async () => {
  if (selectedCells.size === 0) return;
  if (!confirm(`Clear ${selectedCells.size} sel?`)) return;
  const targetsData = Array.from(selectedCells).map(cell => ({
    no: cell.dataset.no,
    dates: expandDates(cell.dataset.date, cell.dataset.dateEnd)
  }));
  try {
    setSyncBadge('connecting', 'Memadam...');
    for (const t of targetsData) {
      for (const dStr of t.dates) {
        await setScheduleCell(key(t.no, dStr), { text: '', type: '' });
      }
    }
    setSyncBadge('online', 'Online');
    showToast('success', 'Cleared', `${selectedCells.size} sel`);
    clearSelection();
  } catch (err) {
    showToast('error', 'Gagal clear', err.message);
  }
});

bulkCancelBtn.addEventListener('click', clearSelection);

function openBulkEditModal() {
  if (selectedCells.size === 0) return;
  const totalCells = selectedCells.size;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay active';
  overlay.innerHTML = `
    <div class="modal">
      <h3><i class="fas fa-pen"></i> Edit ${totalCells} Sel</h3>
      <div class="copy-warning">Semua <strong>${totalCells} sel</strong> akan ditukar.</div>
      <div class="form-group"><label>Teks / Tugasan</label>
        <input type="text" id="bulkText" placeholder="Contoh: Office, WFH">
      </div>
      <div class="form-group"><label>Jenis (warna)</label>
        <select id="bulkType">
          <option value="">— Kosong —</option>
          <option value="office">Office</option>
          <option value="wfh">WFH</option>
          <option value="al">AL (Cuti)</option>
          <option value="mc">MC</option>
          <option value="public">Public Holiday</option>
          <option value="task">Site</option>
          <option value="others">Others (Training, Meeting, dll)</option>
        </select>
      </div>
      <div class="modal-actions">
        <button id="bulkEditCancel" class="btn-secondary">Batal</button>
        <button id="bulkEditSave" class="btn-primary"><i class="fas fa-save"></i> Simpan</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById('bulkText').focus();
  document.getElementById('bulkEditCancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.getElementById('bulkEditSave').addEventListener('click', async () => {
    const text = document.getElementById('bulkText').value.trim();
    const type = document.getElementById('bulkType').value;
    const btn = document.getElementById('bulkEditSave');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';
    const targetsData = Array.from(selectedCells).map(cell => ({
      no: cell.dataset.no,
      dates: expandDates(cell.dataset.date, cell.dataset.dateEnd)
    }));
    try {
      setSyncBadge('connecting', 'Menyimpan...');
      for (const t of targetsData) {
        for (const dStr of t.dates) {
          await setScheduleCell(key(t.no, dStr), { text, type });
        }
      }
      setSyncBadge('online', 'Online');
      overlay.remove();
      showToast('success', 'Berjaya edit', `${totalCells} sel dikemaskini`);
      clearSelection();
    } catch (err) {
      showToast('error', 'Gagal simpan', err.message);
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-save"></i> Simpan';
    }
  });
  document.getElementById('bulkText').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('bulkEditSave').click();
  });
}

// KEYBOARD NAVIGATION
function setFocusedCell(cell) {
  document.querySelectorAll('td.cell.focused').forEach(c => c.classList.remove('focused'));
  if (cell) {
    focusedCell = cell;
    cell.classList.add('focused');
    cell.setAttribute('tabindex', '0');
    if (!IS_MOBILE) {
      cell.focus();
    }
    cell.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  } else {
    focusedCell = null;
    if (document.activeElement && document.activeElement.blur && 
        document.activeElement.tagName === 'TD') {
      document.activeElement.blur();
    }
  }
}

function getAllCells() {
  return Array.from(document.querySelectorAll('td.cell'));
}

function getCellPosition(cell) {
  if (!cell) return null;
  const cells = getAllCells();
  const cellIdx = cells.indexOf(cell);
  if (cellIdx === -1) return null;
  
  const no = cell.dataset.no;
  const date = cell.dataset.date;
  
  const rows = [...new Set(cells.map(c => c.dataset.no))];
  const cols = [...new Set(cells.map(c => c.dataset.date))].sort();
  
  const rowIdx = rows.indexOf(no);
  const colIdx = cols.indexOf(date);
  
  return { rowIdx, colIdx, rows, cols, testerNo: no, dateStr: date };
}

function findCellAt(rowIdx, colIdx) {
  const cells = getAllCells();
  if (cells.length === 0) return null;
  const rows = [...new Set(cells.map(c => c.dataset.no))];
  const cols = [...new Set(cells.map(c => c.dataset.date))].sort();
  if (rowIdx < 0 || rowIdx >= rows.length) return null;
  if (colIdx < 0 || colIdx >= cols.length) return null;
  const targetNo = rows[rowIdx];
  const targetDate = cols[colIdx];
  return cells.find(c => c.dataset.no === targetNo && c.dataset.date === targetDate);
}

function moveFocus(direction) {
  if (!focusedCell) {
    const first = getAllCells()[0];
    if (first) setFocusedCell(first);
    return;
  }
  const pos = getCellPosition(focusedCell);
  if (!pos) return;
  let newRow = pos.rowIdx;
  let newCol = pos.colIdx;
  switch (direction) {
    case 'up': newRow--; break;
    case 'down': newRow++; break;
    case 'left': newCol--; break;
    case 'right': newCol++; break;
    case 'home': newCol = 0; break;
    case 'end': newCol = pos.cols.length - 1; break;
  }
  const targetCell = findCellAt(newRow, newCol);
  if (targetCell) {
    setFocusedCell(targetCell);
    lastClickedCell = targetCell;
  }
}

async function clearFocusedCell() {
  if (!focusedCell) return;
  const no = focusedCell.dataset.no;
  const dateStr = focusedCell.dataset.date;
  const dateEnd = focusedCell.dataset.dateEnd || dateStr;
  const dates = expandDates(dateStr, dateEnd);
  try {
    setSyncBadge('connecting', 'Memadam...');
    for (const dStr of dates) {
      await setScheduleCell(key(no, dStr), { text: '', type: '' });
    }
    setSyncBadge('online', 'Online');
    showToast('success', 'Cleared');
  } catch (err) {}
}

function copyFocusedCell() {
  if (!focusedCell) return;
  const no = focusedCell.dataset.no;
  const dateStr = focusedCell.dataset.date;
  const data = schedule[key(no, dateStr)] || { text: '', type: '' };
  clipboard = { text: data.text || '', type: data.type || '' };
  focusedCell.style.transition = 'none';
  focusedCell.style.outline = '3px solid #10b981';
  setTimeout(() => {
    if (focusedCell) {
      focusedCell.style.outline = '';
      focusedCell.style.transition = '';
    }
  }, 400);
  showToast('info', 'Copied', clipboard.text || '(kosong)');
}

async function pasteToFocusedCell() {
  if (!focusedCell || !clipboard) return;
  const no = focusedCell.dataset.no;
  const dateStr = focusedCell.dataset.date;
  const dateEnd = focusedCell.dataset.dateEnd || dateStr;
  const dates = expandDates(dateStr, dateEnd);
  try {
    setSyncBadge('connecting', 'Menyimpan...');
    for (const dStr of dates) {
      await setScheduleCell(key(no, dStr), clipboard);
    }
    setSyncBadge('online', 'Online');
    showToast('success', 'Pasted');
  } catch (err) {
    showToast('error', 'Gagal paste', err.message);
  }
}

function editFocusedCell() {
  if (!focusedCell) return;
  openModal(focusedCell);
}

function selectFocusedRow() {
  if (!focusedCell) return;
  const no = focusedCell.dataset.no;
  clearSelection();
  document.querySelectorAll('td.cell').forEach(cell => {
    if (cell.dataset.no === no) {
      selectedCells.add(cell);
      cell.classList.add('selected');
    }
  });
  updateBulkCount();
}

function selectFocusedColumn() {
  if (!focusedCell) return;
  const dateStr = focusedCell.dataset.date;
  clearSelection();
  document.querySelectorAll('td.cell').forEach(cell => {
    if (cell.dataset.date === dateStr) {
      selectedCells.add(cell);
      cell.classList.add('selected');
    }
  });
  updateBulkCount();
}

function extendSelection(direction) {
  if (!focusedCell) return;
  const pos = getCellPosition(focusedCell);
  if (!pos) return;
  let newRow = pos.rowIdx;
  let newCol = pos.colIdx;
  switch (direction) {
    case 'up': newRow--; break;
    case 'down': newRow++; break;
    case 'left': newCol--; break;
    case 'right': newCol++; break;
  }
  const targetCell = findCellAt(newRow, newCol);
  if (targetCell) {
    if (selectedCells.size === 0) {
      selectedCells.add(focusedCell);
      focusedCell.classList.add('selected');
    }
    if (!selectedCells.has(targetCell)) {
      selectedCells.add(targetCell);
      targetCell.classList.add('selected');
    }
    setFocusedCell(targetCell);
    updateBulkCount();
    lastClickedCell = targetCell;
  }
}

function attachKeyboardNav() {
  if (IS_MOBILE) return;
  document.querySelectorAll('td.cell').forEach(cell => {
    if (!cell.hasAttribute('tabindex')) {
      cell.setAttribute('tabindex', '0');
    }
    cell.onfocus = () => {
      if (focusedCell !== cell) {
        setFocusedCell(cell);
        lastClickedCell = cell;
      }
    };
  });
}

function initKeyboardNav() {
  if (IS_MOBILE) return;
  
  document.querySelectorAll('td.cell').forEach(cell => {
    if (!cell.hasAttribute('tabindex')) {
      cell.setAttribute('tabindex', '0');
    }
  });
  
  document.addEventListener('keydown', async (e) => {
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    
    const activeModal = document.querySelector('.modal-overlay.active');
    if (activeModal) return;
    
    if (e.key === 'Escape' && contextMenu.classList.contains('active')) {
      hideContextMenu();
      return;
    }
    
    if (!focusedCell) {
      if (['ArrowDown', 'ArrowRight', 'Tab'].includes(e.key)) {
        e.preventDefault();
        const first = getAllCells()[0];
        if (first) setFocusedCell(first);
      }
      return;
    }
    
    const isCtrl = e.ctrlKey || e.metaKey;
    const isShift = e.shiftKey;
    
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (isShift) extendSelection('up'); else moveFocus('up');
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (isShift) extendSelection('down'); else moveFocus('down');
      return;
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (isShift) extendSelection('left'); else moveFocus('left');
      return;
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (isShift) extendSelection('right'); else moveFocus('right');
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      if (isShift) moveFocus('left'); else moveFocus('right');
      return;
    }
    
    if (e.key === 'Enter') {
      e.preventDefault();
      if (isShift) moveFocus('up');
      else editFocusedCell();
      return;
    }
    if (e.key === 'F2') {
      e.preventDefault();
      editFocusedCell();
      return;
    }
    
    if (e.key === 'Home') {
      e.preventDefault();
      if (isCtrl) {
        const first = getAllCells()[0];
        if (first) setFocusedCell(first);
      } else {
        moveFocus('home');
      }
      return;
    }
    if (e.key === 'End') {
      e.preventDefault();
      if (isCtrl) {
        const all = getAllCells();
        if (all.length) setFocusedCell(all[all.length - 1]);
      } else {
        moveFocus('end');
      }
      return;
    }
    
    if (isCtrl && (e.key === 'c' || e.key === 'C')) {
      e.preventDefault();
      copyFocusedCell();
      return;
    }
    if (isCtrl && (e.key === 'v' || e.key === 'V')) {
      e.preventDefault();
      await pasteToFocusedCell();
      return;
    }
    if (isCtrl && (e.key === 'x' || e.key === 'X')) {
      e.preventDefault();
      copyFocusedCell();
      await clearFocusedCell();
      return;
    }
    
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      await clearFocusedCell();
      return;
    }
    
    if (isCtrl && (e.key === 'a' || e.key === 'A')) {
      e.preventDefault();
      selectFocusedColumn();
      return;
    }
    
    if (isCtrl && e.key === ' ') {
      e.preventDefault();
      selectFocusedRow();
      return;
    }
    
    if (e.key === 'Escape') {
      clearSelection();
      setFocusedCell(null);
      hideContextMenu();
      return;
    }
  });
}

// INIT
window.addEventListener('firebase-ready', () => {
  console.log('[QA] Firebase ready');
  console.log('[QA] Mobile mode:', IS_MOBILE);
  FB = window.FB;
  setSyncBadge('connecting', 'Menyambung...');

  showSkeletonLoader(getWeekDates(currentMonday));

  listenTesters();
  listenSchedule();
  listenTrash();

  setTimeout(() => setSyncBadge('online', 'Online'), 2000);
  setTimeout(autoPurgeTrash, 5000);

  document.getElementById('copyPrevWeekBtn').addEventListener('click', copyPreviousWeek);

  initAnalytics();
  initKeyboardNav();
  initWeekNavigation();

  document.getElementById('leaveReportBtn').addEventListener('click', openLeaveReport);

  syncWeekPicker();
});