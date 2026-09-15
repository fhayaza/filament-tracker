/**
 * ============================================================================
 * Filament Tracker — Real-Time Cloud Sync & Visual Reminder
 * Vercel + Firebase Firestore Integration (Universal Compat SDK)
 * ============================================================================
 */

const STORAGE_KEY = 'pic_3d_filament_inventory_v4';
const THEME_KEY = 'pic_3d_filament_theme';
const CLOUD_CONFIG_KEY = 'pic_firebase_custom_config';

// Initial Starter Data
const DEFAULT_SPOOLS = [
  {
    id: 'spool-1',
    name: 'PLA Merah (Strava & Detail)',
    material: 'PLA',
    color: '#dc2626',
    colorMode: 'solid',
    colorFinish: 'standard',
    percent: 85,
    updatedAt: Date.now() - 3600000
  },
  {
    id: 'spool-2',
    name: 'PLA Kuning (Tulang & Part)',
    material: 'PLA',
    color: '#f59e0b',
    colorMode: 'solid',
    colorFinish: 'standard',
    percent: 30,
    updatedAt: Date.now() - 7200000
  },
  {
    id: 'spool-3',
    name: 'PLA+ 2.0 Hitam (Clicker Cap & Box)',
    material: 'PLA+ 2.0',
    color: '#18181b',
    colorMode: 'solid',
    colorFinish: 'standard',
    percent: 75,
    updatedAt: Date.now() - 14400000
  },
  {
    id: 'spool-4',
    name: 'PLA Putih (Keycap Polos)',
    material: 'PLA',
    color: '#f8fafc',
    colorMode: 'solid',
    colorFinish: 'standard',
    percent: 50,
    updatedAt: Date.now() - 86400000
  },
  {
    id: 'spool-5',
    name: 'PLA Silk Dual Color (Blue - Purple)',
    material: 'PLA',
    color: '#2563eb',
    color2: '#9333ea',
    colorMode: 'dual',
    colorFinish: 'silk',
    percent: 65,
    updatedAt: Date.now() - 1800000
  }
];

// App State
let spools = [];
let currentFilterMaterial = 'ALL';
let searchQuery = '';
let currentTheme = 'dark';

// Cloud State
let isCloudActive = false;
let db = null;
let sliderDebounceTimers = {};

/**
 * Initialize Application
 */
function init() {
  initTheme();
  loadLocalData();
  setupEventListeners();
  renderApp();
  initCloudSync();
}

/**
 * Theme Management
 */
function initTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY) || 'dark';
  setTheme(savedTheme);
}

function setTheme(theme) {
  currentTheme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);

  const icon = document.getElementById('theme-icon');
  const label = document.getElementById('theme-label');
  if (theme === 'dark') {
    if (icon) icon.textContent = '☀️';
    if (label) label.textContent = 'Mode Terang';
  } else {
    if (icon) icon.textContent = '🌙';
    if (label) label.textContent = 'Mode Gelap';
  }
}

function toggleTheme() {
  const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
  setTheme(nextTheme);
}

/**
 * Cloud Synchronization (Firebase Firestore Compat SDK)
 */
function getActiveFirebaseConfig() {
  // Check localStorage first
  const custom = localStorage.getItem(CLOUD_CONFIG_KEY);
  if (custom) {
    try {
      const parsed = JSON.parse(custom);
      if (parsed.apiKey && !parsed.apiKey.startsWith('ISI_')) return parsed;
    } catch (e) {
      console.warn('Invalid custom config in storage', e);
    }
  }

  // Check window.FIREBASE_CONFIG from firebase-config.js
  if (window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.apiKey && !window.FIREBASE_CONFIG.apiKey.startsWith('ISI_')) {
    return window.FIREBASE_CONFIG;
  }

  // Fallback to top-level firebaseConfig variable if exists
  if (typeof firebaseConfig !== 'undefined' && firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith('ISI_')) {
    return firebaseConfig;
  }

  return null;
}

function updateSyncBadge(status, message) {
  const dot = document.getElementById('sync-dot');
  const btn = document.getElementById('btn-cloud-status');

  if (status === 'connected') {
    if (dot) dot.className = 'sync-dot connected';
    if (btn) btn.title = 'Cloud: Online (Real-time)';
  } else if (status === 'error') {
    if (dot) dot.className = 'sync-dot error';
    if (btn) btn.title = 'Cloud: Error / Terputus';
  } else {
    if (dot) dot.className = 'sync-dot';
    if (btn) btn.title = 'Cloud: Mode Lokal (Klik untuk setup)';
  }
}

