/* Isométrico adapter for Piskel a6b9c02. Loaded before Piskel boots. */
(() => {
  'use strict';
  const channel = 'isometrico-piskel-v1';
  const session = location.hash.slice(1);
  const origin = location.origin;
  let ready = false, loaded = false, importing = false, exporting = false, width = 0, height = 0, frameCount = 1;
  const send = (type, payload = {}) => parent.postMessage({channel, session, type, ...payload}, origin);
  let adventurePalette = null, paletteControls;
  const fail = error => send('error', {message: error instanceof Error ? error.message : String(error)});
  const snapshot = () => pskl.app.historyService.saveState({type: pskl.service.HistoryService.SNAPSHOT});
  function selectedPalette() {
    const id = pskl.UserSettings.get(pskl.UserSettings.SELECTED_PALETTE);
    const p = pskl.app.paletteService.getPaletteById(id);
    return window.IsometricoPalette.validate({name: pskl.utils.unescapeHtml(p?.name || 'Paleta'), colors: p?.getColors()});
  }
  function updatePaletteControls() {
    if (!paletteControls) return;
    paletteControls.load.disabled = !loaded || exporting || !adventurePalette;
    let valid = true; try { selectedPalette(); } catch { valid = false; }
    paletteControls.apply.disabled = !loaded || exporting || !valid;
  }
  function loadPalette(palette) {
    const valid = window.IsometricoPalette.validate(palette), id = 'isometrico-adventure-palette';
    const name = valid.name.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    const service = pskl.app.paletteService;
    const all = service.getPalettes().filter(p => !service.dynamicPalettes.includes(p) && p.id !== id);
    all.push(new pskl.model.Palette(id, name, valid.colors));
    service.localStorageGlobal.setItem('piskel.palettes', JSON.stringify(all));
    $.publish(Events.PALETTE_LIST_UPDATED);
    pskl.UserSettings.set(pskl.UserSettings.SELECTED_PALETTE, id);
    paletteControls.status.textContent = valid.name + ' · ' + valid.colors.length + ' colores';
    updatePaletteControls();
  }
  function createPaletteControls() {
    pskl.UserSettings.set(pskl.UserSettings.SELECTED_PALETTE, Constants.CURRENT_COLORS_PALETTE_ID);
    $.publish(Events.PALETTE_LIST_UPDATED);
    const container = window.document.createElement('div'); container.className = 'isometrico-palette-controls';
    const load = window.document.createElement('button'); load.className = 'button'; load.textContent = 'Cargar paleta de aventura';
    const apply = window.document.createElement('button'); apply.className = 'button'; apply.textContent = 'Aplicar paleta al sprite';
    const status = window.document.createElement('div'); status.className = 'isometrico-palette-status'; status.setAttribute('role', 'status');
    const hint = window.document.createElement('small'); hint.textContent = 'Todas las hojas al aplicar al taller.';
    container.append(load, apply, status, hint); window.document.querySelector('.palettes-list-container').append(container);
    paletteControls = {load, apply, status};
    load.addEventListener('click', () => { try { loadPalette(adventurePalette); } catch (error) { fail(error); } });
    apply.addEventListener('click', () => void adaptPalette().catch(fail));
    $.subscribe(Events.PALETTE_LIST_UPDATED, updatePaletteControls);
    $.subscribe(Events.USER_SETTINGS_CHANGED, updatePaletteControls);
    $.subscribe(Events.HISTORY_STATE_LOADED, () => {
      if (!loaded || exporting) return;
      paletteControls.status.textContent = appliedPalette() ? 'Paleta aplicada · puedes deshacer' : 'Conversión deshecha';
      updatePaletteControls();
    });
    updatePaletteControls();
  }
  function appliedPalette() {
    const history = pskl.app.historyService;
    for (let i = history.currentIndex; i >= 0; i--) {
      const p = history.stateQueue[i].action?.paletteApplied;
      if (p) return window.IsometricoPalette.validate(p);
    }
    return null;
  }
  async function adaptPalette() {
    if (!loaded || exporting) return;
    const palette = selectedPalette(), mapper = window.IsometricoPalette.createMapper(palette);
    const piskel = pskl.app.piskelController.getPiskel(), history = pskl.app.historyService;
    const state = history.getCurrentStateId(), edits = piskel.getLayers().flatMap(layer => layer.getFrames().map(frame => ({frame, pixels: frame.getPixels()})));
    const total = edits.reduce((sum, e) => sum + e.pixels.length, 0); let completed = 0;
    exporting = true; updatePaletteControls(); send('palette-start');
    try {
      for (const edit of edits) for (let offset = 0; offset < edit.pixels.length; offset += 65536) {
        const block = edit.pixels.subarray(offset, offset + 65536); mapper(block); completed += block.length;
        paletteControls.status.textContent = 'Adaptando… ' + Math.round(completed / total * 100) + '%';
        send('palette-progress', {completed, total}); await new Promise(resolve => setTimeout(resolve, 0));
      }
      if (pskl.app.piskelController.getPiskel() !== piskel || history.getCurrentStateId() !== state) throw new Error('La imagen cambió durante la adaptación. Vuelve a intentarlo.');
      // One history entry: Undo restores all frames, layers and alpha together.
      edits.forEach(edit => edit.frame.setPixels(edit.pixels));
      history.saveState({type: pskl.service.HistoryService.SNAPSHOT, paletteApplied: palette});
      paletteControls.status.textContent = 'Paleta aplicada · puedes deshacer';
      send('palette-done'); send('dirty', {dirty: pskl.app.savedStatusService.isDirty()});
    } finally { exporting = false; updatePaletteControls(); }
  }

  // The workshop owns persistence and navigation. Avoid independent Piskel saves/backups.
  window.isometricoBeforePiskelInit = () => {
    for (const service of ['BackupService', 'BeforeUnloadService', 'FileDropperService']) {
      pskl.service[service].prototype.init = function () {};
    }
    const prototype = pskl.service.palette.PaletteService.prototype, read = prototype.getPalettes;
    prototype.getPalettes = function () {
      if (!this.isometricoStorage) { const memory = new Map(); this.localStorageGlobal = {getItem: key => memory.get(key) || null, setItem: (key, value) => memory.set(key, value)}; this.isometricoStorage = true; }
      return read.call(this);
    };
  };
  window.piskelReadyCallbacks = [() => {
    const shortcuts = pskl.service.keyboard.Shortcuts;
    for (const shortcut of [shortcuts.MISC.NEW_FRAME, shortcuts.MISC.DUPLICATE_FRAME,
      shortcuts.MISC.MERGE_ANIMATION,
      ...Object.values(shortcuts.STORAGE)]) pskl.app.shortcutService.unregisterShortcut(shortcut);
    // Keep Undo from restoring the initial, empty 32×32 document.
    $.subscribe(Events.PISKEL_SAVED_STATUS_UPDATE, () => {
      if (loaded && !importing) send('dirty', {dirty: pskl.app.savedStatusService.isDirty()});
    });
    createPaletteControls();
    ready = true;
    send('ready');
  }];

  async function open(data) {
    if (!ready || loaded || importing) return;
    if (!(data.blob instanceof Blob) || data.blob.size > 10_000_000) throw new Error('PNG no válido.');
    if (!Number.isInteger(data.width) || !Number.isInteger(data.height) || data.width < 1 || data.height < 1 ||
      data.width > 4096 || data.height > 4096 || data.width * data.height > 8_388_608) throw new Error('Dimensiones no admitidas.');
    const count = data.frames === undefined ? 1 : data.frames;
    if (!Number.isInteger(count) || count < 1 || count > 180 || data.width % count) throw new Error('Número de fotogramas no válido.');
    const fps = data.fps === undefined ? 1 : data.fps;
    if (!Number.isFinite(fps) || fps < 1 || fps > 30) throw new Error('Velocidad no válida.');
    importing = true;
    const url = URL.createObjectURL(data.blob);
    try {
      const image = new Image(); image.src = url; await image.decode();
      if (image.naturalWidth !== data.width || image.naturalHeight !== data.height) throw new Error('Las dimensiones del PNG no coinciden.');
      const frames = [];
      const cell = window.document.createElement('canvas'); cell.width = data.width / count; cell.height = data.height;
      const context = cell.getContext('2d');
      for (let i = 0; i < count; i++) {
        context.clearRect(0, 0, cell.width, cell.height);
        context.drawImage(image, i * cell.width, 0, cell.width, cell.height, 0, 0, cell.width, cell.height);
        frames.push(pskl.utils.FrameUtils.createFromCanvas(cell, 0, 0, cell.width, cell.height, true));
      }
      const layer = pskl.model.Layer.fromFrames('Imagen', frames);
      const descriptor = new pskl.model.piskel.Descriptor(String(data.name || 'Imagen').slice(0, 120), '');
      const document = pskl.model.Piskel.fromLayers([layer], fps, descriptor);
      pskl.app.historyService.stateQueue = [];
      pskl.app.historyService.currentIndex = -1;
      pskl.app.historyService.lastLoadState = -1;
      pskl.app.piskelController.setPiskel(document);
      snapshot();
      $.publish(Events.PISKEL_SAVED);
      width = data.width; height = data.height; frameCount = count; loaded = true;
      window.document.body.classList.toggle('isometrico-animation', count > 1);
      if (data.palette) { adventurePalette = window.IsometricoPalette.validate(data.palette); loadPalette(adventurePalette); }
      else paletteControls.status.textContent = 'Define una paleta en la aventura.';
      updatePaletteControls();
      send('loaded', {frames: document.getFrameCount(), width: document.getWidth(), height: document.getHeight()});
    } finally { importing = false; URL.revokeObjectURL(url); }
  }

  async function apply() {
    if (!loaded || exporting) return;
    exporting = true;
    try {
      const document = pskl.app.piskelController.getPiskel();
      if (document.getFrameCount() !== frameCount || document.getWidth() !== width / frameCount || document.getHeight() !== height) {
        throw new Error('Este retoque debe conservar los fotogramas y el tamaño originales. Usa Deshacer para recuperar el formato.');
      }
      const canvas = window.document.createElement('canvas'); canvas.width = width; canvas.height = height;
      const context = canvas.getContext('2d');
      for (let i = 0; i < frameCount; i++) context.drawImage(pskl.utils.LayerUtils.flattenFrameAt(document.getLayers(), i, true), i * (width / frameCount), 0);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob || blob.size > 10_000_000) throw new Error('No se pudo generar el PNG o supera 10 MB.');
      // Canvas premultiplication rounds RGB at translucent edges. Preserve single-layer
      // RGBA directly; the host encodes straight RGBA without that lossy round trip.
      let rgba;
      const layers = document.getLayers();
      if (layers.length === 1 && layers[0].getOpacity() === 1) {
        rgba = new Uint8ClampedArray(width * height * 4);
        const cellWidth = width / frameCount;
        for (let i = 0; i < frameCount; i++) {
          const pixels = new Uint8ClampedArray(layers[0].getFrameAt(i).getPixels().buffer);
          for (let y = 0; y < height; y++) rgba.set(pixels.subarray(y * cellWidth * 4, (y + 1) * cellWidth * 4), (y * width + i * cellWidth) * 4);
        }
      }
      send('result', {blob, rgba, changed: pskl.app.savedStatusService.isDirty(), paletteApplied: appliedPalette()});
    } finally { exporting = false; }
  }

  window.addEventListener('message', event => {
    const data = event.data;
    if (event.source !== parent || event.origin !== origin || !data || data.channel !== channel || data.session !== session) return;
    if (data.type === 'open') void open(data).catch(fail);
    if (data.type === 'apply') void apply().catch(fail);
    if (loaded && !exporting && data.type === 'undo') pskl.app.historyService.undo();
    if (loaded && !exporting && data.type === 'redo') pskl.app.historyService.redo();
  });
  window.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault(); event.stopImmediatePropagation(); send('apply-request');
    }
  }, true);
})();
