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
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'optic-' + uniqueSuffix + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB max
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

// Serve static frontend & uploaded assets
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));

// Database Helper
let db = { photos: [], users: [], categories: [] };

function loadDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      db = JSON.parse(data);
      console.log(`[LUMEN DB] Loaded ${db.photos.length} photos and ${db.users.length} users from database.json`);
    } else if (fs.existsSync(SEED_FILE)) {
      const seedData = fs.readFileSync(SEED_FILE, 'utf8');
      db = JSON.parse(seedData);
      saveDatabase();
      console.log(`[LUMEN DB] Seeded database with ${db.photos.length} photos`);
    } else {
      db = { photos: [], users: [], categories: [] };
      saveDatabase();
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

/* ========================================================= */
/* API ROUTES                                                */
/* ========================================================= */

// Health & System Info
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    system: 'LUMEN Optical Darkroom Node',
    photosCount: db.photos.length,
    usersCount: db.users.length,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// GET /api/photos - Filter, Search & Sort
app.get('/api/photos', (req, res) => {
  const { category, search, sort = 'trending', status } = req.query;

  let results = [...db.photos];

  // Status Filter: default to 'approved' for public catalog, or specific requested status
  if (status && status !== 'all') {
    results = results.filter(p => p.status === status);
  } else if (!status) {
    results = results.filter(p => p.status === 'approved');
  }

  // Category Filter
  if (category && category.toLowerCase() !== 'all') {
    results = results.filter(p => 
      p.category && p.category.toLowerCase().includes(category.toLowerCase())
    );
  }

  // Search Filter (titles, authors, locations, camera, lens)
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

  // Sort
  if (sort === 'likes') {
    results.sort((a, b) => (b.likes || 0) - (a.likes || 0));
  } else if (sort === 'latest') {
    results.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
  } else {
    // Trending: weighted formula (likes + recentness + critique count)
    results.sort((a, b) => {
      const aScore = (a.likes || 0) + (a.comments ? a.comments.length * 15 : 0);
      const bScore = (b.likes || 0) + (b.comments ? b.comments.length * 15 : 0);
      return bScore - aScore;
    });
  }

  res.json({
    success: true,
    total: results.length,
    photos: results
  });
});

// GET /api/photos/:id - Single photo detail
app.get('/api/photos/:id', (req, res) => {
  const photo = db.photos.find(p => p.id === req.params.id);
  if (!photo) {
    return res.status(404).json({ success: false, message: 'Exposure not found in index' });
  }
  res.json({ success: true, photo });
});

// POST /api/photos - Ingest new photo (supports file upload or JSON)
app.post('/api/photos', upload.single('imageFile'), (req, res) => {
  try {
    const body = req.body;
    let imageUrl = body.imageUrl;

    if (req.file) {
      imageUrl = `/uploads/${req.file.filename}`;
    }

    if (!imageUrl) {
      // Fallback aesthetic photographic asset if none provided
      imageUrl = "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1600&q=80";
    }

    const isCurator = (body.authorRole === 'Curator') || (body.role === 'Curator');
    const authorName = body.author || (isCurator ? "Elias Thorne" : "Guest Photographer");
    
    // Parse EXIF composite if provided (e.g. "50mm • f/1.4 • 1/500s • ISO 100")
    const exifComposite = body.exif || "";
    const exifParts = exifComposite.split('•').map(s => s.trim());

    const newPhoto = {
      id: "p_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      title: body.title || "Untitled Darkroom Study",
      author: authorName,
      authorRole: isCurator ? "Curator" : "Photographer",
      avatar: body.avatar || (isCurator 
        ? "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80" 
        : "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80"),
      avatarAlt: `${authorName} profile avatar.`,
      image: imageUrl,
      imageAlt: body.description || `${body.title || 'Exposure'} captured under LUMEN darkroom optics.`,
      location: body.location || "Undisclosed Coordinates",
      category: body.category || "Landscape",
      likes: 1,
      liked: false,
      camera: body.camera || "Leica M11-P Darkroom Edition",
      lens: body.lens || (exifParts[0] || "Leica Summilux 50mm f/1.4"),
      shutter: body.shutter || (exifParts[2] || "1/500s"),
      aperture: body.aperture || (exifParts[1] || "f/2.0"),
      iso: body.iso || (exifParts[3] || "ISO 100"),
      focalLength: body.focalLength || (exifParts[0] || "50mm"),
      status: isCurator ? 'approved' : 'pending',
      featured: false,
      timestamp: new Date().toISOString(),
      comments: []
    };

    db.photos.unshift(newPhoto);
    saveDatabase();

    res.status(201).json({
      success: true,
      message: `Exposure "${newPhoto.title}" ingested successfully`,
      photo: newPhoto
    });
  } catch (err) {
    console.error('Error creating photo:', err);
    res.status(500).json({ success: false, message: 'Failed to ingest exposure asset' });
  }
});

// POST /api/photos/:id/like - Toggle Like
app.post('/api/photos/:id/like', (req, res) => {
  const photo = db.photos.find(p => p.id === req.params.id);
  if (!photo) {
    return res.status(404).json({ success: false, message: 'Photo not found' });
  }

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
  if (!photo) {
    return res.status(404).json({ success: false, message: 'Photo not found' });
  }

  const { text, user = "Elias Thorne", role = "Curator" } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ success: false, message: 'Comment text is required' });
  }

  if (!photo.comments) photo.comments = [];

  const newComment = {
    id: "c_" + Date.now(),
    user: user.trim(),
    role: role,
    text: text.trim(),
    time: "Just now",
    timestamp: new Date().toISOString()
  };

  photo.comments.push(newComment);
  saveDatabase();

  res.status(201).json({ success: true, comments: photo.comments, newComment });
});

