/**
 * LUMEN — Optical Arts & Cinematic Darkroom
 * Public Frontend Application Controller
 * Midnight & Champagne Palette Architecture
 */

const appState = {
  activeView: 'gallery',
  currentFilter: 'All',
  currentSort: 'trending',
  searchQuery: '',
  currentUser: JSON.parse(localStorage.getItem('lumen_user_profile')) || null,
  authToken: localStorage.getItem('lumen_auth_token') || '',
  photos: [],
  categories: [],
  activeLeaderboardTab: 'photos',
  currentLightboxPhoto: null,
  timerInterval: null
};

/* ========================================================= */
/* 1. REST API CLIENT INTERFACE                              */
/* ========================================================= */
const API = {
  getHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (appState.authToken) {
      headers['Authorization'] = `Bearer ${appState.authToken}`;
    }
    return headers;
  },

  async getPhotos(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`/api/photos?${query}`);
    return await res.json();
  },

  async getPhoto(id) {
    const res = await fetch(`/api/photos/${id}`);
    return await res.json();
  },

  async toggleLike(id) {
    const res = await fetch(`/api/photos/${id}/like`, { method: 'POST' });
    return await res.json();
  },

  async addComment(id, text) {
    const res = await fetch(`/api/photos/${id}/comments`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        text,
        user: appState.currentUser ? appState.currentUser.name : 'Optics Operator',
        role: appState.currentUser ? appState.currentUser.role : 'Photographer'
      })
    });
    return await res.json();
  },

  async getCategories() {
    const res = await fetch('/api/categories');
    return await res.json();
  },

  async getLeaderboard() {
    const res = await fetch('/api/leaderboard');
    return await res.json();
  },

  async login(email, password) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    return await res.json();
  },

  async register(name, email, password) {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    return await res.json();
  },

  async uploadPhoto(formData) {
    const headers = {};
    if (appState.authToken) {
      headers['Authorization'] = `Bearer ${appState.authToken}`;
    }
    const res = await fetch('/api/photos', {
      method: 'POST',
      headers,
      body: formData
    });
    return await res.json();
  }
};

