# Raqeb marketing site

Premium marketing homepage for **Raqeb** (رقيب), in English and Arabic.

- **English:** `index.html` (`lang="en"`, LTR)
- **Arabic:** `ar.html` (`lang="ar"`, `dir="rtl"`, natural Arabic, mirrored layout)

Both are single self contained files: inline CSS and JS, no build step, no dependencies,
no server. Open either one in a browser and it runs. The language switch in the header
moves between them, so keep the two files side by side in the same folder.

- **Start here if you are resuming work:** [`HANDOFF.md`](./HANDOFF.md).
- **Live preview:** https://claude.ai/code/artifact/cc4453b2-e00d-4d5e-b914-be14597b6b91

## Rules that are not negotiable

1. No em dash and no en dash anywhere. Check: `grep -c $'—\|–' index.html ar.html` must
   return 0 for both files.
2. The brand is "Raqeb", one e. Never "Raqeeb". Arabic is رقيب.
3. No "sample data" or demo disclaimers on the page. It must read as a real product.
4. No fake logos, testimonials, statistics, awards or certifications.
5. Fictional figures must reconcile, and they must reconcile identically across the two
   languages. Change one number, recheck its totals on both pages.
6. Arabic is a translation of the product, not of the English sentences. Numerals stay
   Western (1, 2, 3), currency and dates follow the Arabic convention already in the file.

## Layout

    index.html      the English deliverable, source of truth
    ar.html         the Arabic deliverable, RTL parity with index.html
    HANDOFF.md      full state, decisions, open questions
    build/          the parts index.html was assembled from (currently behind index.html)
    brand/          official RAQEB wordmark and Q icon as SVG files and symbols
    tools/          Playwright checks: screenshots, contrast, overflow, collisions
    audits/         the round one rebuild directive from the multi critic audit
    screenshots/    reference renders at desktop and mobile, both languages

## Checks

    node tools/shot.js      # screenshots plus overflow report
    node tools/verify.js    # contrast, heading outline, weights, console errors
    node tools/collide.js   # oversized or clipped elements inside product scenes
    node tools/langtest.js  # language switch and RTL parity across both pages

Tools need `playwright-core` and a local `fonts/` folder, see HANDOFF.md.

## Publishing

There is nothing to compile. Upload the folder as static files and both pages work:

- any static host (Cloudflare Pages, Netlify, S3, nginx) serves it as is
- `index.html` at the root, `ar.html` beside it
- the pages pull Inter, Inter Tight and IBM Plex Sans Arabic from Google Fonts, so they
  need outbound network for type; everything else is inline
