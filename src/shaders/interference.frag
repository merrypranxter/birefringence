#version 300 es
precision highp float;

// interference.frag — pass 2 of the pipeline.
// The core of the simulation: transmitted intensity per wavelength is
// I(lambda) = sin^2(pi * Gamma / lambda), summed across the visible
// spectrum and converted to RGB via the CIE color-matching functions. That
// spectral sum is precomputed on the CPU (michel-levy.js) into u_lut so this
// pass only has to do a single texture lookup per pixel.
//
// Analyzer rotation phase-shifts the effective retardance, which is what
// cycles the whole color palette through the Michel-Lévy order sequence.
// A full/quarter-wave plate adds a constant offset for the same reason —
// first-order red becomes second-order blue, etc. Crossed-polarizer
// extinction is modeled as a transmission envelope that goes to near-zero
// when the analyzer is parallel or perpendicular to the reference axis and
// peaks at 45 degrees.

uniform sampler2D u_gammaTex;
uniform sampler2D u_lut;
uniform vec2 u_resolution;
uniform float u_analyzerAngle; // degrees, 0-90
uniform int u_wavePlate;       // 0 none, 1 full, 2 quarter
uniform float u_maxRetardance; // nm, LUT domain max

out vec4 outColor;

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float gamma = texture(u_gammaTex, uv).r;

  float plateOffset = 0.0;
  if (u_wavePlate == 1) plateOffset = 550.0;       // full-wave (1st-order red) plate
  else if (u_wavePlate == 2) plateOffset = 275.0;  // quarter-wave plate

  // analyzer rotation phase-shifts the effective retardance -> cycles the palette
  float analyzerShift = (u_analyzerAngle / 90.0) * u_maxRetardance * 0.5;
  float gammaEff = gamma + plateOffset + analyzerShift;

  // crossed-polarizer transmission envelope: max at 45deg, near-zero at 0/90
  float dev = abs(45.0 - u_analyzerAngle);
  float envelope = sin(radians(2.0 * (45.0 - dev)));
  envelope = clamp(envelope, 0.0, 1.0);
  envelope = mix(0.12, 1.0, envelope);

  float lutCoord = clamp(gammaEff / u_maxRetardance, 0.0, 1.0);
  vec3 color = texture(u_lut, vec2(lutCoord, 0.5)).rgb;

  outColor = vec4(color * envelope, 1.0);
}
