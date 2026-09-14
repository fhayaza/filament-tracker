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
    percent: 85,
    updatedAt: Date.now() - 3600000
  },
  {
    id: 'spool-2',
    name: 'PLA Kuning (Tulang & Part)',
    material: 'PLA',
    color: '#f59e0b',
    percent: 30,
    updatedAt: Date.now() - 7200000
  },
  {
    id: 'spool-3',
    name: 'PLA+ 2.0 Hitam (Clicker Cap & Box)',
    material: 'PLA+ 2.0',
    color: '#18181b',
    percent: 75,
    updatedAt: Date.now() - 14400000
  },
  {
    id: 'spool-4',
    name: 'PLA Putih (Keycap Polos)',
    material: 'PLA',
    color: '#f8fafc',
    percent: 50,
    updatedAt: Date.now() - 86400000
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

function createCardHtml(spool) {
  const percent = Math.max(0, Math.min(100, Math.round(spool.percent)));
  const isFull = percent >= 100;
  const filamentColor = spool.color || '#dc2626';

  return `
    <article class="filament-card" id="card-${spool.id}" 
      style="border-top-color: ${filamentColor}; box-shadow: 0 4px 18px ${filamentColor}22;">
      
      <!-- Top Row: Material Badge, Name & Actions -->
      <div class="card-top">
        <div class="card-title-col">
          <span class="badge-mat">${escapeHtml(spool.material)}</span>
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
          <div class="tank-fill ${isFull ? 'full' : ''}" 
               id="tank-fill-${spool.id}" 
               style="width: ${percent}%; background-color: ${filamentColor};">
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
            <button class="step-btn" onclick="stepPercent('${spool.id}', -10)" title="Kurang 10%">-10%</button>
            <button class="step-btn" onclick="stepPercent('${spool.id}', -5)" title="Kurang 5%">-5%</button>
            <button class="step-btn" onclick="stepPercent('${spool.id}', 5)" title="Tambah 5%">+5%</button>
            <button class="step-btn" onclick="stepPercent('${spool.id}', 10)" title="Tambah 10%">+10%</button>
          </div>
        </div>

        <input type="range" class="styled-slider" id="slider-${spool.id}"
               data-id="${spool.id}"
               min="0" max="100" step="1" value="${percent}"
               oninput="handleSliderChange('${spool.id}', this.value)"
               title="Geser sisa filamen">
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

  updateTankVisual(id, percent, target.color);

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

  updateTankVisual(id, percent, target.color);

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

  updateTankVisual(id, newPercent, target.color);

  if (isCloudActive && db) {
    db.collection('spools').doc(id).set(target, { merge: true }).catch(err => {
      console.error('Failed to sync step to Firestore:', err);
    });
  }
}

/**
 * Ultra-Responsive Touch/Pointer Slider Helper
 * Solves mobile issue where slider drops touch or fails to drag when pressed off-center
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
      try {
        slider.setPointerCapture(e.pointerId);
      } catch (err) {}
      isTracking = true;
      const val = calcVal(e.clientX);
      if (slider.value != val) {
        slider.value = val;
        handleSliderChange(id, val);
      }
    }, { passive: true });

    slider.addEventListener('pointermove', (e) => {
      if (!isTracking) return;
      const val = calcVal(e.clientX);
      if (slider.value != val) {
        slider.value = val;
        handleSliderChange(id, val);
      }
    }, { passive: true });

    const stopTracking = (e) => {
      if (isTracking) {
        isTracking = false;
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

function updateTankVisual(id, percent, color) {
  const fillEl = document.getElementById(`tank-fill-${id}`);
  const labelEl = document.getElementById(`tank-percent-${id}`);

  if (fillEl) {
    fillEl.style.width = `${percent}%`;
    if (color) fillEl.style.backgroundColor = color;
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
 * Modal Handling (Add / Edit)
 */
const modal = document.getElementById('spool-modal');
const form = document.getElementById('spool-form');
const modalTitle = document.getElementById('modal-title');
const colorPicker = document.getElementById('form-color-picker');
const formPercent = document.getElementById('form-percent');
const modalTankFill = document.getElementById('modal-tank-fill');
const modalTankPercentText = document.getElementById('modal-tank-percent-text');
const modalFormPercentNum = document.getElementById('modal-form-percent-num');

function updateModalTankPreview() {
  const val = formPercent.value;
  const col = colorPicker.value;
  modalTankFill.style.width = `${val}%`;
  modalTankFill.style.backgroundColor = col;
  modalTankPercentText.textContent = `${val}%`;

  if (modalFormPercentNum && modalFormPercentNum.value != val) {
    modalFormPercentNum.value = val;
  }
}

function openAddModal() {
  form.reset();
  document.getElementById('spool-id').value = '';
  modalTitle.textContent = 'Tambah Filamen';
  
  colorPicker.value = '#dc2626';
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
  colorPicker.value = target.color || '#dc2626';
  const pct = target.percent !== undefined ? target.percent : 100;
  formPercent.value = pct;
  if (modalFormPercentNum) modalFormPercentNum.value = pct;

  updateModalTankPreview();
  modal.style.display = 'flex';
}

function closeModal() {
  modal.style.display = 'none';
}

colorPicker.addEventListener('input', updateModalTankPreview);
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

document.querySelectorAll('.btn-pill').forEach(btn => {
  btn.addEventListener('click', () => {
    formPercent.value = btn.getAttribute('data-val');
    updateModalTankPreview();
  });
});

document.querySelectorAll('.swatch-item').forEach(btn => {
  btn.addEventListener('click', () => {
    const col = btn.getAttribute('data-color');
    colorPicker.value = col;
    updateModalTankPreview();
  });
});

// Save Form
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const id = document.getElementById('spool-id').value;
  const name = document.getElementById('form-name').value.trim();
  const material = document.getElementById('form-material').value;
  const color = colorPicker.value;
  const percent = parseInt(formPercent.value, 10);

  if (id) {
    // Edit existing
    const item = spools.find(s => s.id === id);
    if (item) {
      item.name = name;
      item.material = material;
      item.color = color;
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

// Register Service Worker for PWA Installation
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.log('ServiceWorker registration skipped or failed:', err);
    });
  });
}

document.addEventListener('DOMContentLoaded', init);
