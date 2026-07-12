<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StorePublicationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $limits = config('voxelverse.limits');

        return [
            'title' => ['required', 'string', 'max:'.$limits['title']],
            'description' => ['nullable', 'string', 'max:'.$limits['description']],
            'display_name' => ['nullable', 'string', 'max:'.$limits['display_name']],
            'tags' => ['nullable', 'array', 'max:'.$limits['tags']],
            'tags.*' => ['string', 'max:'.$limits['tag_length']],
            'visibility' => ['required', Rule::in(['public', 'unlisted'])],
            'allow_remix' => ['sometimes', 'boolean'],
            'scene' => ['required', 'array'],
            'thumbnail' => ['nullable', 'string'],
            'voxel_count' => ['nullable', 'integer', 'min:0'],
            'dimensions' => ['nullable', 'array'],
            'dimensions.x' => ['nullable', 'integer', 'min:0'],
            'dimensions.y' => ['nullable', 'integer', 'min:0'],
            'dimensions.z' => ['nullable', 'integer', 'min:0'],
            'palette_count' => ['nullable', 'integer', 'min:0'],
            'material_count' => ['nullable', 'integer', 'min:0'],
            'source_public_id' => ['nullable', 'uuid'],
            'device_id' => ['nullable', 'string', 'max:64'],
            'edit_key' => ['nullable', 'string', 'max:128'],
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('tags') && is_string($this->input('tags'))) {
            $tags = collect(explode(',', $this->input('tags')))
                ->map(fn ($t) => trim($t))
                ->filter()
                ->take(5)
                ->values()
                ->all();
            $this->merge(['tags' => $tags]);
        }

        if ($this->has('allow_remix')) {
            $this->merge([
                'allow_remix' => filter_var($this->input('allow_remix'), FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) ?? true,
            ]);
        }
    }
}
