const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

// Directories
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');
const SEED_FILE = path.join(DATA_DIR, 'seed.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'optic-' + uniqueSuffix + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

// Static frontend & uploads
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));

// In-Memory Database Engine
let db = { photos: [], users: [], categories: [] };
const activeSessions = new Map(); // token -> { userId, role, expiresAt }

function loadDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      db = JSON.parse(data);
      console.log(`[LUMEN DB] Loaded ${db.photos.length} photos, ${db.categories.length} categories, ${db.users.length} users.`);
    } else if (fs.existsSync(SEED_FILE)) {
      const seedData = fs.readFileSync(SEED_FILE, 'utf8');
      db = JSON.parse(seedData);
      saveDatabase();
      console.log(`[LUMEN DB] Initialized with seed data.`);
    }
  } catch (err) {
    console.error('[LUMEN DB] Error loading database:', err);
    if (fs.existsSync(SEED_FILE)) {
      db = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
    }
  }
}

function saveDatabase() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
  } catch (err) {
    console.error('[LUMEN DB] Error saving database:', err);
  }
}

loadDatabase();

// Helpers
function getISOWeek(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}

function getCountdownToSunday() {
  const now = new Date();
  const nextSunday = new Date(now);
  const day = now.getUTCDay();
  const diff = day === 0 ? 7 : (7 - day); // days until next Sunday
  nextSunday.setUTCDate(now.getUTCDate() + diff);
  nextSunday.setUTCHours(23, 59, 59, 999);
  const totalSeconds = Math.max(0, Math.floor((nextSunday - now) / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { totalSeconds, formatted: `${days}d ${hours}h ${minutes}m ${seconds}s` };
}

// Authentication & Role Check Middleware
function authenticateToken(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return null;
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  const session = activeSessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    activeSessions.delete(token);
    return null;
  }

  const user = db.users.find(u => u.id === session.userId);
  if (!user || user.banned) return null;

  return user;
}

function requireAuth(req, res, next) {
  const user = authenticateToken(req);
  if (!user) {
    return res.status(401).json({ success: false, error: 'Authentication required. Please sign in.' });
  }
  req.user = user;
  next();
}

function requireCurator(req, res, next) {
  const user = authenticateToken(req);
  if (!user) {
    return res.status(401).json({ success: false, error: 'Authentication required. Curator credentials missing.' });
  }
  if (user.role !== 'Curator') {
    return res.status(403).json({ success: false, error: 'Access forbidden. Curator clearance required for this operation.' });
  }
  req.user = user;
  next();
}

/* ========================================================= */
/* API ROUTES                                                */
/* ========================================================= */

// Health
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    system: 'LUMEN Midnight & Champagne Optical Darkroom Engine',
    photosCount: db.photos.length,
    categoriesCount: db.categories.length,
    usersCount: db.users.length,
    uptimeSeconds: Math.floor(process.uptime()),
    currentWeek: getISOWeek(),
    timestamp: new Date().toISOString()
  });
});

// GET /api/auth/me - Verify current session
app.get('/api/auth/me', (req, res) => {
  const user = authenticateToken(req);
  if (!user) {
    return res.status(401).json({ authenticated: false });
  }
  const { password, ...safeUser } = user;
  res.json({ authenticated: true, user: safeUser });
});

// POST /api/auth/login - Real credential verification
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required' });
  }

  const user = db.users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
  if (!user) {
    return res.status(401).json({ success: false, error: 'Unknown darkroom operator credentials' });
  }

  if (user.banned) {
    return res.status(403).json({ success: false, error: 'Account has been expunged or blacklisted by curator terminal' });
  }

  // Password check (matches stored password or default demo password)
  if (user.password && user.password !== password) {
    return res.status(401).json({ success: false, error: 'Invalid master key for optic profile' });
  }

  const token = 'lumen_tok_' + Buffer.from(`${user.id}_${Date.now()}_${Math.random()}`).toString('base64');
  const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days
  activeSessions.set(token, { userId: user.id, role: user.role, expiresAt });

  const { password: _, ...safeUser } = user;
  res.json({
    success: true,
    token,
    user: safeUser
  });
});

