# Photo Abstract Editorial — Claude Code port

A fork of [ZzzLc0405/photo-abstract-editorial](https://github.com/ZzzLc0405/photo-abstract-editorial) by **@AM.**, ported from a Codex skill to a working Claude Code skill.

Turns one photograph into a vertical editorial work: **the untouched photo on top, a sparse photo-derived abstract panel below on flat ivory, and a short English title.** It keeps the photograph's real content and distils only its spatial relationships, compositional rhythm and colour relationships from the photo itself. It is not a filter, not a photo redraw, and not style transfer.

The complete prompt is included in both Chinese and English.

---

## Why the port needed more than a rename

The original is an image-generation prompt. **Claude Code has no raster image generator**, so a straight copy would have had nothing to execute. This fork gives it a real pipeline:

```
Read the photo  →  measure it  →  author HTML + inline SVG  →  headless-render to PNG
```

The photo is embedded as the literal file and never touched, so it is **provably unaltered** — not a regenerated approximation. The panel is vector: crisp at any size, and every mark is an editable line of code.

## What changed

| | |
|---|---|
| **Execution pipeline** | Added `scripts/render.mjs` — HTML → PNG at natural size. Reuses local Playwright/Chromium; no npm install. Refuses to write a broken PNG if an image fails to load. |
| **Measurement** | Added `scripts/inspect.mjs` — true dimensions, paste-ready canvas arithmetic, and a palette clustered from real pixels. The original said "extract colours" with no method, which meant eyeballed guesses. |
| **Mark vocabulary** | The biggest fix. The reference works use **tapered lenticular paths** — thick through the middle, pointed at the ends. Added six copy-paste path recipes plus weight guidance. Uniform-width `<line>`s were what made early attempts read as charts instead of artwork. |
| **Composition template** | `references/composition-template.html` — scaffold that derives the photo/panel ratio from the photo's own aspect ratio, so a mechanical 50/50 split is structurally unreachable. Every SVG group carries a `← FACT:` comment slot. |
| **Pre-flight check** | Eight concrete questions asked against the rendered PNG before anything is shown. |
| **Removed** | `agents/openai.yaml`, the Codex install instructions, and 5 of the 7 example images. |
| **Guardrails** | Unchanged in substance — merged the compressed SKILL.md bullets with the harder constraints that existed only in the full prompt. Nothing softened. |

Two details worth knowing:

- **`assets/examples/` are finished works, not input photos.** The original called them "visual input examples"; pointing the template at one produces a double panel.
- **The examples contradict their own spec** — several carry a colour-swatch row that section 11 explicitly forbids. This fork follows the spec.

## Install

```bash
git clone <this-repo> ~/.claude/skills/photo-abstract-editorial
```

Requires Node and Playwright. Paths are currently hardcoded for one machine — see `references/render-notes.md` to repoint them.

## Use

Give Claude a photo and ask for a photo-plus-abstract-panel editorial work. Then refine **one element at a time** — one variable or one SVG group per pass, re-render, look. Only the best two outputs are kept per photo.

```bash
node scripts/inspect.mjs photo.jpg          # dimensions, arithmetic, palette
node scripts/render.mjs work.html work.png  # render
```

You can also read `references/photo-abstract-editorial-prompt.en.md` (or the `.zh-CN` version) and use it directly as an image-generation prompt, which is how the original was meant to be used.

## What you can tune

Treat the prompt as a high-quality starting point, not an immutable spec. Adjust these to your own taste and project:

- **Photo / panel ratio** — height share of each section, canvas ratio, motif size, amount of whitespace.
- **Colour** — the ivory panel value, saturation of the extracted colours, and the number and bias of dominant vs accent colours.
- **Abstract form** — pick or mix colour blocks, soft organic masses, arcing strokes, short bars, stacked bands, simplified architectural masses, fine lines, dot marks.
- **Layout & type** — motif position, title position, typographic character, title length, subtitle on or off.
- **Degree of abstraction** — slide between "relationships first" and "keep a few identity cues" by subject; a landmark or a small object may earn more recognition cues than a crowd.

Two principles should survive every adjustment:

1. The uploaded photo is always the only content source, and its area is never redrawn, extended or rewritten.
2. Every important element in the abstract panel traces back to a real spatial, colour or structural fact in that photo.

## Structure

```text
photo-abstract-editorial/
├── SKILL.md                         # workflow, guardrails, pre-flight check
├── references/
│   ├── photo-abstract-editorial-prompt.zh-CN.md   # the original spec
│   ├── photo-abstract-editorial-prompt.en.md
│   ├── composition-template.html    # scaffold + mark vocabulary
│   └── render-notes.md
├── scripts/
│   ├── inspect.mjs                  # dimensions, arithmetic, palette
│   └── render.mjs                   # HTML -> PNG
├── assets/examples/                 # 2 finished works by the original author
└── examples/                        # 2 outputs per source, re-renderable
```

Images in `assets/examples` show the expected output quality only. Do not reuse their subject matter, colours or composition for new work unless the user supplies that exact image.

## Examples

Two outputs per source, in `examples/` — each `.html` is the editable source and re-renders from the bundled photo.

| | |
|---|---|
| `cat-v3` / `cat-v4` | v3 redrew the subject mark (it read as a rectangle, not a head); v4 gathered the motif so the arcs read as one form. |
| `bridge-v4` / `bridge-v5` | v4 flattened the banks so the arch is the only curve; v5 darkened the reflection so the mirror reads. |

## Attribution

Original skill and prompt by **@AM.** ([ZzzLc0405](https://github.com/ZzzLc0405)). Sample photographs in `assets/examples` were taken by the original author.

Free for personal, educational and non-commercial use. Commercial use requires prior authorization. If you build something with these skills, attribution to @AM. is greatly appreciated. See `LICENSE.md` and `ATTRIBUTION.md`.

The prompt is the original author's work. This fork changes only how it is executed.
