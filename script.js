// script.js — Full version (tanpa phone field)
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

// PRESENCE
const AVAILABLE_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'];
let currentUser = null;
let onlineUsers = [];
let lastHoverKey = null;
let hoverThrottleTimer = null;
let presenceListener = null;
let heartbeatTimer = null;

// CHART
let charts = { bar: null, doughnut: null, line: null };
const CHART_COLORS = {
  office: '#10b981', wfh: '#3b82f6', al: '#f59e0b',
  mc: '#ef4444', task: '#8b5cf6', public: '#eab308', kosong: '#cbd5e1'
};

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
  } catch (err) { alert('Gagal restore: ' + err.message); }
}

async function deletePermanently(trashId) {
  if (!confirm('Padam item ini secara kekal?')) return;
  const { db, doc, deleteDoc } = FB;
  try { await deleteDoc(doc(db, 'trash', trashId)); } catch (err) {}
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

// PRESENCE
function generateUserId() {
  return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function pickRandomColor() {
  return AVAILABLE_COLORS[Math.floor(Math.random() * AVAILABLE_COLORS.length)];
}

function loadUserFromStorage() {
  try {
    const stored = sessionStorage.getItem('qaRosterUser');
    if (stored) {
      currentUser = JSON.parse(stored);
      if (currentUser && currentUser.id && currentUser.name) return true;
    }
  } catch (e) {}
  return false;
}

function saveUserToStorage() {
  if (currentUser) sessionStorage.setItem('qaRosterUser', JSON.stringify(currentUser));
}

function showNameModal() {
  const modal = document.getElementById('nameModal');
  const nameInput = document.getElementById('displayName');
  const colorPicker = document.getElementById('colorPicker');
  const tempId = generateUserId();
  let selectedColor = pickRandomColor();

  colorPicker.innerHTML = AVAILABLE_COLORS.map(c =>
    `<div class="color-option ${c === selectedColor ? 'selected' : ''}" style="background:${c}; color:${c};" data-color="${c}"></div>`
  ).join('');

  colorPicker.querySelectorAll('.color-option').forEach(el => {
    el.addEventListener('click', () => {
      colorPicker.querySelectorAll('.color-option').forEach(x => x.classList.remove('selected'));
      el.classList.add('selected');
      selectedColor = el.dataset.color;
    });
  });

  modal.classList.add('active');
  setTimeout(() => nameInput.focus(), 100);

  document.getElementById('nameSaveBtn').onclick = () => {
    const name = nameInput.value.trim();
    if (!name) { alert('Sila isi nama.'); return; }
    if (name.length > 20) { alert('Nama terlalu panjang.'); return; }
    currentUser = { id: tempId, name: name, color: selectedColor };
    saveUserToStorage();
    modal.classList.remove('active');
    startPresence();
    updateUsersOnlinePanel();
  };

  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('nameSaveBtn').click();
  });
}

async function updateMyPresence(cellKey = null) {
  if (!currentUser || !FB) return;
  const { db, doc, setDoc } = FB;
  try {
    await setDoc(doc(db, 'presence', currentUser.id), {
      id: currentUser.id,
      name: currentUser.name,
      color: currentUser.color,
      cellKey: cellKey || '',
      lastSeen: Date.now()
    });
  } catch (err) {}
}

async function clearMyPresence() {
  if (!currentUser || !FB) return;
  const { db, doc, deleteDoc } = FB;
  try { await deleteDoc(doc(db, 'presence', currentUser.id)); } catch (err) {}
}

function listenPresence() {
  if (!FB) return;
  const { db, collection, onSnapshot } = FB;
  presenceListener = onSnapshot(collection(db, 'presence'), (snap) => {
    const now = Date.now();
    const allUsers = [];
    snap.forEach(d => {
      const data = d.data();
      if (data.id === currentUser?.id) return;
      if (now - data.lastSeen > 30000) return;
      allUsers.push(data);
    });
    onlineUsers = allUsers;
    renderPresenceCursors();
    updateUsersOnlinePanel();
  }, (err) => {});
}

