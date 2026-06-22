// birefringence — color-maps.js
// 256px DataTexture ramps for the optional post-process "stylize" pass.
// The physical Michel-Lévy hue is never hand-picked; these are a purely
// optional creative finisher applied on top.

export const PALETTES = {
  acid: ['#0a001a', '#8338ec', '#ff006e', '#ffbe0b', '#fb5607'],
  void_bloom: ['#000000', '#3a0ca3', '#f72585', '#4cc9f0', '#ffffff'],
  plasma: ['#1a0000', '#8b0000', '#ff4500', '#ffd700', '#ffffff'],
};

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function buildRamp(gl, hexArray, width = 256) {
  const stops = hexArray.map(hexToRgb);
  const data = new Uint8Array(width * 4);
  for (let i = 0; i < width; i++) {
    const t = i / (width - 1);
    const segment = t * (stops.length - 1);
    const idx = Math.min(stops.length - 2, Math.floor(segment));
    const localT = segment - idx;
    const a = stops[idx];
    const b = stops[idx + 1];
    data[i * 4 + 0] = Math.round(a[0] + (b[0] - a[0]) * localT);
    data[i * 4 + 1] = Math.round(a[1] + (b[1] - a[1]) * localT);
    data[i * 4 + 2] = Math.round(a[2] + (b[2] - a[2]) * localT);
    data[i * 4 + 3] = 255;
  }

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  return tex;
}
