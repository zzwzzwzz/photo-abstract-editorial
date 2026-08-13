# Attribution

This skill is a **port**, not an original work.

## Original

- **Author:** @AM. — GitHub [ZzzLc0405](https://github.com/ZzzLc0405)
- **Source repository:** https://github.com/ZzzLc0405/photo-abstract-editorial
- **Original form:** a Codex skill (`SKILL.md` + `agents/openai.yaml` + bilingual prompt references + example photographs), written as an image-generation prompt.
- © 2026 ZzzLc0405. All rights reserved.

The creative substance of this skill — the DECONSTRUCT → SELECTIVE PRESERVATION → ABSTRACT/DISTILL → RECONSTRUCT method, the abstraction rules, the mark system, the adaptive photo/panel proportions, the CLEAN-mode background rules, the title and typography rules, and the example photographs — is entirely @AM.'s.

The two reference prompts in `references/` are reproduced verbatim from the original repository:

- `references/photo-abstract-editorial-prompt.en.md`
- `references/photo-abstract-editorial-prompt.zh-CN.md`

The examples in `assets/examples/` are finished works by @AM. (photographs shot by the author, composed with this method). They are reference outputs for calibrating the quality bar — never reuse their subject matter, colours, or composition unless the user supplies that exact image.

## Licence

Free for personal, educational, research, and non-commercial use.

Commercial use — commercial products or services, paid or client projects, enterprise applications, commercial AI agents or workflows, paid courses or knowledge products, resale, sublicensing, or commercial redistribution of the skill in modified or repackaged form — **requires prior authorization from the author.**

Attribution is appreciated. If you publish anything made with this, credit the repository and tag **@AM.**

## What this port changed

Claude Code has no native raster image generation, so the port replaces the "prompt an image model" execution path with an authored, deterministic one:

- Claude reads the photograph with the Read tool and performs the inspection step itself, sampling real hex values.
- Claude authors an HTML file: the user's photograph embedded verbatim above, the abstract panel below as inline SVG on flat ivory, title in an editorial serif.
- A headless render script screenshots that HTML to PNG at the composition's exact dimensions.

Consequences: the output is editable, diffable, and versionable, and the photograph is provably unaltered because it is the literal source file rather than a regenerated approximation.

Also changed:

- `agents/openai.yaml` (Codex interface metadata) dropped — no Claude equivalent.
- Codex install instructions from the README dropped.
- Frontmatter `description` rewritten for Claude's skill-triggering conventions.
- Added: `references/composition-template.html`, `scripts/render.mjs`, `references/render-notes.md`, and an explicit render → inspect → adjust-one-thing → re-render iteration loop.
- The "freely adjustable parameters" guidance from the Chinese README is translated into the *Tunable parameters* section of `SKILL.md`.

No constraint from the original was removed, softened, or reworded away.
