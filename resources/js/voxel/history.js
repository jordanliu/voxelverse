export class HistoryStack {
    constructor(limit = 100) {
        this.limit = limit;
        this.undoStack = [];
        this.redoStack = [];
        this._stroke = null;
    }

    get canUndo() {
        return this.undoStack.length > 0;
    }

    get canRedo() {
        return this.redoStack.length > 0;
    }

    beginStroke(label = 'stroke') {
        this._stroke = { label, changes: [] };
    }

    recordChange(change) {
        if (this._stroke) {
            this._stroke.changes.push(change);
            return;
        }
        this.push({ label: 'edit', changes: [change] });
    }

    recordChanges(changes, label = 'edit') {
        if (!changes.length) {
            return;
        }
        if (this._stroke) {
            this._stroke.changes.push(...changes);
            return;
        }
        this.push({ label, changes: [...changes] });
    }

    endStroke() {
        if (!this._stroke) {
            return;
        }
        if (this._stroke.changes.length) {
            this.push(this._stroke);
        }
        this._stroke = null;
    }

    /** Drop in-progress stroke without committing (for cancel). */
    discardStroke() {
        this._stroke = null;
    }

    push(command) {
        this.undoStack.push(command);
        if (this.undoStack.length > this.limit) {
            this.undoStack.shift();
        }
        this.redoStack = [];
    }

    undo(scene) {
        const cmd = this.undoStack.pop();
        if (!cmd) {
            return false;
        }
        // One scene notification for the whole undo
        if (typeof scene.beginBatch === 'function') {
            scene.beginBatch();
            try {
                for (let i = cmd.changes.length - 1; i >= 0; i -= 1) {
                    const c = cmd.changes[i];
                    scene.setVoxel(c.x, c.y, c.z, c.prev, c.layerId);
                }
            } finally {
                scene.endBatch({ type: 'history', action: 'undo' });
            }
        } else {
            for (let i = cmd.changes.length - 1; i >= 0; i -= 1) {
                const c = cmd.changes[i];
                scene.setVoxel(c.x, c.y, c.z, c.prev, c.layerId);
            }
        }
        this.redoStack.push(cmd);
        return true;
    }

    redo(scene) {
        const cmd = this.redoStack.pop();
        if (!cmd) {
            return false;
        }
        if (typeof scene.beginBatch === 'function') {
            scene.beginBatch();
            try {
                for (const c of cmd.changes) {
                    scene.setVoxel(c.x, c.y, c.z, c.next, c.layerId);
                }
            } finally {
                scene.endBatch({ type: 'history', action: 'redo' });
            }
        } else {
            for (const c of cmd.changes) {
                scene.setVoxel(c.x, c.y, c.z, c.next, c.layerId);
            }
        }
        this.undoStack.push(cmd);
        return true;
    }

    clear() {
        this.undoStack = [];
        this.redoStack = [];
        this._stroke = null;
    }
}
