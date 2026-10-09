/**
 * LUMEN — Dedicated Curator Moderation Terminal Controller
 * Enforces real server-side role verification and data synchronization
 */

let currentQueueFilter = 'pending';

function getAuthToken() {
  return localStorage.getItem('lumen_auth_token') || '';
}

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

// Check session on load
async function checkCuratorSession() {
  const token = getAuthToken();
  const gate = document.getElementById('curator-auth-gate');
  const consoleEl = document.getElementById('curator-console-content');
  const logoutBtn = document.getElementById('admin-logout-btn');
  const nodeLabel = document.getElementById('curator-node-label');

  if (!token) {
    gate.classList.remove('hidden');
    consoleEl.classList.add('hidden');
    logoutBtn.classList.add('hidden');
    if (nodeLabel) nodeLabel.textContent = 'AUTHENTICATION REQUIRED';
    return;
  }

  try {
    const res = await fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (data.authenticated && data.user.role === 'Curator') {
      // Access granted
      gate.classList.add('hidden');
      consoleEl.classList.remove('hidden');
      logoutBtn.classList.remove('hidden');
      if (nodeLabel) nodeLabel.textContent = `CURATOR: ${data.user.name.toUpperCase()}`;

      // Load all data
      loadAdminStats();
      loadAdminQueue();
      loadAdminCategories();
      loadAdminUsers();
    } else {
      // Access denied
      gate.classList.remove('hidden');
      consoleEl.classList.add('hidden');
      logoutBtn.classList.add('hidden');
      if (nodeLabel) nodeLabel.textContent = 'CLEARANCE FORBIDDEN';

      const banner = document.getElementById('gate-error-banner');
      if (banner) {
        banner.textContent = data.authenticated
          ? 'Access Restricted: Your current session has Photographer status. Sign in with a verified Curator master account.'
          : 'Session expired. Please re-authenticate.';
        banner.classList.remove('hidden');
      }
    }
  } catch (err) {
    gate.classList.remove('hidden');
    consoleEl.classList.add('hidden');
  }
}

// Curator Gate Login
async function handleGateLogin(e) {
  e.preventDefault();
  const email = document.getElementById('gate-email').value;
  const password = document.getElementById('gate-pass').value;
  const banner = document.getElementById('gate-error-banner');
  const btn = document.getElementById('gate-submit-btn');

  btn.disabled = true;
  btn.textContent = 'VALIDATING CREDENTIALS...';
  if (banner) banner.classList.add('hidden');

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();

    if (!data.success) {
      if (banner) {
        banner.textContent = data.error || 'Authentication rejected';
        banner.classList.remove('hidden');
      }
      return;
    }

    if (data.user.role !== 'Curator') {
      if (banner) {
        banner.textContent = 'Account Clearance Error: Only Curators have permission to access the moderation terminal.';
        banner.classList.remove('hidden');
      }
      return;
    }

    // Save token and load
    localStorage.setItem('lumen_auth_token', data.token);
    localStorage.setItem('lumen_user_profile', JSON.stringify(data.user));
    showToast(`Curator clearance authorized for ${data.user.name}`, 'success');
    checkCuratorSession();
  } catch (err) {
    if (banner) {
      banner.textContent = 'Failed to connect to authentication node';
      banner.classList.remove('hidden');
    }
  } finally {
    btn.disabled = false;
    btn.textContent = 'AUTHENTICATE CLEARANCE';
  }
}

function handleAdminLogout() {
  localStorage.removeItem('lumen_auth_token');
  showToast('Logged out of Curator Terminal', 'info');
  checkCuratorSession();
}

// Load real dynamic stats & cadence
async function loadAdminStats() {
  const token = getAuthToken();
  try {
    const res = await fetch('/api/admin/stats', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!data.success) return;

    const stats = data.stats;
    document.getElementById('stat-total-users').textContent = stats.totalUsers;
    document.getElementById('stat-approved-photos').textContent = stats.approvedPhotos;
    document.getElementById('stat-pending-photos').textContent = stats.pendingPhotos;
    document.getElementById('stat-total-critiques').textContent = stats.totalCritiques;

    // Render Cadence Bar Graph
    const barsContainer = document.getElementById('cadence-bars-container');
    if (barsContainer && stats.cadence) {
      barsContainer.innerHTML = stats.cadence.map(item => `
        <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 0.5rem; height: 100%; justify-content: flex-end;">
          <div style="width: 100%; border-radius: 4px 4px 0 0; background: ${item.count > 0 ? 'linear-gradient(to top, var(--champagne-300), var(--champagne-100))' : 'var(--midnight-750)'}; height: ${item.pct}%; transition: all 0.3s ease; box-shadow: ${item.count > 0 ? '0 0 12px var(--champagne-glow)' : 'none'};"></div>
          <span class="font-mono" style="font-size: 0.625rem; color: ${item.count > 0 ? 'var(--champagne-200)' : 'var(--text-muted)'}; font-weight: ${item.count > 0 ? '700' : '400'};">${item.day} (${item.count})</span>
        </div>
      `).join('');
    }

    const weekLabel = document.getElementById('cadence-active-week');
    if (weekLabel) weekLabel.textContent = `CALENDAR WEEK ${stats.currentWeek} TELEMETRY`;
  } catch (err) {
    console.error('Failed to load admin stats:', err);
  }
}

