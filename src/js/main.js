// birefringence — main.js
// Entry point. Sets up the WebGL2 context, compiles the three-pass
// pipeline (retardance -> interference -> post-process), wires the UI, and
// runs the render loop.
//
// Pipeline:
//   1. retardance.frag   builds Gamma = thickness * Delta-n into an FBO
//      (one program per field source; its getThickness() is spliced in)
//   2. interference.frag samples the Michel-Lévy LUT -> color FBO
//   3. post-process.frag bloom + glassy specular -> screen

import { buildLUT, MAX_RETARDANCE_DEFAULT } from './michel-levy.js';
import { buildRamp, PALETTES } from './color-maps.js';
import { Source } from './source.js';

const FIELD_SOURCES = ['stress_field', 'crystal_thickness', 'cellophane_layers', 'ice_dendrite'];

// Per-regime defaults from the spec (docs/visual-targets.md): each field
// source has a "look" it's tuned for.
const FIELD_PRESETS = {
  stress_field: { retardanceScale: 900, order: 2, autoRotate: false },
  crystal_thickness: { retardanceScale: 1200, order: 3, autoRotate: false },
  cellophane_layers: { retardanceScale: 900, order: 1, autoRotate: true },
  ice_dendrite: { retardanceScale: 3000, order: 8, autoRotate: false },
};
const FIELD_FILES = {
  stress_field: 'src/shaders/fields/stress-field.glsl',
  crystal_thickness: 'src/shaders/fields/crystal-thickness.glsl',
  cellophane_layers: 'src/shaders/fields/cellophane-layers.glsl',
  ice_dendrite: 'src/shaders/fields/ice-dendrite.glsl',
};

const VERTEX_SRC = `#version 300 es
const vec2 positions[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
void main() {
  gl_Position = vec4(positions[gl_VertexID], 0.0, 1.0);
}`;

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`failed to load ${url}: ${res.status}`);
  return res.text();
}

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`shader compile error: ${log}\n${source}`);
  }
  return shader;
}

function linkProgram(gl, vsSource, fsSource) {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSource);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSource);
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    throw new Error(`program link error: ${log}`);
  }
  return program;
}

function uniformLocs(gl, program, names) {
  const locs = {};
  for (const name of names) locs[name] = gl.getUniformLocation(program, name);
  return locs;
}

function createFBO(gl, width, height, internalFormat, format, type, filter) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, format, type, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);

  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { fbo, tex };
}

