// Editor state: the cover settings, the photo library and undo/redo history.
// Photos are kept as loaded images in a Map; the state itself is plain JSON so
// it can be snapshotted for undo without copying image bytes.
import { defaultCoverState, panelCountFor } from './cover.js';

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

export function cloneCoverState(state) {
  return JSON.parse(JSON.stringify(state));
}

/** Keeps panel crops in range when the layout changes (fewer panels, new slots). */
export function normalizePanels(state) {
  const count = panelCountFor(state.layout);
  const fallback = state.panels[0] || { photoId: 'pier', zoom: 1, dx: 0, dy: 0 };
  while (state.panels.length < count) {
    state.panels.push({ ...fallback });
  }
  state.panels.length = count;
  return state;
}

/** A bounded undo/redo stack of cover-state snapshots. */
export class CoverHistory {
  constructor(initial) {
    this.past = [];
    this.future = [];
    this.current = cloneCoverState(initial);
  }

  commit(next) {
    // Clone going in: the editor mutates the live state in place while
    // dragging, typing or zooming, and the live state may be the very
    // object this.current points at (right after load, or after a reset).
    // Pushing the reference would let those in-place edits rewrite the
    // snapshot undo is supposed to restore — undo after a drag then
    // silently did nothing. The clone keeps every snapshot frozen.
    this.past.push(cloneCoverState(this.current));
    if (this.past.length > 60) this.past.shift();
    this.future.length = 0;
    this.current = cloneCoverState(next);
  }

  undo() {
    if (!this.past.length) return null;
    this.future.push(cloneCoverState(this.current));
    this.current = this.past.pop();
    return cloneCoverState(this.current);
  }

  redo() {
    if (!this.future.length) return null;
    this.past.push(cloneCoverState(this.current));
    this.current = this.future.pop();
    return cloneCoverState(this.current);
  }

  get canUndo() {
    return this.past.length > 0;
  }

  get canRedo() {
    return this.future.length > 0;
  }
}

/** The photo library: sample photos shipped with the app plus user uploads. */
export class PhotoLibrary {
  constructor() {
    this.images = new Map();
    this.order = [];
  }

  add(id, img, label) {
    if (!this.images.has(id)) this.order.push({ id, label });
    this.images.set(id, img);
  }

  get(id) {
    return this.images.get(id) || null;
  }

  has(id) {
    return this.images.has(id);
  }

  list() {
    return this.order.slice();
  }
}

/**
 * Loads the two bundled sample photos (made with an image model, free to
 * use). Each photo loads on its own: one missing file must not stop the
 * other, and a failed load must not throw the whole page away — the editor
 * still opens with whatever photos did load, and the library shows them.
 * Returns the ids that loaded.
 */
export async function loadSamplePhotos(library) {
  const loaded = [];
  for (const [id, label] of [['pier', 'Pier sunset'], ['boulevard', 'Boulevard night']]) {
    try {
      const img = await loadImage(`samples/${id}.jpg`);
      library.add(id, img, label);
      loaded.push(id);
    } catch {
      // A sample that cannot load is simply absent from the library.
    }
  }
  return loaded;
}

export { defaultCoverState };
