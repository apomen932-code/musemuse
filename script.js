const STORAGE_KEY = 'private_archive_prototype_v1';
const PIN_KEY = 'private_archive_pin_v1';
const AUTO_LOCK_MS = 90 * 1000;

const defaultWorks = [
  {
    id: 'w1',
    title: 'Night Library',
    actress: 'Airi K.',
    code: 'NL-102',
    tags: ['落ち着きたい', '再視聴向き'],
    image: 'https://picsum.photos/seed/archive1/300/400'
  },
  {
    id: 'w2',
    title: 'Blue Window',
    actress: 'Mio S.',
    code: 'BW-214',
    tags: ['新規開拓', '短時間'],
    image: 'https://picsum.photos/seed/archive2/300/400'
  },
  {
    id: 'w3',
    title: 'Soft Signal',
    actress: 'Rena T.',
    code: 'SS-087',
    tags: ['夜向け', '安定枠'],
    image: 'https://picsum.photos/seed/archive3/300/400'
  }
];

const optionSets = {
  situation: ['寝る前', '暇つぶし', '気分転換', 'しっかり見たい', 'お気に入りを見たい', '新規開拓したい', '短時間で済ませたい', 'なんとなく'],
  mood: ['落ち着きたい', '癒されたい', '刺激が欲しい', '外したくない', '冒険したい', 'ぼーっと見たい'],
  selectionType: ['新規', '再視聴'],
  expectation: ['低め', '普通', '高い']
};

let state = loadState();
let currentWorkId = null;
let longPressTimer = null;
let autoLockTimer = null;
let selectedOptions = {
  situation: 'なんとなく',
  mood: '落ち着きたい',
  selectionType: '新規',
  expectation: '普通'
};

const coverScreen = document.getElementById('coverScreen');
const vaultScreen = document.getElementById('vaultScreen');
const pinModal = document.getElementById('pinModal');
const selectModal = document.getElementById('selectModal');
const helpModal = document.getElementById('helpModal');
const coverLogo = document.getElementById('coverLogo');
const pinInput = document.getElementById('pinInput');
const pinError = document.getElementById('pinError');
const worksList = document.getElementById('worksList');
const recentLogs = document.getElementById('recentLogs');

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try { return JSON.parse(raw); } catch (_) {}
  }
  return { works: [...defaultWorks], logs: [] };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getPin() {
  const pin = localStorage.getItem(PIN_KEY);
  if (!pin) {
    localStorage.setItem(PIN_KEY, '2468');
    return '2468';
  }
  return pin;
}

function showScreen(name) {
  coverScreen.classList.toggle('active', name === 'cover');
  vaultScreen.classList.toggle('active', name === 'vault');
  document.title = name === 'cover' ? 'My Archive' : 'Library Vault';
}

function openModal(modal) {
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
}

function closeModal(modal) {
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
}

function renderWorks() {
  worksList.innerHTML = '';
  state.works.forEach(work => {
    const card = document.createElement('article');
    card.className = 'work-card';
    card.innerHTML = `
      <img src="${work.image}" alt="${escapeHtml(work.title)}">
      <div>
        <h3 class="work-title">${escapeHtml(work.title)}</h3>
        <p class="work-meta">${escapeHtml(work.actress)} ・ ${escapeHtml(work.code)}</p>
        <div class="tagline">${work.tags.map(tag => `<span class="mini-tag">${escapeHtml(tag)}</span>`).join('')}</div>
        <div class="card-actions">
          <button class="primary-btn" data-action="select" data-id="${work.id}">これを選んだ</button>
        </div>
      </div>
    `;
    worksList.appendChild(card);
  });
}

function renderLogs() {
  if (state.logs.length === 0) {
    recentLogs.className = 'log-list empty-state';
    recentLogs.textContent = 'まだ記録がありません。';
    return;
  }
  recentLogs.className = 'log-list';
  recentLogs.innerHTML = '';
  [...state.logs].sort((a, b) => new Date(b.selectedAt) - new Date(a.selectedAt)).slice(0, 8).forEach(log => {
    const item = document.createElement('article');
    item.className = 'log-item';
    item.innerHTML = `
      <div class="log-head">
        <h3 class="log-title">${escapeHtml(log.workTitle)} / ${escapeHtml(log.actress)}</h3>
        <span class="log-date">${formatDate(log.selectedAt)}</span>
      </div>
      <div class="chip-row">
        <span class="chip">${escapeHtml(log.situation)}</span>
        <span class="chip">${escapeHtml(log.mood)}</span>
        <span class="chip">${escapeHtml(log.selectionType)}</span>
        <span class="chip">期待値:${escapeHtml(log.expectation)}</span>
      </div>
    `;
    recentLogs.appendChild(item);
  });
}

function renderSummary() {
  document.getElementById('totalSelections').textContent = String(state.logs.length);
  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthly = state.logs.filter(log => log.selectedAt.startsWith(currentMonth)).length;
  document.getElementById('monthlySelections').textContent = String(monthly);
  const rewatch = state.logs.filter(log => log.selectionType === '再視聴').length;
  const rate = state.logs.length ? Math.round((rewatch / state.logs.length) * 100) : 0;
  document.getElementById('rewatchRate').textContent = `${rate}%`;
}