// PATCH /api/photos/:id/status - Curator Moderation Status update
app.patch('/api/photos/:id/status', (req, res) => {
  const photo = db.photos.find(p => p.id === req.params.id);
  if (!photo) {
    return res.status(404).json({ success: false, message: 'Photo not found' });
  }

  const { status } = req.body;
  if (!['approved', 'pending', 'rejected'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status' });
  }

  photo.status = status;
  saveDatabase();

  res.json({ success: true, message: `Status updated to ${status}`, photo });
});

// DELETE /api/photos/:id - Curator expunge photo
app.delete('/api/photos/:id', (req, res) => {
  const idx = db.photos.findIndex(p => p.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Photo not found' });
  }

  const removed = db.photos.splice(idx, 1)[0];
  saveDatabase();

  res.json({ success: true, message: `Photographic asset "${removed.title}" expunged from telemetry index` });
});

// GET /api/categories - Categories list with counts
app.get('/api/categories', (req, res) => {
  const counts = {};
  db.photos.forEach(p => {
    if (p.category) {
      counts[p.category] = (counts[p.category] || 0) + 1;
    }
  });

  const categoriesWithCounts = db.categories.map(cat => ({
    name: cat,
    count: counts[cat] || 0
  }));

  res.json({
    success: true,
    categories: db.categories,
    categoryDetails: categoriesWithCounts
  });
});

// POST /api/categories - Add category
app.post('/api/categories', (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Category name is required' });
  }
  const cleanName = name.trim();
  if (!db.categories.includes(cleanName)) {
    db.categories.push(cleanName);
    saveDatabase();
  }
  res.json({ success: true, categories: db.categories });
});

// DELETE /api/categories/:name - Remove category
app.delete('/api/categories/:name', (req, res) => {
  const catName = decodeURIComponent(req.params.name);
  db.categories = db.categories.filter(c => c.toLowerCase() !== catName.toLowerCase());
  saveDatabase();
  res.json({ success: true, categories: db.categories });
});

// GET /api/leaderboard - Weekly Grand Prix rankings
app.get('/api/leaderboard', (req, res) => {
  // Top 10 approved photos
  const topPhotos = [...db.photos]
    .filter(p => p.status === 'approved')
    .sort((a, b) => (b.likes || 0) - (a.likes || 0))
    .slice(0, 10);

  // Top photographers computed from user photo counts & reputations
  const topCurators = [...db.users]
    .sort((a, b) => (b.rep || 0) - (a.rep || 0))
    .slice(0, 10);

  res.json({
    success: true,
    week: 42,
    endsInSeconds: 3 * 86400 + 14 * 3600 + 22 * 60 + 18,
    topPhotos,
    topCurators
  });
});

