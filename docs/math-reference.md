# Math Reference

## Core Equations

**Retardance**
```
Γ = thickness · Δn
```
`Γ` (nanometers) is the optical path difference between the fast and slow
polarization axes induced by the material. `Δn` is the birefringence
(difference in refractive index between the two axes); `thickness` is the
physical path length through the material.

**Michel-Lévy spectral interference**
```
I(λ) = sin²(π · Γ / λ)
```
Transmitted intensity per wavelength. Zero when `Γ = m·λ` (integer order),
maximum when `Γ = (m + 0.5)·λ`. The visible color is this function summed
across the spectrum, weighted by the CIE color-matching functions, and
converted to RGB.

**Crossed polarizers**
```
transmitted = sin²(π · Γ / λ) · sin²(2θ)
```
Background is black; only retarded light leaks through. `θ` is the angle
between the retarder's fast axis and the polarizer — this project assumes
`θ = 45°` (maximum transmission) for the base field.

**Analyzer rotation**
```
I(λ, φ) = sin²(π · Γ / λ) · sin²(2(θ - φ))
```
Rotating the analyzer changes the effective retardance and is the
interactive centerpiece of the simulation: `φ` from 0° to 90° cycles
through the entire Michel-Lévy color sequence. Implemented as a phase shift
added to `Γ` before the LUT lookup, with a transmission envelope
(`sin(2·(45° − |45° − φ|))`) that dims toward extinction at 0°/90°.

**Wave plates**
```
Γ_effective = Γ + offset
```
A full-wave plate (`offset = 550nm`, the classic 1st-order-red tint plate)
or quarter-wave plate (`offset = 275nm`) shifts the color order — first-
order red becomes second-order blue.

**Spectral sum → RGB**
Sample the visible spectrum at `N = 64` points from 380nm–780nm, compute
`I(λ)` at each, weight by the CIE 1931 2° color-matching functions
(analytic Gaussian-sum fit, Wyman/Sloan/Shirley 2013), integrate to XYZ,
normalize by the integral of ȳ(λ), and convert XYZ → linear sRGB with the
D65 matrix, then apply the sRGB gamma curve.

## Shader Snippets

The spectral sum (`src/js/michel-levy.js`) is computed once on the CPU and
baked into a 1024×1 LUT texture spanning `Γ ∈ [0, 5500nm]` (~order 8). The
GPU pipeline then only needs:

```glsl
// retardance.frag
float gamma = getThickness(uv, time) * u_retardanceScale * u_order;

// interference.frag
float gammaEff = gamma + plateOffset + analyzerShift;
vec3 color = texture(u_lut, vec2(gammaEff / u_maxRetardance, 0.5)).rgb;
color *= crossedPolarizerEnvelope;
```

## References

- Michel-Lévy & Lacroix interference color chart (classic petrographic
  reference for birefringence under crossed polars).
- Wyman, C., Sloan, P.-P., & Shirley, P. (2013). *Simple Analytic
  Approximations to the CIE XYZ Color Matching Functions*. JCGT 2(2).
- Standard photoelasticity stress-optic law: `σ₁ − σ₂ ∝ Γ`.