async function main() {
  const canvas = document.getElementById('canvas');
  const gl = canvas.getContext('webgl2');
  if (!gl) {
    document.body.innerHTML = '<p style="color:#fff;font-family:monospace;padding:2em">WebGL2 is required.</p>';
    return;
  }
  gl.getExtension('EXT_color_buffer_float');
  const linearFloat = gl.getExtension('OES_texture_float_linear');

  const emptyVAO = gl.createVertexArray();

  // --- compile field-specific retardance programs ---
  const retardanceTemplate = await fetchText('src/shaders/retardance.frag');
  const interferenceSrc = await fetchText('src/shaders/interference.frag');
  const postSrc = await fetchText('src/shaders/post-process.frag');

  const retardancePrograms = {};
  for (const field of FIELD_SOURCES) {
    const fieldFn = await fetchText(FIELD_FILES[field]);
    const fsSource = retardanceTemplate.replace('/*FIELD_FUNCTION*/', fieldFn);
    const program = linkProgram(gl, VERTEX_SRC, fsSource);
    retardancePrograms[field] = {
      program,
      uniforms: uniformLocs(gl, program, [
        'u_resolution', 'u_time', 'u_retardanceScale', 'u_order',
        'u_sourceTex', 'u_useSource', 'u_sourceMix',
      ]),
    };
  }

  const interferenceProgram = linkProgram(gl, VERTEX_SRC, interferenceSrc);
  const interferenceUniforms = uniformLocs(gl, interferenceProgram, [
    'u_gammaTex', 'u_lut', 'u_resolution', 'u_analyzerAngle', 'u_wavePlate', 'u_maxRetardance',
  ]);

  const postProgram = linkProgram(gl, VERTEX_SRC, postSrc);
  const postUniforms = uniformLocs(gl, postProgram, [
    'u_colorTex', 'u_gammaTex', 'u_paletteTex', 'u_resolution',
    'u_bloomStrength', 'u_specularStrength', 'u_stylize',
  ]);

  // --- LUT + palette textures ---
  const lutTex = buildLUT(gl, 1024, MAX_RETARDANCE_DEFAULT);
  let paletteTex = buildRamp(gl, PALETTES.acid);

  // --- source image / webcam ---
  const source = new Source(gl);

  // --- FBOs (rebuilt on resize) ---
  let gammaFBO, colorFBO, width, height;
  const gammaFilter = linearFloat ? gl.LINEAR : gl.NEAREST;

  function rebuildFBOs() {
    width = Math.floor(canvas.clientWidth * dpr());
    height = Math.floor(canvas.clientHeight * dpr());
    canvas.width = width;
    canvas.height = height;
    if (gammaFBO) {
      gl.deleteFramebuffer(gammaFBO.fbo);
      gl.deleteTexture(gammaFBO.tex);
    }
    if (colorFBO) {
      gl.deleteFramebuffer(colorFBO.fbo);
      gl.deleteTexture(colorFBO.tex);
    }
    gammaFBO = createFBO(gl, width, height, gl.RGBA32F, gl.RGBA, gl.FLOAT, gammaFilter);
    colorFBO = createFBO(gl, width, height, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR);
  }

  function dpr() {
    return Math.min(window.devicePixelRatio || 1, 1.5);
  }

  window.addEventListener('resize', rebuildFBOs);
  rebuildFBOs();

  // --- UI state ---
  const ui = {
    field: 'stress_field',
    retardanceScale: FIELD_PRESETS.stress_field.retardanceScale,
    analyzerAngle: 45,
    wavePlate: 0, // 0 none, 1 full, 2 quarter
    order: FIELD_PRESETS.stress_field.order,
    autoRotate: FIELD_PRESETS.stress_field.autoRotate,
    useSource: false,
    sourceMix: 0.7,
    stylize: 0,
    palette: 'acid',
    bloom: 0.6,
    specular: 0.4,
  };

  bindUI(ui, (key) => {
    if (key === 'palette') {
      gl.deleteTexture(paletteTex);
      paletteTex = buildRamp(gl, PALETTES[ui.palette]);
    }
  });

  function drawFullscreen(program) {
    gl.useProgram(program);
    gl.bindVertexArray(emptyVAO);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function render(timeMs) {
    const time = timeMs * 0.001;
    if (ui.autoRotate) {
      ui.analyzerAngle = (Math.sin(time * 0.3) * 0.5 + 0.5) * 90;
      syncUIDisplay(ui);
    }
    if (source.active) source.update();

    // pass 1: retardance
    const fieldProg = retardancePrograms[ui.field];
    gl.bindFramebuffer(gl.FRAMEBUFFER, gammaFBO.fbo);
    gl.viewport(0, 0, width, height);
    gl.useProgram(fieldProg.program);
    gl.uniform2f(fieldProg.uniforms.u_resolution, width, height);
    gl.uniform1f(fieldProg.uniforms.u_time, time);
    gl.uniform1f(fieldProg.uniforms.u_retardanceScale, ui.retardanceScale);
    gl.uniform1f(fieldProg.uniforms.u_order, ui.order);
    gl.uniform1f(fieldProg.uniforms.u_useSource, ui.useSource ? 1 : 0);
    gl.uniform1f(fieldProg.uniforms.u_sourceMix, ui.sourceMix);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, source.texture);
    gl.uniform1i(fieldProg.uniforms.u_sourceTex, 0);
    drawFullscreen(fieldProg.program);

    // pass 2: interference
    gl.bindFramebuffer(gl.FRAMEBUFFER, colorFBO.fbo);
    gl.useProgram(interferenceProgram);
    gl.uniform2f(interferenceUniforms.u_resolution, width, height);
    gl.uniform1f(interferenceUniforms.u_analyzerAngle, ui.analyzerAngle);
    gl.uniform1i(interferenceUniforms.u_wavePlate, ui.wavePlate);
    gl.uniform1f(interferenceUniforms.u_maxRetardance, MAX_RETARDANCE_DEFAULT);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, gammaFBO.tex);
    gl.uniform1i(interferenceUniforms.u_gammaTex, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, lutTex);
    gl.uniform1i(interferenceUniforms.u_lut, 1);
    drawFullscreen(interferenceProgram);

    // pass 3: post-process -> screen
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.useProgram(postProgram);
    gl.uniform2f(postUniforms.u_resolution, width, height);
    gl.uniform1f(postUniforms.u_bloomStrength, ui.bloom);
    gl.uniform1f(postUniforms.u_specularStrength, ui.specular);
    gl.uniform1f(postUniforms.u_stylize, ui.stylize);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, colorFBO.tex);
    gl.uniform1i(postUniforms.u_colorTex, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, gammaFBO.tex);
    gl.uniform1i(postUniforms.u_gammaTex, 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, paletteTex);
    gl.uniform1i(postUniforms.u_paletteTex, 2);
    drawFullscreen(postProgram);

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);

  // expose for UI wiring below
  window.__birefringence = { ui, source };
}