function renderPresenceCursors() {
  document.querySelectorAll('.presence-cursor').forEach(el => el.remove());
  document.querySelectorAll('td.cell.has-presence').forEach(el => {
    el.classList.remove('has-presence');
    el.style.removeProperty('--presence-color');
  });
  onlineUsers.forEach(user => {
    if (!user.cellKey) return;
    const [no, dateStr] = user.cellKey.split('|');
    const cell = document.querySelector(`td.cell[data-no="${no}"][data-date="${dateStr}"]`);
    if (!cell) return;
    cell.classList.add('has-presence');
    cell.style.setProperty('--presence-color', user.color);
    const cursor = document.createElement('div');
    cursor.className = 'presence-cursor';
    cursor.style.background = user.color;
    cursor.innerHTML = `<i class="fas fa-pencil"></i>${user.name}`;
    cell.appendChild(cursor);
  });
}

function updateUsersOnlinePanel() {
  const panel = document.getElementById('usersOnlinePanel');
  if (!panel) return;
  if (onlineUsers.length === 0) {
    panel.innerHTML = `<span class="users-online-empty">Hanya anda online</span>`;
    return;
  }
  const avatars = onlineUsers.slice(0, 5).map(u =>
    `<div class="user-avatar" style="background:${u.color}" title="${u.name}">${u.name.charAt(0).toUpperCase()}</div>`
  ).join('');
  const more = onlineUsers.length > 5 ? `<span style="margin-left:.3rem;">+${onlineUsers.length - 5}</span>` : '';
  panel.innerHTML = `<span style="margin-right:.3rem; color:#94a3b8; font-size:.7rem;">${onlineUsers.length} online:</span>${avatars}${more}`;
}

function attachHoverPresence() {
  document.querySelectorAll('td.cell').forEach(cell => {
    cell.addEventListener('mouseenter', () => {
      if (!currentUser) return;
      const no = cell.dataset.no;
      const dateStr = cell.dataset.date;
      const k = `${no}|${dateStr}`;
      if (k === lastHoverKey) return;
      lastHoverKey = k;
      if (hoverThrottleTimer) return;
      hoverThrottleTimer = setTimeout(() => {
        hoverThrottleTimer = null;
        updateMyPresence(k);
      }, 300);
    });
  });
}

function startHeartbeat() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = setInterval(() => {
    if (currentUser) updateMyPresence(lastHoverKey || '');
  }, 10000);
}

function startPresence() {
  listenPresence();
  startHeartbeat();
  updateMyPresence('');
}

window.addEventListener('beforeunload', () => {
  if (currentUser && FB) clearMyPresence();
});