async function initCloudSync() {
  const config = getActiveFirebaseConfig();
  if (!config) {
    updateSyncBadge('local', 'Mode Lokal');
    return;
  }

  if (typeof firebase === 'undefined') {
    console.warn('Firebase SDK not loaded, running locally');
    updateSyncBadge('local', 'Mode Lokal');
    return;
  }

  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(config);
    }
    db = firebase.firestore();
    isCloudActive = true;
    updateSyncBadge('connected', 'Cloud Aktif (Real-time)');

    // Listen to real-time changes across all devices (HP & Laptop)
    db.collection('spools').onSnapshot((snapshot) => {
      if (snapshot.empty) {
        // If cloud database is brand new, seed with current local spools
        spools.forEach(item => {
          db.collection('spools').doc(item.id).set(item);
        });
        return;
      }

      const cloudSpools = [];
      snapshot.forEach(docSnap => {
        cloudSpools.push(docSnap.data());
      });

      // Update in-memory state and local cache
      spools = cloudSpools;
      saveLocalData();
      renderApp();
    }, (error) => {
      console.error('Firestore snapshot error:', error);
      updateSyncBadge('error', 'Error Cloud');
    });

  } catch (err) {
    console.error('Firebase init failed:', err);
    updateSyncBadge('error', 'Error Cloud');
  }
}

/**
 * Local Data Handling
 */
function loadLocalData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      spools = JSON.parse(raw);
    } else {
      spools = [...DEFAULT_SPOOLS];
      saveLocalData();
    }
  } catch (err) {
    console.error('Failed to load localStorage:', err);
    spools = [...DEFAULT_SPOOLS];
  }
}

function saveLocalData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(spools));
  } catch (err) {
    console.error('Failed to save to localStorage:', err);
  }
}

/**
 * Filter Spools
 */
