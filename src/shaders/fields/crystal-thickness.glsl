// crystal-thickness.glsl — random crystalline domains.
// A Voronoi tessellation; each cell is one crystal grain with its own
// constant thickness/orientation, producing the sharp-boundary, flat-color
// look of a mineral thin-section under crossed polars.

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}

float getThickness(vec2 uv, float time) {
  vec2 p = uv * 6.0;
  vec2 ip = floor(p);
  vec2 fp = fract(p);

  float minDist = 8.0;
  vec2 cell = ip;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 neighbor = vec2(float(x), float(y));
      vec2 point = hash2(ip + neighbor);
      float d = length(neighbor + point - fp);
      if (d < minDist) {
        minDist = d;
        cell = ip + neighbor;
      }
    }
  }

  // each grain holds a near-constant thickness; a slow drift keeps the
  // thin-section feeling faintly alive rather than a static photo
  float base = hash2(cell).x;
  float drift = 0.02 * sin(time * 0.15 + base * 30.0);
  return clamp(base + drift, 0.0, 1.0);
}
