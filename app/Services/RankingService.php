<?php

namespace App\Services;

use App\Models\Publication;

class RankingService
{
    public function bayesianScore(int $ratingSum, int $ratingCount): float
    {
        $m = (float) config('voxelverse.bayesian.prior_mean', 3.5);
        $c = (float) config('voxelverse.bayesian.prior_weight', 5);

        if ($ratingCount === 0) {
            return 0.0;
        }

        $average = $ratingSum / $ratingCount;

        return (($c * $m) + ($ratingCount * $average)) / ($c + $ratingCount);
    }

    public function trendingScore(Publication $publication): float
    {
        $ageHours = max(1, $publication->created_at?->diffInHours(now()) ?: 1);
        $views = $publication->recent_views + ($publication->view_count * 0.05);
        $ratings = $publication->recent_ratings + ($publication->rating_count * 0.2);
        $quality = $publication->rating_score ?: 0;

        $raw = ($views * 1.0) + ($ratings * 8.0) + ($quality * 4.0);

        return $raw / pow($ageHours + 2, 1.15);
    }

    public function refresh(Publication $publication): void
    {
        $publication->rating_score = $this->bayesianScore(
            (int) $publication->rating_sum,
            (int) $publication->rating_count,
        );
        $publication->trending_score = $this->trendingScore($publication);
        $publication->save();
    }
}