function getFilteredSpools() {
  return spools.filter(spool => {
    if (currentFilterMaterial !== 'ALL') {
      if (currentFilterMaterial === 'LAINNYA') {
        if (['PLA', 'PLA+ 2.0', 'PETG'].includes(spool.material)) return false;
      } else if (spool.material !== currentFilterMaterial) {
        return false;
      }
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!(spool.name || '').toLowerCase().includes(q)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Render Cards Grid
 */
function renderApp() {
  const container = document.getElementById('spools-container');
  const emptyState = document.getElementById('empty-state');
  const filtered = getFilteredSpools();

  if (filtered.length === 0) {
    container.innerHTML = '';
    emptyState.style.display = 'flex';
    return;
  }

  emptyState.style.display = 'none';
  container.innerHTML = filtered.map(spool => createCardHtml(spool)).join('');
  setupSliderTouchEnhancements();
}

// Slider Lock State (Anti-Kepencet Saat Scroll)
let activeUnlockedSpoolId = null;
let sliderAutoLockTimer = null;

function unlockSlider(id) {
  if (activeUnlockedSpoolId && activeUnlockedSpoolId !== id) {
    lockSlider(activeUnlockedSpoolId);
  }

  activeUnlockedSpoolId = id;
  const guard = document.getElementById(`guard-${id}`);
  const lockIcon = document.getElementById(`lock-icon-${id}`);
  const lockBtn = document.getElementById(`lock-btn-${id}`);

  if (guard) guard.classList.add('is-unlocked');
  if (lockIcon) lockIcon.textContent = '🔓';
  if (lockBtn) lockBtn.classList.add('is-active');

  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(20);
  }

  resetAutoLockTimer(id);
}

function lockSlider(id) {
  const guard = document.getElementById(`guard-${id}`);
  const lockIcon = document.getElementById(`lock-icon-${id}`);
  const lockBtn = document.getElementById(`lock-btn-${id}`);

  if (guard) guard.classList.remove('is-unlocked');
  if (lockIcon) lockIcon.textContent = '🔒';
  if (lockBtn) lockBtn.classList.remove('is-active');

  if (activeUnlockedSpoolId === id) {
    activeUnlockedSpoolId = null;
  }
  if (sliderAutoLockTimer) {
    clearTimeout(sliderAutoLockTimer);
    sliderAutoLockTimer = null;
  }
}

function toggleSliderLock(id) {
  if (activeUnlockedSpoolId === id) {
    lockSlider(id);
  } else {
    unlockSlider(id);
  }
}

function resetAutoLockTimer(id) {
  if (sliderAutoLockTimer) clearTimeout(sliderAutoLockTimer);
  sliderAutoLockTimer = setTimeout(() => {
    lockSlider(id);
  }, 4000); // 4 detik idle otomatis terkunci kembali agar scroll aman
}

function getSpoolBackground(spool) {
  const c1 = spool.color || '#dc2626';
  if (spool.colorMode === 'dual' && spool.color2) {
    const c2 = spool.color2;
    // Gradasi horizontal (atas ke bawah): Warna 1 di atas, Warna 2 di bawah, transisi lembut di tengah
    return `linear-gradient(180deg, ${c1} 0%, ${c1} 36%, ${c2} 64%, ${c2} 100%)`;
  }
  return c1;
}

function getSpoolCardBorder(spool) {
  const c1 = spool.color || '#dc2626';
  if (spool.colorMode === 'dual' && spool.color2) {
    const c2 = spool.color2;
    return `border-top: 5px solid transparent; border-image: linear-gradient(90deg, ${c1}, ${c2}) 1; box-shadow: 0 4px 18px ${c1}22;`;
  }
  return `border-top-color: ${c1}; box-shadow: 0 4px 18px ${c1}22;`;
}

function createCardHtml(spool) {
  const percent = Math.max(0, Math.min(100, Math.round(spool.percent)));
  const isFull = percent >= 100;
  const isUnlocked = activeUnlockedSpoolId === spool.id;
  const isDual = spool.colorMode === 'dual';
  const isSilk = spool.colorFinish === 'silk';
  const bgStyle = getSpoolBackground(spool);
  const cardBorderStyle = getSpoolCardBorder(spool);

  return `
    <article class="filament-card" id="card-${spool.id}" 
      style="${cardBorderStyle}">
      
      <!-- Top Row: Material Badge, Name, Tags & Actions -->
      <div class="card-top">
        <div class="card-title-col">
          <span class="badge-mat">${escapeHtml(spool.material)}</span>
          ${isDual ? '<span class="badge-tag badge-dual">Dual</span>' : ''}
          ${isSilk ? '<span class="badge-tag badge-silk">✨ Silk</span>' : ''}
          <h3 class="card-name" title="${escapeHtml(spool.name)}">${escapeHtml(spool.name)}</h3>
        </div>

        <div class="card-actions">
          <button class="action-icon-btn" onclick="openEditModal('${spool.id}')" title="Edit Filamen">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="action-icon-btn btn-trash" onclick="deleteSpool('${spool.id}')" title="Hapus">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </div>

      <!-- Center: Giant Tank Container Graphic -->
      <div class="tank-wrap">
        <div class="tank-container">
          <div class="tank-fill ${isFull ? 'full' : ''} ${isSilk ? 'silk-shimmer' : ''}" 
               id="tank-fill-${spool.id}" 
               style="width: ${percent}%; background: ${bgStyle};">
          </div>
          <span class="tank-percent-label" id="tank-percent-${spool.id}">
            ${percent}%
          </span>
        </div>
      </div>

      <!-- Bottom: Compact Slider, Direct Nominal Input & Quick Steps -->
      <div class="slider-control-box">
        <div class="slider-info-row">
          <div class="slider-nominal-group">
            <span class="slider-label">Sisa:</span>
            <div class="nominal-input-wrap">
              <input type="number" 
                     class="percent-num-input" 
                     id="num-input-${spool.id}" 
                     min="0" max="100" 
                     value="${percent}"
                     oninput="handleNumInputChange('${spool.id}', this.value)"
                     title="Ketik nominal persentase (0-100)">
              <span class="percent-unit">%</span>
            </div>
          </div>

          <div class="quick-steps-bar">
            <button class="step-btn btn-lock-toggle ${isUnlocked ? 'is-active' : ''}" 
                    id="lock-btn-${spool.id}" 
                    onclick="toggleSliderLock('${spool.id}')" 
                    title="Kunci / Buka Slider">
              <span id="lock-icon-${spool.id}">${isUnlocked ? '🔓' : '🔒'}</span>
            </button>
            <button class="step-btn" onclick="stepPercent('${spool.id}', -10)" title="Kurang 10%">-10%</button>
            <button class="step-btn" onclick="stepPercent('${spool.id}', -5)" title="Kurang 5%">-5%</button>
            <button class="step-btn" onclick="stepPercent('${spool.id}', 5)" title="Tambah 5%">+5%</button>
            <button class="step-btn" onclick="stepPercent('${spool.id}', 10)" title="Tambah 10%">+10%</button>
          </div>
        </div>

        <!-- Touch Guard: Dilindungi agar scroll halaman tidak menggeser slider secara tidak sengaja -->
        <div class="slider-touch-guard ${isUnlocked ? 'is-unlocked' : ''}" id="guard-${spool.id}">
          <input type="range" class="styled-slider" id="slider-${spool.id}"
                 data-id="${spool.id}"
                 min="0" max="100" step="1" value="${percent}"
                 oninput="handleSliderChange('${spool.id}', this.value)"
                 title="Geser sisa filamen">
                 
          <div class="slider-lock-overlay" id="overlay-${spool.id}" onclick="unlockSlider('${spool.id}')" title="Tekan dulu untuk menggeser">
            <span class="lock-pill"><span class="lock-pill-icon">🔒</span> Tekan untuk geser</span>
          </div>
        </div>
      </div>

    </article>
  `;
}

/**
 * Handle Slider Input (Smooth 60fps local + Debounced Cloud Sync)
 */
function handleSliderChange(id, value) {
  const percent = parseInt(value, 10);
  const target = spools.find(s => s.id === id);
  if (!target) return;

  target.percent = percent;
  target.updatedAt = Date.now();
  saveLocalData();

  // Sync the direct numeric input field
  const numInput = document.getElementById(`num-input-${id}`);
  if (numInput && parseInt(numInput.value, 10) !== percent) {
    numInput.value = percent;
  }

  updateTankVisual(id, percent, target);

  // Sync to Firestore
  if (isCloudActive && db) {
    if (sliderDebounceTimers[id]) clearTimeout(sliderDebounceTimers[id]);
    sliderDebounceTimers[id] = setTimeout(() => {
      db.collection('spools').doc(id).set(target, { merge: true }).catch(err => {
        console.error('Failed to sync spool change to Firestore:', err);
      });
    }, 150);
  }
}

/**
 * Handle Direct Nominal Numeric Input
 */
function handleNumInputChange(id, value) {
  if (value === '' || isNaN(value)) return;
  let percent = parseInt(value, 10);
  if (isNaN(percent)) return;
  percent = Math.max(0, Math.min(100, percent));

  const target = spools.find(s => s.id === id);
  if (!target) return;

  target.percent = percent;
  target.updatedAt = Date.now();
  saveLocalData();

  // Sync the slider input
  const slider = document.getElementById(`slider-${id}`);
  if (slider && parseInt(slider.value, 10) !== percent) {
    slider.value = percent;
  }

  updateTankVisual(id, percent, target);

  // Sync to Firestore
  if (isCloudActive && db) {
    if (sliderDebounceTimers[id]) clearTimeout(sliderDebounceTimers[id]);
    sliderDebounceTimers[id] = setTimeout(() => {
      db.collection('spools').doc(id).set(target, { merge: true }).catch(err => {
        console.error('Failed to sync spool change to Firestore:', err);
      });
    }, 150);
  }
}

/**
 * Step percentage with buttons
 */
function stepPercent(id, delta) {
  const target = spools.find(s => s.id === id);
  if (!target) return;

  let newPercent = target.percent + delta;
  newPercent = Math.max(0, Math.min(100, newPercent));

  target.percent = newPercent;
  target.updatedAt = Date.now();
  saveLocalData();

  const slider = document.getElementById(`slider-${id}`);
  if (slider) slider.value = newPercent;

  const numInput = document.getElementById(`num-input-${id}`);
  if (numInput) numInput.value = newPercent;

  updateTankVisual(id, newPercent, target);

  if (isCloudActive && db) {
    db.collection('spools').doc(id).set(target, { merge: true }).catch(err => {
      console.error('Failed to sync step to Firestore:', err);
    });
  }
}

/**
 * Ultra-Responsive Touch/Pointer Slider Helper
 * Aman: Hanya aktif saat unlocked, tidak pernah membajak scroll halaman saat locked
 */
function setupSliderTouchEnhancements() {
  document.querySelectorAll('.styled-slider').forEach(slider => {
    if (slider._touchBound) return;
    slider._touchBound = true;

    const id = slider.getAttribute('data-id') || (slider.id && slider.id.replace('slider-', ''));
    if (!id) return;

    let isTracking = false;

    const calcVal = (clientX) => {
      const rect = slider.getBoundingClientRect();
      if (rect.width <= 0) return slider.value;
      const x = clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, x / rect.width));
      return Math.round(ratio * 100);
    };

    slider.addEventListener('pointerdown', (e) => {
      // HANYA geser jika slider ini sudah dibuka kuncinya!
      if (activeUnlockedSpoolId !== id) return;

      try {
        slider.setPointerCapture(e.pointerId);
      } catch (err) {}
      isTracking = true;
      resetAutoLockTimer(id);

      const val = calcVal(e.clientX);
      if (slider.value != val) {
        slider.value = val;
        handleSliderChange(id, val);
      }
    }, { passive: true });

    slider.addEventListener('pointermove', (e) => {
      if (!isTracking || activeUnlockedSpoolId !== id) return;
      resetAutoLockTimer(id);

      const val = calcVal(e.clientX);
      if (slider.value != val) {
        slider.value = val;
        handleSliderChange(id, val);
      }
    }, { passive: true });

    const stopTracking = (e) => {
      if (isTracking) {
        isTracking = false;
        resetAutoLockTimer(id);
        try {
          if (slider.hasPointerCapture(e.pointerId)) {
            slider.releasePointerCapture(e.pointerId);
          }
        } catch (err) {}
      }
    };

    slider.addEventListener('pointerup', stopTracking);
    slider.addEventListener('pointercancel', stopTracking);
  });
}

// Otomatis kunci kembali jika pengguna mengetuk di luar kartu/slider yang sedang aktif
document.addEventListener('pointerdown', (e) => {
  if (!activeUnlockedSpoolId) return;
  const activeGuard = document.getElementById(`guard-${activeUnlockedSpoolId}`);
  const activeLockBtn = document.getElementById(`lock-btn-${activeUnlockedSpoolId}`);
  if (activeGuard && !activeGuard.contains(e.target) && activeLockBtn && !activeLockBtn.contains(e.target)) {
    lockSlider(activeUnlockedSpoolId);
  }
}, { passive: true });

function updateTankVisual(id, percent, spoolOrColor) {
  const fillEl = document.getElementById(`tank-fill-${id}`);
  const labelEl = document.getElementById(`tank-percent-${id}`);

  if (fillEl) {
    fillEl.style.width = `${percent}%`;
    if (spoolOrColor) {
      if (typeof spoolOrColor === 'object') {
        fillEl.style.background = getSpoolBackground(spoolOrColor);
        if (spoolOrColor.colorFinish === 'silk') {
          fillEl.classList.add('silk-shimmer');
        } else {
          fillEl.classList.remove('silk-shimmer');
        }
      } else {
        fillEl.style.background = spoolOrColor;
      }
    }
    if (percent >= 100) {
      fillEl.classList.add('full');
    } else {
      fillEl.classList.remove('full');
    }
  }

  if (labelEl) {
    labelEl.textContent = `${percent}%`;
  }
}

/**
 * Modal Handling (Add / Edit) with Dual Color & Silk (Shiny) Modes
 */
const modal = document.getElementById('spool-modal');
const form = document.getElementById('spool-form');
const modalTitle = document.getElementById('modal-title');
const formPercent = document.getElementById('form-percent');
const modalTankFill = document.getElementById('modal-tank-fill');
const modalTankPercentText = document.getElementById('modal-tank-percent-text');
const modalFormPercentNum = document.getElementById('modal-form-percent-num');

// Color Mode Elements
let currentModalColorMode = 'solid'; // 'solid' | 'dual'
let currentModalColorFinish = 'standard'; // 'standard' | 'silk'

const solidColorWrap = document.getElementById('solid-color-wrap');
const dualColorWrap = document.getElementById('dual-color-wrap');
const solidSwatchesSection = document.getElementById('solid-swatches-section');
const dualSwatchesSection = document.getElementById('dual-swatches-section');
const solidColorPicker = document.getElementById('form-color-picker');
const dualColorPicker1 = document.getElementById('form-color-picker-1');
const dualColorPicker2 = document.getElementById('form-color-picker-2');
const colorHex1 = document.getElementById('color-hex-1');
const colorHexDual1 = document.getElementById('color-hex-dual-1');
const colorHexDual2 = document.getElementById('color-hex-dual-2');

function setModalColorMode(mode) {
  currentModalColorMode = mode;
  document.querySelectorAll('#color-mode-selector .mode-pill-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-mode') === mode);
  });

  if (mode === 'dual') {
    if (solidColorWrap) solidColorWrap.style.display = 'none';
    if (dualColorWrap) dualColorWrap.style.display = 'block';
    if (solidSwatchesSection) solidSwatchesSection.style.display = 'none';
    if (dualSwatchesSection) dualSwatchesSection.style.display = 'flex';
  } else {
    if (solidColorWrap) solidColorWrap.style.display = 'block';
    if (dualColorWrap) dualColorWrap.style.display = 'none';
    if (solidSwatchesSection) solidSwatchesSection.style.display = 'flex';
    if (dualSwatchesSection) dualSwatchesSection.style.display = 'none';
  }

  updateModalTankPreview();
}