// Dynamic Categories Management
async function loadAdminCategories() {
  const container = document.getElementById('admin-categories-list');
  const countBadge = document.getElementById('categories-count-badge');
  if (!container) return;

  try {
    const res = await fetch('/api/categories');
    const data = await res.json();
    if (!data.success) return;

    if (countBadge) countBadge.textContent = `${data.categories.length} ACTIVE`;

    container.innerHTML = data.categories.map(cat => `
      <span class="font-mono rounded-xl inline-flex items-center gap-2" style="padding: 0.35rem 0.65rem; background: var(--midnight-900); border: 1px solid var(--midnight-border); font-size: 0.6875rem; color: var(--champagne-100);">
        <span>${cat}</span>
        <button onclick="handleDeleteCategory('${cat}')" style="background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 0.75rem;" title="Delete Category Tag">×</button>
      </span>
    `).join('');
  } catch (err) {
    console.error('Failed to load categories in admin:', err);
  }
}

async function handleAddCategory() {
  const input = document.getElementById('new-category-input');
  const val = input.value.trim();
  if (!val) return;

  const token = getAuthToken();
  try {
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ name: val })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Category "${val}" added to global taxonomy`, 'success');
      input.value = '';
      loadAdminCategories();
    } else {
      showToast(data.error || 'Failed to add category', 'error');
    }
  } catch (err) {
    showToast('Failed to add category', 'error');
  }
}

async function handleDeleteCategory(name) {
  if (!confirm(`Are you sure you want to remove the category "${name}"?`)) return;
  const token = getAuthToken();
  try {
    const res = await fetch(`/api/categories/${encodeURIComponent(name)}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Category "${name}" expunged`, 'info');
      loadAdminCategories();
    } else {
      showToast(data.error || 'Failed to remove category', 'error');
    }
  } catch (err) {
    showToast('Failed to delete category', 'error');
  }
}

// Moderation Pipeline Queue
function filterQueue(status) {
  currentQueueFilter = status;
  const btnPending = document.getElementById('q-btn-pending');
  const btnAll = document.getElementById('q-btn-all');
  const btnRejected = document.getElementById('q-btn-rejected');

  [btnPending, btnAll, btnRejected].forEach(b => {
    if (b) {
      b.className = 'cat-pill';
      b.style.background = 'transparent';
      b.style.borderColor = 'var(--midnight-border)';
    }
  });

  const activeBtn = status === 'pending' ? btnPending : status === 'all' ? btnAll : btnRejected;
  if (activeBtn) {
    activeBtn.className = 'cat-pill active';
  }

  loadAdminQueue();
}

async function loadAdminQueue() {
  const tbody = document.getElementById('queue-tbody');
  if (!tbody) return;

  try {
    const res = await fetch(`/api/photos?status=${currentQueueFilter}`);
    const data = await res.json();
    const photos = data.photos || [];

    if (photos.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 2.5rem; color: var(--text-dim); font-style: italic;">
            No exposures in queue under filter "${currentQueueFilter}".
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = photos.map(p => `
      <tr>
        <td style="display: flex; align-items: center; gap: 0.75rem;">
          <img src="${p.image}" alt="${p.title}" style="width: 3.5rem; height: 2.5rem; object-fit: cover; border-radius: 0.5rem; border: 1px solid var(--midnight-border);">
          <div>
            <span class="font-mono" style="font-size: 0.6875rem; color: var(--champagne-200); display: block;">${p.camera || 'Leica'}</span>
            <span class="font-mono" style="font-size: 0.625rem; color: var(--text-dim);">${p.shutter} • ${p.aperture} • ${p.iso}</span>
          </div>
        </td>
        <td>
          <span style="font-weight: 600; color: var(--text-primary); display: block;">${p.title}</span>
          <span style="font-size: 0.6875rem; color: var(--text-muted);">${p.location}</span>
        </td>
        <td>
          <span style="color: var(--text-secondary);">${p.author}</span>
          <span class="font-mono" style="font-size: 0.625rem; color: var(--text-dim); display: block;">${p.authorRole}</span>
        </td>
        <td>
          <span class="font-mono rounded-xl" style="padding: 0.2rem 0.5rem; font-size: 0.625rem; text-transform: uppercase; background: ${p.status === 'approved' ? 'rgba(16, 185, 129, 0.15)' : p.status === 'rejected' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(212, 175, 55, 0.15)'}; color: ${p.status === 'approved' ? 'var(--accent-emerald)' : p.status === 'rejected' ? 'var(--accent-error)' : 'var(--champagne-300)'};">
            ${p.status}
          </span>
        </td>
        <td style="text-align: right;">
          <div style="display: inline-flex; gap: 0.35rem;">
            ${p.status !== 'approved' ? `
              <button onclick="handleSetPhotoStatus('${p.id}', 'approved')" class="btn-outline font-mono" style="padding: 0.25rem 0.5rem; font-size: 0.625rem; color: var(--accent-emerald); border-color: rgba(16, 185, 129, 0.3);">
                APPROVE
              </button>
            ` : ''}
            ${p.status !== 'rejected' ? `
              <button onclick="handleSetPhotoStatus('${p.id}', 'rejected')" class="btn-outline font-mono" style="padding: 0.25rem 0.5rem; font-size: 0.625rem; color: var(--champagne-300); border-color: rgba(212, 175, 55, 0.3);">
                REJECT
              </button>
            ` : ''}
            <button onclick="handleExpungePhoto('${p.id}')" class="btn-outline font-mono" style="padding: 0.25rem 0.5rem; font-size: 0.625rem; color: var(--accent-error); border-color: rgba(239, 68, 68, 0.3);">
              EXPUNGE
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--accent-error);">Failed to load moderation pipeline</td></tr>`;
  }
}

