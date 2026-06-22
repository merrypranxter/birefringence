#version 300 es
precision highp float;

// post-process.frag — pass 3 of the pipeline.
// Glassy specular highlight (a fake normal from the retardance field's
// gradient) plus a soft bright-pass bloom. An optional "stylize" mix remaps
// luminance through a hand-picked neon ramp from color-maps.js, purely as a
// creative finisher — the underlying hue is still physics, not paint.

uniform sampler2D u_colorTex;
uniform sampler2D u_gammaTex;
uniform sampler2D u_paletteTex;
uniform vec2 u_resolution;
uniform float u_bloomStrength;
uniform float u_specularStrength;
uniform float u_stylize; // 0..1 mix amount

out vec4 outColor;

vec3 bloom(vec2 uv, vec2 texel) {
  vec3 sum = vec3(0.0);
  float total = 0.0;
  for (int x = -2; x <= 2; x++) {
    for (int y = -2; y <= 2; y++) {
      vec2 offset = vec2(float(x), float(y)) * texel * 2.0;
      vec3 c = texture(u_colorTex, uv + offset).rgb;
      float bright = max(c.r, max(c.g, c.b));
      float w = bright * bright;
      sum += c * w;
      total += w;
    }
  }
  return total > 0.0 ? sum / total : vec3(0.0);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 texel = 1.0 / u_resolution;
  vec3 base = texture(u_colorTex, uv).rgb;

  vec3 color = base + bloom(uv, texel) * u_bloomStrength;

  // use normalized thickness (.g), not retardance (.r) — surface finish
  // should be independent of the retardance_scale/order sliders
  float gN = texture(u_gammaTex, uv).g;
  float gE = texture(u_gammaTex, uv + vec2(texel.x, 0.0)).g;
  float gS = texture(u_gammaTex, uv + vec2(0.0, texel.y)).g;
  vec3 normal = normalize(vec3((gN - gE) * 10.0, (gN - gS) * 10.0, 1.0));
  vec3 lightDir = normalize(vec3(0.4, 0.6, 0.7));
  float spec = pow(max(dot(normal, lightDir), 0.0), 24.0);
  color += spec * u_specularStrength;

  if (u_stylize > 0.0) {
    float lum = dot(color, vec3(0.299, 0.587, 0.114));
    vec3 paletteColor = texture(u_paletteTex, vec2(lum, 0.5)).rgb;
    color = mix(color, paletteColor, u_stylize);
  }

  outColor = vec4(color, 1.0);
}