function setModalColorFinish(finish) {
  currentModalColorFinish = finish;
  document.querySelectorAll('#color-finish-selector .mode-pill-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-finish') === finish);
  });

  updateModalTankPreview();
}

function swapModalColors() {
  if (dualColorPicker1 && dualColorPicker2) {
    const temp = dualColorPicker1.value;
    dualColorPicker1.value = dualColorPicker2.value;
    dualColorPicker2.value = temp;
    updateModalTankPreview();
  }
}

function updateModalTankPreview() {
  const val = formPercent.value;
  modalTankFill.style.width = `${val}%`;
  modalTankPercentText.textContent = `${val}%`;

  if (modalFormPercentNum && modalFormPercentNum.value != val) {
    modalFormPercentNum.value = val;
  }

  // Color & Finish Preview
  if (currentModalColorMode === 'dual') {
    const c1 = dualColorPicker1 ? dualColorPicker1.value : '#2563eb';
    const c2 = dualColorPicker2 ? dualColorPicker2.value : '#9333ea';
    modalTankFill.style.background = `linear-gradient(180deg, ${c1} 0%, ${c1} 36%, ${c2} 64%, ${c2} 100%)`;
    if (colorHexDual1) colorHexDual1.textContent = c1;
    if (colorHexDual2) colorHexDual2.textContent = c2;
  } else {
    const c1 = solidColorPicker ? solidColorPicker.value : '#dc2626';
    modalTankFill.style.background = c1;
    if (colorHex1) colorHex1.textContent = c1;
  }

  // Silk Shimmer Class
  if (currentModalColorFinish === 'silk') {
    modalTankFill.classList.add('silk-shimmer');
  } else {
    modalTankFill.classList.remove('silk-shimmer');
  }
}

