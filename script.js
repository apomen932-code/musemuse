const STORAGE_KEY = 'private_archive_prototype_v2';
const PIN_KEY = 'private_archive_pin_v2';
const AUTO_LOCK_MS = 90 * 1000;
const SECRET_KEYWORD = 'vault2468';
const HOLD_MS = 1800;

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
  expectation: ['低め', '普通', '高い'],
  satisfaction: ['未入力', '1', '2', '3', '4', '5']
};

let state = loadState();
let currentWorkId = null;
let longPressTimer = null;
let autoLockTimer = null;
let tapCount = 0;
let tapResetTimer = null;
let selectedOptions = getDefaultSelectedOptions();
let workSearchTerm = '';

const coverScreen = document.getElementById('coverScreen');
const vaultScreen = document.getElementById('vaultScreen');
const pinModal = document.getElementById('pinModal');
const selectModal = document.getElementById('selectModal');
const workModal = document.getElementById('workModal');
const settingsModal = document.getElementById('settingsModal');
const helpModal = document.getElementById('helpModal');
const coverLogo = document.getElementById('coverLogo');
const pinInput = document.getElementById('pinInput');
const pinError = document.getElementById('pinError');
const worksList = document.getElementById('worksList');
const recentLogs = document.getElementById('recentLogs');
const workSearch = document.getElementById('workSearch');
const importFileInput = document.getElementById('importFileInput');
const coverSearch = document.getElementById('coverSearch');