/* ========================================================= */
/* 2. TOAST NOTIFICATION SYSTEM                              */
/* ========================================================= */
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  let icon = 'info';
  if (type === 'success') icon = 'check_circle';
  if (type === 'error') icon = 'error';

  toast.innerHTML = `
    <span class="material-symbols-outlined" style="font-size: 1.1rem;">${icon}</span>
    <span>${message}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

/* ========================================================= */
/* 3. NAVIGATION & VIEW CONTROLLER                           */
/* ========================================================= */
function switchView(viewName) {
  appState.activeView = viewName;

  const views = ['gallery', 'leaderboard', 'auth'];
  views.forEach(v => {
    const el = document.getElementById(`view-${v}`);
    if (el) {
      if (v === viewName) {
        el.classList.remove('hidden');
        el.classList.add('animate-fade-in');
      } else {
        el.classList.add('hidden');
        el.classList.remove('animate-fade-in');
      }
    }
  });

  const navGallery = document.getElementById('nav-gallery');
  const navLeaderboard = document.getElementById('nav-leaderboard');

  [navGallery, navLeaderboard].forEach(l => {
    if (l) l.className = 'nav-link';
  });

  if (viewName === 'gallery' && navGallery) navGallery.className = 'nav-link active';
  if (viewName === 'leaderboard' && navLeaderboard) navLeaderboard.className = 'nav-link active';

  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (viewName === 'gallery') loadGallery();
  if (viewName === 'leaderboard') loadLeaderboard();
}

function handleUserAvatarClick() {
  if (appState.currentUser) {
    if (confirm(`Logged in as ${appState.currentUser.name} (${appState.currentUser.role}). Would you like to sign out?`)) {
      localStorage.removeItem('lumen_auth_token');
      localStorage.removeItem('lumen_user_profile');
      appState.currentUser = null;
      appState.authToken = '';
      syncNavUser();
      showToast('Session terminated', 'info');
    }
  } else {
    switchView('auth');
  }
}

function syncNavUser() {
  const avatar = document.getElementById('nav-user-avatar');
  const badge = document.getElementById('nav-role-badge');
  if (appState.currentUser) {
    if (avatar) avatar.src = appState.currentUser.avatar;
    if (badge) {
      badge.style.background = appState.currentUser.role === 'Curator' ? 'var(--champagne-300)' : 'var(--accent-emerald)';
      badge.title = `${appState.currentUser.role} Session Active`;
    }
  } else {
    if (avatar) avatar.src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80';
    if (badge) {
      badge.style.background = 'var(--text-dim)';
      badge.title = 'Guest (Not Signed In)';
    }
  }
}

/* ========================================================= */
/* 4. HERO CANVAS ENGINE: MOSAICBLOOM 2D (Midnight & Gold)   */
/* ========================================================= */
let heroCanvas, heroCtx;
let heroImageObj = null;
let canvasRunning = true;
let pointerX = -9999, pointerY = -9999;
let sineTime = 0;

function initHeroMosaicEngine() {
  heroCanvas = document.getElementById('hero-mosaic-canvas');
  if (!heroCanvas) return;
  heroCtx = heroCanvas.getContext('2d');

  // Midnight & Champagne alpine gradient mountain buffer
  const buffer = document.createElement('canvas');
  buffer.width = 960;
  buffer.height = 600;
  const bCtx = buffer.getContext('2d');

  const grad = bCtx.createLinearGradient(0, 0, 0, 600);
  grad.addColorStop(0, '#05070a');
  grad.addColorStop(0.35, '#0c1017');
  grad.addColorStop(0.65, '#20180d');
  grad.addColorStop(0.85, '#6b5420');
  grad.addColorStop(1, '#e6d5a7');
  bCtx.fillStyle = grad;
  bCtx.fillRect(0, 0, 960, 600);

  // Mountain silhouettes in obsidian
  bCtx.fillStyle = '#06080c';
  bCtx.beginPath();
  bCtx.moveTo(0, 600);
  bCtx.lineTo(0, 480);
  bCtx.lineTo(240, 320);
  bCtx.lineTo(480, 180);
  bCtx.lineTo(540, 240);
  bCtx.lineTo(720, 360);
  bCtx.lineTo(960, 440);
  bCtx.lineTo(960, 600);
  bCtx.closePath();
  bCtx.fill();

  // Mountain champagne rim highlight
  bCtx.strokeStyle = 'rgba(230, 213, 167, 0.6)';
  bCtx.lineWidth = 2.5;
  bCtx.beginPath();
  bCtx.moveTo(240, 320);
  bCtx.lineTo(480, 180);
  bCtx.lineTo(540, 240);
  bCtx.stroke();

  heroImageObj = buffer;

  function resizeCanvas() {
    if (!heroCanvas) return;
    const rect = heroCanvas.getBoundingClientRect();
    heroCanvas.width = rect.width;
    heroCanvas.height = rect.height;
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  heroCanvas.addEventListener('mousemove', (e) => {
    const rect = heroCanvas.getBoundingClientRect();
    pointerX = e.clientX - rect.left;
    pointerY = e.clientY - rect.top;
  });

  heroCanvas.addEventListener('mouseleave', () => {
    pointerX = -9999;
    pointerY = -9999;
  });

  renderMosaicBloomFrame();
}

function renderMosaicBloomFrame() {
  if (!heroCtx || !heroCanvas) return;

  const w = heroCanvas.width;
  const h = heroCanvas.height;
  const cellSize = 16;
  const revealRadius = 130;

  heroCtx.clearRect(0, 0, w, h);

  if (heroImageObj) {
    heroCtx.drawImage(heroImageObj, 0, 0, w, h);

    if (canvasRunning) {
      sineTime += 0.035;
    }

    for (let y = 0; y < h; y += cellSize) {
      for (let x = 0; x < w; x += cellSize) {
        const dx = (x + cellSize / 2) - pointerX;
        const dy = (y + cellSize / 2) - pointerY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < revealRadius) {
          if (dist > revealRadius - 6) {
            heroCtx.fillStyle = 'rgba(212, 175, 55, 0.45)';
            heroCtx.fillRect(x, y, cellSize, cellSize);
          }
          continue;
        }

        const wave = Math.sin((x * 0.02) + (y * 0.02) + sineTime);
        const scale = 0.65 + wave * 0.35;
        const tileAlpha = 0.55 + wave * 0.25;

        heroCtx.save();
        heroCtx.translate(x + cellSize / 2, y + cellSize / 2);
        heroCtx.scale(scale, scale);

        heroCtx.fillStyle = `rgba(7, 9, 14, ${tileAlpha * 0.75})`;
        heroCtx.fillRect(-cellSize / 2, -cellSize / 2, cellSize - 1, cellSize - 1);

        // Champagne golden point
        if ((x + y) % (cellSize * 2) === 0) {
          heroCtx.fillStyle = 'rgba(230, 213, 167, 0.7)';
          heroCtx.fillRect(-1.5, -1.5, 3, 3);
        }

        heroCtx.restore();
      }
    }

    // Radial vignette falloff
    const radGrad = heroCtx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.65);
    radGrad.addColorStop(0, 'rgba(5, 7, 10, 0)');
    radGrad.addColorStop(1, 'rgba(5, 7, 10, 0.85)');
    heroCtx.fillStyle = radGrad;
    heroCtx.fillRect(0, 0, w, h);
  }

  requestAnimationFrame(renderMosaicBloomFrame);
}

function toggleHeroPlay() {
  canvasRunning = !canvasRunning;
  const text = document.getElementById('canvas-play-text');
  if (text) text.textContent = canvasRunning ? 'Pause Sine Wave' : 'Resume Sine Wave';
}

function inspectHeroImage() {
  openLightbox("p1");
}

/* ========================================================= */
/* 5. GALLERY & DYNAMIC CATEGORIES CONTROLLER                */
/* ========================================================= */
async function loadCategories() {
  try {
    const data = await API.getCategories();
    appState.categories = data.categories || [];
    renderCategoryPills(data.categoryDetails || []);
    populateUploadCategories();
  } catch (err) {
    console.error('Failed to load categories:', err);
  }
}

function renderCategoryPills(details = []) {
  const container = document.getElementById('category-pills-container');
  if (!container) return;

  let html = `
    <button class="cat-pill ${appState.currentFilter === 'All' ? 'active' : ''}" onclick="filterCategory('All')">
      ALL SENSORS
    </button>
  `;

  appState.categories.forEach(cat => {
    const isActive = appState.currentFilter.toLowerCase() === cat.toLowerCase();
    const countInfo = details.find(d => d.name === cat);
    const countBadge = countInfo ? `<span style="opacity: 0.6; margin-left: 0.25rem;">(${countInfo.count})</span>` : '';

    html += `
      <button class="cat-pill ${isActive ? 'active' : ''}" onclick="filterCategory('${cat}')">
        ${cat} ${countBadge}
      </button>
    `;
  });

  container.innerHTML = html;
}

function populateUploadCategories() {
  const select = document.getElementById('up-category');
  if (!select) return;

  select.innerHTML = appState.categories.map(c => `
    <option value="${c}">${c}</option>
  `).join('');
}

function filterCategory(catName) {
  appState.currentFilter = catName;
  loadCategories();
  loadGallery();
}

function sortGallery(sortVal) {
  appState.currentSort = sortVal;
  loadGallery();
}

let searchDebounceTimeout = null;
function handleSearch(val) {
  clearTimeout(searchDebounceTimeout);
  searchDebounceTimeout = setTimeout(() => {
    appState.searchQuery = val.trim();
    const escBtn = document.getElementById('search-clear-btn');
    if (escBtn) {
      if (val.length > 0) escBtn.classList.remove('hidden');
      else escBtn.classList.add('hidden');
    }
    loadGallery();
  }, 250);
}

function clearSearch() {
  const input = document.getElementById('global-search-input');
  if (input) input.value = '';
  appState.searchQuery = '';
  const escBtn = document.getElementById('search-clear-btn');
  if (escBtn) escBtn.classList.add('hidden');
  loadGallery();
}

async function loadGallery() {
  const grid = document.getElementById('gallery-grid');
  if (!grid) return;

  grid.innerHTML = `
    <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem; color: var(--text-muted);">
      <span class="material-symbols-outlined" style="font-size: 2rem; color: var(--champagne-300); display: block; margin-bottom: 0.5rem;">progress_activity</span>
      <p class="font-mono" style="font-size: 0.75rem; text-transform: uppercase;">Synchronizing Optical Index...</p>
    </div>
  `;

  try {
    const data = await API.getPhotos({
      category: appState.currentFilter,
      sort: appState.currentSort,
      search: appState.searchQuery,
      status: 'approved'
    });

    appState.photos = data.photos || [];

    if (appState.photos.length === 0) {
      grid.innerHTML = `
        <div class="glass-panel" style="grid-column: 1 / -1; text-align: center; padding: 3.5rem 2rem;">
          <span class="material-symbols-outlined" style="font-size: 2.5rem; color: var(--text-dim); margin-bottom: 0.5rem; display: block;">search_off</span>
          <p class="font-display" style="font-size: 1.25rem; font-weight: 700;">No Optical Exposures Match Query</p>
          <p class="font-sans" style="font-size: 0.8125rem; color: var(--text-muted); margin-top: 0.25rem;">Try resetting category filters or search parameters.</p>
          <button onclick="filterCategory('All')" class="btn-champagne" style="margin-top: 1rem; font-size: 0.75rem;">
            RESET TELEMETRY FILTER
          </button>
        </div>
      `;
      return;
    }

    grid.innerHTML = appState.photos.map(item => `
      <div class="photo-card">
        
        <!-- Image Viewport -->
        <div class="photo-card-viewport" onclick="openLightbox('${item.id}')">
          <img 
            src="${item.image}" 
            alt="${item.title}"
            loading="lazy"
            onerror="this.src='https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1600&q=80'"
          >
          <div class="photo-card-vignette"></div>

          <!-- Category Badge -->
          <div class="font-mono rounded-xl absolute" style="top: 0.75rem; left: 0.75rem; padding: 0.25rem 0.6rem; font-size: 0.625rem; background: rgba(7, 9, 14, 0.85); border: 1px solid rgba(212, 175, 55, 0.3); color: var(--champagne-200); text-transform: uppercase;">
            ${item.category}
          </div>

          <!-- EXIF Pill -->
          <div class="font-mono rounded-xl absolute flex items-center gap-1" style="bottom: 0.75rem; left: 0.75rem; padding: 0.2rem 0.55rem; font-size: 0.625rem; background: rgba(7, 9, 14, 0.9); border: 1px solid var(--midnight-border); color: var(--text-secondary);">
            <span class="material-symbols-outlined" style="font-size: 0.75rem; color: var(--champagne-300);">photo_camera</span>
            <span>${item.shutter} • ${item.aperture}</span>
          </div>
        </div>

        <!-- Metadata Lower Tier -->
        <div style="padding: 1rem; display: flex; flex-direction: column; gap: 0.75rem;">
          <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 0.5rem;">
            <div>
              <h4 class="font-sans" style="font-size: 0.875rem; font-weight: 600; color: var(--text-primary); cursor: pointer;" onclick="openLightbox('${item.id}')">
                ${item.title}
              </h4>
              <p class="font-mono" style="font-size: 0.625rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.25rem; margin-top: 0.15rem;">
                <span class="material-symbols-outlined" style="font-size: 0.75rem; color: var(--champagne-300);">location_on</span>
                <span>${item.location}</span>
              </p>
            </div>

            <!-- Like Button -->
            <button onclick="event.stopPropagation(); handleToggleLike('${item.id}')" class="btn-outline font-mono" style="padding: 0.25rem 0.6rem; border-radius: 9999px; font-size: 0.6875rem; gap: 0.35rem;">
              <span class="material-symbols-outlined" style="font-size: 0.875rem; color: ${item.liked ? 'var(--champagne-300)' : 'var(--text-muted)'};">favorite</span>
              <span style="font-weight: 600;">${item.likes}</span>
            </button>
          </div>

          <!-- Photographer Row -->
          <div style="display: flex; align-items: center; justify-content: space-between; padding-top: 0.5rem; border-top: 1px solid var(--midnight-border);">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <div class="rounded-full overflow-hidden" style="width: 1.35rem; height: 1.35rem; border: 1px solid var(--midnight-border);">
                <img src="${item.avatar}" alt="${item.author}" style="width: 100%; height: 100%; object-fit: cover;">
              </div>
              <span class="font-sans" style="font-size: 0.75rem; color: var(--text-secondary);">${item.author}</span>
            </div>
            <span class="font-mono" style="font-size: 0.625rem; color: var(--text-dim);">${item.comments ? item.comments.length : 0} CRITIQUES</span>
          </div>
        </div>

      </div>
    `).join('');

  } catch (err) {
    grid.innerHTML = `
      <div class="glass-panel" style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--accent-error);">
        Failed to connect to LUMEN API telemetry.
      </div>
    `;
  }
}

async function handleToggleLike(photoId) {
  try {
    const res = await API.toggleLike(photoId);
    if (res.success) {
      const p = appState.photos.find(x => x.id === photoId);
      if (p) {
        p.likes = res.likes;
        p.liked = res.liked;
        loadGallery();
      }
      if (appState.currentLightboxPhoto && appState.currentLightboxPhoto.id === photoId) {
        appState.currentLightboxPhoto.likes = res.likes;
        appState.currentLightboxPhoto.liked = res.liked;
        const count = document.getElementById('lb-like-count');
        if (count) count.textContent = res.likes;
      }
      showToast(res.liked ? 'Luminance point recorded' : 'Luminance point revoked', 'success');
    }
  } catch (err) {
    showToast('Failed to sync like', 'error');
  }
}

function loadMoreGallery() {
  const btn = document.getElementById('load-more-btn');
  btn.innerHTML = `<span class="material-symbols-outlined" style="font-size: 1rem;">progress_activity</span><span>INGESTING ARCHIVE CHUNKS...</span>`;
  setTimeout(() => {
    btn.innerHTML = `<span class="material-symbols-outlined" style="color: var(--accent-emerald); font-size: 1rem;">check</span><span>ALL TELEMETRY BLOCKS RESOLVED</span>`;
    showToast('All calibrated archives indexed', 'info');
  }, 750);
}

/* ========================================================= */
/* 6. FLUID LIGHTBOX CONTROLLER                              */
/* ========================================================= */
async function openLightbox(photoId) {
  try {
    let photo = appState.photos.find(p => p.id === photoId);
    if (!photo) {
      const res = await API.getPhoto(photoId);
      if (res.success) photo = res.photo;
    }
    if (!photo) return;

    appState.currentLightboxPhoto = photo;

    const img = document.getElementById('lightbox-img');
    img.src = photo.image;
    img.alt = photo.title;

    document.getElementById('lb-title').textContent = photo.title;
    document.getElementById('lb-desc').textContent = photo.imageAlt || "Ultra-high resolution optical darkroom exposure.";
    document.getElementById('lb-photo-loc').textContent = (photo.location || "").toUpperCase();
    document.getElementById('lb-author-name').textContent = photo.author;
    document.getElementById('lb-author-avatar').src = photo.avatar;
    document.getElementById('lb-category-chip').textContent = photo.category;

    // HUD
    document.getElementById('lb-hud-lens').textContent = (photo.lens || "50MM F/1.4").toUpperCase();
    document.getElementById('lb-hud-shutter').textContent = photo.shutter || "1/500s";
    document.getElementById('lb-hud-aperture').textContent = photo.aperture || "f/2.0";
    document.getElementById('lb-hud-iso').textContent = photo.iso || "ISO 100";
    document.getElementById('lb-like-count').textContent = photo.likes;

    renderLightboxComments(photo.comments || []);

    const modal = document.getElementById('lightbox-modal');
    modal.classList.remove('hidden');
  } catch (err) {
    showToast('Failed to open lightbox', 'error');
  }
}

function closeLightbox() {
  document.getElementById('lightbox-modal').classList.add('hidden');
  appState.currentLightboxPhoto = null;
}

function toggleLightboxLike() {
  if (appState.currentLightboxPhoto) {
    handleToggleLike(appState.currentLightboxPhoto.id);
  }
}

function renderLightboxComments(comments = []) {
  const list = document.getElementById('lb-comments-list');
  const countLabel = document.getElementById('lb-comments-count');
  countLabel.textContent = `${comments.length} NOTES`;

  if (comments.length === 0) {
    list.innerHTML = `<p class="font-sans" style="font-size: 0.75rem; color: var(--text-dim); font-style: italic;">No critique notes logged yet.</p>`;
    return;
  }

  list.innerHTML = comments.map(c => `
    <div class="glass-panel" style="padding: 0.6rem 0.75rem; border-color: var(--midnight-border);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.15rem;">
        <span class="font-sans" style="font-size: 0.75rem; font-weight: 600; color: var(--champagne-200);">${c.user}</span>
        <span class="font-mono" style="font-size: 0.5625rem; color: var(--text-dim); text-transform: uppercase;">${c.role || 'CRITIQUE'} • ${c.time || 'RECENT'}</span>
      </div>
      <p class="font-sans" style="font-size: 0.75rem; color: var(--text-secondary);">${c.text}</p>
    </div>
  `).join('');
}

async function postComment(e) {
  e.preventDefault();
  if (!appState.currentLightboxPhoto) return;

  const input = document.getElementById('lightbox-comment-input');
  const val = input.value.trim();
  if (!val) return;

  try {
    const res = await API.addComment(appState.currentLightboxPhoto.id, val);
    if (res.success) {
      appState.currentLightboxPhoto.comments = res.comments;
      renderLightboxComments(res.comments);
      input.value = '';
      showToast('Critique note recorded', 'success');
      loadGallery();
    }
  } catch (err) {
    showToast('Failed to post critique note', 'error');
  }
}

/* ========================================================= */
/* 7. UPLOAD CONTROLLER WITH MOSAIC DISSOLVE EFFECT          */
/* ========================================================= */
function openUploadModal() {
  populateUploadCategories();
  document.getElementById('upload-modal').classList.remove('hidden');
}

function closeUploadModal() {
  document.getElementById('upload-modal').classList.add('hidden');
  const canvas = document.getElementById('upload-mosaic-canvas');
  canvas.classList.add('hidden');
  document.getElementById('dropzone-empty-state').classList.remove('hidden');
  document.getElementById('upload-processing-badge').classList.add('hidden');
}

let selectedUploadFile = null;

function previewUploadFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  selectedUploadFile = file;

  const canvas = document.getElementById('upload-mosaic-canvas');
  const emptyState = document.getElementById('dropzone-empty-state');
  const badge = document.getElementById('upload-processing-badge');

  emptyState.classList.add('hidden');
  canvas.classList.remove('hidden');
  badge.classList.remove('hidden');

  const ctx = canvas.getContext('2d');
  const img = new Image();
  const reader = new FileReader();

  reader.onload = (event) => {
    img.onload = () => {
      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight;

      let step = 32;
      const dissolveInterval = setInterval(() => {
        if (step <= 1) {
          clearInterval(dissolveInterval);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          badge.textContent = "OPTICAL CALIBRATION COMPLETE";
          return;
        }

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;

        for (let y = 0; y < canvas.height; y += step) {
          for (let x = 0; x < canvas.width; x += step) {
            const i = (y * canvas.width + x) * 4;
            const r = data[i], g = data[i + 1], b = data[i + 2];
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fillRect(x, y, step, step);
          }
        }
        step = Math.floor(step / 2);
      }, 120);
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
}

async function handleUploadSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById('up-submit-btn');
  btn.disabled = true;
  btn.textContent = "INGESTING EXPOSURE...";

  const formData = new FormData();
  if (selectedUploadFile) {
    formData.append('imageFile', selectedUploadFile);
  }

  formData.append('title', document.getElementById('up-title').value);
  formData.append('location', document.getElementById('up-loc').value);
  formData.append('category', document.getElementById('up-category').value);
  formData.append('imageUrl', document.getElementById('up-url').value);
  formData.append('camera', document.getElementById('up-camera').value);
  formData.append('lens', document.getElementById('up-lens').value);
  formData.append('shutter', document.getElementById('up-shutter').value);
  formData.append('aperture', document.getElementById('up-aperture-iso').value.split('•')[0]?.trim() || "f/2.0");
  formData.append('iso', document.getElementById('up-aperture-iso').value.split('•')[1]?.trim() || "ISO 100");
  formData.append('description', document.getElementById('up-desc').value);

  if (appState.currentUser) {
    formData.append('author', appState.currentUser.name);
    formData.append('authorRole', appState.currentUser.role);
  }

  try {
    const res = await API.uploadPhoto(formData);
    if (res.success) {
      showToast(`Exposure "${res.photo.title}" calibrated and ingested!`, 'success');
      closeUploadModal();
      loadGallery();
    } else {
      showToast(res.error || 'Failed to ingest exposure', 'error');
    }
  } catch (err) {
    showToast('Failed to connect to ingest pipeline', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = "CALIBRATE & INGEST INTO INDEX";
    selectedUploadFile = null;
  }
}

/* ========================================================= */
/* 8. COMPETITIONS & DYNAMIC WEEK LEADERBOARD                */
/* ========================================================= */
async function loadLeaderboard() {
  const container = document.getElementById('lb-content-area');
  const weekLabel = document.getElementById('lb-week-title');
  const timerLabel = document.getElementById('lb-timer');
  if (!container) return;

  try {
    const data = await API.getLeaderboard();
    if (weekLabel) weekLabel.textContent = `OPTICAL ARTS GRAND PRIX • WEEK ${data.weekNumber}`;
    
    // Start countdown timer
    let remainingSeconds = data.endsInSeconds;
    clearInterval(appState.timerInterval);
    appState.timerInterval = setInterval(() => {
      if (remainingSeconds <= 0) {
        clearInterval(appState.timerInterval);
        if (timerLabel) timerLabel.textContent = "WINDOW CLOSED";
        return;
      }
      remainingSeconds--;
      const days = Math.floor(remainingSeconds / 86400);
      const hours = Math.floor((remainingSeconds % 86400) / 3600);
      const minutes = Math.floor((remainingSeconds % 3600) / 60);
      const seconds = remainingSeconds % 60;
      if (timerLabel) timerLabel.textContent = `${days}d ${hours}h ${minutes}m ${seconds}s`;
    }, 1000);

    renderLeaderboardContent(data);
  } catch (err) {
    container.innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--accent-error);">Failed to load leaderboard</div>`;
  }
}