function openAddModal() {
  form.reset();
  document.getElementById('spool-id').value = '';
  modalTitle.textContent = 'Tambah Filamen';

  if (solidColorPicker) solidColorPicker.value = '#dc2626';
  if (dualColorPicker1) dualColorPicker1.value = '#2563eb';
  if (dualColorPicker2) dualColorPicker2.value = '#9333ea';

  setModalColorMode('solid');
  setModalColorFinish('standard');

  formPercent.value = 100;
  if (modalFormPercentNum) modalFormPercentNum.value = 100;
  document.getElementById('form-material').value = 'PLA+ 2.0';

  updateModalTankPreview();
  modal.style.display = 'flex';
  document.getElementById('form-name').focus();
}

function openEditModal(id) {
  const target = spools.find(s => s.id === id);
  if (!target) return;

  document.getElementById('spool-id').value = target.id;
  modalTitle.textContent = 'Edit Filamen';

  document.getElementById('form-name').value = target.name || '';
  document.getElementById('form-material').value = target.material || 'PLA+ 2.0';

  const mode = target.colorMode || 'solid';
  const finish = target.colorFinish || 'standard';

  if (mode === 'dual') {
    if (dualColorPicker1) dualColorPicker1.value = target.color || '#2563eb';
    if (dualColorPicker2) dualColorPicker2.value = target.color2 || '#9333ea';
  } else {
    if (solidColorPicker) solidColorPicker.value = target.color || '#dc2626';
  }

  setModalColorMode(mode);
  setModalColorFinish(finish);

  const pct = target.percent !== undefined ? target.percent : 100;
  formPercent.value = pct;
  if (modalFormPercentNum) modalFormPercentNum.value = pct;

  updateModalTankPreview();
  modal.style.display = 'flex';
}

