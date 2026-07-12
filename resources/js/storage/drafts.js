const memory = {
    drafts: new Map(),
    meta: new Map(),
    ownership: new Map(),
};

const DB_NAME = 'voxelverse';
const DB_VERSION = 2;
const DRAFTS_STORE = 'drafts';
const META_STORE = 'meta';
const OWNERSHIP_STORE = 'ownership';
const LS_PREFIX = 'vv:';

export function createLocalId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return `draft-${crypto.randomUUID()}`;
    }
    return `draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function ensureStores(db) {
    if (!db.objectStoreNames.contains(DRAFTS_STORE)) {
        db.createObjectStore(DRAFTS_STORE, { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'key' });
    }
    if (!db.objectStoreNames.contains(OWNERSHIP_STORE)) {
        db.createObjectStore(OWNERSHIP_STORE, { keyPath: 'publicId' });
    }
}

function openDb() {
    return new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') {
            reject(new Error('IndexedDB unavailable'));
            return;
        }
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            ensureStores(req.result);
        };
        req.onsuccess = () => {
            const db = req.result;
            // Recover if stores are still missing (corrupt / partial DBs)
            const missing = [DRAFTS_STORE, META_STORE, OWNERSHIP_STORE]
                .some((name) => !db.objectStoreNames.contains(name));
            if (missing) {
                db.close();
                const del = indexedDB.deleteDatabase(DB_NAME);
                del.onsuccess = () => {
                    const retry = indexedDB.open(DB_NAME, DB_VERSION);
                    retry.onupgradeneeded = () => ensureStores(retry.result);
                    retry.onsuccess = () => resolve(retry.result);
                    retry.onerror = () => reject(retry.error || new Error('IndexedDB reopen failed'));
                };
                del.onerror = () => reject(del.error || new Error('IndexedDB delete failed'));
                return;
            }
            resolve(db);
        };
        req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
    });
}

function txDone(tx) {
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    });
}

function lsGet(key, fallback = null) {
    try {
        const raw = localStorage.getItem(LS_PREFIX + key);
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
}

function lsSet(key, value) {
    try {
        localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
    } catch {
        // ignore quota
    }
}

async function withStore(storeName, mode, fn) {
    try {
        const db = await openDb();
        return await new Promise((resolve, reject) => {
            let tx;
            try {
                tx = db.transaction(storeName, mode);
            } catch (err) {
                reject(err);
                return;
            }
            const store = tx.objectStore(storeName);
            Promise.resolve(fn(store, tx)).then(resolve, reject);
            tx.onerror = () => reject(tx.error);
        });
    } catch (err) {
        throw err;
    }
}

export async function listDrafts() {
    try {
        return await withStore(DRAFTS_STORE, 'readonly', (store) => new Promise((resolve, reject) => {
            const req = store.getAll();
            req.onsuccess = () => {
                const items = (req.result || []).map((d) => ({
                    id: d.id,
                    title: d.title,
                    updatedAt: d.updatedAt,
                    createdAt: d.createdAt,
                    voxelCount: d.voxelCount || 0,
                }));
                items.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
                resolve(items);
            };
            req.onerror = () => reject(req.error);
        }));
    } catch {
        const fromLs = lsGet('drafts', {});
        return Object.values(fromLs)
            .map((d) => ({
                id: d.id,
                title: d.title,
                updatedAt: d.updatedAt,
                createdAt: d.createdAt,
                voxelCount: d.voxelCount || 0,
            }))
            .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    }
}

export async function getDraft(id) {
    try {
        return await withStore(DRAFTS_STORE, 'readonly', (store) => new Promise((resolve, reject) => {
            const req = store.get(id);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        }));
    } catch {
        if (memory.drafts.has(id)) {
            return memory.drafts.get(id);
        }
        const fromLs = lsGet('drafts', {});
        return fromLs[id] || null;
    }
}

export async function saveDraft(draft) {
    const record = {
        ...draft,
        updatedAt: Date.now(),
        createdAt: draft.createdAt || Date.now(),
    };
    memory.drafts.set(record.id, record);
    try {
        await withStore(DRAFTS_STORE, 'readwrite', (store, tx) => {
            store.put(record);
            return txDone(tx);
        });
    } catch {
        const all = lsGet('drafts', {});
        all[record.id] = record;
        lsSet('drafts', all);
    }
    return record;
}

export async function deleteDraft(id) {
    memory.drafts.delete(id);
    try {
        await withStore(DRAFTS_STORE, 'readwrite', (store, tx) => {
            store.delete(id);
            return txDone(tx);
        });
    } catch {
        const all = lsGet('drafts', {});
        delete all[id];
        lsSet('drafts', all);
    }
}

export async function duplicateDraft(id) {
    const src = await getDraft(id);
    if (!src) {
        return null;
    }
    const copy = {
        ...src,
        id: createLocalId(),
        title: `${src.title || 'Untitled'} copy`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };
    return saveDraft(copy);
}

export async function getActiveDraftId() {
    try {
        return await withStore(META_STORE, 'readonly', (store) => new Promise((resolve, reject) => {
            const req = store.get('activeDraftId');
            req.onsuccess = () => resolve(req.result?.value || null);
            req.onerror = () => reject(req.error);
        }));
    } catch {
        return memory.meta.get('activeDraftId') || lsGet('activeDraftId', null);
    }
}

export async function setActiveDraftId(id) {
    memory.meta.set('activeDraftId', id);
    try {
        await withStore(META_STORE, 'readwrite', (store, tx) => {
            store.put({ key: 'activeDraftId', value: id });
            return txDone(tx);
        });
    } catch {
        lsSet('activeDraftId', id);
    }
}

export async function saveOwnership(entry) {
    const record = {
        publicId: entry.publicId,
        editKey: entry.editKey,
        title: entry.title,
        savedAt: Date.now(),
    };
    memory.ownership.set(record.publicId, record);
    try {
        await withStore(OWNERSHIP_STORE, 'readwrite', (store, tx) => {
            store.put(record);
            return txDone(tx);
        });
    } catch {
        const all = lsGet('ownership', {});
        all[record.publicId] = record;
        lsSet('ownership', all);
    }
}

export async function getOwnership(publicId) {
    try {
        return await withStore(OWNERSHIP_STORE, 'readonly', (store) => new Promise((resolve, reject) => {
            const req = store.get(publicId);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        }));
    } catch {
        if (memory.ownership.has(publicId)) {
            return memory.ownership.get(publicId);
        }
        const all = lsGet('ownership', {});
        return all[publicId] || null;
    }
}

export async function listOwnership() {
    try {
        return await withStore(OWNERSHIP_STORE, 'readonly', (store) => new Promise((resolve, reject) => {
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        }));
    } catch {
        return Object.values(lsGet('ownership', {}));
    }
}

export async function removeOwnership(publicId) {
    memory.ownership.delete(publicId);
    try {
        await withStore(OWNERSHIP_STORE, 'readwrite', (store, tx) => {
            store.delete(publicId);
            return txDone(tx);
        });
    } catch {
        const all = lsGet('ownership', {});
        delete all[publicId];
        lsSet('ownership', all);
    }
}

const DEVICE_KEY = 'voxelverse_device_id';

export function getDeviceId() {
    try {
        let id = localStorage.getItem(DEVICE_KEY);
        if (!id) {
            id = createLocalId().replace(/^draft-/, 'dev-');
            localStorage.setItem(DEVICE_KEY, id);
        }
        return id;
    } catch {
        return createLocalId().replace(/^draft-/, 'dev-');
    }
}

export function createDraftAutosave({ getPayload, intervalMs = 800, onStatus }) {
    let timer = null;
    let pending = false;
    let saving = false;

    const flush = async () => {
        if (saving) {
            pending = true;
            return;
        }
        saving = true;
        onStatus?.('saving');
        try {
            const payload = await getPayload();
            if (payload) {
                await saveDraft(payload);
            }
            onStatus?.('saved');
        } catch (err) {
            console.error(err);
            onStatus?.('error', err);
        } finally {
            saving = false;
            if (pending) {
                pending = false;
                schedule();
            }
        }
    };

    const schedule = () => {
        clearTimeout(timer);
        timer = setTimeout(flush, intervalMs);
        onStatus?.('pending');
    };

    return {
        touch: schedule,
        flush,
        destroy() {
            clearTimeout(timer);
        },
    };
}