function switchLeaderboardTab(tab) {
  appState.activeLeaderboardTab = tab;
  const btnPhotos = document.getElementById('lb-tab-photos');
  const btnPhotogs = document.getElementById('lb-tab-photogs');

  if (tab === 'photos') {
    btnPhotos.className = 'cat-pill active';
    btnPhotogs.className = 'cat-pill';
    btnPhotogs.style.background = 'transparent';
    btnPhotogs.style.borderColor = 'transparent';
  } else {
    btnPhotogs.className = 'cat-pill active';
    btnPhotos.className = 'cat-pill';
    btnPhotos.style.background = 'transparent';
    btnPhotos.style.borderColor = 'transparent';
  }
  loadLeaderboard();
}

function renderLeaderboardContent(data) {
  const container = document.getElementById('lb-content-area');
  if (!container) return;

  if (appState.activeLeaderboardTab === 'photos') {
    const photos = data.topPhotos || [];
    container.innerHTML = `
      <table class="lumen-table">
        <thead>
          <tr>
            <th style="width: 4rem;">RANK</th>
            <th>EXPOSURE TITLE</th>
            <th>CREATOR</th>
            <th>OPTICAL CATEGORY</th>
            <th>LENS TELEMETRY</th>
            <th style="text-align: right;">LUMINANCE (LIKES)</th>
          </tr>
        </thead>
        <tbody>
          ${photos.map((p, idx) => `
            <tr onclick="openLightbox('${p.id}')" style="cursor: pointer;">
              <td class="font-mono" style="font-weight: 700; color: ${idx === 0 ? 'var(--champagne-300)' : idx === 1 ? 'var(--champagne-100)' : idx === 2 ? '#b8952b' : 'var(--text-dim)'};">
                ${idx === 0 ? '#1 👑' : idx === 1 ? '#2 🥈' : idx === 2 ? '#3 🥉' : `#${idx + 1}`}
              </td>
              <td style="display: flex; align-items: center; gap: 0.75rem;">
                <img src="${p.image}" alt="${p.title}" style="width: 3.5rem; height: 2.5rem; object-fit: cover; border-radius: 0.5rem; border: 1px solid var(--midnight-border);">
                <span style="font-weight: 600; color: var(--text-primary);">${p.title}</span>
              </td>
              <td style="color: var(--text-secondary);">${p.author}</td>
              <td>
                <span class="font-mono rounded-xl" style="padding: 0.2rem 0.5rem; font-size: 0.625rem; background: rgba(212, 175, 55, 0.15); color: var(--champagne-200); text-transform: uppercase;">
                  ${p.category}
                </span>
              </td>
              <td class="font-mono" style="font-size: 0.6875rem; color: var(--text-muted);">${p.lens || 'Leica 50mm'}</td>
              <td class="font-mono" style="text-align: right; font-weight: 700; color: var(--champagne-300);">${p.likes}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } else {
    const curators = data.topCurators || [];
    container.innerHTML = `
      <table class="lumen-table">
        <thead>
          <tr>
            <th style="width: 4rem;">RANK</th>
            <th>CURATOR</th>
            <th>HANDLE</th>
            <th>ROLE</th>
            <th>ARCHIVED EXPOSURES</th>
            <th style="text-align: right;">REPUTATION SCORE</th>
          </tr>
        </thead>
        <tbody>
          ${curators.map((u, idx) => `
            <tr>
              <td class="font-mono" style="font-weight: 700; color: ${idx === 0 ? 'var(--champagne-300)' : idx === 1 ? 'var(--champagne-100)' : idx === 2 ? '#b8952b' : 'var(--text-dim)'};">
                ${idx === 0 ? '#1 👑' : idx === 1 ? '#2 🥈' : idx === 2 ? '#3 🥉' : `#${idx + 1}`}
              </td>
              <td style="display: flex; align-items: center; gap: 0.75rem;">
                <img src="${u.avatar}" alt="${u.name}" style="width: 2rem; height: 2rem; border-radius: 9999px; object-fit: cover; border: 1px solid var(--champagne-300);">
                <span style="font-weight: 600; color: var(--text-primary);">${u.name}</span>
              </td>
              <td class="font-mono" style="font-size: 0.6875rem; color: var(--text-muted);">${u.handle}</td>
              <td>
                <span class="font-mono rounded-xl" style="padding: 0.2rem 0.5rem; font-size: 0.625rem; background: ${u.role === 'Curator' ? 'rgba(212, 175, 55, 0.2)' : 'var(--midnight-800)'}; color: ${u.role === 'Curator' ? 'var(--champagne-200)' : 'var(--text-secondary)'}; text-transform: uppercase;">
                  ${u.role}
                </span>
              </td>
              <td class="font-mono" style="font-size: 0.6875rem; color: var(--text-secondary);">${u.photosCount || 10} ARCHIVES</td>
              <td class="font-mono" style="text-align: right; font-weight: 700; color: var(--champagne-300);">${u.rep || 90}%</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }
}

