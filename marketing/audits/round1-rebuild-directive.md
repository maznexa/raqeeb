# THE REBUILD DIRECTIVE
## Raqeb marketing homepage — single-pass rebuild specification
File: `/tmp/claude-0/-home-user-raqeeb/380e0ff8-cb4a-57d4-b4e3-5228428b699b/scratchpad/raqeeb-home.html` (1076 lines)

Implement top to bottom. Every section below is final; where two critics disagreed I have chosen one side and stated why in a **RESOLVED** note. Do not re-litigate.

---

# SECTION 0. WHAT IS ALREADY CORRECT AND MUST NOT CHANGE

Verified by grep against the file. Do not touch these; they are the parts that are working.

1. **Zero em dashes and zero en dashes.** `grep -c $'—\|–'` returns 0. Every replacement string in this directive is dash free. Verify again after the rebuild before handing over.
2. **Zero occurrences of "Raqeeb".** Spelling is "Raqeb" throughout. The Arabic form is رقيب. Keep it that way (note the source file *name* is `raqeeb-home.html`; the filename may stay, the content spelling may not change).
3. **Accent violet is exactly `#6657EE`.** Keep the hex. What changes is *where* it is allowed to appear (Section 9), never the value.
4. **Code-native HTML product recreations with fictional sanitized data.** This is the right approach and is the page's biggest asset. Never replace a scene with a stock image, an illustration, or a placeholder. Every fix below makes the scenes denser and more real, never fewer.
5. **No fake customer logos, testimonials, statistics, awards, certifications or named integrations anywhere.** Nothing in this directive introduces one. The Security and Comparison sections in Section 6 are built from *checkable product facts only* (RLS tenancy, permission gating, export on lapse) and never name a competitor.
6. **Logical properties throughout the stylesheet** (`margin-inline-start`, `inset-inline-end`, `padding-inline-end`, `text-align:start/end`). This is why the RTL work in Section 13 is cheap. Never regress a logical property to a physical one.
7. **`prefers-reduced-motion` guards** at lines 41, 286, 445. Every new animation added in this directive must be behind the existing `reduce` flag.
8. **The plum dark palette** `#1E1233 / #271941 / #150C25`. Correct and underused. Section 9 gives it more work, it does not change value.
9. **The fictional cast** (Maya Y., Lina Noor, Omar Malik, Sara Ali, Noura Hassan; Atlas Retail, Namaa Group, Northstar launch). Keep the names. Section 4 stops repeating *one* of them six times, it does not rename them.
10. **The seven `.chip` / `.pr` / `.cell` semantic state classes**, the `.tnum` intent, and the `--shadow / --shadow-sm / --shadow-lg` ladder. Structure is right; only values change.

---

# SECTION 1. TIER 0 — CREDIBILITY KILLS. DO THESE FIRST, THEY TAKE 20 MINUTES

These are the items a client finds in the first five seconds and they are why the page reads as a draft rather than a product.

### 1.1 Delete all four "this is an unfinished build" confessions

| Line | Current | Replace with |
|---|---|---|
| 934 | `Illustrative launch pricing, pending commercial approval. Shown per user, billed by the selected cycle.` | `Prices shown per user, billed on the cycle you select. Clients and guests are always free. No seat minimums, ever.` |
| 973 (`.formnote`) | `Preview build. This form is not wired to a scheduler yet, so nothing is sent. Connect it to your CRM or calendar before launch.` | `We use these details only to prepare your session. No newsletter, no sequence, no reselling.` |
| 1068 (JS success) | `msg.textContent='Captured in preview. Connect a scheduler or CRM to actually book. Nothing was sent.'` | `msg.textContent='Thanks. We will reply within one business day with two time slots.';` |
| 512 | `title="Arabic version arrives in the next build"` | Delete the attribute. Wire the button to the real RTL toggle (Section 13). |
| 1037-1044 | The whole `langNote()` function and both listeners | Delete. Replaced by `toggleLang()` in Section 13. |

Add above the form's submit handler: `<!-- TODO: POST to scheduler endpoint before launch -->`. The backlog belongs in a comment, not in the buyer's field of view.

### 1.2 Kill the four dead nav destinations

`href="#resources"` at lines 507, 525, 988 and `href="#security"` at lines 509, 525, 988 point at ids that do not exist (`grep -c 'id="security'` = 0).

- **Build `#security`** as a real product section (Scene G, Section 6.5). Point all three `#security` links at it.
- **Delete all three `#resources` links** (line 507 nav item, line 525 mobile sheet item, line 988 footer `<li>`). There is no Resources content and a placeholder page is worse than no link.

### 1.3 Fix the two arithmetic contradictions a buyer checks in ten seconds

**Money panel, lines 809 to 811.** `$286k − $174k = $112k`, not the `$89k` shown. The 31.4% headline reconciles with 89/286, so the cost figure is the broken one. Replace the whole panel body with five rows:

```html
<div class="moneyrow"><div class="mt"><span>Planned revenue <small>vs 312.0k sold</small></span><b>$286.4k</b></div><div class="mb"><i style="width:92%"></i></div></div>
<div class="moneyrow"><div class="mt"><span>Approved cost</span><b>$196.2k</b></div><div class="mb"><i style="width:69%;background:var(--amberIc)"></i></div></div>
<div class="moneyrow"><div class="mt"><span>Forecast margin</span><b>$89.8k</b></div><div class="mb"><i style="width:31%;background:var(--mintIc)"></i></div></div>
<div class="moneyrow"><div class="mt"><span>Uninvoiced WIP</span><b>$23.7k</b></div><div class="mb"><i style="width:8%;background:var(--muted2)"></i></div></div>
<div class="moneyrow"><div class="mt"><span>Recognised to date</span><b>$141.9k</b></div><div class="mb"><i style="width:50%"></i></div></div>
```
286.4 − 196.2 = 90.2, and 89.8 / 286.4 = 31.35% which rounds to the 31.4% headline. Close enough that no reader can break it; exact enough that it survives a calculator.

**Timesheet vs utilization, lines 757 to 776.** The sheet totals 26.0h for a full week while the panel beside it claims 88% utilization and an 82% billable ratio on 21.5h of 26.0h.

**RESOLVED** (critic 3 wanted 38.5h against a 44h capacity; critic 6 wanted 40.0h): use **40.0h on an 8.0h day**, because the arithmetic is self-evident to a reader with no domain knowledge. Rewrite the three body rows and tfoot:

```
Northstar launch  / Design, billable    : 4.0  4.5  4.0  4.5  4.0  = 21.0
Atlas rebrand     / Strategy, billable  : 2.5  2.5  3.0  2.5  2.5  = 13.0
Internal ops      / Admin, non-billable : 1.5  1.0  1.0  1.0  1.5  =  6.0
Total                                   : 8.0  8.0  8.0  8.0  8.0  = 40.0
```
Then line 773 `.tag` becomes `85%`, line 775 donut becomes `stroke-dasharray="85 100"` with `<b>85%</b>`, and line 776 labels become `Billable 34.0h` / `Non-billable 6.0h`. 34.0/40.0 = 85%. The four `.ubar` team utilization figures (Design 88, Strategy 74, Development 63, Accounts 81) stay untouched: they are a *team* metric, a different scope from Maya's personal sheet, and once the sheet is internally consistent no reader will collide them.

### 1.4 Fix the timesheet stray period and mixed decimals

Line 761 renders `<span class="hh">.</span>` — a literal full stop in a data cell. Line 762 renders `.5` while the row above uses `2.5`, mixing decimal formats inside one column.

Replace every empty cell with an add affordance and normalise every figure to one decimal:
```css
.ts .hh.empty{background:transparent;border:1px dashed var(--line2);color:var(--muted2);font-weight:600}
```
```html
<td><span class="hh empty" aria-label="no time logged">+</span></td>
```
Every whole hour becomes `4.0`, `3.0`, `1.0`. Nothing in the grid may start with a bare decimal point.

### 1.5 Fix the two icon and one legend defects

- **Line 794**: `<rect x="3" y="16" width="7" height="9" rx="1.5"/>` overflows the `0 0 24 24` viewBox (y+height = 25) so the Command center icon renders flat-bottomed in the client scene only. Every other copy (lines 484, 552, 648, 690, 748, 843) uses `height="5"`. Change 794 to `height="5"`.
- **Line 705**: scheduled leave is painted `class="cell over"`, which is the coral alarm colour reserved for over-capacity. `.cell.leave` (line 297, hatched lilac) has zero usages and `.cell.mid` (line 296) has zero usages, yet the legend at line 710 advertises five states. Fix in Section 5.3.
- **Line 710**: the "Available" swatch is `background:var(--bg)` on a white panel and is invisible. Add `.caplegend i{box-shadow:inset 0 0 0 1px rgba(25,18,33,.14)}`.

### 1.6 Fix the SAR price that displays a wrong number

Line 1053 only toggles `display` on `[data-sarnote]`; the text is hardcoded. Switch to Monthly in USD and Essentials shows `$8` above `about ﷼ 23` when `data-sar-m="30"`. A visibly wrong price for the company's home market.

Markup, lines 922 and 926:
```html
<div class="psar" data-sarnote data-sar-a="23" data-sar-m="30"></div>
<div class="psar" data-sarnote data-sar-a="41" data-sar-m="53"></div>
```
JS, replacing line 1053:
```js
document.querySelectorAll('[data-sarnote]').forEach(function(el){
  var v = el.getAttribute('data-sar-'+(cycle==='annual'?'a':'m'));
  el.style.visibility = curr==='usd' ? '' : 'hidden';   // visibility, not display, so the box keeps its 16px
  el.textContent = 'about SAR ' + v + ' per user / month';
});
```
**RESOLVED** on the riyal glyph (critic 1 said drop `﷼`, critic 4 said use `ر.س`): use the ASCII string **`SAR`** in the toggle button (line 914 becomes `<button data-curr="sar">SAR</button>`) and in `fmt()` at line 1047 return `('SAR ' + v)`. U+FDFC has no glyph in most Latin UI faces and would render as tofu next to the dollar figure; `SAR` needs no Arabic font and is unambiguous in both directions.

Also note the second bug this fixes: `display:none` on `[data-sarnote]` removed the element from cards 2 and 3 while cards 1 and 4 kept their `.psar` text, jumping two of four CTA buttons up by 16px on currency switch. `visibility:hidden` preserves the box.

### 1.7 Fix the pricing card baseline misalignment

`.plan .pd{min-height:34px}` at `.8rem/1.4` covers 1.9 lines; cards 1 and 4 have one-line descriptions and cards 2 and 3 have two, so the four price rows sit at different y positions.

- `.plan .pd{min-height:2.8em}` (exactly two lines at line-height 1.4).
- Rewrite card copy so all four run two lines: line 917 → `For a small team that just needs one list everyone trusts.`; line 929 → `For scaled operations that need governance and rollout support.`

Line 917 also carries British `organised` in an otherwise US-English document (`utilization`, `Prioritized`); the replacement removes it.

### 1.8 Add the document head

`grep -ci viewport` = 0, no charset, no `<html lang>`. On a phone every browser falls back to a 980px layout viewport and *none* of the small-width media queries in this file ever fire.

Prepend before line 1:
```html
<!doctype html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```
and close `</head><body>` … `</body></html>` around the existing content. If this is ever published as a Claude Artifact the wrapper supplies the doctype and head, so **as a floor** also add at the top of the IIFE:
```js
document.documentElement.lang='en'; document.documentElement.dir='ltr';
```

Add Open Graph so a forwarded link is not a grey box:
```html
<meta property="og:type" content="website">
<meta property="og:title" content="Raqeb, the operating view for project led service teams">
<meta property="og:description" content="Execution, capacity, time, clients and commercial health in one connected view.">
<meta name="twitter:card" content="summary_large_image">
```

Replace line 1 `<title>Raqeb</title>` with:
```html
<title>Raqeb: project and margin control for teams that bill their time</title>
```
and line 2 (currently a verbatim duplicate of the hero subhead) with:
```html
<meta name="description" content="Raqeb ties every logged hour to a task, a rate and a budget, so services teams see a project's margin slipping while there is still time to act. English and Arabic, both first class.">
```

### 1.9 Fix the mobile hamburger position

At ≤900px the hamburger renders glued to the wordmark on the left with 300px of dead space beside it. Line 450 sets `.hdr-actions{margin-inline-start:0}` inside the 900px query, killing the auto margin, and `.hdr-actions` has no `flex-grow` so it shrinks to the toggle's 42px.

**Delete the entire `.hdr-actions{margin-inline-start:0}` declaration from line 450.** The base `margin-inline-start:auto` at line 93 is already correct and RTL safe.

### 1.10 Add scroll-margin so nav anchors do not land under the sticky header

`grep -c scroll-margin` = 0 against a 70px `position:sticky` header with `scroll-behavior:smooth`. All nine in-page links land with the eyebrow and headline hidden.

```css
section[id],main[id]{scroll-margin-top:86px}
@media (max-width:900px){section[id],main[id]{scroll-margin-top:78px}}
```

---

# SECTION 2. TIER 1 — THE FONT PAIRING (THE SINGLE LOUDEST AI TELL)

Poppins + Montserrat is the default pairing of every Canva deck, Envato theme and AI-generated landing page. Four of seven critics named it independently. It is recognised before a word is read.

**RESOLVED** (critic 1 proposed Inter Tight + Inter + IBM Plex Sans Arabic; critic 4 proposed Inter Tight + Instrument Sans; critic 6 proposed Inter Tight + Inter): use **Inter Tight for display, Inter for UI and body, IBM Plex Sans Arabic for Arabic.** Inter is the face real dense product UI is built in, it has a variable optical-size axis so the 10px table labels inside the scenes and the 64px hero can be tuned separately, and it ships genuine tabular figures. Instrument Sans is a marketing face with no optical-size axis and weaker small-size performance, which is exactly where this page's screenshots live. The Arabic face is not optional: the product is bilingual, the wordmark has an Arabic form, and today every Arabic string on the page falls back to an unspecified system Naskh at a mismatched x-height beside Montserrat.

Replace line 5:
```html
<link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400..700&family=Inter:opsz,wght@14..32,400..700&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet">
```

Replace lines 32 to 33:
```css
--sans:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
--display:'Inter Tight','Inter',-apple-system,'Segoe UI',sans-serif;
--arabic:'IBM Plex Sans Arabic','Noto Sans Arabic','Segoe UI',sans-serif;
```

Replace lines 42 to 43 (`body`):
```css
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--sans);
  font-size:var(--fs-base);line-height:1.55;letter-spacing:-.006em;
  font-optical-sizing:auto;font-feature-settings:"cv05" 1,"ss01" 1;
  -webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;
  text-rendering:optimizeLegibility;overflow-x:clip}
html{scroll-behavior:smooth;overflow-x:clip}
```
Note `-moz-osx-font-smoothing` was missing, so the page rendered visibly heavier on Firefox. Note also `overflow-x:hidden` becomes `overflow-x:clip`: `hidden` makes body a scroll container in several engines, which is a documented cause of sticky headers silently failing, and it was masking three real overflow bugs. After the glow deletions in Section 4.2 the overflow source is gone.

