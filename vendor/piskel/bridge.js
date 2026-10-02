/* Isométrico adapter for Piskel a6b9c02. Loaded before Piskel boots. */
(() => {
  'use strict';
  const channel = 'isometrico-piskel-v1';
  const session = location.hash.slice(1);
  const origin = location.origin;
  let ready = false, loaded = false, importing = false, exporting = false, width = 0, height = 0, frameCount = 1;
  const send = (type, payload = {}) => parent.postMessage({channel, session, type, ...payload}, origin);
  const fail = error => send('error', {message: error instanceof Error ? error.message : String(error)});

  // The workshop owns persistence and navigation. Avoid independent Piskel saves/backups.
  window.isometricoBeforePiskelInit = () => {
    for (const service of ['BackupService', 'BeforeUnloadService', 'FileDropperService']) {
      pskl.service[service].prototype.init = function () {};
    }
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
      $.publish(Events.PISKEL_SAVED);
      width = data.width; height = data.height; frameCount = count; loaded = true;
      window.document.body.classList.toggle('isometrico-animation', count > 1);
      send('loaded');
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
      send('result', {blob, changed: pskl.app.savedStatusService.isDirty()});
    } finally { exporting = false; }
  }

  window.addEventListener('message', event => {
    const data = event.data;
    if (event.source !== parent || event.origin !== origin || !data || data.channel !== channel || data.session !== session) return;
    if (data.type === 'open') void open(data).catch(fail);
    if (data.type === 'apply') void apply().catch(fail);
    if (loaded && data.type === 'undo') pskl.app.historyService.undo();
    if (loaded && data.type === 'redo') pskl.app.historyService.redo();
  });
  window.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault(); event.stopImmediatePropagation(); send('apply-request');
    }
  }, true);
})();
