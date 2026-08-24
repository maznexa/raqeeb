# Raqeb marketing site, working handoff

Last updated: 2026-08-23. Branch `claude/maznexa-pm-review-1lt7an`.

## What this is

A single file premium marketing homepage for **Raqeb** (Arabic رقيب), the product brand for the
project and services operating platform. The deliverable is `marketing/index.html`, self contained
(inline CSS and JS, no build step, no dependencies). Open it in a browser and it runs.

Live preview published as a Claude Artifact:
https://claude.ai/code/artifact/cc4453b2-e00d-4d5e-b914-be14597b6b91

## Binding rules, do not break

1. **No em dash and no en dash anywhere.** Not in copy, code comments, commit messages or chat.
   The client treats them as an AI signature. Use a comma, a colon, parentheses, a period, or the
   word "to" for ranges. A normal hyphen is fine. Verify with:
   `grep -c $'—\|–' marketing/index.html` which must return 0.
2. **The brand is spelled "Raqeb", one e.** Never "Raqeeb". The repo directory name is historical.
3. **No demo or sample disclaimers on the page.** The site must read as a real running product.
   Captions like "sample data" were explicitly removed and must not come back.
4. **No fake proof.** No invented customer logos, testimonials, statistics, awards, certifications
   or named integrations. The security section deliberately refuses to claim certifications.
5. **Fictional data must reconcile.** Every number on the page has been checked with a calculator.
   If you change one figure, re-check the totals that depend on it.

## Brand

- Official RAQEB wordmark is embedded as two SVG symbols, `#rq-word` and `#rq-q`, near the top of
  `index.html`. Latin letters use `currentColor` so they invert to white on dark. The signature Q is
  a circle with a short stem below the baseline and is the standalone app icon.
- The supplied logo file uses violet `#5053c8`. The interface accent is `#6657EE`. Those two sat
  22px apart in the header and read as a mistake, so the Q is currently parameterised to the UI
  accent via `--qv`. **Open question for the client: which violet is authoritative.** Reverting is
  one line: set `--qv` to `#5053c8` on `.wordmark`.
- Type: **Inter Tight** for display, **Inter** for UI and body, **IBM Plex Sans Arabic** for Arabic.
  The previous Poppins plus Montserrat pairing was replaced because four independent critics named
  it as the loudest "AI generated" signal. Weights use variable axes (`wght@400..700`), which
  matters: with discrete weights the 560/620/640 ramp silently rounds and the h2 renders heavier
  than the h1.

## Structure of index.html

Assembled from the parts in `marketing/build/` in this order:

    p1-head.html        head, design tokens, header and mobile sheet CSS
    p2-scene-css.html   product scene component CSS (the visual evidence)
    p3-page-css.html    page section CSS, plus logo sizing
    p0-logo.html        official RAQEB SVG symbols
    p4-header-hero.html header, mobile sheet, hero with the four tab console
    p5-flow-exec.html   operating model strip, project delivery, timeline
    p6-cap-time-reports.html  capacity, time (dark band), clients, reports
    p7-caps-sol-sec.html      capabilities, solutions, security
    p8-pricing-cta-foot.html  pricing, FAQ, refusals band, demo CTA, footer
    p9-js.html          all JavaScript

Rebuild with:

    cd marketing && cat build/p1-head.html build/p2-scene-css.html build/p3-page-css.html \
      build/p0-logo.html build/p4-header-hero.html build/p5-flow-exec.html \
      build/p6-cap-time-reports.html build/p7-caps-sol-sec.html \
      build/p8-pricing-cta-foot.html build/p9-js.html > index.html

Note: several fixes were applied directly to `index.html` after the last assembly, so the parts in
`build/` are now **behind** `index.html`. Treat `index.html` as the source of truth and re-sync the
parts before using the cat command again.

## Page sections

hero (four tab console) → operating model → project delivery (board plus task drawer) → timeline
(gantt) → capacity (workload planner) → time and utilization (dark band) → clients and margin →
reports → capabilities → solutions → security → pricing → FAQ → refusals band → demo → footer

