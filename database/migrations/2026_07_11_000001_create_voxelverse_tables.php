<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('publications', function (Blueprint $table) {
            $table->id();
            $table->uuid('public_id')->unique();
            $table->string('title', 80);
            $table->string('description', 500)->nullable();
            $table->string('display_name', 40)->nullable();
            $table->json('tags')->nullable();
            $table->string('visibility', 16)->default('public')->index();
            $table->boolean('allow_remix')->default(true);
            $table->string('edit_key_hash');
            $table->string('scene_path');
            $table->string('thumbnail_path')->nullable();
            $table->unsignedInteger('width')->default(0);
            $table->unsignedInteger('height')->default(0);
            $table->unsignedInteger('depth')->default(0);
            $table->unsignedInteger('voxel_count')->default(0);
            $table->unsignedSmallInteger('palette_count')->default(0);
            $table->unsignedSmallInteger('material_count')->default(0);
            $table->uuid('source_public_id')->nullable()->index();
            $table->unsignedBigInteger('view_count')->default(0);
            $table->unsignedInteger('rating_sum')->default(0);
            $table->unsignedInteger('rating_count')->default(0);
            $table->decimal('rating_score', 8, 4)->default(0)->index();
            $table->unsignedInteger('recent_views')->default(0);
            $table->unsignedInteger('recent_ratings')->default(0);
            $table->decimal('trending_score', 12, 4)->default(0)->index();
            $table->timestamps();

            $table->index(['visibility', 'created_at']);
            $table->index(['visibility', 'rating_score']);
            $table->index(['visibility', 'trending_score']);
        });

        Schema::create('ratings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('publication_id')->constrained()->cascadeOnDelete();
            $table->string('voter_hash', 64);
            $table->unsignedTinyInteger('score');
            $table->timestamps();

            $table->unique(['publication_id', 'voter_hash']);
        });

        Schema::create('reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('publication_id')->constrained()->cascadeOnDelete();
            $table->string('reason', 32);
            $table->string('details', 500)->nullable();
            $table->string('reporter_hash', 64);
            $table->string('status', 16)->default('open')->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reports');
        Schema::dropIfExists('ratings');
        Schema::dropIfExists('publications');
    }
};
