#!/usr/bin/env node
/**
 * Inspect a source photograph: true dimensions, canvas arithmetic, and a
 * palette actually sampled from its pixels.
 *
 * Usage:
 *   node scripts/inspect.mjs <photo> [f] [canvasWidth]
 *
 *   photo        - path to the user's source photograph.
 *   f            - optional target photo share of final height (0.30–0.75).
 *                  Omit to use the midpoint of the band suggested for this
 *                  photo's orientation.
 *   canvasWidth  - optional render width in px. Default 1400.
 *
 * Why this exists: reading a photo visually gives you eyeballed colours and a
 * guessed aspect ratio. The composition template needs exact numbers — the
 * photo's natural size drives --photo-h, and --panel-h is derived from it.
 * This prints values you paste straight into the template.
 *
 * The palette is a STARTING POINT, not a verdict. It reports what is
 * numerically dominant, which is not always what the photograph is *about* —
 * a large dark sky will out-vote the small ember line that gives the image its
 * meaning. Read the photo yourself and override any role that is wrong.
 *
 * No npm install: reuses the same Playwright/Chromium the renderer uses, and
 * feeds the image in as a data: URI so the canvas is never tainted.
 */

import { chromium } from '/Users/zz/Storybook/node_modules/playwright/index.mjs';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const CANVAS_WIDTH_DEFAULT = 1400;

// Long edge the photo is downsampled to before pixel counting. Small enough to
// be fast, large enough that a meaningful-but-small region (an ember line, a
// lit window) still contributes enough pixels to survive clustering.
const SAMPLE_EDGE = 240;

const MIME = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif',
  '.bmp': 'image/bmp', '.tif': 'image/tiff', '.tiff': 'image/tiff',
};

function fail(message) {
  console.error(`[inspect.mjs] ERROR: ${message}`);
  process.exit(1);
}

/** f bands from the specification, keyed by what the photo actually is. */
function bandFor(aspect) {
  if (aspect >= 1.2) {
    return { name: 'landscape / strong horizontal spread', lo: 0.38, hi: 0.52 };
  }
  if (aspect <= 0.85) {
    return { name: 'vertical architecture / people / tall subject', lo: 0.55, hi: 0.68 };
  }
  return { name: 'near-square / balanced visual centre', lo: 0.48, hi: 0.58 };
}

const hex = ({ r, g, b }) =>
  '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0').toUpperCase()).join('');

function rgbToHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h, s, l };
}

function hslToRgb({ h, s, l }) {
  if (s === 0) return { r: l * 255, g: l * 255, b: l * 255 };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return { r: f(h + 1 / 3) * 255, g: f(h) * 255, b: f(h - 1 / 3) * 255 };
}

/**
 * "Extract, then lower saturation and reduce" — the muted variant is what
 * belongs on the ivory panel. Raw sampled colour is usually too hot to sit
 * next to #F3F0E8 without shouting.
 */
function mute(rgb) {
  const { h, s, l } = rgbToHsl(rgb);
  return hslToRgb({
    h,
    s: s * 0.66,
    // Pull extremes toward the middle so nothing reads as pure black or blown white.
    l: Math.min(0.82, Math.max(0.16, l * 0.92 + 0.05)),
  });
}

const dist = (a, b) => Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);

/** Bucket, count, then greedily merge nearby buckets into clusters. */
function cluster(pixels, mergeRadius = 46) {
  const buckets = new Map();
  for (const p of pixels) {
    // 5 bits per channel: fine enough to keep distinct colours apart, coarse
    // enough that photographic noise collapses instead of fragmenting.
    const key = ((p.r >> 3) << 10) | ((p.g >> 3) << 5) | (p.b >> 3);
    let acc = buckets.get(key);
    if (!acc) buckets.set(key, (acc = { r: 0, g: 0, b: 0, n: 0 }));
    acc.r += p.r; acc.g += p.g; acc.b += p.b; acc.n++;
  }

  const seeds = [...buckets.values()]
    .map((a) => ({ r: a.r / a.n, g: a.g / a.n, b: a.b / a.n, n: a.n }))
    .sort((a, b) => b.n - a.n);

  const clusters = [];
  for (const seed of seeds) {
    const near = clusters.find((c) => dist(c, seed) < mergeRadius);
    if (near) {
      const total = near.n + seed.n;
      near.r = (near.r * near.n + seed.r * seed.n) / total;
      near.g = (near.g * near.n + seed.g * seed.n) / total;
      near.b = (near.b * near.n + seed.b * seed.n) / total;
      near.n = total;
    } else {
      clusters.push({ ...seed });
    }
  }
  return clusters.sort((a, b) => b.n - a.n);
}

/**
 * Assign the four template roles. Deliberately does NOT just take the top four
 * by area: --structural wants the darkest mass, --neutral the lightest, and
 * --accent the most saturated *small* region, which is usually the thing that
 * made the photo worth taking.
 */
function assignRoles(clusters, totalPixels) {
  const withMeta = clusters.map((c) => {
    const { h, s, l } = rgbToHsl(c);
    return { ...c, h, s, l, share: c.n / totalPixels };
  });

  const used = new Set();
  const take = (pick) => {
    const found = pick(withMeta.filter((c) => !used.has(c)));
    if (found) used.add(found);
    return found;
  };

  const dominant = take((cs) => cs[0]);
  const structural = take((cs) => [...cs].sort((a, b) => a.l - b.l)[0]);
  const neutral = take((cs) => [...cs].sort((a, b) => b.l - a.l)[0]);
  // Accent: most saturated cluster holding a genuinely small share. If nothing
  // qualifies, the photo has not earned an accent — the template says delete it.
  const accent = take((cs) =>
    [...cs].filter((c) => c.share < 0.22 && c.s > 0.25).sort((a, b) => b.s - a.s)[0]
  );

  return { dominant, structural, neutral, accent };
}

