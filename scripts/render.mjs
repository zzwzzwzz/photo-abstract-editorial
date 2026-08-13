#!/usr/bin/env node
/**
 * Render a local HTML composition to a PNG at its natural (unclipped) content size.
 *
 * Usage:
 *   node scripts/render.mjs <input.html> <output.png> [scale]
 *
 *   input.html  - path to a local HTML file. <img src="..."> may be relative,
 *                 file://, or absolute; the page is navigated to via a
 *                 file:// URL so relative paths resolve the same way they
 *                 would if you opened the file directly in a browser.
 *   output.png  - path to write the PNG to (parent dir must exist).
 *   scale       - optional device scale factor for retina output. Default 2.
 *
 * See ../references/render-notes.md for the runtime this resolves to on this
 * machine and known gotchas.
 */

import { chromium } from '/Users/zz/Storybook/node_modules/playwright/index.mjs';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Generous probe viewport used only to lay the page out before we measure its
// true content size. Must be wide/tall enough that nothing in the design is
// being squeezed, wrapped, or clipped by it. If a composition legitimately
// needs to be wider than this, raise PROBE_WIDTH.
const PROBE_WIDTH = 2400;
const PROBE_HEIGHT = 2000;

function fail(message) {
  console.error(`[render.mjs] ERROR: ${message}`);
  process.exitCode = 1;
  const err = new Error(message);
  err.__reported = true;
  throw err;
}

async function main() {
  const [, , inputArg, outputArg, scaleArg] = process.argv;

  if (!inputArg || !outputArg) {
    fail('Usage: node scripts/render.mjs <input.html> <output.png> [scale=2]');
  }

  const inputPath = path.resolve(process.cwd(), inputArg);
  const outputPath = path.resolve(process.cwd(), outputArg);
  const scale = scaleArg !== undefined ? Number(scaleArg) : 2;

  if (!Number.isFinite(scale) || scale <= 0) {
    fail(`Invalid scale factor: "${scaleArg}"`);
  }

  if (!existsSync(inputPath) || !statSync(inputPath).isFile()) {
    fail(`Input HTML not found: ${inputPath}`);
  }

  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      viewport: { width: PROBE_WIDTH, height: PROBE_HEIGHT },
      deviceScaleFactor: scale,
    });
    const page = await context.newPage();

    const jsIssues = [];
    page.on('pageerror', (err) => jsIssues.push(String(err.message || err)));
    page.on('console', (msg) => {
      if (msg.type() === 'error') jsIssues.push(msg.text());
    });

    const fileUrl = pathToFileURL(inputPath).href;
    await page.goto(fileUrl, { waitUntil: 'networkidle' });

    // Web-safe/system fonts only (no network font fetches): wait for
    // whatever local @font-face / system fonts the page declares to finish
    // resolving before we measure or shoot, so text metrics are final.
    await page.evaluate(() => document.fonts.ready);

    // Wait for every <img> (including the local photo) to finish loading
    // AND decoding. Do this via explicit DOM checks, not a blind timeout,
    // and surface exactly which src failed rather than shipping a silent
    // blank/broken PNG.
    const imageStatus = await page.evaluate(async () => {
      const imgs = Array.from(document.images);
      return Promise.all(
        imgs.map(async (img) => {
          const src = img.currentSrc || img.getAttribute('src') || '(no src)';
          try {
            if (!img.complete) {
              await new Promise((resolve, reject) => {
                img.addEventListener('load', resolve, { once: true });
                img.addEventListener('error', () => reject(new Error('error event')), { once: true });
              });
            }
            if (img.decode) await img.decode();
            return { src, ok: img.naturalWidth > 0 && img.naturalHeight > 0 };
          } catch (e) {
            return { src, ok: false, error: String(e && e.message ? e.message : e) };
          }
        })
      );
    });

    const failedImages = imageStatus.filter((r) => !r.ok);
    if (failedImages.length > 0) {
      const detail = failedImages
        .map((f) => `  - ${f.src}${f.error ? ` (${f.error})` : ' (zero natural size)'}`)
        .join('\n');
      fail(`${failedImages.length} image(s) failed to load — refusing to write a broken PNG:\n${detail}`);
    }

    // Measure natural content size. NOTE: document.documentElement.scrollWidth
    // /scrollHeight is NOT usable here — <html> always stretches to fill at
    // least the viewport, so it silently reports PROBE_WIDTH x PROBE_HEIGHT
    // instead of the design's real size when the content is smaller than the
    // probe. Instead, take the bounding-box union of body's direct children:
    // those report their own CSS-declared/content-driven size regardless of
    // how large the probe viewport is. Avoid vh/vw units in the composition's
    // root sizing — they'd resolve against the probe box, not a natural size.
    const { width, height } = await page.evaluate(() => {
      const children = Array.from(document.body.children).filter((el) => {
        const cs = getComputedStyle(el);
        return cs.display !== 'none' && cs.visibility !== 'hidden';
      });
      let maxRight = 0;
      let maxBottom = 0;
      for (const el of children) {
        const r = el.getBoundingClientRect();
        maxRight = Math.max(maxRight, r.right);
        maxBottom = Math.max(maxBottom, r.bottom);
      }
      if (children.length === 0 || (maxRight === 0 && maxBottom === 0)) {
        const r = document.body.getBoundingClientRect();
        maxRight = r.width;
        maxBottom = r.height;
      }
      return { width: Math.ceil(maxRight), height: Math.ceil(maxBottom) };
    });

    if (width <= 0 || height <= 0) {
      fail(`Measured page size is invalid (${width}x${height}) — is the HTML empty?`);
    }

    // Resize the real viewport to exactly the content box so the screenshot
    // has no scrollbars and no fullPage stitching artifacts, then shoot.
    await page.setViewportSize({ width, height });
    await page.evaluate(() => document.fonts.ready);

    await page.screenshot({ path: outputPath, fullPage: false });

    if (jsIssues.length > 0) {
      console.warn(`[render.mjs] Note: ${jsIssues.length} console error(s)/JS error(s) during render (image still written):`);
      for (const issue of jsIssues) console.warn(`  - ${issue}`);
    }

    console.log(`[render.mjs] Wrote ${outputPath} (${width}x${height} @${scale}x)`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  if (!process.exitCode) process.exitCode = 1;
  // fail() already printed a clean "[render.mjs] ERROR: ..." line for
  // expected failures (missing file, bad image, etc). Only print again here
  // for genuinely unexpected exceptions (e.g. a Playwright/browser crash).
  if (!err || !err.__reported) {
    console.error(`[render.mjs] ERROR: ${(err && err.stack) || err}`);
  }
  process.exit(process.exitCode);
});