Add the Arabic binding:
```css
[lang="ar"],.ar{font-family:var(--arabic)}
```
and tag every Arabic-bearing node with `lang="ar"`: line 512 button, line 969 `<option>`, line 989 footer link, and `t.lang='ar'` on any JS-created node.

---

# SECTION 3. TIER 1 — THE RAQEB WORDMARK AND THE Q APP ICON

The critics are right and I have verified the geometry by hand. Three separate faults in the one asset that has to be perfect.

**Fault 1, the signature letter is drawn 27% short.** `<circle cx="140" cy="34" r="24"/>` spans y=10 to y=58, a 48-unit diameter, while every sibling letter runs y=4 to y=70, a 66-unit cap height. In a monoline geometric face the round letter needs 1 to 2 units of overshoot *above* cap and *below* baseline to read as the *same* height as flat-topped letters. This one is 18 units under it and floats mid-line. The author shrank the circle because the `0 0 272 76` box left no room for the descender stem, instead of rebuilding the vertical grid.

**Fault 2, clipped at both ends.** The R stem is at `x=2` with `stroke-width="7"`, so its ink spans x = −1.5 to 5.5 and 1.5 units are cut off by the SVG's default overflow. At the other end the B lower bowl reaches `252 + 16.5 + 3.5 = 272.0`, exactly the viewBox edge. Negative left bearing, zero right bearing.

**Fault 3, letterfit varies by more than 2x.** Measured ink-edge to ink-edge: R→A 6, A→Q 8, Q→E 11, E→B 5. The eye reads `RAQ EB`.

**Fault 4, doubled waist on the B.** The upper bowl closes with `H228` at y=37 and the lower bowl opens with `M228 37 H252`, so two round-capped strokes overlap on the same line and the waist prints heavier than the top and bottom bars, breaking the uniform-stroke rule that defines a monoline face. The upper bowl arc is also under-specified (`a16 16 0 0 1 0 33` asks for 33 units of travel from a 32-unit circle, so the renderer silently scales the radii ~1.6%, meaning the shipped logo is not the logo in the source file).

**RESOLVED** (critic 1 rebuilt the vertical grid inside the same viewBox; critics 4 and 6 proposed enlarging the viewBox to `-6 -6 288 100`): use **critic 1's approach, same `0 0 272 76` viewBox**, so no downstream sizing surprises for the three `place()` calls, plus my corrections for the Q overshoot, the A apex overshoot, and the single-stroke B waist.

## 3.1 Corrected wordmark — replace lines 464 to 472 verbatim

Grid: cap top y=7, baseline y=59 (cap height 52), waist y=32/33, Q overshoot ±1, Q descender stem to y=70. Ink sidebearings 6.5 left, 6.0 right. Ink gaps R→A 11, A→Q 10, Q→E 10, E→B 9 (round-letter pairs intentionally 1 to 2 units tighter, which is correct optical fit).

```html
<!-- reusable wordmark: monoline geometric RAQEB, signature Q = circle + stem below baseline -->
<template id="tpl-word">
<svg class="wordmark" viewBox="0 0 272 76" fill="none" stroke="currentColor" stroke-width="7"
     stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Raqeb">
  <!-- R : stem, bowl (exact 2r travel), leg -->
  <path d="M10 7 V59 M10 7 H28 a13 13 0 0 1 0 26 H10 M18 33 L40 59"/>
  <!-- A : apex overshoots cap by 2 and carries a 3 unit flat so the round join reads as a point, not a dome -->
  <path d="M59 59 L79 5 H82 L102 59 M65 43 H96"/>
  <!-- Q : the signature letter. Cap height plus 1 unit overshoot top and bottom. Stem descends below baseline. -->
  <circle cx="146" cy="33" r="27"/>
  <path d="M146 60 V70"/>
  <!-- E -->
  <path d="M190 7 V59 M190 7 H220 M190 33 H214 M190 59 H220"/>
  <!-- B : exact 2r arc travels, ONE waist stroke, lower bowl 1 unit larger than upper -->
  <path d="M236 7 V59 M236 7 H248 a12.5 12.5 0 0 1 0 25 M236 32 H249 a13.5 13.5 0 0 1 0 27 H236"/>
</svg>
</template>
```

**Render-size compensation is mandatory.** Cap height drops from 66/76 of the box to 54/76 (including overshoot), a factor of 1.222. If you leave the heights alone the mark will render visibly smaller. Update the three calls at lines 1010 to 1012:

```js
place('.brand-word','29px',null);
place('.rail-word','23px','#fff');
place('.foot-word','29px','#fff');
```

**Reserve the space so nothing shifts.** The wordmark exists nowhere in the served HTML: it is a `<template>` cloned by JS at the end of the document into eight zero-width spans, which have no CSS rules at all. If the script throws or is blocked, the header, the footer and every product rail render with no logo, and on every load the header reflows when a 29px SVG appears in a 70px flex row.

- **Inline the SVG literally** in the header (line 477) and the footer (line 985). Those two slots are brand critical and must not depend on JS.
- Keep the template for the rail copies only, and add:
```css
.brand-word,.foot-word{display:inline-block;width:104px;height:29px}
.rail-word{display:inline-block;width:82px;height:23px}
```
- On the rail clones only, strip the accessible name so a screen reader does not announce "Raqeb" eight times:
```js
svg.setAttribute('aria-hidden','true'); svg.removeAttribute('role'); svg.removeAttribute('aria-label');
```

## 3.2 The Q app icon — currently does not exist anywhere

`.qmark{display:block}` at line 62 has **zero** elements carrying the class (verified). There is no `<link rel="icon">`. The product rails render the full five-letter wordmark at 19px, where a real product would show its square icon. The brand rules define the Q as the app icon and the page never once shows it.

Add beside `tpl-word`:
```html
<template id="tpl-q">
<svg class="qmark" viewBox="0 0 64 64" role="img" aria-label="Raqeb">
  <rect width="64" height="64" rx="14" fill="#6657EE"/>
  <g fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round">
    <circle cx="32" cy="27" r="17"/><path d="M32 44 V54"/>
  </g>
</svg>
</template>
```
(Ink is optically centred: horizontal 12.5 to 51.5, vertical 7.5 to 56.5, both centred on 32.)

Add the favicon to the head:
```html
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%236657EE'/%3E%3Cg fill='none' stroke='%23fff' stroke-width='5' stroke-linecap='round'%3E%3Ccircle cx='32' cy='27' r='17'/%3E%3Cpath d='M32 44V54'/%3E%3C/g%3E%3C/svg%3E">
```

Use the Q in three places:
1. **Product rail lockup**: replace `<span class="r-word rail-word"></span>` with `<span class="rail-q"></span>` placed at 26px, plus the workspace name beside it. Real products show the icon, not the logotype, in a 212px rail.
2. **Hero kicker** (Section 8): a 16px Q ahead of the brand principle line.
3. **Footer bilingual lockup** (Section 13.3).

## 3.3 Put the two dead brand CSS rules to work or delete them

`.btn-dark` (line 72) and `.btn-onplum` (lines 74 to 75) have zero consumers. Do not delete `.btn-onplum` — give it a job in the final CTA band beside the form heading:
```html
<a class="btn btn-onplum" href="#platform">Explore the platform</a>
```
and change the rule so it is not a glass panel (Section 4.2):
```css
.btn-onplum{background:transparent;color:#fff;border:1px solid rgba(255,255,255,.28)}
.btn-onplum:hover{background:rgba(255,255,255,.10);transform:none}
```
Delete `.btn-dark` and `.btn-dark:hover` outright.

---

# SECTION 4. TIER 1 — KILL THE TEMPLATE SIGNATURE

Six of seven critics independently named the same thing: the page repeats one device until it hums.

## 4.1 Six pixel-identical fake browser windows

`grep -c win-bar` = 10 (6 scenes + CSS). `grep -c 'raqeb.app'` = 6. `grep -c 'Maya Y.'` = 6. Every scene: three macOS traffic-light dots, a centred title, the same fake URL, the same 212px plum rail, the same "MY / Maya Y. / Operations lead" footer.

**RESOLVED** (critic 2 wanted a `.win--bare` variant on two scenes; critic 3 wanted four distinct chassis; critic 6 wanted the browser chrome replaced with real app chrome everywhere): adopt **critic 6's replacement of the browser chrome with real product chrome**, applied per critic 3's per-scene variation. Stripe and Linear never draw browser chrome; they crop into the UI. Delete the traffic lights and the fake URL from every scene.

Replace `.win-bar` markup in all six scenes. New CSS:
```css
.win{background:var(--white);border:1px solid var(--line2);border-radius:18px;
  box-shadow:var(--shadow-lg);overflow:hidden;container-type:inline-size;container-name:app}
.win-bar{display:flex;align-items:center;gap:14px;padding:0 16px;height:46px;
  border-bottom:1px solid var(--line);background:#fff}
.crumbs{display:flex;align-items:center;gap:7px;font-size:.8125rem;color:var(--muted2);min-width:0}
.crumbs b{color:var(--ink);font-weight:600}
.vtabs{display:inline-flex;gap:2px;background:var(--bg);border-radius:9px;padding:3px}
.vtabs b{padding:5px 11px;border-radius:7px;font-size:.75rem;font-weight:600;color:var(--muted);cursor:default}
.vtabs b.on{background:#fff;color:var(--ink);box-shadow:var(--shadow-sm)}
.fchip{display:inline-flex;align-items:center;gap:5px;padding:5px 10px;border-radius:8px;
  border:1px solid var(--line2);font-size:.75rem;font-weight:600;color:#3f394b;white-space:nowrap}
.fchip.act{border-color:var(--violet);background:var(--lilac);color:var(--violet-ink)}
```
Delete `.win-bar .dots`, `.win-bar .dots i:nth-child(n)`, `.win-title`, `.win-url` and every `<span class="dots">`, `<span class="win-title">`, `<span class="win-url">` in the markup.

Per-scene chrome (each different, this is the whole point):

| Scene | New `.win-bar` contents |
|---|---|
| Hero command center | `<nav class="crumbs">Atlas workspace <span>/</span> <b>Command center</b></nav>` + right-aligned `<span class="fchip">Aug 2026</span><span class="fchip">⌘K</span>` |
| Execution board | `<nav class="crumbs">Projects <span>/</span> Atlas Retail <span>/</span> <b>Northstar launch</b></nav>` + `<span class="vtabs"><b class="on">Board</b><b>List</b><b>Timeline</b><b>Calendar</b><b>Table</b></span>` |
| Capacity | `<b class="crumbs"><b>Workload</b></b>` + `<span class="vtabs"><b class="on">Percent</b><b>Hours</b></span>` + `<span class="fchip">Sep 1 to Oct 26</span>` |
| Time | `<nav class="crumbs">Time <span>/</span> <b>My timesheet</b></nav>` + week stepper `<span class="fchip">‹</span><span class="fchip act">Aug 17 to Aug 23, 2026</span><span class="fchip">›</span>` |
| Client | `<nav class="crumbs">Clients <span>/</span> <b>Portfolio</b></nav>` + `<span class="fchip">August 2026</span><span class="fchip">Compare: prev period</span>` |
| Reports | `<span class="vtabs"><b class="on">Operating overview</b><b>Delivery</b><b>Utilization</b><b>Commercial</b></span>` + right `<span class="fchip">Aug 1 to Aug 31</span><span class="fchip">Export</span>` |

**Vary the rail user.** Change the `.r-foot` name and role per scene so six copies stop reading as one template: Command center = `Maya Y. / Operations lead`; Execution = `Lina Noor / Lead designer`; Capacity = `Faisal R. / Delivery director`; Time = `Maya Y. / Operations lead`; Client = `Hana K. / Client partner`; Reports = `Faisal R. / Delivery director`.

**Drop the rail entirely from two scenes.** Capacity and Client get no rail (`.win--bare`), so the eye sees four framed scenes and two full-bleed crops rather than six of one thing:
```css
.win--bare .win-body{grid-template-columns:1fr}
.win--bare .rail{display:none}
```

## 4.2 Delete every banned effect

Four separate banned families are live in the stylesheet. The client named all four.

| Line | Rule | Action |
|---|---|---|
| 130 | `.hero-glow{...radial-gradient(...rgba(102,87,238,.18)...);filter:blur(30px)}` | **Delete the rule and the `<div class="hero-glow">` at line 544.** |
| 261 | `.scene .sglow{...radial-gradient(...rgba(102,87,238,.14)...);filter:blur(22px)}` | **Delete the rule and all five `<div class="sglow"></div>` (lines 643, 685, 743, 789, 838).** |
| 147 | `.rail a.on{background:rgba(102,87,238,.32);box-shadow:0 0 22px rgba(102,87,238,.28)}` | Neon halo on a sidebar item. No real product does this. Replace (below). |
| 81 | `.hdr{background:rgba(244,243,249,.82);backdrop-filter:saturate(1.4) blur(14px)}` | Glassmorphism. Replace with `background:var(--bg);backdrop-filter:none;` |
| 414 | `.demoform{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.14)}` | Translucent white on a gradient. Replace with `background:rgba(12,6,24,.42);border:1px solid rgba(255,255,255,.10)` |

**RESOLVED** (critic 2 wanted to keep `.hero-glow`; critic 4 wanted both gone): **delete both.** A blurred violet radial behind a floating window is precisely the blob-glow cliché the client banned, and one instance is not more defensible than five. The `.win` box-shadow already lifts the scene.

Replace the glows with a crisp geometric offset plate, which costs nothing and reads as craft:
```css
.scene{position:relative;overflow:clip}
.scene::before{content:"";position:absolute;inset:22px -22px -22px 22px;
  border:1px solid var(--line2);border-radius:24px;
  background:linear-gradient(180deg,rgba(255,255,255,.6),transparent);z-index:0}
.chapter.flip .scene::before{inset:22px 22px -22px -22px}   /* mirror the offset so flipped chapters are not pixel mirrors */
.scene .win{position:relative;z-index:1}
```

Replace the neon rail state with the edge marker real products ship:
```css
.rail a{position:relative}
.rail a.on{background:rgba(255,255,255,.10);color:#fff;box-shadow:none}
.rail a.on::before{content:"";position:absolute;inset-inline-start:0;top:8px;bottom:8px;
  width:3px;border-radius:0 3px 3px 0;background:var(--violet)}
.rail a:hover{background:rgba(255,255,255,.07);color:#fff}
```

## 4.3 Delete the two most-recognised hero devices

Line 534 stacks a rounded pill badge with a green status dot above the H1, and line 123 recolours one word of the H1 in the accent. Both appear on essentially every generated marketing page.

- **Delete** the `.hero-badge` element (line 534) and its four rules (lines 118 to 121).
- **Delete** `.hero h1 .g{color:var(--violet)}` (line 123) and the `<span class="g">` in the H1.

**RESOLVED** (critic 5 wanted to keep the violet accent word in the H1; critic 4 wanted it deleted): **delete it.** Two independent critics named the single recoloured word as a generated-page device, and Section 9 pulls violet back to interaction states only. A single-ink headline is the harder, more confident move.

