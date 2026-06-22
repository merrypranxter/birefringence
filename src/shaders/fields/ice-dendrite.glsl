// ice-dendrite.glsl — crystallizing radial thickness field.
// Thickness grows outward from a center with fine angular branching and
// concentric growth rings — fine, high-order fringes, sugar/frost crystal.

float getThickness(vec2 uv, float time) {
  vec2 p = uv * 2.0 - 1.0;
  float r = length(p);
  float a = atan(p.y, p.x);

  float arms = 6.0;
  float branch = sin(a * arms + r * 12.0) * 0.5 + 0.5;
  branch = pow(branch, 3.0);

  float growth = clamp(1.0 - r * 0.9 + 0.05 * sin(time * 0.2), 0.0, 1.0);
  float rings = sin(r * 40.0 - time * 0.3) * 0.5 + 0.5;

  return growth * mix(rings, branch, 0.6);
}