// ANALYTICS
function kiraStatistikMinggu(monday) {
  const days = getWeekDates(monday);
  const stats = { office: 0, wfh: 0, al: 0, mc: 0, task: 0, public: 0, kosong: 0, total: 0 };
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
      labels: ['🏢 Office', '🏠 WFH', '✈️ Cuti', '📝 MC', '📅 Task'],
      datasets: [{
        data: [stats.office, stats.wfh, stats.al, stats.mc, stats.task],
        backgroundColor: [CHART_COLORS.office, CHART_COLORS.wfh, CHART_COLORS.al, CHART_COLORS.mc, CHART_COLORS.task],
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

  const doughnutData = [stats.office, stats.wfh, stats.al, stats.mc, stats.task].filter(v => v > 0);
  const doughnutLabels = [
    { label: 'Office', value: stats.office, color: CHART_COLORS.office },
    { label: 'WFH', value: stats.wfh, color: CHART_COLORS.wfh },
    { label: 'Cuti', value: stats.al, color: CHART_COLORS.al },
    { label: 'MC', value: stats.mc, color: CHART_COLORS.mc },
    { label: 'Task', value: stats.task, color: CHART_COLORS.task }
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
        { label: '📅 Task', data: taskData, borderColor: CHART_COLORS.task, backgroundColor: 'rgba(139,92,246,.1)', tension: 0.4, fill: true, borderWidth: 3, pointRadius: 6, pointBackgroundColor: '#fff', pointBorderColor: CHART_COLORS.task, pointBorderWidth: 3, pointHoverRadius: 8 }
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

// STATISTIK (header cards)
function kiraStatistik(days) {
  const stats = { tester: testers.length, office: 0, wfh: 0, al: 0, mc: 0, task: 0, public: 0, kosong: 0 };
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
    tbody.innerHTML = `<tr><td colspan="${days.length + 4}" style="padding:2rem;color:#94a3b8;">Memuatkan tester...</td></tr>`;
    return;
  }
  if (filteredTesters.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${days.length + 4}" style="padding:2rem;color:#94a3b8;text-align:center;">🔍 Tiada tester sepadan dengan "<strong>${searchQuery}</strong>"</td></tr>`;
    return;
  }

  let html = '';
  filteredTesters.forEach((t, idx) => {
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
                   title="${dateLabel}">
                   ${displayText}
               </td>`;
      i += span;
    }
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
  attachHoverPresence();
  renderPresenceCursors();
}

function renderAll() {
  const days = getWeekDates(currentMonday);
  renderHeader(days);
  renderBody(days);
  updateWeekBadge(days);
  renderStatistik(days);
  updateTodayBanner();
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
    closeModal();
  } catch (err) {
    alert('Gagal simpan: ' + err.message);
    setSyncBadge('offline', 'Ralat');
  }
});

modalText.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('modalSave').click();
});

// MODAL: TESTER (tanpa phone)
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
    if (editingTesterNo !== null && editingTesterNo !== no) await removeTester(editingTesterNo);
    await setTester({ no, name, unit });
    setSyncBadge('online', 'Online');
    closeTesterModal();
  } catch (err) {
    alert('Gagal simpan: ' + err.message);
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
      } catch (err) {
        alert('Gagal padam: ' + err.message);
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
  if (keysToDelete.length === 0) { alert('Tiada data untuk dipadam minggu ini.'); return; }
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
      } catch (err) {
        alert('Gagal padam: ' + err.message);
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
    alert('Tiada data untuk disalin.');
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
    alert(`✅ Berjaya copy ${berjaya}/${toCopy.length} sel.`);
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

// SCREENSHOT
const screenshotBtn = document.getElementById('screenshotBtn');
screenshotBtn.addEventListener('click', async () => {
  if (typeof html2canvas === 'undefined') { alert('Library screenshot tak load.'); return; }
  const originalText = screenshotBtn.innerHTML;
  screenshotBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyediakan...';
  screenshotBtn.classList.add('loading');
  try {
    document.body.classList.add('screenshot-mode');
    const target = document.querySelector('.table-card');
    await new Promise(r => setTimeout(r, 100));
    const canvas = await html2canvas(target, {
      backgroundColor: '#ffffff', scale: 2, useCORS: true, logging: false
    });
    document.body.classList.remove('screenshot-mode');
    const weekNum = getWeekNumber(currentMonday);
    const firstDay = formatShortDate(getWeekDates(currentMonday)[0].dateStr);
    const lastDay = formatShortDate(getWeekDates(currentMonday)[6].dateStr);
    const fileName = `QA-Roster_Week${weekNum}_${firstDay}-${lastDay}.png`;
    const link = document.createElement('a');
    link.download = fileName;
    link.href = canvas.toDataURL('image/png');
    link.click();
    screenshotBtn.innerHTML = '<i class="fas fa-check"></i> Selesai!';
    setTimeout(() => {
      screenshotBtn.innerHTML = originalText;
      screenshotBtn.classList.remove('loading');
    }, 2000);
  } catch (err) {
    document.body.classList.remove('screenshot-mode');
    alert('Gagal screenshot: ' + err.message);
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
  if (selectedCells.size > 0) bulkBar.classList.add('active');
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

function attachCellEvents() {
  document.querySelectorAll('td.cell').forEach(cell => {
    cell.addEventListener('click', (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault(); e.stopPropagation();
        toggleCellSelection(cell);
        lastClickedCell = cell;
        return;
      }
      if (e.shiftKey && lastClickedCell) {
        e.preventDefault(); e.stopPropagation();
        rangeSelect(lastClickedCell, cell);
        return;
      }
      if (selectedCells.size > 0) {
        e.preventDefault(); e.stopPropagation();
        toggleCellSelection(cell, true);
        lastClickedCell = cell;
        return;
      }
      openModal(cell);
      lastClickedCell = cell;
    });
    cell.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (!selectedCells.has(cell)) clearSelection();
      lastClickedCell = cell;
      showContextMenu(e.pageX, e.pageY, cell);
    });
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

document.addEventListener('click', (e) => {
  if (!contextMenu.contains(e.target)) hideContextMenu();
});
document.addEventListener('scroll', hideContextMenu, true);
document.addEventListener('contextmenu', (e) => {
  if (!e.target.closest('td.cell')) hideContextMenu();
});

function copyCell(cell) {
  const no = cell.dataset.no;
  const data = schedule[key(no, cell.dataset.date)] || { text: '', type: '' };
  clipboard = { text: data.text || '', type: data.type || '' };
  cell.style.transition = 'none';
  cell.style.outline = '3px solid #10b981';
  setTimeout(() => { cell.style.outline = ''; cell.style.transition = ''; }, 400);
}

async function pasteToCells(cells) {
  if (!clipboard) { alert('Tiada apa untuk paste.'); return; }
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
  } catch (err) {
    alert('Gagal paste: ' + err.message);
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
  } catch (err) {}
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
  } catch (err) {}
  hideContextMenu();
});

document.addEventListener('keydown', async (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
  if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
    const cell = selectedCells.size > 0 ? Array.from(selectedCells)[0] : lastClickedCell;
    if (cell) { e.preventDefault(); copyCell(cell); }
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
    e.preventDefault();
    const targets = selectedCells.size > 0 ? Array.from(selectedCells) : (lastClickedCell ? [lastClickedCell] : []);
    if (targets.length > 0 && clipboard) await pasteToCells(targets);
  }
  if (e.key === 'Escape') { clearSelection(); hideContextMenu(); }
  if (e.key === 'Enter' && selectedCells.size > 0) {
    e.preventDefault();
    openBulkEditModal();
  }
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
    clearSelection();
  } catch (err) {}
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
        <input type="text" id="bulkText" placeholder="Contoh: Office, WFH, LL25">
      </div>
      <div class="form-group"><label>Jenis (warna)</label>
        <select id="bulkType">
          <option value="">— Kosong —</option>
          <option value="office">Office</option>
          <option value="wfh">WFH</option>
          <option value="al">AL (Cuti)</option>
          <option value="mc">MC</option>
          <option value="public">Public Holiday</option>
          <option value="task">Outstation</option>
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
      clearSelection();
    } catch (err) {
      alert('Gagal simpan: ' + err.message);
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-save"></i> Simpan';
    }
  });
  document.getElementById('bulkText').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('bulkEditSave').click();
  });
}

// INIT
window.addEventListener('firebase-ready', () => {
  console.log('[QA] Firebase ready');
  FB = window.FB;
  setSyncBadge('connecting', 'Menyambung...');

  listenTesters();
  listenSchedule();
  listenTrash();

  setTimeout(() => setSyncBadge('online', 'Online'), 2000);
  setTimeout(autoPurgeTrash, 5000);

  renderAll();

  document.getElementById('copyPrevWeekBtn').addEventListener('click', copyPreviousWeek);

  // Init Analytics
  initAnalytics();

  // Init presence
  if (!loadUserFromStorage()) {
    showNameModal();
  } else {
    startPresence();
    updateUsersOnlinePanel();
  }
});