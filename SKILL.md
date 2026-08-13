---
name: photo-abstract-editorial
description: Use when the user has a photograph and wants a vertical editorial artwork made from it — the untouched photo on top, a sparse photo-derived abstract "memory panel" below on flat ivory, and a short poetic English title. Triggers on "photo plus abstract panel", "abstract editorial diptych", "visual memory panel", "minimalist archival poster from this photo", "distil/abstract this photo", or any request to pair a photo with a restrained abstraction of it without filtering, redrawing, or restyling the source.
---

# Photo Abstract Editorial

Turn one photograph into one finished vertical work: **original photo area + abstract memory panel + poetic English title**. The photo stays faithful. Everything in the panel is derived only from relationships observed in that photo.

This is not a filter, not a photo redraw, not style transfer, not vectorization.

## How this runs in Claude Code

Claude has no raster image generator, so the composition is **authored, not generated**:

1. **Read the photo** with the Read tool — it renders visually. Name the 3–6 decisive spatial facts and pick the mark family. This is the judgment half.
2. **Measure it** — the numbers half. Eyeballing hex values off a rendered image gives you guesses:
   ```
   node scripts/inspect.mjs <photo> [f] [canvasWidth]
   ```
   Prints true dimensions, the canvas arithmetic (`--photo-h`, `--panel-h`) ready to paste, and a palette clustered from real pixels with muted variants. Treat the palette as a **starting point, not a verdict** — it ranks by area, and area is not importance. A large dark sky out-votes the small ember line that gives the photo its meaning; promote by hand when that happens.
