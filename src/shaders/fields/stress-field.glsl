// stress-field.glsl — photoelastic stress field.
// Superposed point-load stress kernels (simplified Flamant solution) plus a
// crack discontinuity. sigma_xx - sigma_yy (the stress-optic proxy) falls off
// as 1/r from each load, so retardance — and the resulting Michel-Lévy order —
// climbs steeply near the loads: the classic "screaming" stress fringes.

float loadStress(vec2 p, vec2 loadPos, float strength) {
  vec2 d = p - loadPos;
  float r = length(d) + 0.025;
  float theta = atan(d.y, d.x + 1e-6);
  return strength * cos(2.0 * theta) / r;
}

float getThickness(vec2 uv, float time) {
  vec2 p = uv * 2.0 - 1.0;

  float s = 0.0;
  s += loadStress(p, vec2(0.0, 0.65), 0.10);
  s += loadStress(p, vec2(-0.55, -0.55), -0.085);
  s += loadStress(p, vec2(0.55, -0.55), 0.085);

  // a crack: a thin wandering discontinuity that locally concentrates stress
  float crackDist = abs(p.x - 0.15 * sin(p.y * 3.0 + time * 0.05));
  s += 0.045 / (crackDist + 0.012);

  return abs(s);
}
