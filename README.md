# LUMEN

> *Where every journey is seen in a new light.*

A photography community website where photographers share pictures of tourist spots, browse by category, and compete on a weekly leaderboard. Includes separate **User** and **Admin** dashboards, styled with a cinematic "Vignette Bloom" theme: an animated Canvas2D mosaic effect, soft vignettes, and champagne-gold bloom highlights on a near-black base.

> This is a frontend-only project. All data is mocked in `js/data.js` and login is simulated with `localStorage`.

---

## Features

### Public / Shared
- Login and Sign-up with inline validation
- Role selector (User / Admin) for demo purposes
- Animated Vignette Bloom background on the login page

### User Dashboard
- "Featured Spot of the Week" hero with a hover-reveal mask
- Category chips: Landscape, Beach, Mountains, Heritage & Architecture, Wildlife, Street & Culture, Night Sky, Food & Markets, Others
- Masonry photo gallery with likes, location, photographer and category tag
- Lightbox with description, camera details and comments preview
- Upload modal with drag-and-drop, title, location, category, description and tags
- "My Uploads" tab with edit and delete
- Weekly Leaderboard: Top Photographers / Top Photos toggle, rank badges, countdown to weekly reset

### Admin Dashboard
- Overview: stat cards and uploads-per-day chart
- Photo moderation: approve, reject, delete
- User management: search, ban/unban, make admin
- Category management: add, rename, delete (updates user filters)
- Leaderboard control: view standings, reset the week, remove disqualified entries
- Reported content queue

---

## Folder Structure

```
project-root/
├── index.html              # Login / Sign-up
├── user.html               # User dashboard
├── admin.html              # Admin dashboard
├── css/
│   ├── variables.css       # Colour palette, fonts, spacing tokens
│   ├── base.css            # Reset, typography, shared components
│   ├── login.css
│   ├── user.css
│   └── admin.css
├── js/
│   ├── data.js             # Mock photos, users, categories, leaderboard
│   ├── auth.js             # Fake login/logout using localStorage
│   ├── MosaicBloom.js      # Reusable Canvas2D effect module
│   ├── user.js             # User dashboard logic
│   ├── admin.js            # Admin dashboard logic
│   └── leaderboard.js      # Ranking and weekly countdown logic
├── assets/
│   └── images/             # Local fallback images (optional)
└── README.md
```

---

## Getting Started

No build step is required.

**Option 1: Open directly**
Double-click `index.html` in a modern browser.

**Option 2: Run a local server (recommended)**
Some browsers restrict canvas pixel reading on `file://` URLs, so a local server is safer.

```bash
# Python
python -m http.server 8000

# or Node
npx serve .
```

Then open `http://localhost:8000`.

### Demo Logins

| Role  | Email               | Password   |
|-------|---------------------|------------|
| User  | user@lumen.com    | user123    |
| Admin | admin@lumen.com   | admin123   |

*(Update these to match the credentials in `data.js`.)*

---

## Theme: Vignette Bloom

### Colour Palette (Midnight and Champagne)

Defined as CSS variables in `css/variables.css`:

| Role              | Hex                  |
|-------------------|----------------------|
| Background        | `#0B0C0F`            |
| Surface / glass   | `#15171C`            |
| Borders           | `#2A2D35`            |
| Primary text      | `#F3EFE6`            |
| Muted text        | `#A09C92`            |
| Accent (champagne)| `#C9A96E`            |
| Bloom glow        | `#E8D3A2` (low alpha)|
| Rank gold         | `#C9A96E`            |
| Rank silver       | `#C0C4CC`            |
| Rank bronze       | `#B07A4F`            |

Use the accent for roughly 10% of the interface: buttons, active states, ranks, hairline borders and glows.

### Typography
- Headings: elegant serif (e.g. Playfair Display or Cormorant Garamond)
- Body: clean sans-serif (e.g. Inter)
- Labels, ranks, counters: monospace (e.g. JetBrains Mono)

### Where the Animated Effect Appears
- Login page background
- User dashboard hero
- Leaderboard thumbnails and upload preview
- Empty states and 404

