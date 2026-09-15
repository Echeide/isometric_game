/* Isométrico adapter for Piskel a6b9c02. Loaded before Piskel boots. */
(() => {
  'use strict';
  const channel = 'isometrico-piskel-v1';
  const session = location.hash.slice(1);
  const origin = location.origin;
  let ready = false, loaded = false, importing = false, exporting = false, width = 0, height = 0;
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
      shortcuts.MISC.PREVIOUS_FRAME, shortcuts.MISC.NEXT_FRAME, shortcuts.MISC.MERGE_ANIMATION,
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
    importing = true;
    const url = URL.createObjectURL(data.blob);
    try {
      const image = new Image(); image.src = url; await image.decode();
      if (image.naturalWidth !== data.width || image.naturalHeight !== data.height) throw new Error('Las dimensiones del PNG no coinciden.');
      const frame = pskl.utils.FrameUtils.createFromImage(image, true);
      const layer = pskl.model.Layer.fromFrames('Imagen', [frame]);
      const descriptor = new pskl.model.piskel.Descriptor(String(data.name || 'Imagen').slice(0, 120), '');
      const document = pskl.model.Piskel.fromLayers([layer], 1, descriptor);
      pskl.app.historyService.stateQueue = [];
      pskl.app.historyService.currentIndex = -1;
      pskl.app.historyService.lastLoadState = -1;
      pskl.app.piskelController.setPiskel(document);
      $.publish(Events.PISKEL_SAVED);
      width = data.width; height = data.height; loaded = true;
      send('loaded');
    } finally { importing = false; URL.revokeObjectURL(url); }
  }

  async function apply() {
    if (!loaded || exporting) return;
    exporting = true;
    try {
      const document = pskl.app.piskelController.getPiskel();
      if (document.getFrameCount() !== 1 || document.getWidth() !== width || document.getHeight() !== height) {
        throw new Error('Este retoque debe conservar un único fotograma y el tamaño original. Usa Deshacer para recuperar el formato.');
      }
      const canvas = pskl.utils.LayerUtils.flattenFrameAt(document.getLayers(), 0, true);
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