// POST /api/auth/register - Register new photographer
app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ success: false, error: 'Name, email and password are required' });
  }

  const existing = db.users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
  if (existing) {
    return res.status(400).json({ success: false, error: 'An operator with this email is already registered' });
  }

  const newUser = {
    id: 'u_' + Date.now(),
    name: name.trim(),
    email: email.trim().toLowerCase(),
    password: password,
    handle: `@${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
    role: 'Photographer', // New accounts are strictly photographers
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
    photosCount: 0,
    rep: 80,
    banned: false
  };

  db.users.push(newUser);
  saveDatabase();

  const token = 'lumen_tok_' + Buffer.from(`${newUser.id}_${Date.now()}_${Math.random()}`).toString('base64');
  activeSessions.set(token, { userId: newUser.id, role: newUser.role, expiresAt: Date.now() + (7 * 24 * 3600 * 1000) });

  const { password: _, ...safeUser } = newUser;
  res.status(201).json({ success: true, token, user: safeUser });
});

// GET /api/photos - Public & Filtered Catalog
app.get('/api/photos', (req, res) => {
  const { category, search, sort = 'trending', status } = req.query;

  let results = [...db.photos];

  // Status Filter: default to approved for public feed unless explicitly requested
  if (status && status !== 'all') {
    results = results.filter(p => p.status === status);
  } else if (!status) {
    results = results.filter(p => p.status === 'approved');
  }

  // Category Filter
  if (category && category.toLowerCase() !== 'all') {
    results = results.filter(p =>
      p.category && p.category.toLowerCase().trim() === category.toLowerCase().trim()
    );
  }

  // Search Filter
  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    results = results.filter(p =>
      (p.title && p.title.toLowerCase().includes(q)) ||
      (p.author && p.author.toLowerCase().includes(q)) ||
      (p.location && p.location.toLowerCase().includes(q)) ||
      (p.lens && p.lens.toLowerCase().includes(q)) ||
      (p.camera && p.camera.toLowerCase().includes(q)) ||
      (p.category && p.category.toLowerCase().includes(q))
    );
  }

  // Sorting
  if (sort === 'likes') {
    results.sort((a, b) => (b.likes || 0) - (a.likes || 0));
  } else if (sort === 'latest') {
    results.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
  } else {
    // Trending
    results.sort((a, b) => {
      const aScore = (a.likes || 0) + (a.comments ? a.comments.length * 20 : 0);
      const bScore = (b.likes || 0) + (b.comments ? b.comments.length * 20 : 0);
      return bScore - aScore;
    });
  }

  res.json({
    success: true,
    total: results.length,
    photos: results
  });
});

// GET /api/photos/:id
app.get('/api/photos/:id', (req, res) => {
  const photo = db.photos.find(p => p.id === req.params.id);
  if (!photo) return res.status(404).json({ success: false, error: 'Exposure asset not found' });
  res.json({ success: true, photo });
});

// POST /api/photos - Ingest new photo (supports multipart file or JSON)
app.post('/api/photos', upload.single('imageFile'), (req, res) => {
  try {
    const body = req.body;
    let imageUrl = body.imageUrl;

    if (req.file) {
      imageUrl = `/uploads/${req.file.filename}`;
    }

    if (!imageUrl) {
      imageUrl = "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1600&q=80";
    }

    // Check author session if token supplied
    const user = authenticateToken(req);
    const isCurator = user ? (user.role === 'Curator') : (body.authorRole === 'Curator');
    const authorName = user ? user.name : (body.author || 'Guest Photographer');
    const authorRole = isCurator ? 'Curator' : 'Photographer';
    const authorAvatar = user ? user.avatar : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80';

    const newPhoto = {
      id: 'p_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      title: body.title || 'Untitled Darkroom Exposure',
      author: authorName,
      authorRole: authorRole,
      avatar: authorAvatar,
      avatarAlt: `${authorName} profile.`,
      image: imageUrl,
      imageAlt: body.description || `${body.title || 'Exposure'} captured under LUMEN darkroom optics.`,
      location: body.location || 'Undisclosed Coordinates',
      category: body.category || 'Landscape',
      likes: 1,
      liked: false,
      camera: body.camera || 'Leica M11-P Darkroom Edition',
      lens: body.lens || 'Leica Summilux 50mm f/1.4 ASPH',
      shutter: body.shutter || '1/500s',
      aperture: body.aperture || 'f/2.0',
      iso: body.iso || 'ISO 100',
      focalLength: body.focalLength || '50mm',
      status: isCurator ? 'approved' : 'pending', // Submissions from curators are approved, others pending
      featured: false,
      timestamp: new Date().toISOString(),
      comments: []
    };

    db.photos.unshift(newPhoto);
    saveDatabase();

    res.status(201).json({
      success: true,
      message: `Exposure "${newPhoto.title}" ingested. Status: ${newPhoto.status.toUpperCase()}`,
      photo: newPhoto
    });
  } catch (err) {
    console.error('Photo ingest error:', err);
    res.status(500).json({ success: false, error: 'Ingestion pipeline error' });
  }
});

// POST /api/photos/:id/like - Like toggle
app.post('/api/photos/:id/like', (req, res) => {
  const photo = db.photos.find(p => p.id === req.params.id);
  if (!photo) return res.status(404).json({ success: false, error: 'Exposure not found' });

  if (photo.liked) {
    photo.likes = Math.max(0, (photo.likes || 1) - 1);
    photo.liked = false;
  } else {
    photo.likes = (photo.likes || 0) + 1;
    photo.liked = true;
  }

  saveDatabase();
  res.json({ success: true, likes: photo.likes, liked: photo.liked });
});

// POST /api/photos/:id/comments - Add critique note
app.post('/api/photos/:id/comments', (req, res) => {
  const photo = db.photos.find(p => p.id === req.params.id);
  if (!photo) return res.status(404).json({ success: false, error: 'Exposure not found' });

  const { text } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ success: false, error: 'Critique text is required' });
  }

  const user = authenticateToken(req);
  const authorName = user ? user.name : (req.body.user || 'Optics Operator');
  const authorRole = user ? user.role : (req.body.role || 'Photographer');

  if (!photo.comments) photo.comments = [];

  const newComment = {
    id: 'c_' + Date.now(),
    user: authorName,
    role: authorRole,
    text: text.trim(),
    time: 'Just now',
    timestamp: new Date().toISOString()
  };

  photo.comments.push(newComment);
  saveDatabase();

  res.status(201).json({ success: true, comments: photo.comments, newComment });
});

// PATCH /api/photos/:id/status - Curator only
app.patch('/api/photos/:id/status', requireCurator, (req, res) => {
  const photo = db.photos.find(p => p.id === req.params.id);
  if (!photo) return res.status(404).json({ success: false, error: 'Exposure not found' });

  const { status } = req.body;
  if (!['approved', 'pending', 'rejected'].includes(status)) {
    return res.status(400).json({ success: false, error: 'Invalid moderation status' });
  }

  photo.status = status;
  saveDatabase();

  res.json({ success: true, message: `Status updated to ${status}`, photo });
});

// DELETE /api/photos/:id - Curator only
app.delete('/api/photos/:id', requireCurator, (req, res) => {
  const idx = db.photos.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, error: 'Exposure not found' });

  const removed = db.photos.splice(idx, 1)[0];
  saveDatabase();

  res.json({ success: true, message: `Asset "${removed.title}" expunged from index` });
});

// GET /api/categories - Dynamic Category List
app.get('/api/categories', (req, res) => {
  const counts = {};
  db.photos.forEach(p => {
    if (p.category) counts[p.category] = (counts[p.category] || 0) + 1;
  });

  const categoryDetails = db.categories.map(cat => ({
    name: cat,
    count: counts[cat] || 0
  }));

  res.json({
    success: true,
    categories: db.categories,
    categoryDetails
  });
});

// POST /api/categories - Curator only
app.post('/api/categories', requireCurator, (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, error: 'Category name is required' });
  }
  const cleanName = name.trim();
  if (!db.categories.includes(cleanName)) {
    db.categories.push(cleanName);
    saveDatabase();
  }
  res.json({ success: true, categories: db.categories });
});

// DELETE /api/categories/:name - Curator only
app.delete('/api/categories/:name', requireCurator, (req, res) => {
  const catName = decodeURIComponent(req.params.name).trim();
  db.categories = db.categories.filter(c => c.toLowerCase() !== catName.toLowerCase());
  saveDatabase();
  res.json({ success: true, categories: db.categories });
});

// GET /api/leaderboard - Real rankings & countdown
app.get('/api/leaderboard', (req, res) => {
  const topPhotos = [...db.photos]
    .filter(p => p.status === 'approved')
    .sort((a, b) => (b.likes || 0) - (a.likes || 0))
    .slice(0, 10);

  const topCurators = [...db.users]
    .sort((a, b) => (b.rep || 0) - (a.rep || 0))
    .slice(0, 10);

  const countdown = getCountdownToSunday();

  res.json({
    success: true,
    weekNumber: getISOWeek(),
    weekTitle: `WEEK ${getISOWeek()} • GRAND PRIX`,
    countdownFormatted: countdown.formatted,
    endsInSeconds: countdown.totalSeconds,
    topPhotos,
    topCurators
  });
});

// GET /api/admin/stats - Curator only real calculated statistics
app.get('/api/admin/stats', requireCurator, (req, res) => {
  const totalPhotos = db.photos.length;
  const approvedPhotos = db.photos.filter(p => p.status === 'approved').length;
  const pendingPhotos = db.photos.filter(p => p.status === 'pending').length;
  const rejectedPhotos = db.photos.filter(p => p.status === 'rejected').length;
  const totalUsers = db.users.length;
  const curatorCount = db.users.filter(u => u.role === 'Curator').length;
  const totalLikes = db.photos.reduce((acc, p) => acc + (p.likes || 0), 0);
  const totalCritiques = db.photos.reduce((acc, p) => acc + (p.comments ? p.comments.length : 0), 0);

  // Compute real 7-day ingestion cadence from actual timestamps
  const daysOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const dayCounts = { SUN: 0, MON: 0, TUE: 0, WED: 0, THU: 0, FRI: 0, SAT: 0 };

  db.photos.forEach(p => {
    if (p.timestamp) {
      const d = new Date(p.timestamp);
      const dayName = daysOfWeek[d.getUTCDay()];
      if (dayCounts[dayName] !== undefined) dayCounts[dayName]++;
    }
  });

  const maxDayCount = Math.max(1, ...Object.values(dayCounts));
  const cadence = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(day => ({
    day,
    count: dayCounts[day],
    pct: Math.max(15, Math.round((dayCounts[day] / maxDayCount) * 100))
  }));

  res.json({
    success: true,
    stats: {
      totalPhotos,
      approvedPhotos,
      pendingPhotos,
      rejectedPhotos,
      totalUsers,
      curatorCount,
      totalLikes,
      totalCritiques,
      currentWeek: getISOWeek(),
      cadence
    }
  });
});

// GET /api/admin/users - Curator only
app.get('/api/admin/users', requireCurator, (req, res) => {
  const { search } = req.query;
  let results = [...db.users];

  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    results = results.filter(u =>
      u.name.toLowerCase().includes(q) ||
      u.handle.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
  }

  // Remove passwords before returning
  const safeUsers = results.map(({ password, ...u }) => u);
  res.json({ success: true, users: safeUsers });
});

// PATCH /api/users/:id/role - Curator only
app.patch('/api/users/:id/role', requireCurator, (req, res) => {
  const user = db.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });

  user.role = user.role === 'Curator' ? 'Photographer' : 'Curator';
  saveDatabase();

  const { password, ...safeUser } = user;
  res.json({ success: true, user: safeUser });
});

// PATCH /api/users/:id/ban - Curator only
app.patch('/api/users/:id/ban', requireCurator, (req, res) => {
  const user = db.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });

  user.banned = !user.banned;
  saveDatabase();

  const { password, ...safeUser } = user;
  res.json({ success: true, user: safeUser });
});

// Explicit Admin Route
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Fallback to SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`  ✦ LUMEN — Optical Arts & Cinematic Darkroom Engine ✦  `);
  console.log(`  Midnight & Champagne Architecture                   `);
  console.log(`  Server live on http://localhost:${PORT}             `);
  console.log(`=======================================================`);
});