/* ========================================================= */
/* 9. REAL AUTHENTICATION & LOGIN/REGISTER VIEW              */
/* ========================================================= */
let currentAuthMode = 'login';

function toggleAuthTab(mode) {
  currentAuthMode = mode;
  const tLogin = document.getElementById('auth-tab-login');
  const tRegister = document.getElementById('auth-tab-register');
  const nameGroup = document.getElementById('auth-fullname-group');
  const submitBtn = document.getElementById('auth-submit-btn');

  if (mode === 'login') {
    tLogin.className = 'nav-link active';
    tRegister.className = 'nav-link';
    nameGroup.classList.add('hidden');
    submitBtn.textContent = 'AUTHENTICATE SESSION';
  } else {
    tRegister.className = 'nav-link active';
    tLogin.className = 'nav-link';
    nameGroup.classList.remove('hidden');
    submitBtn.textContent = 'REGISTER LENS PROFILE';
  }
}

function fillDemo(type) {
  if (type === 'curator') {
    document.getElementById('auth-email').value = 'curator@lumen.lens';
    document.getElementById('auth-pass').value = 'curator123';
  } else {
    document.getElementById('auth-email').value = 'kenji@lumen.lens';
    document.getElementById('auth-pass').value = 'photo123';
  }
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('auth-email').value;
  const password = document.getElementById('auth-pass').value;
  const btn = document.getElementById('auth-submit-btn');

  btn.disabled = true;

  try {
    let res;
    if (currentAuthMode === 'login') {
      res = await API.login(email, password);
    } else {
      const name = document.getElementById('auth-name').value;
      res = await API.register(name, email, password);
    }

    if (res.success) {
      appState.authToken = res.token;
      appState.currentUser = res.user;
      localStorage.setItem('lumen_auth_token', res.token);
      localStorage.setItem('lumen_user_profile', JSON.stringify(res.user));

      syncNavUser();
      showToast(`Session established for ${res.user.name} (${res.user.role})`, 'success');
      switchView('gallery');
    } else {
      showToast(res.error || 'Authentication rejected', 'error');
    }
  } catch (err) {
    showToast('Failed to connect to authentication node', 'error');
  } finally {
    btn.disabled = false;
  }
}

/* ========================================================= */
/* 10. INITIALIZATION LIFECYCLE                              */
/* ========================================================= */
window.addEventListener('DOMContentLoaded', () => {
  // Sync User Profile in Nav
  syncNavUser();

  // Initialize Canvas
  initHeroMosaicEngine();

  // Load initial categories & gallery
  loadCategories();
  loadGallery();

  // ESC key handler
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeLightbox();
      closeUploadModal();
      clearSearch();
    }
  });
});