function closeModal() {
  modal.style.display = 'none';
}

// Color and percent input listeners
if (solidColorPicker) solidColorPicker.addEventListener('input', updateModalTankPreview);
if (dualColorPicker1) dualColorPicker1.addEventListener('input', updateModalTankPreview);
if (dualColorPicker2) dualColorPicker2.addEventListener('input', updateModalTankPreview);
formPercent.addEventListener('input', updateModalTankPreview);

if (modalFormPercentNum) {
  modalFormPercentNum.addEventListener('input', () => {
    let val = parseInt(modalFormPercentNum.value, 10);
    if (isNaN(val)) return;
    val = Math.max(0, Math.min(100, val));
    formPercent.value = val;
    updateModalTankPreview();
  });
}

// Quick percent pills
document.querySelectorAll('.btn-pill').forEach(btn => {
  btn.addEventListener('click', () => {
    formPercent.value = btn.getAttribute('data-val');
    updateModalTankPreview();
  });
});

// Solid color swatches
document.querySelectorAll('.swatch-item').forEach(btn => {
  btn.addEventListener('click', () => {
    const col = btn.getAttribute('data-color');
    if (solidColorPicker) solidColorPicker.value = col;
    updateModalTankPreview();
  });
});

// Dual color split swatches
document.querySelectorAll('.swatch-dual-item').forEach(btn => {
  btn.addEventListener('click', () => {
    const c1 = btn.getAttribute('data-c1');
    const c2 = btn.getAttribute('data-c2');
    if (dualColorPicker1) dualColorPicker1.value = c1;
    if (dualColorPicker2) dualColorPicker2.value = c2;
    updateModalTankPreview();
  });
});

