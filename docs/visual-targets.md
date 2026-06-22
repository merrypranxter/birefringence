# Visual Targets

## Aesthetic Regimes

**photoelastic_stress** (`field_source: stress_field`)
Stressed bracket / crack on a black crossed-polarizer field. Stress
concentrates near point loads (1/r falloff), producing concentric rainbow
fringe rings that climb the Michel-Lévy order scale toward the load points —
the engineering-photograph look. Defaults: `retardance_scale: 900nm`,
`order: 2`.

**mineral_thin_section** (`field_source: crystal_thickness`)
Random Voronoi crystalline domains, each a flat constant color with sharp
boundaries — a geology slide under crossed polars. Defaults:
`retardance_scale: 1200nm`, `order: 3`.

**cellophane_mondrian** (`field_source: cellophane_layers`)
Flat stacked rectangles/circles, each adding a fixed retardance increment;
overlaps stack. Auto-rotating analyzer cycles the whole palette — a Mondrian
that breathes. Defaults: `retardance_scale: 900nm`, `order: 1`,
`auto-rotate: on`.

**sugar_crystal** (`field_source: ice_dendrite`)
Radial dendritic growth from a center, thickness increasing with radius —
fine, high-order pastel fringes, like a sugar/frost crystal under a
microscope. Defaults: `retardance_scale: 3000nm`, `order: 8`.

## Output Checklist

- [x] stress_field engine renders (photoelastic fringes)
- [x] crystal_thickness engine renders (Voronoi domains)
- [x] cellophane_layers engine renders (stacked shapes)
- [x] ice_dendrite engine renders (radial dendrite)
- [x] Post-finisher applies (bloom + specular + optional stylize)
- [x] Parameters are interactive (field, retardance, order, analyzer angle,
      auto-rotate, wave plate, source mix, bloom, specular, stylize, palette)
- [x] u_source bonus: image upload and webcam both push luminance through
      the retardance field