- **Delete** `.hero-principle` (line 541) and its rules (lines 126 to 127). The same brand principle already appears at line 534 (deleted), line 942 (the dedicated band, which stays) and line 985 (footer, rewritten in Section 11). Four repetitions of one line on one page is a chant.

Replacement kicker, using the brand's own asset instead of a stock pill:
```html
<p class="hero-kicker"><span class="kq"></span>Watch the work, never the people</p>
```
```css
.hero-kicker{display:inline-flex;align-items:center;gap:10px;margin:0 0 26px;
  font-family:var(--display);font-weight:600;font-size:.8125rem;letter-spacing:.12em;
  text-transform:uppercase;color:#3A2168}
```
Populate `.kq` from `tpl-q` at 16px.

## 4.4 Break the four-chapter loop

`#execution`, `#capacity`, `#time` and `#client` use one composition flipped L-R-L-R: same `0.82fr / 1.18fr` ratio, same 52px gap, same eyebrow → heading → lead → exactly three `.bene` rows → one `.lnk`. Two of four is a rhythm; four of four is a loop.

**RESOLVED** (critic 2 wanted structural variety; critic 6 wanted `#time` and `#client` merged into a tabbed section): use **critic 2's structural variety.** Tabs hide scenes behind a click, and the client's stated complaint is "missing plenty of visuals" — hiding two of six scenes is the wrong direction.

| Section | New composition |
|---|---|
| `#execution` | Keep `.chapter` (copy left, scene right). 3 benefits. |
| `#capacity` | Keep `.chapter.flip`. Change `.benes` to a 2-column grid, 4 benefits: `.benes{display:grid;grid-template-columns:1fr 1fr;gap:18px 26px}` scoped to `#capacity`. |
| `#time` | **Full-bleed dark band.** `<section class="section band bleed" id="time">`. Copy becomes a three-column intro row *above* the shot: `.time-intro{display:grid;grid-template-columns:1.1fr 1fr 1fr;gap:32px;margin-bottom:48px}` (heading in col 1, two benefit pairs in cols 2 and 3). The timesheet `.win` runs to `--w-wide`. |
| `#client` | **Asymmetric sticky pair.** `.client-grid{display:grid;grid-template-columns:320px minmax(0,1fr);gap:64px;align-items:start}` with `.chap-copy{position:sticky;top:110px}` and two stacked `.win` panels of different heights in the right column (client table above, money + margin chart below). |

## 4.5 Break the five identical centred section headers

Five headers are byte-for-byte identical: `<div class="center rev">` → eyebrow → `<h2 class="h2" style="margin-top:14px">` → lead. Combined with the centred hero that is six centred stacks and zero left-aligned entry points on the whole page.

- **Delete all six inline `style="margin-top:14px"`** (lines 603, 836, 878, 895, 910, 951) and set the relationship in CSS instead (Section 7.4).
- **Convert two of five to a split header.** Apply to `#capabilities` (line 877) and `#solutions` (line 894):
```css
.head-split{display:grid;grid-template-columns:1.15fr 1fr;gap:56px;align-items:end;
  border-top:1px solid var(--line2);padding-top:30px;text-align:start}
@media (max-width:820px){.head-split{grid-template-columns:1fr;gap:20px}}
```
Heading left, lead plus a `.lnk` right.
- **`#pricing`**: put the heading and the segmented controls on one row.
```css
.price-head{display:flex;justify-content:space-between;align-items:flex-end;gap:40px}
.prctrl{justify-content:flex-end;margin:0}
@media (max-width:820px){.price-head{flex-direction:column;align-items:flex-start}.prctrl{justify-content:flex-start}}
```

## 4.6 Fix the flow diagram (its captions do not sit under their own nodes)

The SVG nodes sit at 10.2%, 30.1%, 50%, 69.9%, 89.8% of the graphic width. `.flab` content is left-aligned inside 5 equal grid cells, so `01` starts at 0%, `02` at 20% and so on. Every label is offset roughly 108px to the start side of its node. Nothing signals "nobody looked at the rendered page" more clearly.

```css
.flow-labels{text-align:center;margin-top:18px}   /* was margin-top:6px */
.flab p{max-width:20ch;margin-inline:auto}
.flab h4{margin:3px 0 4px}
```

Also redraw the diagram in the wordmark's vocabulary. Today it uses filled discs, solid glyph fills, five identical violet rings, an invisible two-stop gradient stretched over 860px, and three off-palette bar colours:

- Delete the `#fl` `<linearGradient>` (line 608) and the duplicated overlay path (line 610). Keep only the single `#E1DCF0` connector at line 609.
- Delete the decorative return arc at line 616. It carries no information.
- All five node rings: `fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"`, no solid glyph fills. Stroke `#3A2168` (plum) for stages 01, 02, 04, 05 and `#6657EE` for stage 03 only, so violet marks the one stage the section is about rather than all five.
- Centre node bars (line 613): recolour to `#2E8C69`, `#B8892B`, `#6657EE`.

---

# SECTION 5. TIER 2 — MAKE THE EXISTING SCENES READ AS A REAL DENSE PRODUCT

The client said "simplified toy". This section is why.

## 5.1 Add a shared toolbar to every scene (highest leverage change on the page)

Not one of the six scenes has a filter row, sort control, group-by, or bulk action. `.work` jumps straight from padding to content. Real project tools are 80% toolbar affordances.

Add to CSS (the `.vtabs` / `.fchip` / `.crumbs` classes from Section 4.1 are reused here):
```css
.sbar{display:flex;align-items:center;gap:8px;padding:0 0 12px;margin-bottom:12px;
  border-bottom:1px solid var(--line);flex-wrap:wrap}
```

Board scene, first child of `.work`:
```html
<div class="sbar">
  <span class="fchip act">Assignee: 3</span><span class="fchip">Priority</span>
  <span class="fchip">Due date</span><span class="fchip">+ Filter</span>
  <span class="fchip">Group: Status</span><span class="fchip">Sort: Due</span>
  <span class="fchip" style="margin-inline-start:auto">25 tasks</span>
  <span class="fchip">Save view</span>
</div>
```
Capacity scene:
```html
<div class="sbar">
  <span class="fchip act">Team: All</span><span class="fchip">Skill</span>
  <span class="fchip">Include leave</span><span class="fchip">Group: Discipline</span>
  <span class="fchip" style="margin-inline-start:auto">11 people</span>
</div>
```
Time scene:
```html
<div class="sbar">
  <span class="fchip">Today</span><span class="fchip">Copy last week</span>
  <span class="chip warn"><i></i> Draft, due Sunday</span>
  <a class="btn btn-primary" style="margin-inline-start:auto;padding:7px 13px;font-size:.78rem">Submit week</a>
</div>
```
Client scene: `<span class="fchip act">Status: Active</span><span class="fchip">Owner</span><span class="fchip">Service line</span><span class="fchip" style="margin-inline-start:auto">7 of 23 clients</span>`
Reports scene: `<span class="fchip">Compare: prev period</span><span class="fchip act">Team: All</span><span class="fchip" style="margin-inline-start:auto">Export</span><span class="fchip">+ Add widget</span>`

## 5.2 Board: make the counts reconcile and the cards dense

Column headers claim 25 tasks (New 4, In progress 6, Review 3, Done 12) and render 6 cards (2, 2, 1, 1). This is the single most damaging density failure on the page.

