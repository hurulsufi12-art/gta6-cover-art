// Golden Hour Cover Studio — studio.js
// The studio model: the cover state, the photo tray, and undo / redo.
// The state is plain JSON, so every edit is a snapshot push and every undo
// step is a snapshot restore. Photos live outside the state (they are
// images, not JSON) and are referenced by tray index.

import { LAYOUTS, panelsForLayout } from './render.js';

export const SAMPLE_PHOTOS = [
  { name: 'boulevard', label: 'Boulevard', src: 'samples/boulevard.jpg' },
  { name: 'pier', label: 'Pier', src: 'samples/pier.jpg' },
];

export function defaultState() {
  return {
    layout: 'magazine',
    grade: 'gold',
    title: 'GOLDEN HOUR',
    subtitle: 'Vice City nights, your story',
    place: 'Leonida • 2026',
    titleStyle: 'solid',
    size: 'square',
    stickers: { stars: true, est: true, pin: true },
    panels: {},
  };
}

// Fill in panel placements for the state's layout: every panel gets the
// first photo by default, keeping any placement the panel already had.
export function ensurePanels(state, photoCount) {
  const { panels } = panelsForLayout(state.layout, 100, 100);
  const next = {};
  for (const panel of panels) {
    const old = state.panels[panel.id];
    next[panel.id] = old ?? { photo: photoCount > 0 ? 0 : null, ox: 0, oy: 0, zoom: 1 };
  }
  state.panels = next;
  return state;
}

export function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}

export function createStudio(onChange) {
  const studio = {
    state: ensurePanels(defaultState(), 0),
    photos: [],
    selectedPhoto: 0,
    history: [],
    historyIndex: -1,
    onChange: onChange ?? (() => {}),
  };

  function commit() {
    // A new edit drops whatever redo steps were waiting.
    studio.history = studio.history.slice(0, studio.historyIndex + 1);
    studio.history.push(JSON.stringify(studio.state));
    if (studio.history.length > 80) studio.history.shift();
    studio.historyIndex = studio.history.length - 1;
    studio.onChange();
  }

  function restore(snapshot) {
    studio.state = ensurePanels(JSON.parse(snapshot), studio.photos.length);
    studio.onChange();
  }

  studio.commit = commit;

  studio.loadPhoto = (src, name) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        studio.photos.push({ name, img, src });
        if (studio.photos.length === 1) studio.selectedPhoto = 0;
        resolve(studio.photos[studio.photos.length - 1]);
      };
      img.onerror = () => reject(new Error(`could not load photo ${name}`));
      img.src = src;
    });

  studio.loadSamples = async () => {
    for (const sample of SAMPLE_PHOTOS) {
      if (!studio.photos.some((p) => p.name === sample.name)) {
        await studio.loadPhoto(sample.src, sample.name);
      }
    }
    ensurePanels(studio.state, studio.photos.length);
    // The first sample fills every panel, so the cover is alive at once.
    studio.fillAll(0, false);
    commit();
  };

  studio.addUpload = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const photo = await studio.loadPhoto(String(reader.result), file.name);
          studio.selectedPhoto = studio.photos.length - 1;
          commit();
          resolve(photo);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('could not read that file'));
      reader.readAsDataURL(file);
    });

  studio.selectPhoto = (index) => {
    if (index >= 0 && index < studio.photos.length) {
      studio.selectedPhoto = index;
      studio.onChange();
    }
  };

  // Click a panel: put the selected tray photo in it.
  studio.placeInPanel = (panelId) => {
    if (studio.photos.length === 0) return false;
    const place = studio.state.panels[panelId];
    if (!place) return false;
    place.photo = studio.selectedPhoto;
    place.ox = 0;
    place.oy = 0;
    place.zoom = 1;
    commit();
    return true;
  };

  // One click fills every panel with one photo.
  studio.fillAll = (photoIndex, record = true) => {
    if (photoIndex < 0 || photoIndex >= studio.photos.length) return false;
    for (const place of Object.values(studio.state.panels)) {
      place.photo = photoIndex;
      place.ox = 0;
      place.oy = 0;
      place.zoom = 1;
    }
    if (record) commit();
    return true;
  };

  studio.setLayout = (layout) => {
    if (!LAYOUTS[layout] || studio.state.layout === layout) return;
    studio.state.layout = layout;
    ensurePanels(studio.state, studio.photos.length);
    commit();
  };

  studio.setGrade = (grade) => {
    if (studio.state.grade === grade) return;
    studio.state.grade = grade;
    commit();
  };

  studio.setTitleStyle = (style) => {
    if (studio.state.titleStyle === style) return;
    studio.state.titleStyle = style;
    commit();
  };

  studio.setSize = (size) => {
    if (studio.state.size === size) return;
    studio.state.size = size;
    commit();
  };

  studio.setCaption = (field, value) => {
    if (studio.state[field] === value) return;
    studio.state[field] = value;
    commit();
  };

  studio.toggleSticker = (name) => {
    studio.state.stickers[name] = !studio.state.stickers[name];
    commit();
  };

  // Drag inside a panel: move the photo. Called live during the drag; the
  // history push happens once, when the drag starts (snapshotBefore) and
  // ends (snapshotAfter is the live state), so one drag is one undo step.
  studio.beginDrag = () => {
    studio.history = studio.history.slice(0, studio.historyIndex + 1);
    studio.history.push(JSON.stringify(studio.state));
    if (studio.history.length > 80) studio.history.shift();
    studio.historyIndex = studio.history.length - 1;
  };
  studio.movePanel = (panelId, dx, dy) => {
    const place = studio.state.panels[panelId];
    if (!place) return;
    place.ox = Math.max(-0.6, Math.min(0.6, place.ox + dx));
    place.oy = Math.max(-0.6, Math.min(0.6, place.oy + dy));
    // No onChange here: the pointer handler repaints the preview itself,
    // so a drag does not rebuild the whole control panel on every move.
  };
  studio.zoomPanel = (panelId, factor) => {
    const place = studio.state.panels[panelId];
    if (!place) return;
    place.zoom = Math.max(1, Math.min(3.5, place.zoom * factor));
    studio.onChange();
  };
  studio.endDrag = () => {
    // Replace the pre-drag snapshot with the post-drag state: one step.
    studio.history[studio.historyIndex] = JSON.stringify(studio.state);
    studio.onChange();
  };

  studio.canUndo = () => studio.historyIndex > 0;
  studio.canRedo = () => studio.historyIndex < studio.history.length - 1;

  studio.undo = () => {
    if (!studio.canUndo()) return false;
    studio.historyIndex--;
    restore(studio.history[studio.historyIndex]);
    return true;
  };

  studio.redo = () => {
    if (!studio.canRedo()) return false;
    studio.historyIndex++;
    restore(studio.history[studio.historyIndex]);
    return true;
  };

  studio.resetHistory = () => {
    studio.history = [JSON.stringify(studio.state)];
    studio.historyIndex = 0;
  };

  studio.resetHistory();
  return studio;
}
