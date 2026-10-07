/* Shared OKLab matching rules with the workshop; RGBA pixels are little-endian Uint32. */
(() => {
  'use strict';
  function validate(value) {
    if (!value || typeof value.name !== 'string' || !value.name.trim() || value.name.length > 80 ||
      !Array.isArray(value.colors) || value.colors.length < 1 || value.colors.length > 256 ||
      value.colors.some(c => typeof c !== 'string' || !/^#[\da-f]{6}$/i.test(c)) ||
      new Set(value.colors.map(c => c.toLowerCase())).size !== value.colors.length) {
      throw new Error('Elige una paleta con nombre y entre 1 y 256 colores HEX distintos.');
    }
    return {name: value.name.trim(), colors: value.colors.map(c => c.toLowerCase())};
  }
  function lab(rgb) {
    const [r, g, b] = rgb.map(v => { const s = v / 255; return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4; });
    const l = Math.cbrt(.4122214708 * r + .5363325363 * g + .0514459929 * b);
    const m = Math.cbrt(.2119034982 * r + .6806995451 * g + .1073969566 * b);
    const s = Math.cbrt(.0883024619 * r + .2817188376 * g + .6299787005 * b);
    return [.2104542553 * l + .793617785 * m - .0040720468 * s,
      1.9779984951 * l - 2.428592205 * m + .4505937099 * s,
      .0259040371 * l + .7827717662 * m - .808675766 * s];
  }
  function createMapper(palette) {
    const colors = validate(palette).colors.map(c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]);
    const labs = colors.map(lab), cache = new Map();
    return pixels => {
      for (let i = 0; i < pixels.length; i++) {
        const pixel = pixels[i], alpha = pixel >>> 24;
        if (!alpha) continue;
        const key = pixel & 0xffffff;
        let color = cache.get(key);
        if (color === undefined) {
          const sample = lab([pixel & 255, pixel >>> 8 & 255, pixel >>> 16 & 255]);
          let best = Infinity, index = 0;
          labs.forEach((p, j) => { const distance = p.reduce((sum, v, k) => sum + (v - sample[k]) ** 2, 0); if (distance < best) { best = distance; index = j; } });
          const [r, g, b] = colors[index]; color = r | g << 8 | b << 16;
          if (cache.size < 65536) cache.set(key, color);
        }
        pixels[i] = (pixel & 0xff000000 | color) >>> 0;
      }
    };
  }
  window.IsometricoPalette = {validate, createMapper};
})();