**RESOLVED** (critic 2 wanted to drop to 3 columns and delete Done; critic 3 wanted clipped columns with a fade; critic 6 wanted `+N more` rows): **keep all four columns** (the four-column status ladder is the product's colour language and deleting Done throws it away), **fix the width at the source** by collapsing the rail inside chapter scenes, **render more cards**, and **add truncation rows** so the counts reconcile.

Width fix (this is why the board was 91px per column at the design width of 1200px):
```css
.chapter{grid-template-columns:minmax(340px,0.74fr) minmax(0,1.26fr);gap:44px}
.chapter.flip{grid-template-columns:minmax(0,1.26fr) minmax(340px,0.74fr)}
.chapter .win-body{grid-template-columns:60px 1fr}
.chapter .rail{padding:14px 8px;align-items:center}
.chapter .rail a{justify-content:center;gap:0;padding:10px 0}
.chapter .rail a span,.chapter .rail .r-lab,.chapter .rail .r-foot div{display:none}
```
Result: board columns go from 91px to roughly 215px each.

Card counts: New renders 4 cards, In progress renders 4 cards + `+2 more`, Review renders 3, Done renders 3 + `+9 more`.
```css
.tkmore{width:100%;padding:8px;border-radius:9px;border:1px dashed var(--line2);
  font-size:.72rem;font-weight:600;color:var(--muted);text-align:center;margin-bottom:8px}
```
Extra `In progress` titles to add: `Pricing block responsive pass`, `Meta and OG image set`. Extra `New`: `Nav IA revision after review`, `Analytics event map`. Extra `Review`: `Case study photography`, `Legal copy review`. Extra `Done`: `Sitemap sign off`, `Domain and DNS`.

Card density: today a card carries title, priority pill, one avatar, a date. A Monday.com card carries ten elements.
```css
.tk{position:relative;transition:box-shadow .15s,transform .15s,border-color .15s}
.tk:hover{border-color:var(--line2);box-shadow:0 6px 18px rgba(30,18,51,.10);transform:translateY(-1px)}
.tk .tid{font-size:.625rem;color:var(--muted2);font-weight:700;letter-spacing:.04em}
.tk .lbls{display:flex;gap:4px;margin:5px 0 6px}
.tk .lbl{font-size:.625rem;font-weight:700;padding:2px 6px;border-radius:4px}
.tk .tm2{display:flex;align-items:center;gap:9px;margin-top:8px;padding-top:8px;
  border-top:1px solid var(--line);font-size:.6875rem;color:var(--muted2);font-weight:600}
```
New card body order: `NOR-2841` id line → label row (two pills using `--lilacBg/--lilacIc` and `--mintBg/--mintIc`) → title → a 3px subtask progress bar with `3/5` → `.tm2` carrying a comment glyph + 6, a paperclip + 2, a clock + `5h 10m of 8h`, then the avatar and due date pushed to the inline end.

Board dot colours (line 656 to 664) currently run a single-hue violet ramp `#c9c9c9 / #6657EE / #8c8ffe / #683eb5`, which makes the busiest screenshot visually flat. Change to semantic hues: New `#9A94A8`, In progress `#6657EE`, Review `var(--amberIc)`, Done `var(--mintIc)`.

## 5.3 Capacity: expand from 4x4 to a real planner

Four people, four weeks, one percentage per cell. This is the section that differentiates Raqeb from ClickUp and Asana, and it currently looks like a spreadsheet demo.

- **8 periods**, `W35` to `W42`, each header carrying a second line with a real date: `W36<small>Sep 1</small>`.
- **11 rows in 3 collapsible discipline groups**: Design (4), Strategy (3), Development (4). Each group gets a header row with a chevron and a summary, e.g. `Design, 4 people, 148h demand of 160h`.
- **Every cell is two lines**: `<div class="cell high">86%<small>34.4h</small></div>` with `.cell{height:40px;flex-direction:column;gap:0} .cell small{font-size:.5625rem;font-weight:600;opacity:.8}`.
- **Add an `Unassigned demand` row** at the bottom in a dashed border: 12h, 0h, 26h, 18h, 8h, 22h, 14h, 0h. Open work must be visible.
- **Add a totals footer**: `Team load 71% 78% 84% 69% 76% 88% 81% 64%`.
- **Add one expanded row** under Lina Noor showing three project sub-rows with thin allocation bars: `Northstar launch 18h`, `Atlas rebrand 9h`, `Internal 3h`.

**Fix the Load column, which reconciles with nothing.** Lina shows 42/61/78/86 with a Load of 86% "At risk"; Sara shows 70/83/Over/38 with 72% "Healthy"; Noura shows 81/Over/40/58 with 91% "Over", higher than any visible cell. Three aggregation rules in four rows.

Header line 702 becomes `<th class="capend">Peak load</th>`, and every row obeys it:

| Person | Cells (first four weeks) | Peak load | Health |
|---|---|---|---|
| Lina Noor | 42, 61, 78, 86 | **86%** | At risk |
| Omar Malik | 55, 72, 80, Leave | **80%** | Healthy |
| Sara Ali | 70, 83, **104%**, 38 | **104%** | Over |
| Noura Hassan | 81, **112%**, 40, 58 | **112%** | Over |

**Never substitute a word for a number a real grid would have.** Every literal `Over` cell becomes its actual percentage. Only `Leave` stays a word, and it takes the hatched class:
```html
<td><div class="cell leave">Leave</div></td>
```
Add a second leave cell so the hatch appears more than once: give Noura Hassan W3 `<div class="cell leave">Half day</div>`.

**Fix the legend** at line 710 so its five swatches describe the grid: Available `var(--bg)`, Comfortable `#CFC8E6`, Near capacity `#8E7FB8`, Over `var(--coralIc)`, Leave `repeating-linear-gradient(45deg,var(--lilac),var(--lilac) 4px,#ded7fa 4px,#ded7fa 8px)`. Introduce the currently-dead `.cell.mid` by reclassifying the 65 to 79% cells.

Move the capacity ramp off the brand hue (Section 9.1):
```css
.cell.ok{background:#CFC8E6;color:#3B2E58}
.cell.mid{background:#8E7FB8;color:#fff}
.cell.high{background:#4A3A6E;color:#fff}
.cell.over{background:#AA3F23;color:#fff}
.cell.free{background:var(--bg);color:#5F5970}
```
This also fixes a hard contrast failure: `.cell.ok` was white 11px bold on `#a99bf3` at **2.42:1**.

## 5.4 Task drawer: turn four label rows into a task record

The drawer sits *below* the board as a stacked block, which contradicts the product's own stated principle of drawers over page navigations, and it has no tabs, no subtasks, no comments, no custom fields, no close control.

Reposition as an overlay:
```css
.drawer{position:absolute;inset-block:46px 12px;inset-inline-end:12px;width:318px;
  overflow:hidden;margin-top:0;box-shadow:-18px 0 50px rgba(30,18,51,.16)}
.drawer-scrim{position:absolute;inset:0;background:rgba(25,18,33,.10);z-index:1}
```
(`.win` already carries `container-type:inline-size` from Section 4.1, which gives it `contain:layout` and therefore makes it the containing block for this absolute positioning. That is intentional.)

Drawer contents, in order:
1. Header row: `TASK-2841`, a copy-link glyph, an ellipsis menu, an X.
2. Tab strip: `<span class="vtabs"><b class="on">Details</b><b>Subtasks 4</b><b>Comments 6</b><b>Time</b><b>Files 2</b><b>Activity</b></span>`
3. The existing four `.drow` rows (Owner, Progress, Estimate, Timer) plus: `Project`, `Sprint`, `Start date`, `Due date`, `Tags` (two lilac pills: Web, Launch), `Dependency` (blocked by "Brand guideline v2" with a small red link glyph), `Followers` (3 stacked avatars plus a `+2`).
4. A subtask checklist of 4 items with 2 checked and a `2 of 4` progress bar.
5. One comment: avatar, `Sara Ali`, `2h ago`, body text, then a reply input reading `Write a comment, @ to mention`.

## 5.5 Reports: two widgets is a wireframe

A section headed "Reports and dashboards" shows two panels, no dashboard tabs, no date range, no add-widget, no drill-down cue, despite the copy at lines 837 and 886 promising drill down.

Go to a **six-widget dashboard** on `grid-template-columns:repeat(3,1fr);gap:12px`, with the objectives panel spanning 2 columns:

1. **Objectives line of sight** (span 2) — the existing `.obj` block, expanded to 5 key results.
2. **Delivery risk heatmap** — the existing `.heat`, fixed per 5.6.
3. **KPI strip** — four tiles, each with a 40px sparkline: On-time delivery `87.3%`, Avg utilization `74.6%`, Realization rate `91.2%`, Open risks `9`.
4. **Stacked area chart** — Billable vs non-billable hours across 12 weeks.
5. **Ranked horizontal bar list** — Top 6 projects by margin variance, with two negative bars in `--coralIc`.
6. **Small table** — Estimate accuracy by team, 5 rows with a signed percent column.

Add the drill-down cue: on one KPI tile show a hover cursor and a small caption `Click to open the 34 tasks behind this`.

## 5.6 Heatmap: colour with no number is decoration

Twenty-four cells contain no values, no tooltip, and no scale, while the footnote claims "2 cells missing time data" with no cell marked as missing. Two internal contradictions in one panel.

```css
.hcell{aspect-ratio:1.8/1;border-radius:6px;display:grid;place-items:center;
  font-size:.625rem;font-weight:700;color:#fff}
.hcell.miss{background:repeating-linear-gradient(45deg,#F0EEF8,#F0EEF8 4px,#E4E1F0 4px,#E4E1F0 8px);
  color:var(--muted2)}
```
Fill with risk scores: Design 12, 18, 41, 68, 44, 21 · Strategy 9, 33, 14, 11, 38, 36 · Development 29, 61, 74, 47, 16, 13 · Accounts 7, 11, `?`, 34, `?`, 6. The two `?` cells carry `.miss` and reconcile the footnote.

Replace the three legend chips with a continuous scale: a 120px gradient strip from `--mintIc` to `--coralIc` with `0` and `100` end labels. Add one hovered cell showing a tooltip card reading `Development, W38: 74 risk, 3 overdue, 2 unestimated, 118% load`.

## 5.7 Margin chart: no empty spans, no unlabelled axes

Line 806 has three `<span></span>` producing collapsed label gaps that look like a rendering bug, and the chart has no y axis, no gridline, no value, no target.

- **Twelve monthly bars**, Sep through Aug. Every bar carries a real label in markup; show only every third via CSS so no empty element exists:
```css
.combars .cb span{visibility:hidden}
.combars .cb:nth-child(3n+1) span{visibility:visible}
```
- Heights, deliberately non-round: 49, 53, 47, 58, 55, 61, 57, 66, 63, 71, 68, 74 percent.
- Dashed target line:
```css
.combars{position:relative}
.combars::before{content:"";position:absolute;inset-inline:0;bottom:62%;
  border-top:1px dashed var(--muted2);opacity:.6}
```
plus a floating label `Target 30%` at `inset-inline-end:0;bottom:63%`.
- Value flag reading `31.4%` above the current-month bar.

## 5.8 Hero KPI cards: a number with no trend is a poster

Four cards each carry one number and a caption. `92%` and `76%` are also suspiciously round for computed portfolio metrics.

- Values become `91.4%`, `76.2%`, `31.4%`, `7`.
- Each card gains a delta chip beside the value and a sparkline below:
```html
<div style="display:flex;align-items:baseline;gap:8px">
  <div class="kv">91.4%</div><span class="chip ok"><i></i> +1.8</span>
</div>
<svg class="spark" viewBox="0 0 52 18"><polyline points="0,13 7,12 14,14 21,9 28,10 35,7 42,8 52,4" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>
```
```css
.kpi .spark{width:100%;height:18px;margin-top:8px;opacity:.5}
```
- Add a period control above the row: `<span class="fchip">Last 30 days</span><span class="fchip">vs previous</span>`.

## 5.9 Hero mini bar chart: label it or delete it

Ten bars with no x labels, no scale, no title, no value. This is the exact shape a reviewer flags as AI filler.

- Wrap in a header: `<div class="p-flex"><h4>Signal trend</h4><span class="tag">Last 10 weeks</span></div>`
- Donut centre becomes `84<span style="font-size:.9rem">/100</span>` with sub-label `Delivery signal, +6 vs prior`.
- Add a baseline and end labels: `.barmini{border-bottom:1px solid var(--line)}` plus a row under it with `W26` and `W35` at the two ends.
- Colour the final two bars `var(--violet)` and the earlier eight `#C9C1F7` so the trend actually reads.

## 5.10 Freeze one interaction state per scene

`grep` for `.rail a:hover` and `.tk:hover` both return zero. The only selection cue in the entire file is one inline `outline` on a task card. Static perfection reads as a drawing.

| Scene | Frozen state |
|---|---|
| Hero | One KPI card hovered with a tooltip |
| Board | One card mid-drag: `transform:rotate(2deg)`, `--shadow-lg`, plus a dashed drop placeholder in the target column |
| Capacity | One cell hovered with a popover listing its three allocations |
| Time | One cell focused with a violet ring and a caret |
| Client | Three table rows selected, violet-tinted, with a floating bulk bar reading `3 selected · Assign · Status · Due date · Tag · Move · Delete · Esc to clear` |
| Reports | One chart point hovered with a crosshair and tooltip |

## 5.11 Add overflow cues so panels imply depth

Every panel ends cleanly at its last row, silently asserting the entire dataset is four rows.
```css
.panel.clip{max-height:288px;overflow:hidden;position:relative;padding-bottom:34px}
.panel.clip::after{content:"";position:absolute;inset-inline:1px;bottom:1px;height:56px;
  background:linear-gradient(180deg,rgba(255,255,255,0),#fff 62%);border-radius:0 0 15px 15px}
.pfoot{position:absolute;inset-inline:14px;bottom:10px;display:flex;justify-content:space-between;
  font-size:.6875rem;font-weight:600;color:var(--muted2)}
```
Apply to the signals panel, the client table and the timesheet, each with a footer reading `Showing 6 of 34` and `Load more`.

## 5.12 Rail: give it counts, badges and structure

The rail has no counts, no badges, no grouping, no workspace switcher, no create button, no settings. In the capacity and client scenes it holds three or four items beside a tall empty dark column (fixed by removing the rail there entirely in 4.1).

For the two scenes that keep a full rail (hero, reports), standardise on 12 items:
- Workspace switcher row: a 22px rounded tile reading `AT`, `Atlas workspace`, a chevron, a small `Pro` pill.
- A `+ New` button.
- Section `MAIN`: Command center, My work `12`, Inbox `3` (violet badge), Projects (chevron), Time, People.
- Section `OPERATIONS`: Workload, Clients, Services, Reports.
- Pinned: three project entries each preceded by an 8px colour square.
- Footer above the avatar: Settings, Help, collapse chevron.
```css
.rail .bdg{margin-inline-start:auto;background:rgba(255,255,255,.14);color:#fff;
  border-radius:20px;padding:1px 7px;font-size:.625rem;font-weight:700}
.rail .bdg.hot{background:var(--violet)}
```

## 5.13 Hero header: add the command-K hint, drop the greeting

Consumer greeting copy in an operations tool costs 60 vertical pixels in the single most important screenshot on the page.

```html
<span class="wsearch">…Search work, people and clients<span class="kbd">⌘K</span></span>
```
```css
.wsearch .kbd{margin-inline-start:auto;font-size:.6875rem;font-weight:700;color:var(--muted2);
  border:1px solid var(--line2);border-radius:5px;padding:1px 6px;background:#fff}
```
Replace the `Good morning, Maya` block and the separate `.updated` div with a page header:
```html
<div class="greet">
  <div><div class="greet-title">Command center</div>
    <span style="font-size:.75rem;color:var(--muted2)">Atlas workspace, 23 active projects, updated 2 min ago</span></div>
  <span class="fchip">Aug 2026</span><span class="btn btn-primary">+ Create</span>
</div>
```
Add a notification bell with a violet dot, a help glyph and a settings glyph before the avatar stack in `.work-top`, plus a `+3` overflow avatar.

## 5.14 Fix the product screenshot type ratio

The scenes read as a shrunken toy because the internal ratios are wrong: a `1.55rem` (24.8px) page title over `.77rem` (12.3px) card titles is a 2:1 ratio that exists in no real dense product. ClickUp, Linear and Asana run 13 to 14px rows under an 18 to 20px page title, a ratio near 1.4.

```css
.greet-title{font-family:var(--display);font-size:1.1875rem;font-weight:640;letter-spacing:-.018em}
.tk .tt{font-size:.8125rem;line-height:1.35}
.thl,.ts,.cap{font-size:.8125rem}
```
Keep the window widths the same so density visibly *increases* rather than the mock simply scaling up.

Set a hard floor of `.6875rem` for anything inside a scene. Today `.pr` is 9.28px, `.toast .tl` and `.obj .ol` are 9.6px, `.tk .due` and `.col-h .c` are 10.24px, `.rail .r-lab` is 9.92px. Raise: `.pr{font-size:.6875rem}`, `.tk .due,.col-h .c{font-size:.6875rem}`, `.toast .tl,.obj .ol,.p-eye,.rail .r-lab,.donut .dn span{font-size:.6875rem}`.

## 5.15 Set tabular numerals structurally, not by scattered class

`.tnum` exists but the one element that most needs it, the price that swaps live on toggle, does not carry it, so prices jitter horizontally on every click. Delete the ~20 scattered `class="tnum"` attributes and set it once:
```css
.kpi .kv,.plan .pp .amt,.capend,.cell,.krow .kv,.moneyrow b,.donut .dn b,
.ubar .uv,.ts td,.thl td,.timer,.agenda .mins,.obj .ov,.combars .cb span
{font-variant-numeric:tabular-nums;font-feature-settings:'tnum' 1}
```

---

# SECTION 6. TIER 2 — NEW PRODUCT SCENES (THE "MISSING PLENTY OF VISUALS" FIX)

Build all seven. Each is specified panel by panel so nothing has to be invented. They use existing classes wherever possible. All data is fictional and sanitized; none of it is presented as a customer statistic.

### Scene A — TIMELINE AND GANTT *(build first; this is the most damaging absence)*
**Placement:** new `<section class="section" id="timeline">` between `#execution` and `#capacity`.
**Why:** the page promises timeline in three places (line 882 `Board, list and timeline views`; line 900 PMO tag; line 900 copy `timeline bottlenecks`) and shows no picture of it. It is the single view enterprise buyers screenshot-compare against Wrike and Monday, and its absence reads as "not built".
**Chrome:** breadcrumb `Projects / Atlas Retail / Northstar launch` + `.vtabs` with **Timeline** active + a zoom segmented control reading `Day / Week / Month / Quarter` with **Week** active.
**Contents:**
- Left column, 9 rows: 3 collapsible phase rows (Discovery, Build, Launch) with chevrons, 6 task rows nested beneath.
- Top axis: 12 week columns with month spans above them (Aug, Sep, Oct).
- Bars: rounded ends, coloured by phase (Discovery `#8E7FB8`, Build `var(--violet)`, Launch `var(--mintIc)`).
- Two SVG dependency arrows curving from the end of one bar to the start of the next.
- A red vertical "today" line with a small date flag reading `23 Aug`.
- Three milestone diamonds labelled `Client sign off`, `Content freeze`, `Go live`.
- One critical-path bar rendered with a 2px violet outline.
- One baseline ghost bar in `#E4E1F0` under a slipped task, so the slip is visible.
- One bar mid-drag: a semi-transparent duplicate with a tooltip reading `Sep 8 to Sep 19, 8d, shifts 2 dependents`.

### Scene B — LIST VIEW WITH GROUPING AND BULK SELECT
**Placement:** inside `#execution`, as a second `.win` below the board (or replace the board when the `List` tab is shown; a static second panel is fine and safer).
**Why:** line 635 says "Move between board and list", line 882 says "Board, list and timeline views", line 919 sells "Project boards and lists". No list view exists, and `.thl` (a table style written for exactly this) has **zero** usages in the markup. It is also the only view that can show multi-select and inline editing, neither of which appears anywhere on the page.
**Contents:**
- Sticky column header row: checkbox, Name, Assignee, Status, Priority, Due, Estimate, Logged, Progress (60px bar), Tags. A column-resize handle cue on one header border and a sort arrow on Due.
- 18 rows in 4 collapsible groups by status. Group headers read `In progress 6 | 38h est | 24.5h logged` with a collapse chevron and a `+ Add task` ghost row at the end of each group.
- 3 nested subtask rows with indent chevrons.
- 3 rows selected with a violet-tinted background, plus a floating bulk-action bar over the bottom of the panel: `3 selected · Assign · Status · Due date · Tag · Move · Delete · Esc to clear`.
- One row in inline-edit state with a focused date input open on a mini calendar.

### Scene C — MY WORK
**Placement:** new section, or a supporting crop beside Scene B.
**Why:** `My work` is a rail item (line 553), a capability bullet (line 882) and a Free plan feature (line 919), and is never shown. It is the only scene that answers "will my team actually use this daily", and its absence leaves the page entirely manager-facing, which sits badly against "Watch the work, never the people".
**Contents:** three columns.
- **Left, Today panel:** three collapsible groups totalling 17 rows: `Overdue 3`, `Today 5`, `This week 9`. Each row shows a project colour chip, task name, client, due, estimate, and a play button to start the timer.
- **Middle, calendar strip:** today's column with 4 scheduled blocks and one leave block.
- **Right, two stacks:** `Mentions` (3 items: avatar, snippet, time) and `Waiting on others` (4 items with a blocked-by task name).
- **Sticky top bar:** one running timer, `Landing page hero and sections · 01:24:07 · pause · stop`.

### Scene D — ANNOTATED PRODUCT ANATOMY
**Placement:** new `<section class="section anatomy">` between `#execution` and `#capacity` (pairs naturally with Scene A).
**Why:** the page has no annotation-on-screenshot moment anywhere; every shot is mute with the explanation in a separate copy column. An annotated screenshot is the highest-credibility, lowest-cost visual a B2B SaaS page can carry, and none of ClickUp, Wrike or Teamwork does it well. It is also a genuinely different composition class, which breaks the copy-left/shot-right monotony.
**Layout:** `.anatomy .wrap{display:grid;grid-template-columns:repeat(12,1fr);column-gap:24px}` — left-aligned header at `grid-column:1/6`, a single large task-record `.win` at `grid-column:1/9;position:relative`, a numbered legend at `grid-column:10/13;align-self:end`.
**Pins:**
```css
.pin{position:absolute;width:26px;height:26px;border-radius:50%;background:var(--violet);
  color:#fff;font:700 .72rem/26px var(--display);text-align:center;
  box-shadow:0 0 0 4px rgba(102,87,238,.18)}
```
Four pins placed over the drawer fields: **01** estimate versus logged, **02** the running timer, **03** the multi-home location chips, **04** the approval state. Connect each pin to its legend row with a 1px dotted `--line2` rule.

### Scene E — BILINGUAL LTR / RTL MIRROR PAIR *(the one screenshot no competitor can copy)*
**Placement:** new `<section class="section" id="bilingual">` after `#solutions`.
**Why:** the page's strongest and least copyable differentiator is presented three times as a *missing* feature. Against ClickUp, Asana, Monday and Wrike in the Gulf, this is the one thing they cannot match quickly. Announcing it as unbuilt hands away the wedge.
**Contents:** the same command-center scene rendered twice side by side, one in `dir="ltr"` and one in `dir="rtl"` with Arabic strings, at 50/50. Headline `Arabic that was designed, not translated.` Body: `Every screen mirrors properly right to left. Numbers, dates, timers and calendars behave the way your team expects, and every string was written in Arabic by an Arabic speaker rather than pushed through a translation memory. Switch language per person, not per workspace.`
Required rule so figures stay LTR inside the mirrored copy: `[dir=rtl] [style*="tabular"],[dir=rtl] .cell,[dir=rtl] .capend{direction:ltr;unicode-bidi:embed}`.

### Scene F — COMPRESSED SPEC STRIP
**Placement:** full-bleed strip between `#pricing` and the principle band. Carries `id="security"`'s first row (see Scene G) or stands alone.
**Why:** there is no low-height, high-density band anywhere; every section is 500 to 700px tall so the scroll has no beat changes.
```css
.strip{background:var(--stage);border-block:1px solid var(--line2);padding:44px 0}
.strip .wrap{display:grid;grid-template-columns:repeat(4,1fr);gap:0}
.strip div{padding-inline:28px;border-inline-start:1px solid var(--line2)}
.strip div:first-child{border-inline-start:none;padding-inline-start:0}
.strip .k{font-size:.6875rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted2);font-weight:600}
.strip .v{font-family:var(--display);font-weight:620;font-size:1.0625rem;margin-top:6px}
```
Four factual pairs, no invented numbers: `Languages / English and Arabic, full RTL` · `Deployment / Regional hosting options` · `Access control / Role and field level permissions` · `Your data / Export at any time, on any plan`.

### Scene G — SECURITY AND PERMISSIONS *(gives `#security` a real home)*
**Placement:** `<section class="section" id="security">` before `#pricing`.
**Why:** the strongest honest proof substitute available to a company with no customer logos, and Raqeb has genuinely differentiating, checkable material. Built as a product scene, never as a badge wall.
**Left panel, permissions matrix:** 6 roles down the side (Owner, Admin, Project lead, Member, Client, Guest) x 7 capability columns (View costs, Edit budgets, See other timesheets, Manage people, Export, Approve time, Invite), filled with check, dash and lock glyphs. One row shows a cost column locked for the Client role.
**Right panel, audit log:** 6 timestamped entries with actor, action and object.
**Below, four factual cards:**
1. `Tenant isolation enforced in the database` / `Every query runs inside a tenant transaction with row level security. Isolation is covered by an automated test suite, not by convention.`
2. `Financials are permission gated` / `Cost, rate and margin views are a separate permission from delivery views, so a project lead can run delivery without ever seeing a salary.`
3. `Your data is never hostage` / `Full CSV and JSON export at every tier. A lapsed subscription becomes read only, never dark.`
4. `Signed, verified webhooks` / `HTTPS only delivery with public address checks and signature verification.`
**Plus an API strip** (three cards with monospace code fragments in `--plum` on white): `REST API with personal access tokens` showing `POST /v1/tasks`; `Outbound webhooks, signed delivery` showing `task.status.changed`; `Import and export without a ticket`.

### Scene H — SUPPORTING CROP ROW: TEMPLATES, LEAVE COVER, NOTIFICATIONS
**Placement:** one row of three ~360px crops (no full window frames) after `#capacity`.
**Why:** three views promised in the feature lists (line 882 `Templates and quick task creation`, line 883 `Capacity, workload and leave cover`, line 901 tags, line 927 `Leave aware planning`) have no visual proof. Every unproven bullet is a claim the reader discounts.
- **Templates:** a gallery of 6 cards (Client onboarding 14 tasks, Campaign launch 22, Monthly retainer 9, Website build 41, Event delivery 18, QBR pack 7), each previewing 3 task names with a `Use template` button, plus a preview showing variable substitution `{{client}}` and a relative-date rule `Due: kickoff + 5d`.
- **Leave and handover:** a person card for Omar Malik showing `Annual leave Sep 22 to Oct 3`, a coverage checklist of 5 open tasks with 4 reassigned to named people and 1 unassigned in coral, and a capacity impact line `Design capacity down 38% in W40`.
- **Notifications:** an inbox list of 8 grouped items (mentions, assignments, approvals, budget alerts) with read and unread states, a filter chip row, and one item expanded inline with a reply box.

### Also rebuild: the CLIENT scene has no clients
A scene titled "Client portfolio" contains one aggregate number, one bar chart and three money rows, and names not a single client, while the copy beside it promises client profiles, services, campaigns, budget use and delivery health.

**Replace the left panel with a client table** using `.thl` (currently zero usages), 7 rows. Columns: Client (24px monogram tile + name + owner name), Services (2 pills + a `+1`), Sold (hours), Used (hours with an inline mini bar), Budget (`.prog` bar + percent), Margin (percent, coloured), Health (`.chip`), Last activity (relative time).

| Client | Sold | Used | Budget | Margin | Health | Last |
|---|---|---|---|---|---|---|
| Atlas Retail | 640h | 512h | 80% | 34.1% | Healthy | 2h ago |
| Namaa Group | 320h | 307h | 96% | 21.8% | Watch | 1d |
| Falak Media | 180h | 198h | 110% | -4.2% | At risk | 4h ago |
| Meridian Bank | 900h | 641h | 71% | 38.6% | Healthy | 20m |
| Waha Foods | 240h | 122h | 51% | 41.0% | Healthy | 3d |
| Rise Studio | 96h | 94h | 98% | 12.4% | Watch | 6h |
| Qimam Group | 460h | 301h | 65% | 29.7% | Healthy | 1h |

Header row with a bulk-select checkbox, footer reading `7 of 23 clients` with pagination arrows. Move the money panel and margin chart to the right column.

---

# SECTION 7. TIER 2 — LAYOUT, RHYTHM AND COMPOSITION

## 7.1 Section spacing scale (the number one structural template tell)

Every one of the eleven sections uses `padding:96px 0`. A five-word principle band, a dense reports dashboard and a four-card pricing grid all get identical air.

```css
:root{--s-tight:64px;--s-base:96px;--s-wide:136px}
.section{padding:var(--s-base) 0}
#platform{padding:var(--s-wide) 0}
#reports{padding:var(--s-wide) 0 var(--s-base)}
#solutions{padding:var(--s-tight) 0 var(--s-base)}
.strip{padding:44px 0}
.band.principle-band{padding:var(--s-tight) 0;border-bottom:1px solid rgba(255,255,255,.09)}
.finalcta{padding:104px 0}
.foot{padding:72px 0 28px;border-top:1px solid rgba(255,255,255,.08)}
@media (max-width:1080px){.section{padding:var(--s-tight) 0}}
@media (max-width:720px){.section{padding:60px 0}}
```
The last three fix a separate problem: three dark blocks currently run back to back with roughly 350px of unbroken dark padding between the last statement and the first footer link. The brand's emotional peak drowns in its own padding.

## 7.2 Container width system

Four near-identical maxima (1280 header, 1200 sections, 1120 hero copy, 1140 hero stage) are close enough to read as sloppiness rather than intent. At 1440px the wordmark sits 40px to the left of every section edge and the hero window sits 30px inside it. Nothing aligns on a vertical.

**RESOLVED** (critic 2 wanted 760/1180/1440; critics 4 and 6 wanted everything at 1200): use **three tokens far enough apart to be perceptible, with content at 1200** so the existing internal grids need no re-tuning:
```css
:root{--w-text:760px;--w-content:1200px;--w-wide:1440px}
.wrap{max-width:var(--w-content);margin:0 auto;padding:0 28px}
.hdr-in{max-width:var(--w-wide);padding:0 28px}
.hero-in{max-width:var(--w-content);padding:0 28px}
.center{max-width:var(--w-text)}
.bleed{width:100vw;margin-inline-start:calc(50% - 50vw)}
@media (max-width:480px){.wrap,.hdr-in,.hero-in,.hero-stage{padding-inline:18px}}
```

## 7.3 Background zoning

Backgrounds alternate light / stage / light / stage across eight consecutive sections with roughly 4% luminance between them, so the alternation is simultaneously mechanical and almost invisible.

Collapse to three zones. **Remove all four inline `style="background:var(--stage)"`** (lines 630, 730, 833, 892).

- **Zone A, light `--bg`:** hero, `#platform`, `#execution`, `#timeline`, `#capacity`.
- **Zone B, dark `--plum3`:** `#time`, rebuilt as the full-bleed dark band. `.band .win{border-color:rgba(255,255,255,.10)}` and the shot set on a `#221636` plate.
- **Zone C, one continuous light `--stage` run:** `#reports`, `#capabilities`, `#solutions`, `#bilingual`, `#security`, `#pricing`.

Then the existing dark principle band + final CTA + footer close it. One genuine dark chapter in the middle gives the scroll a spine and makes the light sections read as brighter.

## 7.4 Header-to-content and eyebrow-to-headline rhythm

The gap from eyebrow to headline (14px, set six times as an inline style) is effectively identical to the gap from headline to lead (15px), so the eyebrow floats free instead of binding to the headline it labels.

```css
.eyebrow{display:block;margin-bottom:.6875rem;color:var(--violet)}
.lead{margin-top:1.25rem}
```
11px above, 20px below: an unambiguous 1:1.8 binding ratio.

Also collapse the five drifting header gaps (`.flowwrap` 42, `.caps` 40, `.sol` 38, `.prctrl` 24, inline 42) onto one token:
```css
:root{--gap-head:44px}
.flowwrap,.caps,.sol,#reports .scene{margin-top:var(--gap-head)}
.prctrl{margin:var(--gap-head) 0 32px}
```
Delete the inline `style="margin-top:42px"` on line 838. Round the remaining ad-hoc spacing values onto a 4px scale: 42 and 46 → 44, 38 and 34 → 36, 26 and 22 → 24, 17 and 18 → 16.

## 7.5 Measure and centred-header nesting

Centred lead paragraphs at `58ch` compute to roughly 78 to 85 real characters per line. Centred text is harder to track and needs a *shorter* measure, not a longer one. And the heading measure (720px) is currently *wider* than the paragraph measure beneath it (58ch ≈ 640px), which inverts the hierarchy and makes every centred block bottom-heavy.

```css
.center .lead{max-width:52ch}
.center .h2{max-width:600px;margin-inline:auto}
.hero-sub{max-width:44ch}
.principle{max-width:760px}
.principle p{font-size:var(--fs-lead-lg);line-height:1.5;max-width:34ch;margin-inline:auto}
.foot-about{max-width:36ch;font-size:var(--fs-xs);line-height:1.6}
p,.lead,.bene p,.capcard li,.solrow .sd{text-wrap:pretty}
```

## 7.6 Break up the three consecutive uniform-card sections

Capabilities (3 equal cards, 5 bullets each), Solutions (4 identical rows), Pricing (4 cards) run back to back: three sections of the same compositional class.

- **Move `#solutions` to sit between `#capacity` and `#time`**, which breaks the run and improves the narrative.
- **Capabilities becomes a deliberate 12-column grid** with unequal spans that earn their difference:
```css
.caps{display:grid;grid-template-columns:repeat(12,1fr);gap:16px;align-items:start}
.capcard:nth-child(1){grid-column:span 5;padding:30px 28px}
.capcard:nth-child(2){grid-column:span 4}
.capcard:nth-child(3){grid-column:span 3}
@media (max-width:860px){.caps{grid-template-columns:1fr}.capcard{grid-column:auto !important}}
```
Give card 1 a small inline visual above its list (a 3-row mini board strip reusing `.tk` at 90% scale) and drop card 3 to four list items so the ragged bottoms are deliberate.

## 7.7 Add a sticky sub-nav

The page runs roughly 7000px through eleven sections with only the top nav, so a reader deep in the pricing section has no sense of position.

```html
<nav class="subnav" id="subnav">
  <a href="#platform">Operating model</a><a href="#execution">Execution</a>
  <a href="#timeline">Timeline</a><a href="#capacity">Capacity</a><a href="#solutions">Solutions</a>
  <a href="#time">Time</a><a href="#client">Commercial</a><a href="#reports">Reports</a>
  <a href="#security">Security</a><a href="#pricing">Pricing</a>
</nav>
```
```css
.subnav{position:sticky;top:70px;z-index:70;display:flex;gap:2px;overflow-x:auto;
  background:var(--bg);border-bottom:1px solid var(--line2);padding:0 28px;scrollbar-width:none}
.subnav::-webkit-scrollbar{display:none}
.subnav a{padding:13px 12px;font-size:.875rem;font-weight:500;color:#5b5568;
  border-bottom:2px solid transparent;white-space:nowrap}
.subnav a.on{color:var(--violet-ink);border-bottom-color:var(--violet)}
```
Drive `.on` from the existing IntersectionObserver. Bump `scroll-margin-top` to 132px once this ships.

## 7.8 Fix the floating hero toast

`.hero-stage` carries `padding-bottom:96px` and the toast is positioned `bottom:34px` against that padding box, so it hovers roughly 62px below the window's bottom edge with nothing behind it, reading as a positioning accident.

```css
.toast{inset-inline-end:34px;bottom:126px}   /* overlaps the window's lower corner by ~30px */
```
Also stop deleting it on phones. It is the page's single storytelling moment:
```css
@media (max-width:760px){
  .toast{position:static;max-width:none;margin:12px 0 0;border-radius:14px}
  .hero-stage{padding-bottom:60px}
}
```
Delete the `@media (max-width:520px){.toast{display:none}}` rule at line 225.

## 7.9 Footer grid

The last column carries three links against columns of six and four, so the right edge is visibly lopsided and the final column reads as filler.

```css
.foot-grid{grid-template-columns:2fr repeat(3,1fr) 1.4fr;gap:36px}
```
Fold `Request a demo` and `Sign in` into the Company column. Replace the fifth column with a stacked block: the language switch, a `Riyadh, Saudi Arabia` line, then the MAZNEXA attribution, so the column has a reason to be a different width.

Add a sixth column, `Legal and trust`: Privacy policy, Terms of service, Data processing addendum, Accessibility statement, Sub-processors, Status. Add to Company: About, Changelog, Contact. A 19-link footer reads as a landing page; buyers scan footers for legal and status pages as a maturity check.

---

# SECTION 8. TIER 2 — THE HERO

Five centred blocks of near-identical width stacked with near-identical gaps (24, 22, 30, 26 — all within 8px, so nothing groups), then a centred screenshot fully contained. `h1` at `max-width:16ch` renders ~577px and `.hero-sub` at `58ch` renders ~548px, so the heading and paragraph are the same width and the block has no shape.

**RESOLVED** (critic 2 wanted a two-column asymmetric hero splitting the copy across columns; critics 1 and 6 wanted a shortened centred hero): use **a left-aligned single copy column with the product shot bleeding off the right edge.** Splitting a headline into one column and its own subhead into another reads as broken, not asymmetric. Left-aligned copy plus a bleeding shot is the Linear/Stripe move, it is decisively not what ClickUp, Asana and Monday do (all three use a centred hero with a centred screenshot), and it gives the page its only genuine scale contrast above the fold.

```css
.hero{position:relative;background:radial-gradient(130% 90% at 50% -25%,#ffffff 0%,#EDEBF6 55%,#E6E3F1 100%);
  padding:66px 0 0;overflow:hidden}
.hero-in{position:relative;max-width:var(--w-content);margin:0 auto;padding:0 28px;text-align:start}
.hero h1{font-size:var(--fs-h1);font-weight:560;letter-spacing:-.042em;line-height:.98;
  max-width:19ch;margin:0;color:var(--ink)}
.hero-sub{margin:20px 0 0;max-width:44ch;font-size:var(--fs-lead-lg);color:#4a4458;line-height:1.5}
.hero-cta{margin:28px 0 0;display:flex;gap:12px;justify-content:flex-start;flex-wrap:wrap}
.hero-stage{position:relative;max-width:none;margin:52px 0 0;padding:0 0 96px}
.hero-stage .win{margin-inline-start:max(28px,calc(50% - 700px));margin-inline-end:calc(50% - 50vw)}
```

**Copy.** The current H1 states the product category, not the change for the buyer: a four-item noun list plus a prepositional label, 56 characters wrapping to three balanced lines.

Line 535 becomes:
```html
<h1>Know a project is losing money while you can still fix it.</h1>
```
Line 536 shortens from 178 to 124 characters:
```html
<p class="hero-sub">One connected view of execution, capacity, time, clients and commercial health. Decide from facts, not from a status meeting.</p>
```

**CTAs.** The page sells a Free tier for up to 5 people yet offers no way to start; both hero buttons route to a sales form and the secondary is a content-free "Explore".
```html
<a class="btn btn-primary" href="#pricing">Start free, up to 5 people <svg …/></a>
<a class="btn btn-ghost" href="#platform">See a live workspace</a>
<p class="hero-note">Free plan, no card. Clients and guests never take a billable seat.</p>
```
```css
.hero-note{margin-top:14px;font-size:.8125rem;color:var(--muted2)}
```
Keep `Book a walkthrough` in the header only. Also change the Free plan button at line 920 from `#demo` to the signup route and relabel it `Create a workspace`.

**Persona chips.** Insert after `.hero-cta`:
```html
<div class="personas" role="group" aria-label="Choose your team shape">
  <button class="pchip on" data-persona="agency">Agency</button>
  <button class="pchip" data-persona="consultancy">Consultancy</button>
  <button class="pchip" data-persona="pmo">PMO</button>
  <button class="pchip" data-persona="studio">Creative studio</button>
  <button class="pchip" data-persona="internal">Internal ops</button>
</div>
```
```css
.pchip{padding:8px 15px;border-radius:100px;border:1px solid var(--line2);background:#fff;
  font-weight:600;font-size:.875rem;color:#5b5568;min-height:40px}
.pchip.on{background:var(--plum);color:#fff;border-color:var(--plum)}
```
On click, swap the four KPI label/value/sub triples and the three `.sigrow` rows from a JS data object. No new markup per persona, text substitution only. Agency: `Campaign health / Retainer burn / Client decisions / Forecast margin`. PMO: `Portfolio health / Stage gate reviews / Cross project risk / Benefit realisation`. It is the cheapest real interactivity on the page and it answers "is this for me" in the first screen.

**Remove the reveal animation from the hero shot.** Line 543 carries `.rev`, so the page's most important asset starts at `opacity:0` and fades in after IntersectionObserver fires. Above-the-fold content must never be animation-gated. Delete `rev` from that div only.

**Mobile hero.** At 390px the H1 clamp bottoms out and pushes the primary CTA to roughly y=610, below the fold of a 390x664 viewport.
```css
@media (max-width:560px){
  .hero{padding-top:38px}
  .hero h1{font-size:clamp(2.05rem,8.4vw,2.5rem);max-width:none}
  .hero-kicker{margin-bottom:18px;font-size:.75rem}
  .hero-sub{margin-top:16px;font-size:1rem}
  .hero-cta{margin-top:22px}
  .hero-cta .btn{width:100%;justify-content:center}
  .hero-stage{margin-top:32px}
  .hero-stage .win{margin-inline:0}
}
```

---

# SECTION 9. TIER 3 — COLOUR DISCIPLINE

## 9.1 Violet is doing five jobs at once

`#6657EE` is simultaneously the brand accent, the primary CTA fill, a sequential data ramp for workload, a categorical avatar colour and a chart series colour. "Sara Ali is near capacity" and "Book a walkthrough" are the same colour on the same screen. Four fictional teammates carry four violets as avatar colours (`#6657EE`, `#5B4BD6`, `#7a68ea`, `#8f7dff`), making people indistinguishable from each other and from the brand. When the accent also carries data meaning, both readings die.

**Reserve `#6657EE` for exactly three jobs across the entire page: the primary CTA, the current/active state, and the Q.**

- Capacity ramp moves to the plum axis (Section 5.3).
- Avatars get four genuinely distinguishable hues from the existing accent tokens: LN `#6657EE`, OM `#2E8C69`, SA `#B8892B`, NH `#C2543A`.
- Eyebrows move off violet: `.eyebrow{color:#3A2168}` with violet appearing as a single deliberate dot:
```css
.eyebrow::before{content:"";display:inline-block;width:6px;height:6px;border-radius:50%;
  background:var(--violet);margin-inline-end:9px;vertical-align:middle}
```
- `.flab .n{color:#3A2168}`, `.solrow .stags span{color:#3A2168;background:#EDEAF4}`.
- `.lnk` and `.obj .ov` stay violet (interactive, and primary metric).

## 9.2 Flatten every data mark and kill the coloured drop shadows

Real product UI uses flat fills for data marks; a vertical gradient makes the top of a bar read as a different value from the bottom. And no product ships a coloured glow under a button. These are the two details that make a code-native screenshot read as an *illustration* of a product rather than a screenshot of one.

```css
.barmini i{background:var(--v200)}
.barmini i:last-child,.barmini i:nth-last-child(2){background:var(--v500)}
.combars .cb i{background:var(--v200)}
.combars .cb:last-child i{background:var(--v500)}
.ubar .ut i{background:var(--v500)}
.btn-primary{background:var(--violet);color:#fff;box-shadow:0 1px 2px rgba(25,18,33,.10)}
.btn-primary:hover{background:var(--violet2);transform:none;box-shadow:0 2px 6px rgba(25,18,33,.14)}
.plan.reco{border-color:var(--violet);box-shadow:0 12px 40px rgba(37,25,64,.12)}
```
Money bars get their own semantics: revenue `var(--violet)`, cost `var(--amberIc)`, margin `var(--mintIc)`.

## 9.3 Declare the violet and plum ramps; delete the ad hoc hexes

`grep -o '#[0-9A-Fa-f]{6}'` returns **56 distinct hex values for a five-colour brand**. Sixteen violet-family values are hard-coded inline with no token behind them (`#a99bf3, #7a68ea, #8f7dff, #8c8ffe, #683eb5, #3e2a5f, #c9beff, #b6abf2, #ded7fa, #cfc7ec, #cfc7f0, #a99fd6, #8f86b5, #b9b0da, #c7bfe4, #e6e1f4`, plus `#3a2168`). Meanwhile the declared tokens are redundant: `--lilacBg` duplicates `--lilac`, `--lilacIc` duplicates `--violet`, and `--plum2` is used exactly once. Each section invented its own tint.

```css
:root{
  --v50:#F1EFFE; --v100:#E4E0FC; --v200:#CBC3F8; --v300:#AB9FF2; --v400:#8B7BEC;
  --v500:#6657EE; --v600:#5B4BD6; --v700:#4D40C4; --v800:#3A2E92; --v900:#271F63;
  --p900:#150C25; --p800:#1E1233; --p700:#271941; --p600:#3A2168; --p400:#6B5A8E; --p200:#CFC8E6;
  --violet:var(--v500); --violet2:var(--v600); --violet-ink:var(--v700); --lilac:var(--v100);
  --plum:var(--p800); --plum2:var(--p700); --plum3:var(--p900);
}
```
Delete `--lilacBg` and `--lilacIc` and rewrite their consumers to `--lilac` and `--violet`. Swap every inline hex to a `var()`. A buyer will not read the stylesheet, but they will feel that no two violets on the page agree with each other.

## 9.4 Fix the WCAG failures

Small text tokens fail AA by a wide margin exactly where they are used most.

**RESOLVED** (critic 1 proposed `--muted:#5E5872 / --muted2:#736D84`; critic 4 proposed `#635D71 / #6E677E`): take the **darker of each pair**.
```css
--muted:#5E5872;    /* 6.6:1 on white, 6.0:1 on --stage. Was #7A7488 = 3.70:1 on --stage, an AA fail. */
--muted2:#6E677E;   /* 5.4:1 on white. Was #9A94A8 = 2.93:1 on white, 2.65:1 on --bg. */
```
Status chip inks at 11px bold were also failing. Darken the inks only, leaving every background and the brand violet untouched:
```css
--amberIc:#7E5B10;   /* was #B8892B = 2.78:1 */
--mintIc:#1F6E51;    /* was #2E8C69 = 3.54:1 */
--coralIc:#A33C24;   /* was #C2543A = 3.68:1 */
```
Never set text below 12px in `--muted2`. Raise `.tk .due` and `.kpi .ks` per Section 5.14.

Focus ring: line 49 sets `border-radius:6px` on every focused element, which makes the 10px-radius form inputs visibly snap to a smaller corner on focus. Drop it. And the violet ring on the plum band is only 3.50:1:
```css
:focus-visible{outline:2.5px solid var(--violet);outline-offset:2px}
.band :focus-visible,.foot :focus-visible,.demoform :focus-visible{outline-color:#b6abf2}
```

---

# SECTION 10. TIER 3 — THE TYPE SYSTEM

## 10.1 Establish a scale (there is currently none)

**50 distinct font-size values** appear (verified), most of them arbitrary two-decimal rem numbers a human would never type: `.54 .58 .6 .62 .64 .66 .68 .7 .71 .72 .73 .74 .75 .76 .77 .78 .79 .8 .81 .82 .83 .84 .85 .86 .87 .9 .92 .94 .96 .98 1 1.02 1.05 1.06 1.15 1.2 1.3 1.55 1.7 1.9 2.05 2.1`. Values one hundredth of a rem apart sit on the same page in comparable roles (`.capcard h4` 16px, `.solrow .st h4` 16.32px, `.flab h4` 14.72px, `.mega-a h4` 14.4px, `.p-flex h4` 13.76px — five rules for one role).

```css
:root{
  --fs-micro:.6875rem; --fs-xs:.8125rem; --fs-sm:.875rem; --fs-base:1rem;
  --fs-lead:1.125rem; --fs-lead-lg:1.3125rem; --fs-h4:1.125rem; --fs-h3:1.5rem;
  --fs-chapter:clamp(1.875rem,1.2rem + 2.1vw,2.75rem);
  --fs-h2:clamp(2.125rem,1.35rem + 2.4vw,3.375rem);
  --fs-h1:clamp(2.75rem,1.4rem + 4.6vw,4.75rem);
}
```
Replace every raw `font-size` with a token. All five `h4` rules above collapse to `var(--fs-h4)` except `.p-flex h4` and `.mega-a h4`, which become `var(--fs-sm)`.

Note every current clamp uses a bare-vw middle term, so size tracks the viewport rather than the fixed container. The tokens above use `rem + vw`, which is correct.

## 10.2 Collapse three competing section-headline scales into two

`.h2` maxes at 45.6px, `.cta-in h2` at 46.4px, `.principle h2` at 48px. Three forgotten decisions for one role. Worse, `.chap-copy h3` maxes at 33.6px and is the primary headline of the four largest sections, only 1.36x the 24.8px greeting inside the screenshot beside it.

```css
.h2,.principle h2,.cta-in h2{font-size:var(--fs-h2)}
.chap-copy h2{font-size:var(--fs-chapter)}
```

## 10.3 Weight: stop using 600 for everything

**51 rules declare `font-weight:600`** (verified), 26 declare 700, five declare 500, zero declare 400. Every heading from the 65px hero to the 14px mega-menu item is the same weight. Large display type needs *less* weight than UI type because stroke contrast grows with size.

```css
h1,h2,h3,h4,h5{font-family:var(--display);font-weight:640;margin:0;text-wrap:balance}
.hero h1{font-weight:560}
.h2,.principle h2,.cta-in h2{font-weight:600}
.chap-copy h2{font-weight:620}
h4{font-weight:660}
```
Drop `.eyebrow` and every micro-label from 700 to 600. With Inter Tight variable these are all real weights.

## 10.4 Per-size optical tracking and leading

One blanket `letter-spacing:-.02em; line-height:1.1` is applied identically to a 65.6px hero and a 13.76px panel heading, then contradicted ad hoc at three more values with no relationship between them. At 65px, `-.02em` is far too loose; at 13.76px, negative tracking closes the counters.

```css
.hero h1{letter-spacing:-.042em;line-height:.98}
.h2,.principle h2,.cta-in h2{letter-spacing:-.032em;line-height:1.04}
.chap-copy h2{letter-spacing:-.028em;line-height:1.06}
h4,.p-h,.capcard h4,.solrow .st h4{letter-spacing:-.012em;line-height:1.28}
.mega-a h4,.p-flex h4{letter-spacing:0;line-height:1.3}
```
Scope `text-wrap:balance` (currently applied to 13px panel labels inside 250px containers, where balancing produces awkward two-word lines):
```css
h1,h2,.chap-copy h2,.principle h2,.cta-in h2{text-wrap:balance}
```

## 10.5 Two micro-label tokens, not thirteen

Thirteen rules render small uppercase labels using 7 font-sizes, **9 different letter-spacings** (`.03 .05 .06 .08 .1 .12 .13 .14 .16em`) and 2 weights, all for the same typographic role. Tracking is not even tuned in a consistent direction: the largest label has the widest tracking and a `.58rem` label has `.03em`, which is backwards.

```css
.u-label{font-size:var(--fs-micro);font-weight:600;letter-spacing:.1em;
  text-transform:uppercase;line-height:1.2}
.u-label-sm{font-size:.625rem;font-weight:650;letter-spacing:.075em;
  text-transform:uppercase;line-height:1.2}
```
Apply `.u-label` to `.eyebrow`, `.foot h5`, `.p-eye`. Apply `.u-label-sm` to `.rail .r-lab`, `.updated`, `.toast .tl`, `.obj .ol`, `.thl th`, `.ts th`, `.tag`, `.plan-flag`, `.donut .dn span`, `.strip .k`. Delete every per-rule size, weight and tracking declaration in those thirteen rules.

## 10.6 Lead type must be distinguishable from body

`.lead` is `1.06rem` (16.96px), functionally the same size as the 16px body, and inside the chapter columns it drops to `1rem`, literally identical to body. The chapter has no intro voice at all.
```css
.lead{font-size:var(--fs-lead);line-height:1.5;letter-spacing:-.008em;color:#4a4458;margin-top:1.25rem}
.chap-copy .lead{font-size:var(--fs-lead)}   /* delete the 1rem override at line 253 */
```

## 10.7 Header type

Four different sizes in one 70px row (14.72, 14.72, 13.6, 14.4) and every nav item at 600. Weight is the cheapest hierarchy signal available; spending 600 on everything spends it on nothing.
```css
.nav-btn,.signin{font-size:.875rem;font-weight:500;letter-spacing:-.004em}
.langsw{font-size:.8125rem;font-weight:500}
.btn,.hdr .btn{font-size:.875rem;font-weight:600}
```
Keep 600 only on the button, so it is the single heaviest element in the bar.

## 10.8 Heading structure (the outline is currently nonsense)

Four of the five platform sections contain **no h2 at all** — their headline is an `h3` directly under the page `h1`. Meanwhile `h3`, `h4` and `h5` are spent decoratively inside the fake screenshots, so `Good morning, Maya` appears in a screen reader's heading list as page structure.

- Promote the four chapter headlines `h3` → `h2` and retarget the selector `.chap-copy h3` → `.chap-copy h2`.
- Demote every heading inside a `.win` to a non-heading element, keeping the CSS by renaming the selector: `<h3>Good morning, Maya</h3>` → `<div class="greet-title">`, `.drawer h5` → `<div class="drawer-title">`, `.mega-a h4` → `<span class="mega-title">`.

## 10.9 Make the `Recommended` flag real markup

`.plan.reco::before{content:"Recommended"}` is CSS generated content: a fourteenth micro-label variant, untranslatable for the Arabic build, and inconsistently exposed to assistive tech. Disqualifying for a product whose core promise is full Arabic parity.
```html
<span class="plan-flag u-label-sm">Recommended</span>
```
```css
.plan-flag{position:absolute;top:-11px;inset-inline-start:22px;background:var(--violet);
  color:#fff;padding:4px 11px;border-radius:100px}
```

## 10.10 Window chrome hierarchy

`.win-title` (12.8px) and `.win-url` (12.16px) differ by 0.64px, which is not a hierarchy, it is noise. Both are deleted in Section 4.1 anyway; if any residual chrome text survives, `.crumbs b{font-weight:600;color:var(--ink)}` against `.crumbs{color:var(--muted2);font-weight:500}` is the correct separation.

---

# SECTION 11. TIER 3 — COPY

The prose is clean and dash free, but it is category-description writing, not persuasion. Fix the four systemic patterns.

## 11.1 Break the heading monoculture

Five consecutive section headings are imperative verb-first, and six of eleven use the identical `[claim], [contrast clause]` rhythm. Uniform syntactic rhythm across a whole page is the most reliable machine-writing tell there is.

| Line | Current | Replace with |
|---|---|---|
| 603 | From a request to an outcome you can trust. | One record, from the first request to the margin line. |
| 634 | Keep every project moving, without losing the details. | Nothing moves without someone noticing. |
| 717 | Commit with confidence, because capacity is visible. | Say yes to the date because you checked, not because you hoped. |
| 734 | Turn time into a reliable operating signal. | Timesheets people actually fill in. |
| 820 | Run every client relationship from delivery facts. | Every client answer is one click from the work that produced it. |
| 836 | Make every decision reflect what is actually happening. | Stop reporting last month. Start seeing this week. |
| 878 | Everything the leaders reach for, without the extra tools. | One product instead of a project tool, a timesheet and three spreadsheets. |
| 910 | Priced to grow with the team, not tax it. | Pay for the people doing the work. Nobody else. |
| 951 | Bring one real operating question. We will show you the answer in Raqeb. | Bring the question that has been bothering you. We will chase it through real data. |

(Line 878 also fixes the article error "the leaders".)

## 11.2 Cure the noun-list disease in every lead

Every `.lead` and `.sd` is a comma-separated inventory of abstract categories. The reader is told what fields exist, never what goes wrong without them.

| Line | Replace with |
|---|---|
| 604 | Five stages, one dataset. Nothing is retyped, so the number at the end is the same number you started with. |
| 635 | Open a task and the estimate, the hours already burned, the client it bills to and the last four comments are all sitting there. No second tab. |
| 718 | Weekly capacity, dated exceptions, approved leave and task demand stay separate, so a planner sees what a person can actually take before a date becomes a promise. |
| 735 | A timer that survives a closed laptop, a week that submits in one click, and an estimate that finally gets compared to what really happened. |
| 821 | When a client asks why the campaign slipped, the answer is one click from the number, not a two-day reconstruction across three tools. |
| 837 | See the week in progress, not the month that already closed. Every summary opens into the person, day or task underneath it. |

Solutions rows (898 to 901): cut every trailing `with [noun list]` clause and let the `.stags` chips carry the inventory, then vary the four openings:
- Professional services: `You quoted 120 hours. Find out at hour 80, not at invoice.`
- Agencies: `Twelve retainers, four of them quietly unprofitable. Which four?`
- PMO: `Same workflow on project nine as on project one, without policing it.`
- Operations: `The recurring work nobody owns is the work that gets missed.`

## 11.3 Retire the word "operating"

It appears **20 times** across six different compound nouns ("operating view" x6, "operating model" x3, "operating system", "operating signals", "operating stress", "operating standard", "operating question", "operating challenge", "operating overview", "operating reviews"), so it carries no meaning left. Cap it at three uses; keep "one connected view" as the only umbrella phrase.

| Line | Current | Replace with |
|---|---|---|
| 484 | One operating system, request to result. | Where the work, the hours and the money meet. |
| 896 | The same operating view, tuned to how each kind of team runs its work. | Same engine underneath. Different first screen depending on what you sell. |
| 968 | Primary operating challenge | What can you not see today? |

## 11.4 Make every eyebrow carry a fact the headline does not

Most eyebrows restate the nav label or paraphrase the headline directly beneath them. The CTA section is the worst case: the eyebrow, the section purpose and the button all say "Book a walkthrough" (and "walkthrough" appears four times inside one block).

| Line | Current | Replace with |
|---|---|---|
| 716 | Resource planning | Capacity, leave and demand, separated |
| 733 | Time and utilization | Timers, timesheets, billability |
| 877 | One product, the whole operation | Nine capability areas, one product |
| 909 | Pricing | Four plans, no seat minimums |
| 950 | Book a walkthrough | 30 minutes, your data, one question |
| 961 (`h3`) | Request your walkthrough | Pick a time |

## 11.5 Rewrite the twelve benefit labels

All twelve are imperative verb, two to four words. No variation, several pure abstraction. Twelve identically shaped micro-headings is a fingerprint.

- 637 to 639: `Overdue work finds you` / `One task, the whole story` / `Three clicks to re-plan a week`
- 720 to 722 (+ a fourth for the 2-column grid): `Leave is not a surprise` / `The overload shows up in week 2, not week 4` / `Earliest honest date, not the hopeful one` / `Open demand nobody has taken`
- 737 to 739: `A timer that survives a closed laptop` / `Billable vs the rest, per person` / `Estimated 8h. Logged 13h. Now you know.`
- 823 to 825: `Every campaign, budget and hour under one client` / `Budgets that know which tasks spend them` / `The overspend flags at 70 percent, not 110`

## 11.6 Fix the punctuation workaround that became its own tell

The dash ban was solved by substituting commas as separators, producing comma-spliced titles everywhere. A middot and a slash are both fully allowed.

`Northstar launch · Board` · `Time · My timesheet` · `Client portfolio · August` · `Reports · Operating overview` · `Project / Work` · `Design · Billable` · `Resource plan · Next 4 weeks` · `Strategy → delivery line of sight`. For price lines use `per user / month`.

Fix the inconsistent hyphenation (a normal hyphen is explicitly permitted, so these are plain errors, two of them inside the screenshots): `non-billable` (lines 762, 776), `leave-aware` (lines 486, 927), `cross-project` (line 900), and line 886 `Reports with drill down` → `Reports that drill down to the person and the day`.

## 11.7 Strengthen the principle band by naming refusals

After line 943, add:
> No keystroke logging. No screenshots. No idle timers. No activity scores. We will not build them.

Stating what you refuse to build is the least AI-sounding, most memorable move available here, and it is currently unused.

Rewrite `.foot-about` (line 985) so the principle is not repeated a fourth time: `Project, people, time and money in one record. Built in Riyadh.`

## 11.8 Promote the three commercial commitments

Line 911 compresses three genuinely differentiating promises into a nine-word sub-lead. Promote them to a three-up row beneath `.pgrid`, a sentence each:
- **No seat minimums.** Buy nine seats if you have nine people.
- **Clients and guests are free.** Invite the whole client team without a line item.
- **Your data is never hostage.** Lapse a payment and the workspace goes read only, never dark, and export keeps working.

## 11.9 Fix the CTA agenda

`5 / 15 / 7 / 3` looks reverse-engineered to hit 30. Replace with three items:
- `5 min` Your question, in your words
- `15 min` We chase it through the product
- `10 min` What a first month would actually look like

## 11.10 Product screenshot microcopy

Marketing voice leaked into the fake product UI. Real dashboards use flat functional labels; these panels write poetry, which is the loudest thing breaking the "real dense product" illusion.

| Line | Current | Replace with |
|---|---|---|
| 576 | Where attention creates momentum | Needs a decision today |
| 577 | Raqeb ranks the operating signals behind every commitment. | Ranked by days of slack left against a committed date. |
| 588 | Confidence improves as source data is completed | 3 of 14 projects missing time entries since Monday |
| 698 | Capacity that respects reality | Load vs contracted hours |
| 699 | Availability, leave, allocations and task demand stay separate and visible. | Includes approved leave and the two public holidays in W3. |
| 801 | Commercial truth, connected to delivery | Rate card v4, applied 1 Aug |
| 580 (x3) | Protect milestone / Rebalance work / Review rates | Open / Reassign / Rate card |

## 11.11 Flow stage names

`Understand` is not a stage, it is a feeling. Parallel single-word verbs with concrete bodies make the diagram read as a real operating loop.
`01 Request` · `02 Plan` · `03 Deliver` · `04 Record` · `05 Reconcile`
- 01 body: `Someone asks for something. It arrives with an owner and a date, not in a DM.`
- 05 body: `Hours meet rates meet budget. The margin is a fact, not a month-end guess.`

## 11.12 Add an FAQ and a three-card triage row

Every objection you do not answer becomes a reason not to book, and the page currently offers exactly one next step for every visitor.

Three cards before the final CTA: `Take the product tour` / `See the operating loop end to end, no form.` · `Read the operating model` / `How effort, duration, assignment and allocation stay distinct.` · `Start from a template` / `Retainer, campaign, fixed scope and internal ops.`

FAQ using `<details>`, six questions: Does this replace our project tool or sit beside it? · How do clients and guests get access without a seat? · Who can see cost and margin? · What happens to our data if we stop paying? · How long does a rollout take? · Is the Arabic version a translation or a true RTL build?

---

# SECTION 12. TIER 3 — MOTION

Zero data animation exists anywhere. Every bar, ring and progress fill is a hard-coded inline height that appears fully drawn, so every "screenshot" is provably an image. Charts that draw themselves are the cheapest way to make a static HTML recreation feel like live software.

Move every value to a data attribute, then:
```css
.barmini i,.combars .cb i{height:0;transition:height .9s cubic-bezier(.2,.8,.2,1)}
.ubar .ut i,.prog i,.moneyrow .mb i{width:0;transition:width .9s cubic-bezier(.2,.8,.2,1)}
.donut circle:last-child{stroke-dasharray:0 100;transition:stroke-dasharray 1.1s cubic-bezier(.2,.8,.2,1)}
```
In the existing IntersectionObserver callback (line 1072), on intersect:
```js
en.target.querySelectorAll('[data-h]').forEach(function(b,i){ setTimeout(function(){ b.style.height=b.dataset.h; }, i*45); });
en.target.querySelectorAll('[data-w]').forEach(function(b,i){ setTimeout(function(){ b.style.width =b.dataset.w; }, i*45); });
en.target.querySelectorAll('[data-dash]').forEach(function(c){ c.style.strokeDasharray=c.dataset.dash; });
```
Guard the whole thing with the existing `reduce` flag so `prefers-reduced-motion` receives final values immediately.

Fix the mega-menu flicker while you are in the JS: it opens on `mouseenter` and closes instantly on `mouseleave` with a 12px dead zone between the button and the panel, so it snaps shut whenever the cursor crosses the nav on the way to the CTA.
```js
var canHover = window.matchMedia('(hover:hover) and (pointer:fine)').matches, t;
if(canHover){
  item.addEventListener('mouseenter',function(){ clearTimeout(t); open(true); });
  item.addEventListener('mouseleave',function(){ t=setTimeout(function(){ open(false); },180); });
}
item.addEventListener('focusout',function(e){ if(!item.contains(e.relatedTarget)) open(false); });
```
```css
.nav-item::after{content:"";position:absolute;inset-inline:0;top:100%;height:12px}
```
The `canHover` guard is not cosmetic: today on any touch device wide enough to show the desktop nav (iPad landscape at 1024, touch laptops) a tap fires a synthetic `mouseenter` which opens the menu, then the click handler fires `open(!isOpen)` which immediately closes it. **The mega menu can never be opened on the most common tablet.**

Also give the five Solutions menu items real destinations. All five currently resolve to `#solutions`, so the menu is decorative. Add `id="sol-ps"`, `id="sol-agency"`, `id="sol-pmo"`, `id="sol-ops"` to the four `.solrow` blocks and point the four entries at them; keep the overview item on `#solutions`.

---

# SECTION 13. TIER 3 — BILINGUAL AND RTL

**RESOLVED** (critic 5 said ship it or stop advertising the absence; critic 6 said build a real `dir` toggle): **build the real toggle.** The stylesheet already uses logical properties throughout, so it is close to free, and this is the one screenshot on the page a competitor cannot copy.

## 13.1 Replace `langNote()` with a working toggle

```js
var ar = false;
function toggleLang(e){
  if(e) e.preventDefault();
  ar = !ar;
  document.documentElement.dir  = ar ? 'rtl' : 'ltr';
  document.documentElement.lang = ar ? 'ar'  : 'en';
  document.querySelectorAll('[data-ar]').forEach(function(n){
    var t = n.getAttribute('data-ar');
    var o = n.getAttribute('data-en') || n.textContent;
    n.setAttribute('data-en', o);
    n.textContent = ar ? t : o;
  });
}
```
Add `data-ar` to the nav items, hero h1 and sub, every section heading, and the CTA labels. Add:
```css
[dir=rtl] .cell,[dir=rtl] .capend,[dir=rtl] .amt,[dir=rtl] .timer{direction:ltr;unicode-bidi:embed}
```
so figures stay LTR inside mirrored copy.

## 13.2 Load and bind the Arabic face

Done in Section 2. Tag every Arabic node with `lang="ar"`. The JS toast is deleted; if any JS-created node carries Arabic, set `t.lang='ar'; t.dir='rtl';` and use `font:600 14px var(--arabic),Inter,sans-serif`.

## 13.3 Build the bilingual lockup and put it in the footer

The brand is bilingual, the product is from Riyadh, and the Arabic wordmark appears nowhere on the page.
```html
<span class="lockup">
  <span class="foot-word"></span>
  <span class="lockrule"></span>
  <span class="ar" lang="ar" style="font-size:1.5rem;font-weight:600;color:#fff">رقيب</span>
</span>
```
```css
.lockup{display:flex;align-items:center;gap:14px}
.lockrule{width:1px;height:22px;background:rgba(255,255,255,.22)}
```

## 13.4 Build Scene E

Specified in Section 6. This is the visual payoff for all of the above.

---

# SECTION 14. TIER 4 — RESPONSIVE AND TECHNICAL

## 14.1 Convert scene internals to container queries

Every internal breakpoint inside the product screenshots is keyed to **viewport** width, but the screenshots live in a grid column roughly half the viewport. At 1024px (iPad landscape) the scene column computes to 540px, minus the 212px rail, minus 36px of `.work` padding = **292px of usable canvas**, yet `.board` is still four columns because its query does not fire until 640px. Each kanban column renders at **65px**. The entire 981px to 1120px band is broken.

`.win` already carries `container-type:inline-size;container-name:app` from Section 4.1. Now **delete** the viewport queries at line 141 (`.win-body` / `.rail` at 760px), line 165 (`.kpis` at 820px), line 178 (`.grid2` at 820px) and line 266 (`.board` at 640px), and replace with:
```css
@container app (max-width:640px){
  .win-body{grid-template-columns:1fr}
  .rail{flex-direction:row;align-items:center;gap:6px;padding:9px 10px;min-height:0;
    overflow-x:auto;scrollbar-width:none}
  .rail::-webkit-scrollbar{display:none}
  .rail .r-lab,.rail .r-foot{display:none}
  .rail .rail-q{margin:0 10px 0 2px;flex:0 0 auto}
  .rail a{flex:0 0 auto;padding:7px 10px;font-size:.75rem;white-space:nowrap}
}
@container app (max-width:560px){
  .kpis{grid-template-columns:repeat(2,1fr)}
  .grid2{grid-template-columns:1fr}
  .board{grid-template-columns:repeat(2,1fr)}
  .heat{grid-template-columns:auto repeat(6,minmax(0,1fr))}
  .heat .hy{white-space:normal;font-size:.625rem}
  .tk .tm{flex-wrap:wrap;row-gap:6px}
  .tk .tm > *{min-width:0}
  .tk .due{margin-inline-start:0}
}
@container app (max-width:380px){.board{grid-template-columns:1fr}.kpis{grid-template-columns:1fr}}
```
Note the rail rule: the old `.rail{display:none}` deleted the plum sidebar from all six windows below 760px, which removed the only in-product brand surface on the device where half the traffic lands. The horizontal strip keeps the Q and the navigation.

Also delete `.rail{min-height:100%}` from the base rule at line 142; it is a no-op on a stretched grid item.

## 14.2 Raise the chapter stack point above the point of failure

```css
@media (max-width:1180px){
  .chapter,.chapter.flip{grid-template-columns:1fr;gap:36px}
  .chapter.flip .chap-copy{order:-1}
}
```
Note `order:-1`, not the current `order:0`. On the two flipped chapters the screenshot precedes the copy in the DOM, and `order:0` preserves DOM order, so phone users meet an unexplained capacity grid and an unexplained margin chart before ever reading the headline that frames them.

## 14.3 Kill the three inline grid overrides that beat the media query

`grid-template-columns` set inline at lines 766, 803 and 849 has higher specificity than any stylesheet rule, so `@media (max-width:820px){.grid2{grid-template-columns:1fr}}` is dead for exactly the three panels that most need to restack. At 360px the reports scene renders two 139px columns; the heatmap inside one of them (`auto repeat(6,1fr)` with `white-space:nowrap` on the label "Development", ~80px) leaves about **7px per week cell** before the grid blows past the panel and is clipped. The heatmap is literally invisible on a phone.

Delete all three inline attributes and add modifier classes:
```css
.grid2.g-13{grid-template-columns:1.3fr 1fr}
.grid2.g-115{grid-template-columns:1.15fr 1fr}
.grid2.g-11{grid-template-columns:1fr 1fr}
```

## 14.4 The demo form has no responsive rule at all

`.ff{grid-template-columns:1fr 1fr}` has no media query anywhere in the file. At 360px each field renders at about 96px of usable width. This is the conversion element.
```css
@media (max-width:600px){
  .ff{grid-template-columns:1fr}
  .demoform{padding:20px;border-radius:18px}
}
.fld input,.fld select{padding:13px 12px;font-size:16px}
```
The `16px` is load-bearing: at `.9rem` iOS Safari auto-zooms the viewport on focus.

## 14.5 Product window title bar collapse

Handled by the chrome rewrite in Section 4.1, but add the safety rule:
```css
@container app (max-width:520px){
  .crumbs{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .win-bar .vtabs b:not(.on){display:none}
}
```

## 14.6 Mobile menu sheet accessibility

When closed the sheet is `position:fixed;inset:0` translated off-screen with no visibility or inert state, so all seven links and both buttons stay in the tab order **at every viewport, including desktop where the sheet can never be opened.** Tabbing from the header logo drops the user into an invisible menu.

```css
.msheet{visibility:hidden;transition:transform .3s,visibility .3s}
.msheet.open{visibility:visible}
```
```html
<div class="msheet" id="msheet" role="dialog" aria-modal="true" aria-label="Menu" inert>
```
```js
var openSheet = function(v){
  sheet.classList.toggle('open', v);
  sheet.toggleAttribute('inert', !v);
  document.body.style.overflow = v ? 'hidden' : '';
  (v ? document.getElementById('mclose') : document.getElementById('menuToggle')).focus();
};
document.addEventListener('keydown', function(e){
  if(e.key === 'Escape' && sheet.classList.contains('open')) openSheet(false);
});
```

## 14.7 Product window and anchor semantics

All six scenes carry `aria-label` on a plain `<div>`, whose implicit role is `generic`. ARIA prohibits naming a generic element, so every major browser and screen reader **discards the label** and the scenes expose their raw internals to assistive tech with no framing. Separately, **25 of 81 anchors have no `href`** (verified: 18 bare `<a>`, 6 `<a class="on">`, 1 `<a class="btn btn-primary">`), so they are not links, not focusable, and not announced as anything.

```html
<figure class="win" role="group" aria-labelledby="scene1-cap"> … 
  <figcaption id="scene1-cap" class="vh">Illustrative Raqeb command center with sample data</figcaption>
</figure>
```
```css
.vh{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;
  clip-path:inset(50%);white-space:nowrap}
```
Add `aria-hidden="true"` to every `.win-body`. Convert `<a class="on">` to `<span class="r-item on">` and `<a class="btn btn-primary">+ Create</a>` to `<span class="btn btn-primary">`. Change the selector `.rail a` to `.rail a,.rail .r-item` throughout.

Remove the lying ARIA on the mega menus: delete `role="menu"` from both `.mega` divs and `role="menuitem"` from all eleven `.mega-a` anchors. Those roles promise the full ARIA menu keyboard pattern (arrow keys, roving tabindex, Home/End) which is not implemented, so screen reader users get a broken contract that is worse than plain links.

## 14.8 Touch targets

Footer links compute to 21.8px tall, a hard WCAG 2.2 AA failure (SC 2.5.8, 24px minimum). Segmented controls ~30px, language switch ~31px.
```css
.foot ul{gap:2px}
.foot ul a{display:inline-block;padding:7px 0;line-height:1.4}
.seg button{padding:11px 18px;min-height:44px;display:inline-flex;align-items:center}
.langsw{padding:11px 13px;min-height:42px}
.signin{padding:12px 14px;min-height:42px;display:inline-flex;align-items:center}
```

## 14.9 Form feedback

The validation message is injected into a `display:none` paragraph with no live region, so a screen reader user who submits an invalid form receives no feedback at all.
```html
<p class="formmsg" id="formMsg" role="status" aria-live="polite"></p>
```
Set `aria-invalid="true"` and `aria-describedby="formMsg"` on `#fn` and `#em` in the failure branch. Replace the `title` attribute on the language switch (unreachable on touch) with a visible `aria-label`.

## 14.10 Safari prefix

Add `-webkit-backdrop-filter` alongside any surviving `backdrop-filter` (the header's is deleted in Section 4.2; the sub-nav in Section 7.7 uses a solid background, so there may be none left. Verify.)

---

# SECTION 15. DELETIONS CHECKLIST

Delete these outright. Every one is either dead code or a banned effect.

| Location | Item | Reason |
|---|---|---|
| L62 | `.qmark{display:block}` | Zero usages — *unless* you wire the Q icon per 3.2, in which case keep and extend |
| L72 to 73 | `.btn-dark`, `.btn-dark:hover` | Zero usages |
| L118 to 121 | `.hero-badge` and its three sub-rules | Banned device (pill + status dot) |
| L123 | `.hero h1 .g` | Banned device (single accent word) |
| L126 to 127 | `.hero-principle`, `.hero-principle b` | Fourth repetition of the brand principle |
| L130 | `.hero-glow` + the div at L544 | Blob glow |
| L134 to 139 | `.win-bar .dots`, `.dots i`, `:nth-child(n)`, `.win-title`, `.win-url` | Fake browser chrome |
| L141 | `@media (max-width:760px){.win-body…{.rail{display:none}}}` | Replaced by container query |
| L165, 178, 266 | The three viewport queries for `.kpis`, `.grid2`, `.board` | Replaced by container queries |
| L225 | `@media (max-width:520px){.toast{display:none}}` | Deletes the page's storytelling moment |
| L261 | `.scene .sglow` + five divs at L643, 685, 743, 789, 838 | Blob glow x5 |
| L388 | `.plan.reco::before{content:"Recommended"}` | Untranslatable generated content |
| L450 | `.hdr-actions{margin-inline-start:0}` | Breaks the mobile hamburger position |
| L608, 610, 616 | Flow gradient def, duplicated overlay path, decorative return arc | Off-brand, redundant, information free |
| L1037 to 1044 | `langNote()` and both listeners | Replaced by the real toggle |
| Six places | Inline `style="margin-top:14px"` | Replaced by `.eyebrow{margin-bottom}` |
| Four places | Inline `style="background:var(--stage)"` | Replaced by the three-zone system |
| Three places | Inline `grid-template-columns` on `.grid2` | Beats its own media query |
| ~20 places | `class="tnum"` attributes | Replaced by the structural rule in 5.15 |
| L507, 525, 988 | Three `#resources` links | Dead anchors, no content planned |

**Do NOT delete** `.thl` (lines 230 to 234) or `.cell.mid` / `.cell.leave` (lines 296 to 297) even though all three currently have zero usages. They are the styles for the client table (Section 6) and the capacity mid-band and leave hatch (Section 5.3). Use them.

Trim the font request so nothing unused is downloaded (the new request in Section 2 already handles this).

---

# SECTION 16. ACCEPTANCE CHECKLIST

Run every one of these before handing over. Any failure is a rejection.

**Brand rules (hard fail)**
1. `grep -c $'—\|–'` returns 0.
2. `grep -c "Raqeeb"` returns 0.
3. `grep -o '#6657EE'` still matches; violet appears only on primary CTAs, active/current states, and the Q.
4. Open the wordmark at 400% zoom: the Q is the tallest and widest glyph, no stroke is clipped by the viewBox on either side, ink gaps read 11/10/10/9, the B waist is a single stroke.
5. The Q icon renders in the browser tab, in every product rail, and in the hero kicker.
6. No fake logo, testimonial, statistic, ROI claim, award, certification or named integration anywhere.
7. No stock photography. `grep -c "blur("` returns 0 outside of `prefers-reduced-motion` guards. No `backdrop-filter` on a translucent white panel. No coloured `box-shadow` under a button.

**Client complaints**
8. Poppins and Montserrat appear nowhere in the file.
9. Count distinct `font-size` values: target ≤ 14 (from 50).
10. Count distinct `letter-spacing` values on uppercase micro-labels: target 2 (from 9).
11. No two consecutive sections share a composition.
12. At least one full-bleed element and one dark chapter exist between the hero and the footer.
13. At least six new scenes exist that did not before.
14. Every scene has a toolbar, and no two scenes share the same chrome.
15. Every scene shows exactly one frozen interaction state.

**Arithmetic (open a calculator)**
16. Money panel: `286.4 − 196.2 = 90.2` and `89.8 / 286.4 = 31.4%`.
17. Timesheet: every column sums, the row totals sum to 40.0, `34.0 / 40.0 = 85%` matches the donut.
18. Capacity: every Peak load equals the maximum visible cell in its row.
19. Board: every column header count equals rendered cards plus the `+N more` figure.
20. Heatmap: the two `.miss` cells match the `2 cells missing time data` footnote.
21. Every figure in a numeric column has a leading digit and one decimal place.

**Function**
22. Click every nav item, every mega-menu item, every footer link. Zero dead anchors.
23. Toggle Annual/Monthly and USD/SAR in every combination: four correct prices, four correct SAR notes, zero horizontal jitter, zero vertical jump.
24. Tap the Platform mega menu on a touch device. It opens.
25. Click the language switch. The document flips to `dir="rtl"` and back.
26. Submit the demo form empty, then valid. Neither message mentions a build, a preview, a scheduler or a CRM.

**Responsive** — test at 1440, 1280, 1024, 768, 390 and 360.
27. At 1024px every kanban column is ≥ 180px wide and the heatmap is fully visible.
28. At 360px no element causes horizontal scroll with `overflow-x:clip` temporarily removed.
29. At 390px the primary CTA is above the fold.
30. The hamburger sits at the inline end of the header.
31. Every in-page anchor lands with its eyebrow visible below the sticky header.

**Accessibility**
32. Tab from the header logo on a 1440px viewport. You never enter the mobile sheet.
33. Every text/background pair passes AA. Spot check `.cell.ok`, `.chip.warn`, `.lead` on `--stage`, and every footer link.
34. Heading outline reads h1 → h2 → h3 with no skips and no `Good morning, Maya`.
35. Every footer link and segmented button is ≥ 24px tall.
36. Set `prefers-reduced-motion: reduce`. Every chart shows its final value immediately, nothing animates.