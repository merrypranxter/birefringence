#version 300 es
precision highp float;

// retardance.frag — pass 1 of the pipeline.
// Builds the retardance field Gamma = thickness * Delta-n from whichever
// field source is currently selected (its getThickness() is spliced in by
// main.js before compilation). Optionally folds in u_source luminance as an
// extra thickness multiplier, so any uploaded image can be pushed through
// the simulated birefringent medium.

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_retardanceScale; // nm, scales thickness -> Gamma
uniform float u_order;           // 1-8, Michel-Lévy order multiplier
uniform sampler2D u_sourceTex;
uniform float u_useSource;       // 0 or 1
uniform float u_sourceMix;       // 0..1 blend amount

out vec4 outColor;

/*FIELD_FUNCTION*/

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float thickness = getThickness(uv, u_time);

  if (u_useSource > 0.5) {
    float lum = dot(texture(u_sourceTex, uv).rgb, vec3(0.299, 0.587, 0.114));
    thickness = mix(thickness, thickness * lum, u_sourceMix);
  }

  float gamma = thickness * u_retardanceScale * u_order; // nm
  outColor = vec4(gamma, thickness, 0.0, 1.0);
}
