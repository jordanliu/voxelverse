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

## Production database and storage

SQLite is suitable for local development but should not be used for production
because the application filesystem is ephemeral. Use Postgres for the database
and S3-compatible object storage for thumbnails and scene JSON. Neon works as
the Postgres provider; Laravel Cloud can also provide a managed Postgres
database if preferred.

### Neon Postgres

Add these variables to the deployed environment. Do not commit a real Neon
password to `.env`, the repository, or the README:

```dotenv
DB_CONNECTION=pgsql
DB_URL=postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require&channel_binding=require
DB_SSLMODE=require
```

The connection string can be entered as a single `DB_URL` value. Alternatively,
use separate `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, and
`DB_PASSWORD` values. Keep `DB_CONNECTION=pgsql` in both cases. The pgsql
configuration enables emulated prepares for Neon pooled connections, which
avoids transaction issues with Laravel's database cache and rate limiter.

For Laravel Cloud, add the variables in the environment's Variables section.
If you attach a Laravel-managed Postgres database instead, Cloud can inject the
individual `DB_*` values; still set `DB_CONNECTION=pgsql` and
`DB_SSLMODE=require` when needed.

Set the deploy command to:

```bash
php artisan migrate --force
```

Run it after the database variables are available. This creates the schema in
a fresh Neon database and safely applies any later migrations.

### Object storage

For published thumbnails and scene JSON, attach a Laravel Cloud Object Storage
bucket or use another S3-compatible provider. Configure the deployed
environment with the provider's values:

```dotenv
FILESYSTEM_DISK=s3
PUBLIC_FILESYSTEM_DISK=s3
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_DEFAULT_REGION=us-east-1
AWS_BUCKET=your-bucket
AWS_ENDPOINT=https://your-s3-endpoint
AWS_URL=https://your-public-bucket-url
AWS_USE_PATH_STYLE_ENDPOINT=false
```

The `league/flysystem-aws-s3-v3` package is included in `composer.json`, which
is required when a Laravel Cloud bucket is attached. The bucket must allow the
published thumbnail URLs to be read publicly, or `AWS_URL` should point to a
public CDN/bucket URL.

The migrations use Laravel's schema builder and are compatible with PostgreSQL.
Run them on staging first if the production database already contains data.
Existing SQLite data must be exported and imported separately; migrations only
create the schema.

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
- Drafts autosave in IndexedDB with a localStorage fallback
- `/editor` resumes the active unpublished draft; use `/editor?new=1` or the
  editor's **Start new** action to begin a fresh model
- Publishing clears only the active-draft pointer; existing drafts and private
  edit links remain recoverable
- Publish uses a centered desktop modal and a mobile bottom drawer
- Publish returns a public URL and a private edit key, shown once with a recovery download
- Unlisted models are URL-accessible but excluded from the gallery
- Ratings use a hashed device identity; Bayesian score powers Top rated
- Original assets only. No third-party model or image assets are bundled into the product.