// Mode & Finish buttons
document.querySelectorAll('#color-mode-selector .mode-pill-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    setModalColorMode(btn.getAttribute('data-mode'));
  });
});

document.querySelectorAll('#color-finish-selector .mode-pill-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    setModalColorFinish(btn.getAttribute('data-finish'));
  });
});

// Swap colors button
const swapBtn = document.getElementById('btn-swap-colors');
if (swapBtn) {
  swapBtn.addEventListener('click', swapModalColors);
}

// Save Form
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const id = document.getElementById('spool-id').value;
  const name = document.getElementById('form-name').value.trim();
  const material = document.getElementById('form-material').value;
  const percent = parseInt(formPercent.value, 10);

  const colorMode = currentModalColorMode;
  const colorFinish = currentModalColorFinish;
  let color = '#dc2626';
  let color2 = '';

  if (colorMode === 'dual') {
    color = dualColorPicker1 ? dualColorPicker1.value : '#2563eb';
    color2 = dualColorPicker2 ? dualColorPicker2.value : '#9333ea';
  } else {
    color = solidColorPicker ? solidColorPicker.value : '#dc2626';
  }

  if (id) {
    // Edit existing
    const item = spools.find(s => s.id === id);
    if (item) {
      item.name = name;
      item.material = material;
      item.color = color;
      item.color2 = color2;
      item.colorMode = colorMode;
      item.colorFinish = colorFinish;
      item.percent = percent;
      item.updatedAt = Date.now();
      saveLocalData();

      if (isCloudActive && db) {
        await db.collection('spools').doc(id).set(item);
      }
      showToast('Data filamen diperbarui');
    }
  } else {
    // Add new
    const newSpool = {
      id: 'spool-' + Date.now(),
      name,
      material,
      color,
      color2,
      colorMode,
      colorFinish,
      percent,
      updatedAt: Date.now()
    };
    spools.unshift(newSpool);
    saveLocalData();

    if (isCloudActive && db) {
      await db.collection('spools').doc(newSpool.id).set(newSpool);
    }
    showToast('Filamen baru ditambahkan');
  }

  closeModal();
  renderApp();
});

/**
 * Delete Spool
 */
async function deleteSpool(id) {
  const target = spools.find(s => s.id === id);
  if (!target) return;

  if (confirm(`Hapus "${target.name}" dari daftar filamen?`)) {
    spools = spools.filter(s => s.id !== id);
    saveLocalData();

    if (isCloudActive && db) {
      await db.collection('spools').doc(id).delete();
    }

    renderApp();
    showToast('Filamen telah dihapus');
  }
}

/**
 * Cloud Setup Modal
 */
const cloudModal = document.getElementById('cloud-modal');

function openCloudModal() {
  const config = getActiveFirebaseConfig();
  if (config) {
    document.getElementById('cloud-config-input').value = JSON.stringify(config, null, 2);
  }
  cloudModal.style.display = 'flex';
}

function closeCloudModal() {
  cloudModal.style.display = 'none';
}

