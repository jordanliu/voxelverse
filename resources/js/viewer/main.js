import { VoxelScene } from '../voxel/scene.js';
import { StudioRenderer } from '../render/studio.js';
import { getDeviceId, getOwnership } from '../storage/drafts.js';

const root = document.getElementById('vv-viewer-page');
if (root) {
    bootViewer(root).catch(console.error);
}

async function bootViewer(root) {
    const publicId = root.dataset.publicId;
    const apiBase = root.dataset.apiBase || '/api';
    const canvas = document.getElementById('vv-viewer-canvas');

    // Ownership edit button
    const ownership = await getOwnership(publicId);
    if (ownership?.editKey) {
        const edit = document.getElementById('vv-edit-owned');
        if (edit) {
            edit.classList.remove('hidden');
            edit.href = `/editor/${publicId}#key=${ownership.editKey}`;
        }
    }

    document.getElementById('vv-share')?.addEventListener('click', async () => {
        await navigator.clipboard.writeText(window.location.href);
        const btn = document.getElementById('vv-share');
        btn.textContent = 'Copied';
        setTimeout(() => { btn.textContent = 'Copy link'; }, 1200);
    });

    // Ratings
    const starGroup = document.getElementById('vv-stars');
    const starButtons = [...document.querySelectorAll('#vv-stars [data-score]')];
    let selectedScore = 0;

    const paintStars = (score, preview = false) => {
        starButtons.forEach((btn) => {
            const value = Number(btn.dataset.score);
            btn.classList.toggle('vv-star-on', value <= score);
            btn.setAttribute('aria-pressed', String(!preview && value === selectedScore));
        });
    };

    paintStars(selectedScore);
    starButtons.forEach((btn) => {
        const previewScore = Number(btn.dataset.score);
        btn.addEventListener('pointerenter', () => paintStars(previewScore, true));
        btn.addEventListener('focus', () => paintStars(previewScore, true));
        btn.addEventListener('click', async () => {
            const score = previewScore;
            const msg = document.getElementById('vv-rating-msg');
            const previousScore = selectedScore;
            try {
                const body = {
                    score,
                    device_id: getDeviceId(),
                };
                if (ownership?.editKey) {
                    body.edit_key = ownership.editKey;
                }
                const res = await fetch(`${apiBase}/models/${publicId}/ratings`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                        'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content || '',
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                    credentials: 'same-origin',
                    body: JSON.stringify(body),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                    throw new Error(data.message || 'Rating failed');
                }
                document.getElementById('vv-rating-summary').textContent =
                    `★ ${Number(data.rating_average).toFixed(1)} average · ${data.rating_count} ratings`;
                selectedScore = score;
                paintStars(selectedScore);
                msg.textContent = 'Thanks for rating.';
                msg.classList.remove('hidden');
            } catch (err) {
                paintStars(previousScore);
                msg.textContent = err.message || 'Could not save rating.';
                msg.classList.remove('hidden');
            }
        });
    });
    starGroup?.addEventListener('pointerleave', () => paintStars(selectedScore));
    starGroup?.addEventListener('focusout', (event) => {
        if (!starGroup.contains(event.relatedTarget)) paintStars(selectedScore);
    });

    const reportDialog = document.getElementById('vv-report-dialog');
    const reportForm = document.getElementById('vv-report-form');
    const reportReason = document.getElementById('vv-report-reason');
    const reportDetails = document.getElementById('vv-report-details');
    const reportMessage = document.getElementById('vv-report-message');
    const reportSubmit = document.getElementById('vv-report-submit');
    let reportTrigger;

    const setReportMessage = (message, success = false) => {
        reportMessage.textContent = message;
        reportMessage.classList.toggle('hidden', !message);
        reportMessage.classList.toggle('is-success', success);
        reportMessage.setAttribute('role', success ? 'status' : 'alert');
    };

    const closeReportDialog = () => {
        reportDialog?.classList.remove('is-open');
        if (reportDialog) reportDialog.hidden = true;
        document.body.classList.remove('vv-modal-open');
        reportTrigger?.focus();
    };

    const openReportDialog = () => {
        reportTrigger = document.getElementById('vv-report');
        setReportMessage('');
        reportForm?.reset();
        reportSubmit.disabled = false;
        reportSubmit.textContent = 'Submit report';
        if (!reportDialog) return;
        reportDialog.hidden = false;
        reportDialog.classList.add('is-open');
        document.body.classList.add('vv-modal-open');
        reportReason?.focus();
    };

    document.getElementById('vv-report')?.addEventListener('click', openReportDialog);
    document.getElementById('vv-report-close')?.addEventListener('click', closeReportDialog);
    document.getElementById('vv-report-cancel')?.addEventListener('click', closeReportDialog);
    reportDialog?.addEventListener('click', (event) => {
        if (event.target === reportDialog) closeReportDialog();
    });
    reportDialog?.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeReportDialog();
    });
    reportForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        setReportMessage('');
        reportSubmit.disabled = true;
        reportSubmit.textContent = 'Submitting…';
        try {
            const res = await fetch(`${apiBase}/models/${publicId}/reports`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content || '',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'same-origin',
                body: JSON.stringify({
                    reason: reportReason.value,
                    details: reportDetails.value,
                    device_id: getDeviceId(),
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || 'Report failed');
            setReportMessage('Report submitted. Thank you.', true);
            reportSubmit.textContent = 'Submitted';
            setTimeout(closeReportDialog, 900);
        } catch (err) {
            setReportMessage(err.message || 'Report failed');
            reportSubmit.disabled = false;
            reportSubmit.textContent = 'Submit report';
        }
    });

    // View count (fire and forget)
    fetch(`${apiBase}/models/${publicId}/views`, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content || '',
            'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'same-origin',
    }).catch(() => {});

    // Interactive 3D viewer - orbit / zoom / pan
    let renderer;
    try {
        renderer = new StudioRenderer(canvas, { mode: 'viewer' });
        renderer.setGridVisible(false);
        // Full interaction (constructor already enables left-drag rotate for viewer mode)
        renderer.controls.enabled = true;
        renderer.controls.enableRotate = true;
        renderer.controls.enableZoom = true;
        renderer.controls.enablePan = true;
        renderer.controls.enableDamping = true;
        renderer.controls.dampingFactor = 0.07;
        renderer.controls.rotateSpeed = 0.78;
        renderer.controls.zoomSpeed = 1.0;
        renderer.controls.panSpeed = 0.78;
        renderer.controls.zoomToCursor = true;
        renderer.controls.minPolarAngle = Math.PI * 0.08;
        renderer.controls.maxPolarAngle = Math.PI * 0.92;
        renderer.controls.autoRotate = false;
        renderer.controls.autoRotateSpeed = 1.2;
        renderer.setNavigateMode(true);
        canvas.style.touchAction = 'none';
        canvas.style.cursor = 'grab';
        canvas.addEventListener('pointerdown', () => {
            canvas.style.cursor = 'grabbing';
            // Stop auto-spin once the user takes control
            if (renderer.controls.autoRotate) {
                renderer.controls.autoRotate = false;
                const btn = document.getElementById('vv-auto-rotate');
                if (btn) {
                    btn.classList.remove('is-on');
                    btn.setAttribute('aria-pressed', 'false');
                }
            }
        });
        canvas.addEventListener('pointerup', () => {
            canvas.style.cursor = 'grab';
        });
        canvas.addEventListener('pointerleave', () => {
            canvas.style.cursor = 'grab';
        });
    } catch (e) {
        console.error(e);
        document.getElementById('vv-viewer-fallback')?.classList.remove('hidden');
        return;
    }

    // Viewer chrome controls
    document.getElementById('vv-viewer-reset')?.addEventListener('click', () => {
        if (renderer._lastScene) {
            renderer.frameModel(renderer._lastScene, 1.55);
        }
    });
    document.getElementById('vv-auto-rotate')?.addEventListener('click', (e) => {
        const next = !renderer.controls.autoRotate;
        renderer.controls.autoRotate = next;
        e.currentTarget.classList.toggle('is-on', next);
        e.currentTarget.setAttribute('aria-pressed', next ? 'true' : 'false');
    });

    try {
        const res = await fetch(`${apiBase}/models/${publicId}/scene`);
        if (!res.ok) throw new Error('Failed to load scene');
        const data = await res.json();
        const scene = VoxelScene.deserialize(data.scene);
        renderer.setEnvironment(scene.environment || 'soft-studio');
        if (scene.meta?.studio) {
            renderer.applyStudioAppearance(scene.meta.studio);
        }
        renderer.setGridVisible(false);
        renderer.rebuild(scene);
        renderer.frameModel(scene, 1.55);
        renderer._lastScene = scene;
        // Ensure controls still fully interactive after appearance apply
        renderer.setNavigateMode(true);
        renderer.controls.enabled = true;
        document.getElementById('vv-thumb-fallback')?.remove();
        document.getElementById('vv-viewer-hint')?.classList.remove('opacity-0');
    } catch (e) {
        console.error(e);
        document.getElementById('vv-viewer-fallback')?.classList.remove('hidden');
    }
}