// GET /api/users - User registry & access control
app.get('/api/users', (req, res) => {
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

  res.json({ success: true, users: results });
});

// POST /api/users - Register new user
app.post('/api/users', (req, res) => {
  const { name, email, handle, role = 'Photographer' } = req.body;
  if (!name || !email) {
    return res.status(400).json({ success: false, message: 'Name and email are required' });
  }

  const existing = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    return res.json({ success: true, message: 'Existing session authenticated', user: existing });
  }

  const newUser = {
    id: "u_" + Date.now(),
    name,
    email,
    handle: handle || `@${name.toLowerCase().replace(/\s+/g, '_')}`,
    role,
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80",
    photosCount: 0,
    rep: 85,
    banned: false
  };

  db.users.push(newUser);
  saveDatabase();

  res.status(201).json({ success: true, user: newUser });
});

// PATCH /api/users/:id/role - Toggle Curator / Photographer role
app.patch('/api/users/:id/role', (req, res) => {
  const user = db.users.find(u => u.id === req.params.id);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  user.role = user.role === 'Curator' ? 'Photographer' : 'Curator';
  saveDatabase();

  res.json({ success: true, user });
});

// PATCH /api/users/:id/ban - Toggle Ban status
app.patch('/api/users/:id/ban', (req, res) => {
  const user = db.users.find(u => u.id === req.params.id);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  user.banned = !user.banned;
  saveDatabase();

  res.json({ success: true, user });
});

// POST /api/auth/login - Darkroom Session Authentication
app.post('/api/auth/login', (req, res) => {
  const { email, role } = req.body;
  let user = db.users.find(u => u.email.toLowerCase() === (email || '').toLowerCase());

  if (!user) {
    // Generate session user
    user = {
      id: "u_" + Date.now(),
      name: email ? email.split('@')[0] : "Darkroom Operator",
      email: email || "operator@lumen.lens",
      handle: `@${(email ? email.split('@')[0] : 'operator').toLowerCase()}`,
      role: role || (email && email.includes('curator') ? 'Curator' : 'Photographer'),
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80",
      photosCount: 1,
      rep: 90,
      banned: false
    };
    db.users.push(user);
    saveDatabase();
  }

  res.json({
    success: true,
    token: "lumen_jwt_" + Buffer.from(user.id).toString('base64'),
    user
  });
});

// GET /api/stats - Telemetry Dashboard Metrics
app.get('/api/stats', (req, res) => {
  const totalPhotos = db.photos.length;
  const approvedCount = db.photos.filter(p => p.status === 'approved').length;
  const pendingCount = db.photos.filter(p => p.status === 'pending').length;
  const totalCritiques = db.photos.reduce((acc, p) => acc + (p.comments ? p.comments.length : 0), 0);
  const totalLikes = db.photos.reduce((acc, p) => acc + (p.likes || 0), 0);

  res.json({
    success: true,
    stats: {
      totalUsers: db.users.length + 14815,
      archivedExposures: totalPhotos + 48280,
      pendingCount: pendingCount,
      approvedCount: approvedCount,
      totalCritiques: totalCritiques,
      totalLikes: totalLikes,
      weeklyIngest: 1240 + totalPhotos,
      cadence: [
        { day: 'MON', count: 180, pct: 45 },
        { day: 'TUE', count: 240, pct: 60 },
        { day: 'WED', count: 210, pct: 52 },
        { day: 'THU', count: 310, pct: 80 },
        { day: 'FRI', count: 390, pct: 95 },
        { day: 'SAT', count: 420, pct: 100 },
        { day: 'SUN', count: 290, pct: 72 }
      ]
    }
  });
});

// Fallback route for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`  ✦ LUMEN — Optical Arts & Cinematic Darkroom Engine ✦  `);
  console.log(`  Server running on http://localhost:${PORT}          `);
  console.log(`=======================================================`);
});
