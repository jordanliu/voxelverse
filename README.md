# Voxelverse

Online voxel editor and public gallery. Make something blocky, make it yours, and share original voxel creations without an account.

Voxelverse is local-first: drafts stay in the browser until you choose to publish. Published models get a public URL and a private edit link.

<video src="https://github.com/user-attachments/assets/cdf08914-6163-47a8-9e57-a7eea2711bad" controls width="100%" style="max-width:720px;border-radius:12px;margin-top:1rem" title="Voxelverse demo"></video>

## Stack

- Laravel 13 + Blade + Vite + Tailwind 4
- Vanilla ES modules + Three.js (editor / viewer)
- Postgres and S3-compatible Object Storage
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

## Setup

```bash
composer setup
php artisan storage:link
```

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

## Deployment

[Laravel Cloud](https://laravel.com/cloud) is the recommended deployment
strategy for Voxelverse. It provides managed Laravel application hosting and a
straightforward path to connect the production services the app needs.

Use Laravel Cloud’s managed bucket for thumbnails and scene JSON, and configure
Postgres with the following environment variables:

```dotenv
APP_KEY=base64:your-production-app-key
DB_CONNECTION=pgsql
DB_SSLMODE=require
DB_URL=postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require&channel_binding=require
```

Run migrations after the database is configured:

```bash
php artisan migrate --force
```

## Docs

- [Scene Format](docs/scene-format.md)
- [Anonymous Ownership](docs/ownership.md)