Seven code native product scenes, all fictional but internally consistent. Sample cast: Maya Y.,
Lina Noor, Omar Malik, Sara Ali, Noura Hassan, Yara Kamal. Sample accounts: Atlas Retail, Namaa
Group, Meridian Health, Vega Studios. Projects: Northstar launch, Atlas rebrand, Namaa
transformation, Meridian retainer, Vega campaign.

## Quality state

Two adversarial audit rounds with 15 independent critics.

- Round 1 average: **4.07 / 10**. Verdicts: Poppins plus Montserrat read as a template, no type
  scale, product scenes were toy mockups in a 644px column with one clipping, wordmark drawn wrong,
  four "unfinished preview" confessions, dead nav links, fake data that did not add up, no security
  section, no FAQ, no timeline, mobile overflowed, hamburger on the wrong side.
- Round 2 average: **6.0 / 10** after the rebuild, then every critical finding from round 2 was
  fixed as well.

Verified at the last pass: zero em and en dashes, zero "Raqeeb", zero horizontal overflow at 360,
390, 768, 1024, 1280 and 1440, zero contrast failures across 19 sampled text on background pairs,
one h1 with zero heading level skips, and no clipped elements in any product scene at desktop or
laptop widths.

## Tooling in marketing/tools

Requires the sandbox Chromium at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` and
`playwright-core`. Google Fonts is blocked in the sandbox, so `tools/` expects a local `fonts/`
folder containing `local.css` plus woff2 files. Regenerate it by fetching the Google Fonts CSS for
Inter Tight, Inter and IBM Plex Sans Arabic, then downloading the latin and arabic subsets.

- `shot.js`    desktop and mobile screenshots plus an overflow report with offending selectors
- `sect.js`    one screenshot per page section
- `verify.js`  contrast audit, heading outline, computed weights, console errors
- `collide.js` finds oversized text and clipped or overflowing elements inside product scenes
- `diag.js`    reports whether any product window is clipped at 1440, 1280 and 1024

The `.h2` incident is worth remembering: the heatmap band class was named `h2`, which collided with
the global `.h2` section heading utility (a clamp up to 3rem), so three cells inherited heading size
and burst out of their boxes. Scene component classes must not reuse global utility names.

## Pricing (decided 2026-08-23)

No free plan. Essentials 12 USD per user per month annual, 15 monthly (about SAR 45/56).
Operations 20 annual, 25 monthly (about SAR 75/94), recommended tier. Enterprise custom.
Both paid tiers save exactly 20 percent on annual, so the badge says "Save 20%".

## Arabic page

`marketing/ar.html` is the full Arabic homepage: dir=rtl, lang=ar, IBM Plex Sans Arabic,
Arabic-Indic digits in all marketing copy and pricing, and natural Arabic rather than
translated English. The product scenes and the floating toast deliberately stay in English
with lang="en" dir="ltr", because the shipping product UI is English today and an Arabic UI
screenshot would fabricate an unshipped capability. The language switch is a real link both
ways (index.html and ar.html).

## Open items, in priority order

These are commercial facts nobody has supplied yet, and they matter more than further polish. The
buyer critic (role playing an operations director in Riyadh on monday.com Pro) concluded the page
currently **wins the argument in the room and loses the deal in procurement**.

1. The hero CTA links to `#pricing`. A real signup URL is still needed.
2. **No privacy notice, terms or DPA.** The demo form collects name, work email and phone with no
   privacy link. This fails a PDPL review outright.
3. **No import or migration story.** First question every switcher asks. A FAQ entry exists but the
   claims are deliberately thin because the real importer behaviour is unknown.
4. **No API, webhooks or integrations claim**, although the live system clearly has an API.
5. **Arabic is deferred, not delivered.** The العربية control currently only announces that the RTL
   interface is coming. For the Riyadh market this is the single strongest reason to switch, so
   either give it a firm date or build `/ar`.
6. Decide the violet question above.

## Suggested next step

Either build the Arabic `/ar` homepage with true right to left, natural Arabic (not translated
English) and Arabic-Indic digits, or run a third craft audit round to push from 6 toward 8. The
Arabic build is the larger commercial lever.
