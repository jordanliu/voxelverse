# Voxelverse

Online voxel editor and public gallery. Make something blocky, make it yours, and share original voxel creations without an account.

Voxelverse is local-first: drafts stay in the browser until you choose to publish. Published models get a public URL and a private edit link.

## Stack

- Laravel 13 + Blade + Vite + Tailwind 4
- Vanilla ES modules + Three.js (editor / viewer)
- SQLite locally, Neon Postgres and S3-compatible Object Storage in production
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

## Deployment

Use Postgres for the database and S3-compatible object storage for thumbnails
and scene JSON. Set the following environment variables:

```dotenv
DB_CONNECTION=pgsql
DB_URL=postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require

FILESYSTEM_DISK=s3
PUBLIC_FILESYSTEM_DISK=s3
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_BUCKET=your-bucket
AWS_ENDPOINT=https://your-s3-endpoint
AWS_URL=https://your-public-bucket-url
```

Run migrations after the database is configured:

```bash
php artisan migrate --force
```

Existing SQLite data must be exported and imported separately.

## Scripts

| Command | Purpose |
|---------|---------|
| `composer test` | PHPUnit |
| `php artisan test` | Laravel feature and unit tests |
| `npm test` | Voxel engine unit tests |
| `npm run build` | Production assets |
| `composer dev` | Serve + queue + vite |

## Docs

- [Scene format](docs/scene-format.md)
- [Anonymous ownership](docs/ownership.md)