document.getElementById('btn-cloud-status').addEventListener('click', openCloudModal);
document.getElementById('btn-close-cloud-modal').addEventListener('click', closeCloudModal);
document.getElementById('btn-close-cloud').addEventListener('click', closeCloudModal);

document.getElementById('btn-save-cloud').addEventListener('click', () => {
  const raw = document.getElementById('cloud-config-input').value.trim();
  if (!raw) {
    alert('Silakan tempel kode objek Firebase Config!');
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed.apiKey || !parsed.projectId) {
      alert('Format Firebase Config tidak lengkap! Pastikan ada apiKey dan projectId.');
      return;
    }
    localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(parsed));
    showToast('Konfigurasi Cloud disimpan! Memuat ulang...', 'success');
    setTimeout(() => window.location.reload(), 800);
  } catch (err) {
    alert('Format JSON tidak valid: ' + err.message);
  }
});

/**
 * Export / Import Backup JSON
 */
function exportBackup() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(spools, null, 2));
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  a.setAttribute("href", dataStr);
  a.setAttribute("download", `filamen_backup_${dateStr}.json`);
  document.body.appendChild(a);
  a.click();
  a.remove();
  showToast('Cadangan data berhasil diunduh');
}

function handleFileImport(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const imported = JSON.parse(event.target.result);
      if (Array.isArray(imported)) {
        if (confirm(`Impor ${imported.length} filamen? Data akan digabungkan.`)) {
          imported.forEach(item => {
            const idx = spools.findIndex(s => s.id === item.id);
            if (idx !== -1) {
              spools[idx] = item;
            } else {
              spools.push(item);
            }
          });
          saveLocalData();

          if (isCloudActive && db) {
            for (const item of spools) {
              await db.collection('spools').doc(item.id).set(item);
            }
          }

          renderApp();
          showToast(`Berhasil mengimpor ${imported.length} filamen!`);
        }
      } else {
        alert('File JSON tidak valid!');
      }
    } catch (err) {
      alert('Gagal membaca file JSON: ' + err.message);
    }
    e.target.value = '';
  };
  reader.readAsText(file);
}

/**
 * Event Listeners
 */
function setupEventListeners() {
  // Theme Toggle
  document.getElementById('btn-theme-toggle').addEventListener('click', toggleTheme);

  // Modal Buttons
  document.getElementById('btn-add-spool').addEventListener('click', openAddModal);
  document.getElementById('btn-close-modal').addEventListener('click', closeModal);
  document.getElementById('btn-cancel-modal').addEventListener('click', closeModal);
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
  cloudModal.addEventListener('click', (e) => {
    if (e.target === cloudModal) closeCloudModal();
  });

  // Search
  const searchInput = document.getElementById('search-input');
  const clearBtn = document.getElementById('btn-clear-search');
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.trim();
    clearBtn.style.display = searchQuery ? 'block' : 'none';
    renderApp();
  });
  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    clearBtn.style.display = 'none';
    renderApp();
    searchInput.focus();
  });

  // Filter Chips
  document.querySelectorAll('#material-chips .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#material-chips .chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentFilterMaterial = chip.getAttribute('data-material');
      renderApp();
    });
  });

  // Reset Filters
  document.getElementById('btn-reset-filters').addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    clearBtn.style.display = 'none';
    currentFilterMaterial = 'ALL';
    document.querySelectorAll('#material-chips .chip').forEach(c => c.classList.remove('active'));
    document.querySelector('#material-chips .chip[data-material="ALL"]').classList.add('active');
    renderApp();
  });

  // Export / Import
  document.getElementById('btn-export').addEventListener('click', exportBackup);
  const fileInput = document.getElementById('import-file-input');
  document.getElementById('btn-import-trigger').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', handleFileImport);

  // Esc key closes modal
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
      closeCloudModal();
    }
  });
}

/**
 * Toast Utility
 */
function showToast(message) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.2s ease';
    setTimeout(() => toast.remove(), 200);
  }, 2200);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Window Globals for onclick handlers in HTML
window.openEditModal = openEditModal;
window.deleteSpool = deleteSpool;
window.stepPercent = stepPercent;
window.handleSliderChange = handleSliderChange;
window.handleNumInputChange = handleNumInputChange;
window.unlockSlider = unlockSlider;
window.lockSlider = lockSlider;
window.toggleSliderLock = toggleSliderLock;

// Register Service Worker for PWA Installation
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.log('ServiceWorker registration skipped or failed:', err);
    });
  });
}

document.addEventListener('DOMContentLoaded', init);
