# birefringence

A creative coding project exploring **crossed-polarizer interference colors** — the Michel-Lévy effect where birefringent materials retard light by thickness × Δn, producing spectral rainbows between crossed polarizers. Photoelastic stress fringes, mineral thin-sections, cellophane layers, sugar crystals. Rainbow-mathy.

## What Is This?

A **generator** that simulates the physics of birefringence: a material with two different refractive indices retards light passing through it. Between crossed polarizers, that retardance becomes color. The color is not arbitrary — it is the spectral interference `sin²(πΓ/λ)` summed across the visible spectrum. The result is physics-generated rainbows.

**Bonus:** Can read `u_source` luminance as a thickness field to push any image through the simulated birefringent medium.

## Project Structure

```
src/
  js/
    main.js           — WebGL2 setup, three-pass pipeline, UI wiring, render loop
    michel-levy.js    — retardance → RGB spectral-sum LUT builder
    color-maps.js     — optional neon palette ramps for the stylize finisher
    source.js         — u_source: image upload / webcam texture handling
  shaders/
    fields/           — swappable retardance sources
      stress-field.glsl     — photoelastic stress (point loads / cracks)
      crystal-thickness.glsl — random crystalline domains
      cellophane-layers.glsl — flat stacked regions
      ice-dendrite.glsl     — crystallizing thickness field
    retardance.frag   — build Γ = thickness · Δn field
    interference.frag — Michel-Lévy LUT lookup + analyzer/wave-plate modulation
    post-process.frag — glassy specular + bloom
```

## Running

Shaders are loaded with `fetch()`, so serve the directory over HTTP rather
than opening `index.html` directly (file:// fetches are blocked by most
browsers):

```sh
python3 -m http.server 8080
# or: npx serve
```

Then open `http://localhost:8080`. WebGL2 required.

## Current Field Engines

- [x] _stress_field — photoelastic stress from point loads/cracks → screaming fringes
- [x] _crystal_thickness — random domains, mineral thin-section look
- [x] _cellophane_layers — flat stacked regions, Mondrian-style color blocks
- [x] _ice_dendrite — radial thickness, fine high-order fringes

## Aesthetic Regimes

- [x] photoelastic_stress — stressed bracket, black field, stress rainbows
- [x] mineral_thin_section — random domains, Michel-Lévy orders, geology-slide look
- [x] cellophane_mondrian — flat layered regions, rotating analyzer cycles palette
- [x] sugar_crystal — radial thickness, fine high-order fringes

## Parameters

- `field_source` — stress_field | crystal_thickness | cellophane_layers | ice_dendrite
- `retardance_scale` — 0–5000 nm (scales thickness → color order)
- `analyzer_angle` — 0°–90° (rotates the whole palette)
- `wave_plate` — none | full | quarter (offsets color order)
- `order` — 1–8 (Michel-Lévy order)

See `docs/math-reference.md` for the physics and `docs/visual-targets.md`
for per-regime defaults.

## Ecosystem Hooks

Shares spectral-color logic with `thin_film_iridescence`, `structural_color`. Pairs with `crystalline`, `minerals`, `op_art_style`. Rainbow-weird.

---

*The color is not painted — it is the physics of light fighting through matter.*