function getDefaultSelectedOptions() {
  return {
    situation: 'なんとなく',
    mood: '落ち着きたい',
    selectionType: '新規',
    expectation: '普通',
    satisfaction: '未入力'
  };
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      parsed.works = Array.isArray(parsed.works) ? parsed.works : [...defaultWorks];
      parsed.logs = Array.isArray(parsed.logs) ? parsed.logs : [];
      return parsed;
    } catch (_) {}
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
  const term = workSearchTerm.trim().toLowerCase();
  const works = [...state.works].filter(work => {
    if (!term) return true;
    return [work.title, work.actress, work.code, ...(work.tags || [])].join(' ').toLowerCase().includes(term);
  });
  if (works.length === 0) {
    worksList.innerHTML = '<div class="empty-state">該当する作品がありません。</div>';
    return;
  }
  works.forEach(work => {
    const card = document.createElement('article');
    card.className = 'work-card';
    card.innerHTML = `
      <img src="${escapeHtml(work.image || '')}" alt="${escapeHtml(work.title)}">
      <div>
        <h3 class="work-title">${escapeHtml(work.title)}</h3>
        <p class="work-meta">${escapeHtml(work.actress)} ・ ${escapeHtml(work.code)}</p>
        <div class="tagline">${(work.tags || []).map(tag => `<span class="mini-tag">${escapeHtml(tag)}</span>`).join('')}</div>
        <div class="card-actions">
          <button class="primary-btn" data-action="select" data-id="${work.id}">これを選んだ</button>
          <button class="ghost-btn" data-action="delete-work" data-id="${work.id}">削除</button>
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
  [...state.logs]
    .sort((a, b) => new Date(b.selectedAt) - new Date(a.selectedAt))
    .slice(0, 10)
    .forEach(log => {
      const item = document.createElement('article');
      item.className = 'log-item';
      item.innerHTML = `
        <div class="log-head">
          <div>
            <h3 class="log-title">${escapeHtml(log.workTitle)} / ${escapeHtml(log.actress)}</h3>
            <div class="stat-note">${log.satisfaction && log.satisfaction !== '未入力' ? `満足度 ${escapeHtml(log.satisfaction)} / 5` : '満足度 未入力'}</div>
          </div>
          <div>
            <span class="log-date">${formatDate(log.selectedAt)}</span>
          </div>
        </div>
        <div class="chip-row">
          <span class="chip">${escapeHtml(log.situation)}</span>
          <span class="chip">${escapeHtml(log.mood)}</span>
          <span class="chip">${escapeHtml(log.selectionType)}</span>
          <span class="chip">期待値:${escapeHtml(log.expectation)}</span>
        </div>
        <div class="card-actions">
          <button class="trash-btn" data-action="delete-log" data-id="${log.id}">この記録を削除</button>
        </div>
      `;
      recentLogs.appendChild(item);
    });
}

function renderActressList() {
  const target = document.getElementById('actressList');
  const counts = countBy(state.works, 'actress');
  const entries = Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0], 'ja'));
  if (!entries.length) {
    target.innerHTML = '<p class="hint">まだ登録がありません。</p>';
    return;
  }
  target.innerHTML = entries.map(([name, count]) => `
    <div class="stat-line">
      <div>
        <strong>${escapeHtml(name)}</strong>
        <div class="stat-note">登録作品 ${count}</div>
      </div>
      <span>${count}</span>
    </div>
  `).join('');
}

function renderSummary() {
  document.getElementById('totalSelections').textContent = String(state.logs.length);
  document.getElementById('coverCount').textContent = String(state.logs.length);
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
  renderInsights();
  renderCoverTags();
}

function renderCoverTags() {
  const target = document.getElementById('coverRecentTags');
  const tagCount = {};
  state.works.forEach(work => (work.tags || []).forEach(tag => tagCount[tag] = (tagCount[tag] || 0) + 1));
  const top = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([tag]) => tag);
  target.innerHTML = (top.length ? top : ['夜', '短時間', '再視聴']).map(tag => `<span class="chip">${escapeHtml(tag)}</span>`).join('');
}

function renderInsights() {
  const target = document.getElementById('insightText');
  if (state.logs.length === 0) {
    target.innerHTML = '<p class="hint">まだデータがないので、3件くらい記録すると傾向が見え始めます。</p>';
    return;
  }
  const topSituation = topEntry(countBy(state.logs, 'situation'));
  const topMood = topEntry(countBy(state.logs, 'mood'));
  const topActress = topEntry(countBy(state.logs, 'actress'));
  const avgSat = averageSatisfaction();
  const lines = [
    `いちばん多い状況は「${topSituation?.[0] || '未集計'}」です。`,
    `気分では「${topMood?.[0] || '未集計'}」が目立ちます。`,
    `よく選ぶ女優は「${topActress?.[0] || '未集計'}」です。`,
    avgSat ? `入力済み満足度の平均は ${avgSat.toFixed(1)} / 5 です。` : '満足度はまだ十分に集まっていません。'
  ];
  target.innerHTML = `<p>${lines.join('<br>')}</p>`;
}

function topEntry(map) {
  return Object.entries(map).sort((a, b) => b[1] - a[1])[0] || null;
}

function averageSatisfaction() {
  const values = state.logs.map(log => Number(log.satisfaction)).filter(v => Number.isFinite(v));
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
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
    const value = item?.[key];
    if (!value) return acc;
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function renderAll() {
  renderWorks();
  renderLogs();
  renderActressList();
  renderSummary();
  renderStats();
}

function openSelectionModal(workId) {
  currentWorkId = workId;
  selectedOptions = getDefaultSelectedOptions();
  const work = state.works.find(w => w.id === workId);
  if (!work) return;
  document.getElementById('modalImage').src = work.image || 'https://picsum.photos/seed/fallback/300/400';
  document.getElementById('modalTitle').textContent = work.title;
  document.getElementById('modalSubtitle').textContent = `${work.actress} ・ ${work.code}`;
  buildOptionButtons('situationOptions', 'situation');
  buildOptionButtons('moodOptions', 'mood');
  buildOptionButtons('selectionTypeOptions', 'selectionType');
  buildOptionButtons('expectationOptions', 'expectation');
  buildOptionButtons('satisfactionOptions', 'satisfaction');
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
    id: safeUuid(),
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

function safeUuid() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
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
  [selectModal, pinModal, settingsModal, workModal].forEach(closeModal);
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

function importJson(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(String(reader.result || '{}'));
      if (!Array.isArray(imported.works) || !Array.isArray(imported.logs)) {
        throw new Error('bad data');
      }
      state = imported;
      saveState();
      renderAll();
      alert('読み込みが完了しました。');
    } catch (_) {
      alert('JSONの形式が正しくありません。');
    }
  };
  reader.readAsText(file);
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

function openAddWorkModal() {
  ['workTitleInput','workActressInput','workCodeInput','workImageInput','workTagsInput'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('workError').textContent = '';
  openModal(workModal);
}

function saveWork() {
  const title = document.getElementById('workTitleInput').value.trim();
  const actress = document.getElementById('workActressInput').value.trim();
  const code = document.getElementById('workCodeInput').value.trim();
  const image = document.getElementById('workImageInput').value.trim() || `https://picsum.photos/seed/${Date.now()}/300/400`;
  const tags = document.getElementById('workTagsInput').value.split(',').map(v => v.trim()).filter(Boolean);
  const error = document.getElementById('workError');
  if (!title || !actress || !code) {
    error.textContent = '作品名・女優名・品番は必須です。';
    return;
  }
  state.works.unshift({ id: safeUuid(), title, actress, code, image, tags });
  saveState();
  renderAll();
  closeModal(workModal);
}

function deleteWork(id) {
  const work = state.works.find(item => item.id === id);
  if (!work) return;
  if (!confirm(`「${work.title}」を削除しますか？`)) return;
  state.works = state.works.filter(item => item.id !== id);
  state.logs = state.logs.filter(log => log.workId !== id);
  saveState();
  renderAll();
}

function deleteLog(id) {
  if (!confirm('この記録を削除しますか？')) return;
  state.logs = state.logs.filter(log => log.id !== id);
  saveState();
  renderAll();
}

function saveSettings() {
  const value = document.getElementById('newPinInput').value.trim();
  const error = document.getElementById('settingsError');
  if (!/^\d{4}$/.test(value)) {
    error.textContent = 'PINは4桁の数字で入力してください。';
    return;
  }
  localStorage.setItem(PIN_KEY, value);
  error.textContent = '保存しました。';
  setTimeout(() => closeModal(settingsModal), 500);
}

function resetData() {
  if (!confirm('作品と記録をすべて初期化しますか？')) return;
  state = { works: [...defaultWorks], logs: [] };
  saveState();
  renderAll();
  closeModal(settingsModal);
}

function startLongPress() {
  clearTimeout(longPressTimer);
  longPressTimer = setTimeout(openPin, HOLD_MS);
}

function clearLongPress() {
  clearTimeout(longPressTimer);
}

function handleSecretTap() {
  tapCount += 1;
  clearTimeout(tapResetTimer);
  tapResetTimer = setTimeout(() => { tapCount = 0; }, 2000);
  if (tapCount >= 5) {
    tapCount = 0;
    openPin();
  }
}

coverLogo.addEventListener('pointerdown', startLongPress);
coverLogo.addEventListener('pointerup', clearLongPress);
coverLogo.addEventListener('pointerleave', clearLongPress);
coverLogo.addEventListener('pointercancel', clearLongPress);
coverLogo.addEventListener('touchstart', startLongPress, { passive: true });
coverLogo.addEventListener('touchend', clearLongPress, { passive: true });
coverLogo.addEventListener('touchcancel', clearLongPress, { passive: true });
coverLogo.addEventListener('mousedown', startLongPress);
coverLogo.addEventListener('mouseup', clearLongPress);
coverLogo.addEventListener('mouseleave', clearLongPress);
coverLogo.addEventListener('click', handleSecretTap);
coverLogo.addEventListener('contextmenu', e => e.preventDefault());

document.getElementById('unlockBtn').addEventListener('click', unlock);
document.getElementById('closePinBtn').addEventListener('click', () => closeModal(pinModal));
document.getElementById('panicBtn').addEventListener('click', panicHide);
document.getElementById('saveSelectionBtn').addEventListener('click', saveSelection);
document.getElementById('cancelSelectBtn').addEventListener('click', () => closeModal(selectModal));
document.getElementById('coverHelpBtn').addEventListener('click', () => openModal(helpModal));
document.getElementById('closeHelpBtn').addEventListener('click', () => closeModal(helpModal));
document.getElementById('exportBtn').addEventListener('click', exportJson);
document.getElementById('importBtn').addEventListener('click', () => importFileInput.click());
document.getElementById('addWorkBtn').addEventListener('click', openAddWorkModal);
document.getElementById('cancelWorkBtn').addEventListener('click', () => closeModal(workModal));
document.getElementById('saveWorkBtn').addEventListener('click', saveWork);
document.getElementById('settingsBtn').addEventListener('click', () => {
  document.getElementById('newPinInput').value = '';
  document.getElementById('settingsError').textContent = '';
  openModal(settingsModal);
});
document.getElementById('closeSettingsBtn').addEventListener('click', () => closeModal(settingsModal));
document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);
document.getElementById('resetDataBtn').addEventListener('click', resetData);
pinInput.addEventListener('keydown', e => { if (e.key === 'Enter') unlock(); });
workSearch.addEventListener('input', e => { workSearchTerm = e.target.value; renderWorks(); });
coverSearch.addEventListener('input', e => {
  if (e.target.value.trim().toLowerCase() === SECRET_KEYWORD) {
    e.target.value = '';
    openPin();
  }
});
importFileInput.addEventListener('change', e => importJson(e.target.files?.[0]));

worksList.addEventListener('click', e => {
  const selectBtn = e.target.closest('[data-action="select"]');
  if (selectBtn) {
    openSelectionModal(selectBtn.dataset.id);
    return;
  }
  const deleteBtn = e.target.closest('[data-action="delete-work"]');
  if (deleteBtn) {
    deleteWork(deleteBtn.dataset.id);
  }
});

recentLogs.addEventListener('click', e => {
  const deleteBtn = e.target.closest('[data-action="delete-log"]');
  if (!deleteBtn) return;
  deleteLog(deleteBtn.dataset.id);
});

['click', 'touchstart', 'keydown', 'scroll'].forEach(eventName => {
  vaultScreen.addEventListener(eventName, () => {
    if (vaultScreen.classList.contains('active')) resetAutoLock();
  }, { passive: true });
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && vaultScreen.classList.contains('active')) panicHide();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    [pinModal, selectModal, workModal, settingsModal, helpModal].forEach(closeModal);
  }
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

renderAll();
showScreen('cover');
getPin();