3. **Author an HTML file** — the user's photo embedded verbatim (`<img src="file:///…">` pointing at their actual file) in the upper section, the abstract panel below as inline SVG on flat ivory, title set in an editorial serif on the panel.
4. **Render it** to PNG at the composition's exact dimensions:
   ```
   node scripts/render.mjs <input.html> <output.png>
   ```
   (See `references/render-notes.md` for the render script's behaviour and gotchas.)

Both scripts need this machine's Node: `~/.local/bin/node`.

This is stronger than prompting an image model: it is deterministic, editable, versionable, and the photograph is **provably unaltered** — it is the literal file, not a regenerated approximation. Say this to the user once if they ask why it works this way; don't lecture.

## Workflow

**Before anything, read `references/photo-abstract-editorial-prompt.en.md` in full.** SKILL.md is the operating procedure; that file is the specification. (Chinese equivalent: `references/photo-abstract-editorial-prompt.zh-CN.md`.) Then Read one file from `assets/examples/` — finished works by the original author — to set the quality bar before you compose anything.

1. **Inspect.** Read the photo. Internally identify three to six decisive spatial facts — subject relationships, relative scale, axes, direction, intervals, overlap, depth, repetition, rhythm, light, colour roles, negative space. Decide what comes from subject mass and what comes from structure, movement, or emptiness. Do not output an analysis essay; a few lines is plenty.
2. **Measure.** Run `scripts/inspect.mjs` for exact dimensions, the canvas arithmetic, and a pixel-sampled palette. Then edit it down by judgment: one dominant, one dark structural, one light/neutral, at most one or two small accents. Accents must be colours that genuinely exist in the photo — and should usually be the colour the photo is *about*, not the one covering the most area.
3. **Choose proportions.** Adapt photo/panel heights to the source — never a mechanical 50/50. `inspect.mjs` suggests the band from the photo's orientation; pass your own `f` to override. Landscape or strongly horizontal: photo ~38–52% of final height. Vertical architecture, people, tall subjects: ~55–68%. Near-square or balanced centre: ~48–58%. Shift ~8% for overall harmony. Preserve the photo's aspect ratio; never crop hard to force a ratio.
4. **Build the composition.** Copy `references/composition-template.html` to a working file and fill it in. The template encodes the layout rules — canvas arithmetic, direct join, flat ivory, motif box, title placement — and carries the **mark vocabulary**: read that comment block before drawing anything. Marks are tapered filled `<path>` lenses, thick through the middle and pointed at the ends. Uniform-width `<line>`s and straight-sided polygons are what make this read as a diagram instead of a work. One primary mark family, at most two supporting families.
5. **Title it.** One original English title, two to five words, grounded in a visible fact. Faithful, clear, elegant. Place it only on the ivory panel, lower-left or bottom-centred, in a restrained editorial serif, in a dark subject colour drawn from the photo (never pure black). Subtitle only if it adds a new layer.
6. **Render and look.** Run the render script, then **Read the output PNG**. Judge it as an image, not as code.
7. **Run the pre-flight check** below before showing the user anything.
8. **Refine one element at a time.** See below.

## Pre-flight check

Read the rendered PNG and answer these honestly. Any "no" is a fix, not a caveat to mention:

- Does the panel read as **drawn**, or as a chart? Uniform-width lines, straight-sided polygons, evenly spaced identical marks and perfectly regular intervals are the tells.
- Is the join **seamless** — no white line, no gap, no crop, no shadow?
- Is the ivory **completely flat** — no gradient, texture, or tonal drift?
- Can you name the **visual fact behind every mark**? If a mark has no `← FACT`, delete it.
- Are people **single continuous forms with blunt tops**, not spikes, capsules, or heads-plus-bodies?
- Is there still **65–80% quiet space** in the panel?
- Is the title **2–5 words**, on the panel, grounded in something visible — and is it the only text in the image?
- Does it read **first as a minimal composition**, and only second as *this* photograph?

## The refine loop

Never regenerate the whole composition to fix one thing. Each pass:

1. Name the single thing that is wrong ("panel is too tall", "the crowd marks are too even", "title sits too close to the motif").
2. Change **only** that — usually one CSS variable or one SVG group.
3. Save to a new versioned file, don't overwrite: `harbour-v3-panel-shorter.html` / `.png` (subject–version–what-changed).
4. Re-render, Read the PNG, compare.
5. Stop when it reads first as a minimal abstract composition and only on second glance evokes this photo.

Show the user the PNG path each pass and ask what one thing to adjust next.

**Keep only two outputs per photo** — the current best and the strongest runner-up. Delete superseded passes as you go, so the folder ends up holding two images rather than a pile of near-duplicates.

## Guardrails

These are the whole value of the skill. Do not soften or "improve" them.

- The uploaded photo is the **sole content source**. Introduce no other image, scene, object, colour, or symbol.
- Never redraw, extend, replace, retouch, embellish, outpaint, posterize, vectorize, or filter the photo. Only restrained proportional scaling or a slight crop needed for the join.
- The panel background is **flat, continuous, uniform ivory** (`#F3F0E8` or a harmonious neighbour). No gradients, lighting variation, paper texture, grain, noise, glow, shadows, vignettes, bands, seams, stains, fog, fading, scan marks, or compression artefacts. Atmosphere comes only from whitespace, pauses, asymmetry, scale contrast, few marks, restrained colour.
- **Every abstract mark must be traceable to a visual fact in the photo.** No decoration, no invented symmetry, no pattern, no colour, no object added merely to look good. Avoid regularized spacing — let scale and position vary slightly.
- **People are irregular continuous short vertical marks** or gently tapered blocks; head, shoulders and body are one form. Never separate circular heads, limbs, faces, or clothing. Never neat capsule shapes. Rhythm comes from height, width, interval, tilt, overlap.
- **Landmark architecture keeps at most one to three identity cues** — distinctive outer contour, representative negative space, eave line, tapering mass, arch, spire, layered rhythm. No windows, masonry, brackets, carvings, rail patterns, or surface detail.
- One primary mark family, **maximum two** supporting families.
- Palette extracted **only** from the photo, desaturated and reduced. No neon, no unsupported complementaries, no competing accents.
- Join photo and panel **directly** — no frame, border, drop shadow, rounded corner, gap, torn edge, tape, dimensional card, collage artefact, or mockup effect.
- Title on the panel only — never in the photo area, never inside the motif, never lower-right, never on the canvas edge. Editorial serif only: no commercial bold, sans-serif advertising faces, cartoon, exaggerated handwriting, or decorative fonts.
- The finished image carries **no other text** — no commentary, analysis, title options, labels, dates, serial numbers, place descriptions, colour swatches, legends, signatures, logos, or watermarks.
- Preserve the **minimum necessary recognizability**, not the object. The abstraction must not become a thumbnail, tracing, illustration, infographic, or generic icon.

## Tunable parameters

The prompt is a high-quality starting point, not an immutable spec. These are the knobs to reach for during the refine loop:

| Knob | What to change |
|---|---|
| Photo / panel ratio | Height share of each section, canvas ratio, motif size, amount of whitespace |
| Colour | Ivory panel value, saturation of extracted colours, number and bias of dominant vs accent colours |
| Abstract vocabulary | Pick or mix: colour blocks, soft organic masses, arcing or tapered strokes, short bars, stacked bands, simplified architectural masses, fine lines, dot marks |
| Layout & type | Motif position, title position, serif character, title length, subtitle on/off |
| Abstraction level | Slide between "relationships first" and "keep a few identity cues" by subject — a landmark or a small object may earn more recognition cues than a crowd |

Two principles survive every adjustment: the photo is always the only content source and is never rewritten; every important panel element traces to a real spatial, colour, or structural fact in it.

## References

- `references/photo-abstract-editorial-prompt.en.md` — full specification (read this).
- `references/photo-abstract-editorial-prompt.zh-CN.md` — Chinese original.
- `references/composition-template.html` — commented HTML/SVG scaffold, including the **mark vocabulary** (tapered band, arc, figure, hairline axis, scatter, mass) with working path recipes.
- `references/render-notes.md` — render script behaviour.
- `scripts/inspect.mjs` — photo dimensions, canvas arithmetic, pixel-sampled palette.
- `scripts/render.mjs` — HTML → PNG at natural size.
- `assets/examples/` — two **finished works** by the original author. Read one before starting to calibrate the quality bar: how sparse the panel really is, how much whitespace, how small the motif sits, how quiet the title is. Never reuse their subject matter, colours, or composition unless the user supplies that exact image. (Note: several examples carry a small colour-swatch row in a corner. The specification forbids swatches — follow the specification, not that detail.)
- `ATTRIBUTION.md` — original author, licence, port notes.
