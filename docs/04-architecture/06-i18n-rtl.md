# Internationalization & RTL — English + Arabic from Day One

> **Status:** Accepted. Arabic is not a translation pass at the end; it is a first-class
> locale in the scaffold (risk 5: "RTL debt"). The seed data includes an Arabic-named
> tenant specifically to force RTL through every screen from the first demo.

## Locale plumbing (next-intl)

- **Library:** `next-intl` on the Next.js App Router. Locales: `en` (default), `ar`.
- **Routing:** locale segment `/{locale}/...` (`/en/t/acme/...`, `/ar/t/acme/...`);
  negotiation order: explicit URL → account preference (`accounts.locale`) → tenant
  default (`tenants.default_locale`) → `Accept-Language` → `en`.
- **Catalogs:** `packages/i18n/en.json`, `packages/i18n/ar.json` — one shared package so
  API-emitted strings (emails, digests) and the web app use the same catalog. Keys are
  namespaced by module (`tasks.status.change_button`). Missing-key policy: dev throws,
  prod falls back to `en` and increments a metric.
- **Server components first:** messages resolved server-side; client bundles receive only
  the namespaces the route uses.

## Direction: `dir` from locale at the root

```tsx
// app/[locale]/layout.tsx
const dir = locale === 'ar' ? 'rtl' : 'ltr';
return <html lang={locale} dir={dir}>...</html>;
```

- `dir` is set **once at the root layout** from the locale; components never hard-code
  direction and never read it — they are written in logical properties so direction is
  free (below).
- Embedded LTR runs inside RTL text (code snippets, URLs, task keys like `ACME-42`) are
  wrapped in `<bdi>`/`unicode-bidi: isolate` utilities provided by the design system.

## CSS logical properties mandate

**Physical left/right properties are banned.** All spacing, positioning, borders, radii,
and text alignment use logical properties, which flip automatically under `dir="rtl"`:

| Banned (physical) | Required (logical) |
| --- | --- |
| `margin-left` / `ml-*` | `margin-inline-start` / `ms-*` |
| `margin-right` / `mr-*` | `margin-inline-end` / `me-*` |
| `padding-left` / `pl-*` | `padding-inline-start` / `ps-*` |
| `padding-right` / `pr-*` | `padding-inline-end` / `pe-*` |
| `left:` / `right:` | `inset-inline-start:` / `inset-inline-end:` |
| `border-left*` / `border-right*` | `border-inline-start*` / `border-inline-end*` |
| `text-align: left/right` | `text-align: start/end` |
| `rounded-l-*` / `rounded-r-*` | `rounded-s-*` / `rounded-e-*` |

Enforcement:
- **stylelint ban** on the physical properties (`stylelint-use-logical` + a custom rule
  for Tailwind physical utilities in class strings) — CI-gated, error not warning.
- Tailwind is configured with the logical utilities (`ms-*`, `me-*`, `ps-*`, `pe-*`,
  `start-*`, `end-*`); Radix/shadcn components are audited once and wrapped where they
  emit physical values.
- The only sanctioned exceptions are direction-agnostic physical cases (e.g. video player
  scrub bars, color pickers) — each carries a
  `/* stylelint-disable-next-line ... -- physical: <reason> */` annotation.

## Directional icon flip registry

Mirroring icons wholesale is wrong (a "play" triangle flips; a checkmark must not; a
clock must never). The design system keeps an explicit **flip registry**:

- `packages/ui/icons/registry.ts` marks every icon `flip: true | false`.
  - `flip: true`: arrows, chevrons, back/forward, indent/outdent, send, breadcrumb
    separators, undo/redo, list-collapse.
  - `flip: false`: checkmarks, clocks, search, media playback (per platform convention),
    logos, numerals-bearing icons.
- The `<Icon>` component applies `transform: scaleX(-1)` in RTL only for registered
  flippers. Raw icon imports outside the component are lint-banned.
- New icons cannot merge without a registry entry (CI check).

## Messages: ICU only, Arabic's six plural categories

- **All user-facing strings go through ICU MessageFormat.** String concatenation and
  template-literal sentence assembly are banned in review — word order differs in Arabic,
  so sentences must be single translatable messages with placeholders.
- Arabic has **six CLDR plural categories** (zero, one, two, few, many, other) vs
  English's two, so every countable message is a full ICU plural:

```json
"tasks.count": "{count, plural, zero {لا مهام} one {مهمة واحدة} two {مهمتان} few {# مهام} many {# مهمة} other {# مهمة}}"
```

- CI validates catalogs: every `ar` plural message must define all six categories; every
  `en` key must exist in `ar` (untranslated keys tracked, not silently fallback-shipped);
  ICU syntax is parse-checked.

## Dates, numbers, digits

- **All formatting via `Intl`** (`Intl.DateTimeFormat`, `Intl.NumberFormat`,
  `Intl.RelativeTimeFormat`) through shared helpers in `packages/i18n` — no hand-rolled
  formatting, no moment-style locale bundles.
- API payloads are locale-neutral (ISO 8601 UTC timestamps, raw numbers); formatting is a
  presentation concern only.
- **Arabic-Indic digits policy:** default is **Western digits** (`ar` with
  `-u-nu-latn`) — the common convention in modern Arabic business software — with a
  per-account setting to switch to Arabic-Indic digits (`-u-nu-arab`), applied uniformly
  by the shared formatters. Task keys, ids, and technical strings always render Western.
- Calendars: Gregorian in v1; Hijri display is a documented later option via
  `-u-ca-islamic-umalqura` (no schema impact — storage is always ISO).
- First day of week and weekend follow locale defaults (configurable per tenant later —
  relevant to capacity/scheduling in P4).

## RTL testing checklist + CI

Manual checklist (every feature PR that touches UI):

1. Full screen renders correctly under `/ar` — no horizontal scrollbars, no clipped text.
2. Navigation, chevrons, and breadcrumbs point the correct way (flip registry honored).
3. Drag-and-drop reorder works and drop indicators appear on the correct side (board and
   list interactions are direction-aware).
4. Mixed-content strings (Arabic sentence containing an English task key/URL) render with
   correct bidi isolation.
5. Number/date fields format per locale; inputs accept both digit sets.
6. Keyboard navigation: Home/End and arrow keys respect visual direction.
7. Truncation/ellipsis appears at the logical end, not the physical right.

Automated:
- **CI screenshot job:** Playwright renders the core screens (login, project list, task
  list, task panel) in `en` and `ar` against the seeded Arabic tenant; screenshots are
  diffed against committed baselines; layout deltas fail review-free merges.
- The stylelint ban, catalog validation, and icon-registry check run in the standard lint
  gate.
- Definition of runnable (Phase 0) explicitly includes the full task flow in **both**
  locales — see `docs/07-roadmap/02-scaffold-scope.md`.
