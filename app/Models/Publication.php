<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Publication extends Model
{
    protected $fillable = [
        'public_id',
        'title',
        'description',
        'display_name',
        'tags',
        'visibility',
        'allow_remix',
        'edit_key_hash',
        'scene_path',
        'thumbnail_path',
        'width',
        'height',
        'depth',
        'voxel_count',
        'palette_count',
        'material_count',
        'source_public_id',
        'view_count',
        'rating_sum',
        'rating_count',
        'rating_score',
        'recent_views',
        'recent_ratings',
        'trending_score',
    ];

    protected function casts(): array
    {
        return [
            'tags' => 'array',
            'allow_remix' => 'boolean',
            'rating_score' => 'float',
            'trending_score' => 'float',
        ];
    }

    protected $hidden = [
        'edit_key_hash',
        'scene_path',
        'id',
    ];

    public function ratings(): HasMany
    {
        return $this->hasMany(Rating::class);
    }

    public function reports(): HasMany
    {
        return $this->hasMany(Report::class);
    }

    public function averageRating(): ?float
    {
        if ($this->rating_count === 0) {
            return null;
        }

        return round($this->rating_sum / $this->rating_count, 2);
    }

    public function thumbnailUrl(): ?string
    {
        if (! $this->thumbnail_path) {
            return null;
        }

        return asset('storage/'.$this->thumbnail_path);
    }

    public function publicUrl(): string
    {
        return url('/m/'.$this->public_id);
    }

    public function scopeListed($query)
    {
        return $query->where('visibility', 'public');
    }

    public function toGalleryArray(): array
    {
        return [
            'public_id' => $this->public_id,
            'title' => $this->title,
            'display_name' => $this->display_name,
            'tags' => $this->tags ?? [],
            'thumbnail_url' => $this->thumbnailUrl(),
            'voxel_count' => $this->voxel_count,
            'rating_average' => $this->averageRating(),
            'rating_count' => $this->rating_count,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }

    public function toPublicArray(): array
    {
        return [
            ...$this->toGalleryArray(),
            'description' => $this->description,
            'visibility' => $this->visibility,
            'allow_remix' => $this->allow_remix,
            'dimensions' => [
                'x' => $this->width,
                'y' => $this->height,
                'z' => $this->depth,
            ],
            'palette_count' => $this->palette_count,
            'material_count' => $this->material_count,
            'source_public_id' => $this->source_public_id,
            'view_count' => $this->view_count,
            'public_url' => $this->publicUrl(),
        ];
    }
}
