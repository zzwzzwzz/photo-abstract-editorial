# Render notes — scripts/render.mjs

## Command

```
node scripts/render.mjs <input.html> <output.png> [scale]
```

- `input.html` — local HTML file. `<img src="...">` may be relative, `file://`, or absolute;
  the page is navigated to via a `file://` URL so relative paths resolve exactly like opening
  the file directly in a browser.
- `output.png` — where to write the PNG (parent dir must already exist).
- `scale` — optional device scale factor for retina output. Default `2`.

Verified on this machine:

```
~/.local/bin/node scripts/render.mjs test.html out.png       # -> 900x1728 @2x = 1800x3456 PNG
~/.local/bin/node scripts/render.mjs test.html out-1x.png 1  # -> 900x1728 @1x =  900x1728 PNG
```

## Runtime this resolved to

- Node: manually installed at `~/.local/opt/node-v24.16.0-darwin-arm64` (symlinked from
  `~/.local/bin/node`). Not on PATH by default in every shell — invoke it by full path if
  `node` isn't found.
- Browser: Playwright (not Puppeteer) — imported directly from
  `~/Storybook/node_modules/playwright/index.mjs` (absolute path, no local npm install needed).
  Playwright package version 1.61.1.
- Chromium binary: resolved automatically from Playwright's default browser cache,
  `~/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app`.
  No `PLAYWRIGHT_BROWSERS_PATH` override needed — this cache dir is Playwright's default location
  on macOS and `chromium.launch()` found it with zero config. (A `chromium_headless_shell-1228`
  build also exists in that cache but was not needed; the full Chrome-for-Testing build worked
  directly.)

## Gotchas hit and how they're handled

1. **`document.documentElement.scrollWidth/scrollHeight` lies about "natural size."**
   `<html>` always stretches to fill at least the viewport, so measuring it against a large
   probe viewport (used to avoid squeezing the layout before measuring) just reports the probe
   viewport's own dimensions back, not the content's real size. First attempt at this script
   wrote a 2400x2000 PNG that was really a giant blank canvas around a 900px-wide design.
   **Fix:** measure the bounding-box union of `document.body`'s direct children instead — those
   report their own CSS-declared/content-driven size regardless of how large the probe viewport
   is. Then resize the real viewport to exactly that box and shoot with `fullPage: false` (no
   scrollbars, no fullPage-stitching artifacts).
   - Corollary for skill authors: avoid `vh`/`vw` units on the composition's root sizing — they
     resolve against the 2400x2000 probe box in `render.mjs`, not a "natural" size. Use fixed
     `px` widths (e.g. `width: 900px` on the outer wrapper) instead.

2. **Local image loading must be verified by decode, not just `load`.** The script waits for
   `document.fonts.ready`, then for every `<img>` to be `.complete` **and** successfully
   `.decode()`s with non-zero `naturalWidth`/`naturalHeight`. If any image fails (bad path, 404,
   corrupt file), the script exits 1 with the exact failing `src` printed and **never calls
   `page.screenshot()`** — no silent blank/broken PNG gets written. Verified via a deliberately
   broken `<img src="does-not-exist.jpg">` test: script exits 1, prints
   `1 image(s) failed to load — refusing to write a broken PNG: ... (The source image cannot be
   decoded.)`, and produces no output file.

3. **Missing input file is checked before the browser even launches** — a clear
   `Input HTML not found: <path>` error with exit code 1, no browser overhead wasted.

4. **Fonts must be web-safe/system serif only (no network fetches, must work offline).**
   `render.mjs` itself doesn't fetch anything — it just calls `document.fonts.ready`. It's on the
   HTML author to only reference system fonts (e.g. `Georgia, "Times New Roman", serif`) or a
   locally committed `@font-face` `.woff2`, never a CDN `<link>` or `@import` — Chromium will
   silently fall back and you won't notice until the PNG is wrong. `waitUntil: 'networkidle'` in
   this script does NOT guarantee a CDN font finished (fonts can resolve after network goes
   idle), so don't rely on this script to catch that class of bug — it's a source-HTML
   discipline issue, not something `render.mjs` can detect for you.

5. **Inline SVG needs no special waiting** — it's parsed synchronously as part of the DOM, so it
   was already present by the time the images/fonts wait resolved. Confirmed visually in the
   test render (three verticals, a circle, and an arc all rendered crisply).

## Changing the scale factor

Third CLI arg, e.g. `node scripts/render.mjs input.html output.png 3` for 3x. Must be a positive
number; anything else exits 1 with `Invalid scale factor: "..."`.

## If it breaks on another machine

- `chromium.launch()` throwing "executable doesn't exist": Playwright's browser cache moved or
  was never downloaded. Check `~/Library/Caches/ms-playwright/` for a `chromium-<rev>` folder
  matching the Playwright version in `~/Storybook/node_modules/playwright/package.json`. If
  missing, run `node ~/Storybook/node_modules/playwright/cli.js install chromium` (or point
  `PLAYWRIGHT_BROWSERS_PATH` at wherever the browsers actually live).
- If `~/Storybook/node_modules/playwright` no longer exists at that path, update the import at
  the top of `render.mjs` (`import { chromium } from '<path>/playwright/index.mjs'`) to wherever
  a Playwright install is actually available on that machine.
- If `~/.local/bin/node` doesn't exist, use whatever `node` is on PATH — this script has no
  Node-version-specific syntax beyond stable ESM (`import`, top-level `await` inside `main()`),
  works on any reasonably recent Node (18+).
- If output PNG looks cropped/oversized again, it's almost certainly gotcha #1 above — check the
  composition HTML doesn't use `vh`/`vw`/`100%`-of-viewport sizing on its root element.

## Also verified against the real `composition-template.html`

Filled in a copy of `references/composition-template.html` with real photo path, colors,
motif box, and title, and rendered it. Measured output was exactly `--photo-h` + `--panel-h`
(2520 CSS px, 700 wide) with no viewport bleed — confirms the body-children bounding-box
measurement (gotcha #1) works correctly against the template's real two-child (`.photo` +
`.panel`) structure, not just the simplified smoke-test HTML. Motif SVG, palette colors, and
the serif title in the `.title-block` (lower-left layout) all rendered at the correct
percentage-based positions.

## Test artifacts (throwaway, not checked in)

Built and visually verified in
`/private/tmp/claude-501/-Users-zz-zzclaude/7524fa6c-c10a-4ce8-9616-75567c803c19/scratchpad/render-test/`:
a vertical page with a local JPG on top, a flat `#f3ede1` ivory panel below with inline SVG marks
(three verticals, a circle, an arc) and a Georgia serif title + italic subtitle. Rendered PNG
confirmed by eye: photo displayed at full resolution (not a broken-image box), panel is flat with
no gradient/texture, SVG marks are crisp, and title/subtitle render at correct proportions and
position. Note: the sample images in `assets/examples/` in this skill are themselves *finished
example compositions* (already have a title/panel baked in), not blank source photos — that's
expected and doesn't affect the render pipeline, it's just why the test screenshot shows two
stacked panels (the example's pre-existing one, plus the test-authored one from this script).