function renderStats() {
  renderStatBlock('situationStats', countBy(state.logs, 'situation'));
  renderStatBlock('moodStats', countBy(state.logs, 'mood'));
  renderStatBlock('actressStats', countBy(state.logs, 'actress'));
}

function renderStatBlock(targetId, map) {
  const target = document.getElementById(targetId);
  const entries = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (!entries.length) {
    target.innerHTML = '<p class="hint">まだデータがありません。</p>';
    return;
  }
  target.innerHTML = entries.map(([key, value]) => `
    <div class="stat-line">
      <span>${escapeHtml(key)}</span>
      <strong>${value}</strong>
    </div>
  `).join('');
}

function countBy(arr, key) {
  return arr.reduce((acc, item) => {
    acc[item[key]] = (acc[item[key]] || 0) + 1;
    return acc;
  }, {});
}

function renderAll() {
  renderWorks();
  renderLogs();
  renderSummary();
  renderStats();
}

function openSelectionModal(workId) {
  currentWorkId = workId;
  const work = state.works.find(w => w.id === workId);
  if (!work) return;
  document.getElementById('modalImage').src = work.image;
  document.getElementById('modalTitle').textContent = work.title;
  document.getElementById('modalSubtitle').textContent = `${work.actress} ・ ${work.code}`;
  buildOptionButtons('situationOptions', 'situation');
  buildOptionButtons('moodOptions', 'mood');
  buildOptionButtons('selectionTypeOptions', 'selectionType');
  buildOptionButtons('expectationOptions', 'expectation');
  openModal(selectModal);
}

function buildOptionButtons(targetId, key) {
  const target = document.getElementById(targetId);
  target.innerHTML = '';
  optionSets[key].forEach(option => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `option-btn ${selectedOptions[key] === option ? 'active' : ''}`;
    btn.textContent = option;
    btn.addEventListener('click', () => {
      selectedOptions[key] = option;
      buildOptionButtons(targetId, key);
    });
    target.appendChild(btn);
  });
}

function saveSelection() {
  const work = state.works.find(w => w.id === currentWorkId);
  if (!work) return;
  const log = {
    id: crypto.randomUUID(),
    workId: work.id,
    workTitle: work.title,
    actress: work.actress,
    selectedAt: new Date().toISOString(),
    ...selectedOptions
  };
  state.logs.push(log);
  saveState();
  renderAll();
  closeModal(selectModal);
}

function openPin() {
  pinInput.value = '';
  pinError.textContent = '';
  openModal(pinModal);
  setTimeout(() => pinInput.focus(), 50);
}

function unlock() {
  if (pinInput.value !== getPin()) {
    pinError.textContent = 'PINが違います。';
    return;
  }
  closeModal(pinModal);
  showScreen('vault');
  resetAutoLock();
}

function panicHide() {
  showScreen('cover');
  closeModal(selectModal);
  closeModal(pinModal);
  clearTimeout(autoLockTimer);
}

function resetAutoLock() {
  clearTimeout(autoLockTimer);
  autoLockTimer = setTimeout(() => {
    panicHide();
  }, AUTO_LOCK_MS);
}

function exportJson() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `archive-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function restoreSamples() {
  state.works = [...defaultWorks];
  saveState();
  renderAll();
}

function formatDate(value) {
  return new Date(value).toLocaleString('ja-JP', {
    month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

coverLogo.addEventListener('pointerdown', () => {
  longPressTimer = setTimeout(openPin, 2200);
});
['pointerup', 'pointerleave', 'pointercancel'].forEach(eventName => {
  coverLogo.addEventListener(eventName, () => clearTimeout(longPressTimer));
});

document.getElementById('unlockBtn').addEventListener('click', unlock);
document.getElementById('closePinBtn').addEventListener('click', () => closeModal(pinModal));
document.getElementById('panicBtn').addEventListener('click', panicHide);
document.getElementById('saveSelectionBtn').addEventListener('click', saveSelection);
document.getElementById('cancelSelectBtn').addEventListener('click', () => closeModal(selectModal));
document.getElementById('coverHelpBtn').addEventListener('click', () => openModal(helpModal));
document.getElementById('closeHelpBtn').addEventListener('click', () => closeModal(helpModal));
document.getElementById('exportBtn').addEventListener('click', exportJson);
document.getElementById('addSampleBtn').addEventListener('click', restoreSamples);
pinInput.addEventListener('keydown', e => { if (e.key === 'Enter') unlock(); });

worksList.addEventListener('click', e => {
  const button = e.target.closest('[data-action="select"]');
  if (!button) return;
  openSelectionModal(button.dataset.id);
});

['click', 'touchstart', 'keydown', 'scroll'].forEach(eventName => {
  vaultScreen.addEventListener(eventName, () => {
    if (vaultScreen.classList.contains('active')) resetAutoLock();
  }, { passive: true });
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && vaultScreen.classList.contains('active')) panicHide();
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

renderAll();
showScreen('cover');
