# Raqeb marketing site

Premium single file marketing homepage for **Raqeb** (رقيب).

- **The site:** `index.html`. Self contained, no build step. Open it in a browser.
- **Start here if you are resuming work:** [`HANDOFF.md`](./HANDOFF.md).
- **Live preview:** https://claude.ai/code/artifact/cc4453b2-e00d-4d5e-b914-be14597b6b91

## Rules that are not negotiable

1. No em dash and no en dash anywhere. Check: `grep -c $'—\|–' index.html` must return 0.
2. The brand is "Raqeb", one e. Never "Raqeeb".
3. No "sample data" or demo disclaimers on the page. It must read as a real product.
4. No fake logos, testimonials, statistics, awards or certifications.
5. Fictional figures must reconcile. Change one number, recheck its totals.

## Layout

    index.html      the deliverable, source of truth
    HANDOFF.md      full state, decisions, open questions
    build/          the parts index.html was assembled from (currently behind index.html)
    brand/          official RAQEB wordmark and Q icon as SVG symbols
    tools/          Playwright checks: screenshots, contrast, overflow, collisions
    audits/         the round one rebuild directive from the multi critic audit
    screenshots/    reference renders at desktop and mobile

## Checks

    node tools/shot.js      # screenshots plus overflow report
    node tools/verify.js    # contrast, heading outline, weights, console errors
    node tools/collide.js   # oversized or clipped elements inside product scenes

Tools need `playwright-core` and a local `fonts/` folder, see HANDOFF.md.
