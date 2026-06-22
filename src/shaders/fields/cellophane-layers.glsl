// cellophane-layers.glsl — flat stacked cellophane regions.
// Each shape is a sheet of cellophane with a fixed retardance increment;
// overlapping sheets simply add thickness, giving the rotating-Mondrian look.

float sdBox(vec2 p, vec2 c, vec2 size) {
  vec2 d = abs(p - c) - size;
  return max(d.x, d.y);
}

float sdCircle(vec2 p, vec2 c, float r) {
  return length(p - c) - r;
}

float getThickness(vec2 uv, float time) {
  vec2 p = uv * 2.0 - 1.0;

  float t = 0.0;
  t += step(sdBox(p, vec2(-0.5, 0.3), vec2(0.35, 0.25)), 0.0) * 0.20;
  t += step(sdBox(p, vec2(0.3, -0.1), vec2(0.45, 0.30)), 0.0) * 0.35;
  t += step(sdCircle(p, vec2(0.4, 0.5), 0.30), 0.0) * 0.25;
  t += step(sdBox(p, vec2(-0.3, -0.5), vec2(0.50, 0.20)), 0.0) * 0.50;
  t += step(sdCircle(p, vec2(-0.6, 0.1), 0.25), 0.0) * 0.15;

  return t;
}
