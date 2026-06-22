// birefringence — michel-levy.js
// Retardance (Gamma, nm) -> RGB via the Michel-Lévy spectral interference
// sum: I(lambda) = sin^2(pi * Gamma / lambda), integrated against the CIE
// 1931 color-matching functions and converted XYZ -> sRGB. Baked into a 1D
// LUT texture so the shader only needs one lookup per pixel.

function gaussian(x, alpha, mu, sigma1, sigma2) {
  const sigma = x < mu ? sigma1 : sigma2;
  const t = (x - mu) / sigma;
  return alpha * Math.exp(-0.5 * t * t);
}

// Analytic CIE 1931 2-degree color-matching function fit
// (Wyman, Sloan & Shirley, "Simple Analytic Approximations to the CIE XYZ
// Color Matching Functions", JCGT 2013).
function cieMatch(lambda) {
  const x = gaussian(lambda, 1.056, 599.8, 37.9, 31.0)
          + gaussian(lambda, 0.362, 442.0, 16.0, 26.7)
          + gaussian(lambda, -0.065, 501.1, 20.4, 26.2);
  const y = gaussian(lambda, 0.821, 568.8, 46.9, 40.5)
          + gaussian(lambda, 0.286, 530.9, 16.3, 31.1);
  const z = gaussian(lambda, 1.217, 437.0, 11.8, 36.0)
          + gaussian(lambda, 0.681, 459.0, 26.0, 13.8);
  return [x, y, z];
}

// CIE XYZ (D65) -> linear sRGB
const XYZ_TO_SRGB = [
   3.2406, -1.5372, -0.4986,
  -0.9689,  1.8758,  0.0415,
   0.0557, -0.2040,  1.0570,
];

function srgbGamma(c) {
  c = Math.max(0, Math.min(1, c));
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

function xyzToSrgb(x, y, z) {
  const r = XYZ_TO_SRGB[0] * x + XYZ_TO_SRGB[1] * y + XYZ_TO_SRGB[2] * z;
  const g = XYZ_TO_SRGB[3] * x + XYZ_TO_SRGB[4] * y + XYZ_TO_SRGB[5] * z;
  const b = XYZ_TO_SRGB[6] * x + XYZ_TO_SRGB[7] * y + XYZ_TO_SRGB[8] * z;
  return [srgbGamma(r), srgbGamma(g), srgbGamma(b)];
}

const N_SAMPLES = 64;
const LAMBDA_MIN = 380;
const LAMBDA_MAX = 780;

export const MAX_RETARDANCE_DEFAULT = 5500; // nm, ~order 8

// Spectral sum: retardance Gamma (nm) -> sRGB in [0,1].
export function retardanceToRGB(gamma) {
  let X = 0, Y = 0, Z = 0, yIntegral = 0;
  const step = (LAMBDA_MAX - LAMBDA_MIN) / N_SAMPLES;
  for (let i = 0; i < N_SAMPLES; i++) {
    const lambda = LAMBDA_MIN + (i + 0.5) * step;
    const s = Math.sin((Math.PI * gamma) / lambda);
    const intensity = s * s;
    const [x, y, z] = cieMatch(lambda);
    X += intensity * x;
    Y += intensity * y;
    Z += intensity * z;
    yIntegral += y;
  }
  X /= yIntegral;
  Y /= yIntegral;
  Z /= yIntegral;
  return xyzToSrgb(X, Y, Z);
}

// Bakes the spectral sum into a 1px-tall RGBA8 LUT texture covering
// retardance 0..maxRetardance nm. The shader samples this directly.
export function buildLUT(gl, width = 1024, maxRetardance = MAX_RETARDANCE_DEFAULT) {
  const data = new Uint8Array(width * 4);
  for (let i = 0; i < width; i++) {
    const gamma = (i / (width - 1)) * maxRetardance;
    const [r, g, b] = retardanceToRGB(gamma);
    data[i * 4 + 0] = Math.round(r * 255);
    data[i * 4 + 1] = Math.round(g * 255);
    data[i * 4 + 2] = Math.round(b * 255);
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