async function main() {
  const [, , photoArg, fArg, widthArg] = process.argv;
  if (!photoArg) fail('Usage: node scripts/inspect.mjs <photo> [f] [canvasWidth]');

  const photoPath = path.resolve(process.cwd(), photoArg);
  if (!existsSync(photoPath) || !statSync(photoPath).isFile()) {
    fail(`Photo not found: ${photoPath}`);
  }

  const ext = path.extname(photoPath).toLowerCase();
  const mime = MIME[ext];
  if (!mime) {
    fail(`Unsupported image type "${ext}". Supported: ${Object.keys(MIME).join(', ')}`);
  }

  const canvasW = widthArg !== undefined ? Number(widthArg) : CANVAS_WIDTH_DEFAULT;
  if (!Number.isFinite(canvasW) || canvasW <= 0) fail(`Invalid canvasWidth: "${widthArg}"`);

  const dataUri = `data:${mime};base64,${readFileSync(photoPath).toString('base64')}`;

  const browser = await chromium.launch();
  let probe;
  try {
    const page = await browser.newPage();
    // data: URI keeps the canvas untainted, so getImageData works without
    // launching Chromium with --allow-file-access-from-files.
    await page.setContent(`<body style="margin:0"><img id="p" src="${dataUri}"></body>`);
    probe = await page.evaluate(async (edge) => {
      const img = document.getElementById('p');
      if (!img.complete) {
        await new Promise((res, rej) => {
          img.addEventListener('load', res, { once: true });
          img.addEventListener('error', () => rej(new Error('decode failed')), { once: true });
        });
      }
      await img.decode();
      const W = img.naturalWidth, H = img.naturalHeight;
      if (!W || !H) throw new Error('image reported zero natural size');

      const scale = Math.min(1, edge / Math.max(W, H));
      const cw = Math.max(1, Math.round(W * scale));
      const ch = Math.max(1, Math.round(H * scale));
      const cv = document.createElement('canvas');
      cv.width = cw; cv.height = ch;
      const ctx = cv.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, cw, ch);
      const { data } = ctx.getImageData(0, 0, cw, ch);

      const pixels = [];
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 128) continue; // skip transparent
        pixels.push({ r: data[i], g: data[i + 1], b: data[i + 2] });
      }
      return { W, H, pixels };
    }, SAMPLE_EDGE);
  } catch (err) {
    fail(`Could not read the photo: ${(err && err.message) || err}`);
  } finally {
    await browser.close();
  }

  const { W, H, pixels } = probe;
  if (!pixels.length) fail('Photo contained no opaque pixels to sample.');

  const aspect = W / H;
  const band = bandFor(aspect);
  const f = fArg !== undefined ? Number(fArg) : (band.lo + band.hi) / 2;
  if (!Number.isFinite(f) || f <= 0.05 || f >= 0.95) fail(`Invalid f: "${fArg}"`);

  const photoH = canvasW / aspect;
  const panelH = photoH * (1 - f) / f;

  const clusters = cluster(pixels).slice(0, 8);
  const roles = assignRoles(clusters, pixels.length);

  const fmtRole = (name, c) => {
    if (!c) return `  --${name.padEnd(10)} (none — photo has not earned one; delete the variable)`;
    const m = mute(c);
    return `  --${name.padEnd(10)} ${hex(m)}   (raw ${hex(c)}, ${(c.share * 100).toFixed(1)}% of pixels)`;
  };

  console.log(`
[inspect.mjs] ${path.basename(photoPath)}

DIMENSIONS
  natural        ${W} x ${H}px
  aspect (W/H)   ${aspect.toFixed(4)}
  reads as       ${band.name}

CANVAS ARITHMETIC  (canvas width ${canvasW}px, f = ${f.toFixed(3)} of band ${band.lo}–${band.hi})
  --canvas-w     ${canvasW}px
  --photo-h      ${Math.round(photoH)}px
  --panel-h      ${Math.round(panelH)}px
  final canvas   ${canvasW} x ${Math.round(photoH + panelH)}px
  photo share    ${(photoH / (photoH + panelH) * 100).toFixed(1)}%

PALETTE  (muted values are the ones to paste; raw is what was sampled)
${fmtRole('dominant', roles.dominant)}
${fmtRole('structural', roles.structural)}
${fmtRole('neutral', roles.neutral)}
${fmtRole('accent', roles.accent)}

ALL CLUSTERS BY AREA
${clusters.map((c) => {
  const { s } = rgbToHsl(c);
  return `  ${hex(c)}  ${(c.n / pixels.length * 100).toFixed(1).padStart(5)}%  sat ${(s * 100).toFixed(0).padStart(3)}%  -> muted ${hex(mute(c))}`;
}).join('\n')}

Numbers are a starting point. Area is not importance — if the meaning of this
photo lives in a small bright region, promote it by hand and demote whatever
merely covers the most ground.
`);
}

main().catch((err) => fail((err && err.stack) || String(err)));
