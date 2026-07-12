# Voxelverse

Online voxel editor and public gallery. Make something blocky, make it yours, and share original voxel creations without an account.

Voxelverse is local-first: drafts stay in the browser until you choose to publish. Published models get a public URL and a private edit link.

## Stack

- Laravel 13 + Blade + Vite + Tailwind 4
- Vanilla ES modules + Three.js (editor / viewer)
- SQLite by default, local filesystem storage
- PHPUnit + Vitest

## Editor features

- Add, erase, paint, line, box fill, box erase, eyedropper, and flood fill tools
- Brush sizing and X, Y, Z mirror symmetry
- Palette editing with hex and native color controls
- Clay, wood, stone, metal, glass, rubber, neon, ceramic, fabric, ice, and gold materials
- Studio lighting presets with optional advanced controls
- Background, ground, grid, camera, projection, and layer controls
- Draft autosave in IndexedDB
- PNG and OBJ export
- Responsive desktop inspector and mobile Vaul-style settings drawer

## Setup

```bash
composer setup
php artisan storage:link
```

`composer setup` installs PHP and frontend dependencies, creates the environment file, generates the application key, runs migrations, and builds production assets.

For a manual setup:

```bash
composer install
cp .env.example .env
php artisan key:generate
touch database/database.sqlite
php artisan migrate
php artisan storage:link
npm install
npm run build
```

Dev:

```bash
composer dev
# or: php artisan serve + npm run dev
```

## Scripts

| Command | Purpose |
|---------|---------|
| `composer test` | PHPUnit |
| `php artisan test` | Laravel feature and unit tests |
| `npm test` | Voxel engine unit tests |
| `npm run build` | Production assets |
| `composer dev` | Serve + queue + vite |

## Routes

| Path | Description |
|------|-------------|
| `/` | Editor (create) |
| `/gallery` | Gallery (Trending / Newest / Top rated) |
| `/editor` | Create / edit draft |
| `/editor/{publicId}` | Edit published model (needs private key) |
| `/m/{publicId}` | Public model page |
| `/privacy` | Privacy notice |
| `/moderation?token=…` | Internal report queue (`VOXELVERSE_MODERATION_TOKEN`) |
| `/api/models` | Publish / list / update / rate / report |

## Docs

- [Scene format](docs/scene-format.md)
- [Anonymous ownership](docs/ownership.md)

## Product notes

- No signup required
- Drafts autosave in IndexedDB
- Publish uses a centered desktop modal and a mobile bottom drawer
- Publish returns a public URL and a private edit key, shown once with a recovery download
- Unlisted models are URL-accessible but excluded from the gallery
- Ratings use a hashed device identity; Bayesian score powers Top rated
- Original assets only. No third-party model or image assets are bundled into the product.