async function handleSetPhotoStatus(id, status) {
  const token = getAuthToken();
  try {
    const res = await fetch(`/api/photos/${id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ status })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Exposure marked as ${status.toUpperCase()}`, 'success');
      loadAdminQueue();
      loadAdminStats();
    } else {
      showToast(data.error || 'Operation forbidden', 'error');
    }
  } catch (err) {
    showToast('Failed to update status', 'error');
  }
}

async function handleExpungePhoto(id) {
  if (!confirm("Confirm complete expungement of photographic asset from telemetry index?")) return;
  const token = getAuthToken();
  try {
    const res = await fetch(`/api/photos/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success) {
      showToast('Asset expunged from database', 'info');
      loadAdminQueue();
      loadAdminStats();
    } else {
      showToast(data.error || 'Expunge failed', 'error');
    }
  } catch (err) {
    showToast('Failed to expunge asset', 'error');
  }
}

// User Registry
let userSearchTimeout = null;
function handleUserSearch(val) {
  clearTimeout(userSearchTimeout);
  userSearchTimeout = setTimeout(() => {
    loadAdminUsers(val.trim());
  }, 250);
}

async function loadAdminUsers(search = '') {
  const grid = document.getElementById('users-grid');
  if (!grid) return;

  const token = getAuthToken();
  try {
    const res = await fetch(`/api/admin/users?search=${encodeURIComponent(search)}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!data.success) return;

    const users = data.users || [];
    grid.innerHTML = users.map(u => `
      <div class="glass-panel" style="padding: 1rem; display: flex; align-items: center; justify-content: space-between;">
        <div>
          <div class="flex items-center gap-2">
            <span style="font-size: 0.875rem; font-weight: 600; color: var(--text-primary);">${u.name}</span>
            ${u.banned ? '<span class="font-mono rounded" style="font-size: 0.5625rem; padding: 0.1rem 0.35rem; background: rgba(239, 68, 68, 0.2); color: var(--accent-error);">BANNED</span>' : ''}
          </div>
          <span class="font-mono" style="font-size: 0.6875rem; color: var(--text-muted); display: block; margin-top: 0.15rem;">
            ${u.handle} • <span style="color: ${u.role === 'Curator' ? 'var(--champagne-300)' : 'var(--text-secondary)'}">${u.role}</span>
          </span>
        </div>
        <div class="flex items-center gap-1">
          <button onclick="handleToggleUserRole('${u.id}')" class="btn-outline font-mono" style="font-size: 0.625rem; padding: 0.35rem 0.5rem;">
            ${u.role === 'Curator' ? 'REVOKE' : 'MAKE CURATOR'}
          </button>
          <button onclick="handleToggleUserBan('${u.id}')" class="btn-outline font-mono" style="font-size: 0.625rem; padding: 0.35rem 0.5rem; color: ${u.banned ? 'var(--accent-emerald)' : 'var(--accent-error)'};">
            ${u.banned ? 'UNBAN' : 'BAN'}
          </button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--accent-error);">Failed to load user registry</div>`;
  }
}

async function handleToggleUserRole(id) {
  const token = getAuthToken();
  try {
    const res = await fetch(`/api/users/${id}/role`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success) {
      showToast(`User role toggled to: ${data.user.role}`, 'success');
      loadAdminUsers();
      loadAdminStats();
    } else {
      showToast(data.error || 'Role change failed', 'error');
    }
  } catch (err) {
    showToast('Failed to update role', 'error');
  }
}

async function handleToggleUserBan(id) {
  const token = getAuthToken();
  try {
    const res = await fetch(`/api/users/${id}/ban`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.user.banned ? 'User banned from telemetry' : 'User unbanned', 'info');
      loadAdminUsers();
    } else {
      showToast(data.error || 'Failed to update ban state', 'error');
    }
  } catch (err) {
    showToast('Failed to update ban state', 'error');
  }
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
  checkCuratorSession();
});
