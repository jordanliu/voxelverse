/**
 * Vaul-inspired bottom drawer for vanilla JS.
 * Drag-to-dismiss, spring-ish motion, focus trap, body scroll lock.
 */

function prefersReducedMotion() {
    return typeof matchMedia === 'function'
        && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function getFocusable(root) {
    return [...root.querySelectorAll(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )].filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null);
}

/**
 * @param {HTMLElement} root - Element with .vv-drawer structure (scrim + sheet)
 * @param {object} options
 */
export function createDrawer(root, options = {}) {
    if (!root) {
        throw new Error('createDrawer requires a root element');
    }

    const {
        dismissible = true,
        modal = true,
        onOpenChange = null,
        closeOnScrim = true,
        /** When true, never apply [hidden] - used for desktop-persistent panels */
        persistent = false,
        startOpen = false,
    } = options;

    const sheet = root.querySelector('[data-drawer-sheet]') || root.querySelector('.vv-drawer-sheet');
    const handle = root.querySelector('[data-drawer-handle]') || root.querySelector('.vv-drawer-handle');
    let open = false;
    let lastFocus = null;
    let drag = null;

    function setOpen(next) {
        const value = !!next;
        if (open === value) return;
        open = value;

        if (open) {
            lastFocus = document.activeElement;
            root.hidden = false;
            root.removeAttribute('hidden');
            root.classList.add('is-open');
            root.setAttribute('aria-hidden', 'false');
            if (modal && !persistent) {
                document.documentElement.classList.add('vv-drawer-open');
            }
            // focus first focusable after paint (skip for persistent desktop panel)
            if (!persistent) {
                requestAnimationFrame(() => {
                    const focusables = getFocusable(sheet || root);
                    (focusables[0] || sheet || root).focus?.({ preventScroll: true });
                });
            }
        } else {
            root.classList.remove('is-open');
            root.setAttribute('aria-hidden', 'true');
            if (sheet) {
                sheet.style.transform = '';
                sheet.style.transition = '';
            }
            if (!persistent) {
                const delay = prefersReducedMotion() ? 0 : 280;
                setTimeout(() => {
                    if (!open) {
                        root.hidden = true;
                        root.setAttribute('hidden', '');
                    }
                }, delay);
            }
            if (modal && !document.querySelector('.vv-drawer.is-open')) {
                document.documentElement.classList.remove('vv-drawer-open');
            }
            if (lastFocus && typeof lastFocus.focus === 'function' && !persistent) {
                lastFocus.focus({ preventScroll: true });
            }
        }

        onOpenChange?.(open);
    }

    function onKeyDown(e) {
        if (!open) return;
        if (e.key === 'Escape' && dismissible) {
            e.preventDefault();
            setOpen(false);
            return;
        }
        if (e.key !== 'Tab' || !sheet) return;
        const focusables = getFocusable(sheet);
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    }

    // Drag to dismiss
    function onPointerDown(e) {
        if (!open || !dismissible || !sheet) return;
        // Only start drag from handle or sheet top area / direct sheet press (not inputs)
        const target = e.target;
        if (target.closest('input, textarea, select, button, a, [data-no-drag]')) return;
        const fromHandle = handle && (handle === target || handle.contains(target));
        const fromSheetTop = sheet.contains(target);
        if (!fromHandle && !fromSheetTop) return;

        drag = {
            id: e.pointerId,
            startY: e.clientY,
            lastY: e.clientY,
            lastT: performance.now(),
            vy: 0,
        };
        try { sheet.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
        sheet.style.transition = 'none';
    }

    function onPointerMove(e) {
        if (!drag || e.pointerId !== drag.id || !sheet) return;
        const dy = Math.max(0, e.clientY - drag.startY);
        const now = performance.now();
        const dt = Math.max(1, now - drag.lastT);
        drag.vy = (e.clientY - drag.lastY) / dt;
        drag.lastY = e.clientY;
        drag.lastT = now;
        sheet.style.transform = `translate3d(0, ${dy}px, 0)`;
        const progress = Math.min(1, dy / 280);
        root.style.setProperty('--vv-drawer-scrim-opacity', String(1 - progress * 0.65));
    }

    function onPointerUp(e) {
        if (!drag || e.pointerId !== drag.id || !sheet) return;
        const dy = Math.max(0, e.clientY - drag.startY);
        const shouldClose = dismissible && (dy > 120 || drag.vy > 0.55);
        drag = null;
        root.style.removeProperty('--vv-drawer-scrim-opacity');
        sheet.style.transition = '';
        if (shouldClose) {
            setOpen(false);
        } else {
            sheet.style.transform = '';
        }
        try { sheet.releasePointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    }

    function onScrimClick(e) {
        if (!closeOnScrim || !dismissible) return;
        if (e.target === root || e.target.hasAttribute('data-drawer-scrim')) {
            setOpen(false);
        }
    }

    root.addEventListener('click', onScrimClick);
    document.addEventListener('keydown', onKeyDown);
    if (sheet) {
        sheet.addEventListener('pointerdown', onPointerDown);
        sheet.addEventListener('pointermove', onPointerMove);
        sheet.addEventListener('pointerup', onPointerUp);
        sheet.addEventListener('pointercancel', onPointerUp);
    }

    // Initial state
    if (startOpen || persistent) {
        open = false; // force setOpen to run
        setOpen(true);
        if (persistent) {
            root.hidden = false;
            root.removeAttribute('hidden');
            root.classList.add('is-open');
        }
    } else {
        root.hidden = true;
        root.setAttribute('hidden', '');
        root.setAttribute('aria-hidden', 'true');
        root.classList.remove('is-open');
    }

    return {
        open: () => setOpen(true),
        close: () => {
            // Persistent panels stay visible on desktop; caller can still force
            if (persistent && typeof matchMedia === 'function'
                && matchMedia('(min-width: 900px)').matches) {
                return;
            }
            setOpen(false);
        },
        toggle: () => setOpen(!open),
        isOpen: () => open,
        setPersistent(value) {
            // allow runtime switch between mobile drawer / desktop panel
        },
        destroy() {
            document.removeEventListener('keydown', onKeyDown);
            root.removeEventListener('click', onScrimClick);
            if (sheet) {
                sheet.removeEventListener('pointerdown', onPointerDown);
                sheet.removeEventListener('pointermove', onPointerMove);
                sheet.removeEventListener('pointerup', onPointerUp);
                sheet.removeEventListener('pointercancel', onPointerUp);
            }
            if (open && !persistent) setOpen(false);
        },
    };
}
