# Scene format (v1)

Voxelverse scene documents are versioned JSON. They are never evaluated as code.

## Top-level fields

| Field | Type | Notes |
|-------|------|--------|
| `version` | number | Must be `1` |
| `meta` | object | `{ title?: string, camera?: object \| null }` |
| `palette` | string[] | Hex colors `#RRGGBB`, 1–256 entries |
| `materials` | string[] | Built-in material ids |
| `environment` | string | Lighting preset id |
| `activeLayerId` | string | Optional |
| `layers` | Layer[] | 1–32 layers |

## Layer

| Field | Type | Notes |
|-------|------|--------|
| `id` | string | Stable client id |
| `name` | string | Display name |
| `visible` | boolean | |
| `locked` | boolean | |
| `voxels` | object | Map of `"x,y,z"` → `{ c: paletteIndex, m: materialIndex }` |

## Limits

See `config/voxelverse.php`:

- 250,000 occupied voxels
- 32 layers
- 256 palette entries
- ~8MB encoded scene payload

## Runtime representation

Sparse maps are chunked at render time (16³) for meshing. Only visible faces are generated.
