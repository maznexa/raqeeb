# UI/UX Principles

*Standing product directive: Raqeeb's interface must beat every competitor on polish — the
reference points are ClickUp's density-with-warmth and monday.com's color-first clarity.*

## North star

A first-time user should feel the product is **alive, fast, and colorful** within ten seconds,
and a power user should never feel it is in their way. We compete on feel, not just features.

## Principles

1. **Color carries meaning (monday lesson).** Status pills, priority flags, and project colors
   are saturated and consistent everywhere the entity appears — list, board, drawer, dashboard.
   Semantic color (status/priority) is never repurposed for decoration.
2. **Density with hierarchy (ClickUp lesson, minus the clutter).** Rows are compact; secondary
   metadata (human ID, dates, avatars) sits in a muted layer; hover reveals actions instead of
   permanently crowding the row. Progressive disclosure over toggles-everywhere.
3. **Speed is a feature.** Optimistic updates with rollback for every frequent mutation
   (status change, reorder, drag between columns). Perceived latency budget: <100ms for local
   interactions, skeletons — never spinners — for loads.
4. **The drawer is the workbench.** Task detail opens as an end-side drawer (never a page
   navigation) so context is preserved; every field edits in place.
5. **Bilingual is not a mode.** Arabic RTL receives the same polish as English LTR: logical CSS
   properties only, mirrored iconography where direction matters, natural Arabic copy (never
   machine-literal).
6. **Keyboard first-class.** Esc closes, Enter commits, arrows navigate lists; a command
   palette (Ctrl/Cmd+K) lands in P2.
7. **Empty states sell the next action.** Every empty view names the one thing to do next,
   in the user's language and tone — no dead ends.
8. **Anti-clutter pledge.** New surface area must displace or fold into existing surface —
   the ClickUp failure mode (buttons everywhere) is a rejected pattern (see
   `01-competitive-analysis/08-anti-patterns.md`).

## Review gate

Every UI PR answers: Would this screen pass in a side-by-side against ClickUp/monday? Does it
hold in RTL? Does it meet the perf budgets in `04-architecture/08-observability-performance.md`?