The gallery shows clean, full-quality photos, and the admin dashboard is static. A maximum of 2 animated canvases run at once to keep mobile performance smooth.

---

## Using the MosaicBloom Module

```js
import { createMosaicBloom } from './js/MosaicBloom.js';

const effect = createMosaicBloom(
  document.querySelector('#hero-canvas'),
  'https://images.unsplash.com/your-photo.jpg',
  {
    renderMode: 'mosaic',
    cellSize: 16,
    brightness: 12,
    contrast: 115,
    animStyle: 'wave',
    pfx: {
      vignette: { enabled: true, intensity: 38 },
      bloom:    { enabled: true, intensity: 25 }
    }
  }
);

effect.start();
// effect.setOptions({ animStyle: 'ripple' });
// effect.stop();
// effect.destroy();
```

### Common Options

| Option          | Default  | Description                                              |
|-----------------|----------|----------------------------------------------------------|
| `cellSize`      | `16`     | Tile size in px (larger = chunkier, faster)              |
| `animStyle`     | `wave`   | `wave`, `pulse`, `shimmer`, `ripple`, `flicker`          |
| `animSpeed`     | `100`    | Animation speed                                          |
| `animIntensity` | `60`     | Strength of tile movement                                |
| `brightness`    | `12`     | Colour adjustment                                        |
| `contrast`      | `115`    | Colour adjustment                                        |
| `tint`          | accent   | Tint colour (opacity `0` by default)                     |
| `pfx.*`         | see code | Post-effects: vignette, bloom (on); scanLines, chromatic, filmGrain, glitch, pixelate, halftone, filmDust (off) |

### Performance and Accessibility
- Animation pauses when the canvas is off-screen or the tab is hidden
- `prefers-reduced-motion` renders a single static frame
- Device pixel ratio capped at 2; larger `cellSize` on small screens
- Falls back to a plain `<img>` if canvas fails

---

## Swapping Mock Data for a Real API

All data access goes through `js/data.js` and the helper functions in `auth.js`, `user.js` and `admin.js`. To connect a backend:

1. Replace the arrays in `data.js` with `fetch()` calls, for example:
   ```js
   export async function getPhotos(category) {
     const res = await fetch(`/api/photos?category=${category}`);
     return res.json();
   }
   ```
2. Replace the localStorage login in `auth.js` with a call to your auth endpoint (use secure, HTTP-only cookies or tokens).
3. Move the weekly leaderboard calculation and reset to the server (a scheduled job is ideal).
4. Replace the upload modal's local preview handling with a real file upload (e.g. to cloud storage) and save the returned URL.

### Suggested Endpoints

| Method | Endpoint                    | Purpose                    |
|--------|-----------------------------|----------------------------|
| POST   | `/api/auth/login`           | Log in                     |
| POST   | `/api/auth/signup`          | Create account             |
| GET    | `/api/photos`               | List photos (filter by category) |
| POST   | `/api/photos`               | Upload a photo             |
| POST   | `/api/photos/:id/like`      | Like / unlike              |
| GET    | `/api/leaderboard?range=week` | Weekly standings         |
| GET    | `/api/admin/stats`          | Dashboard stats            |
| PATCH  | `/api/admin/photos/:id`     | Approve / reject           |
| PATCH  | `/api/admin/users/:id`      | Ban / unban / promote      |
| CRUD   | `/api/admin/categories`     | Manage categories          |

---

## Browser Support

Latest versions of Chrome, Edge, Firefox and Safari. Requires Canvas2D, `IntersectionObserver` and `backdrop-filter` (glass panels degrade gracefully to solid surfaces where unsupported).

---

## Accessibility

- WCAG AA contrast targeted for all text, including text over glass panels
- Keyboard navigable, visible focus states
- Alt text on all images
- Reduced-motion support

---

## Credits

- Mosaic effect inspired by the "Vignette Bloom" ASCII effect on [21st.dev](https://21st.dev/community/ascii)
- Sample photos from [Unsplash](https://unsplash.com) (check each photo's licence before production use)

## License

Add your preferred licence here (e.g. MIT).