function bindUI(ui, onChange) {
  const $ = (id) => document.getElementById(id);

  $('field-source').addEventListener('change', (e) => {
    ui.field = e.target.value;
    const preset = FIELD_PRESETS[ui.field];
    ui.retardanceScale = preset.retardanceScale;
    ui.order = preset.order;
    ui.autoRotate = preset.autoRotate;
    $('retardance-scale').value = preset.retardanceScale;
    $('retardance-scale-val').textContent = preset.retardanceScale;
    $('order').value = preset.order;
    $('order-val').textContent = preset.order;
    $('auto-rotate').checked = preset.autoRotate;
    $('analyzer-angle').disabled = preset.autoRotate;
  });
  $('retardance-scale').addEventListener('input', (e) => {
    ui.retardanceScale = Number(e.target.value);
    $('retardance-scale-val').textContent = ui.retardanceScale;
  });
  $('analyzer-angle').addEventListener('input', (e) => {
    ui.analyzerAngle = Number(e.target.value);
    $('analyzer-angle-val').textContent = `${ui.analyzerAngle}°`;
  });
  $('wave-plate').addEventListener('change', (e) => {
    ui.wavePlate = { none: 0, full: 1, quarter: 2 }[e.target.value];
  });
  $('order').addEventListener('input', (e) => {
    ui.order = Number(e.target.value);
    $('order-val').textContent = ui.order;
  });
  $('auto-rotate').addEventListener('change', (e) => {
    ui.autoRotate = e.target.checked;
    $('analyzer-angle').disabled = ui.autoRotate;
  });
  $('bloom').addEventListener('input', (e) => { ui.bloom = Number(e.target.value); });
  $('specular').addEventListener('input', (e) => { ui.specular = Number(e.target.value); });
  $('stylize').addEventListener('input', (e) => { ui.stylize = Number(e.target.value); });
  $('palette').addEventListener('change', (e) => { ui.palette = e.target.value; onChange('palette'); });

  $('source-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      await window.__birefringence.source.fromImage(file);
      ui.useSource = true;
      $('use-source').checked = true;
    } catch (err) {
      console.error('Failed to load image:', err);
      alert('Failed to load the selected image.');
    }
  });
  $('webcam-btn').addEventListener('click', async () => {
    try {
      await window.__birefringence.source.fromWebcam();
      ui.useSource = true;
      $('use-source').checked = true;
    } catch (err) {
      console.error('Failed to acquire webcam:', err);
      alert('Could not access webcam. Please check permissions.');
    }
  });
  $('use-source').addEventListener('change', (e) => { ui.useSource = e.target.checked; });
  $('source-mix').addEventListener('input', (e) => { ui.sourceMix = Number(e.target.value); });
  $('clear-source').addEventListener('click', () => {
    window.__birefringence.source.clear();
    ui.useSource = false;
    $('use-source').checked = false;
  });
}

function syncUIDisplay(ui) {
  const angleEl = document.getElementById('analyzer-angle');
  const angleVal = document.getElementById('analyzer-angle-val');
  if (angleEl) angleEl.value = ui.analyzerAngle;
  if (angleVal) angleVal.textContent = `${Math.round(ui.analyzerAngle)}°`;
}

main().catch((err) => {
  console.error(err);
  document.body.innerHTML = `<pre style="color:#f55;font-family:monospace;padding:2em;white-space:pre-wrap">${err.message}</pre>`;
});
