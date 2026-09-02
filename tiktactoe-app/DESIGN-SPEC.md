# Tic-Tac-Toe — UI/UX Design Spec

Game: 3x3 Tic-Tac-Toe, Two-player (pass-and-play) vs AI modes. Matches `calculator-app` dark-theme aesthetic.

## 1. Layout

```
┌────────────────────────────────────────────┐
│ Header:  Tic-Tac-Toe          🌗 toggle    │
│ ─────────────────────────────────────────  │
│ Status banner:  "X's turn" / "O wins!"     │
│ ┌───────────┐  ┌─────────────────────────┐ │
│ │           │  │ Mode select (segmented) │ │
│ │   3x3     │  │  [ Two-player | vs AI ] │ │
│ │  board    │  │  ────────────────────── │ │
│ │           │  │  [ Restart ]  (primary) │ │
│ │           │  │  ────────────────────── │ │
│ │           │  │  Score:  X 3 | O 1 | D  │ │
│ └───────────┘  │  .─ Draws 2             │ │
│                └─────────────────────────┘ │
└────────────────────────────────────────────┘
```

- **Header bar**: game title (left), dark/light toggle (right).
- **Status banner** (`aria-live="polite"`): turn indicator, win announcement, draw.
- **Board**: centered 3x3 CSS grid of square buttons.
- **Side panel** (below board on mobile): mode selector, restart, score.
- **Restart**: secondary-styled action that resets board only (scores persist).

## 2. Design tokens (dark / light)

| Token              | Dark (default)         | Light     |
| ------------------ | ---------------------- | --------- |
| bg (gradient base) | `#1e1f29` / `#171821`  | `#f2f4fa` |
| panel              | `#282a3a`              | `#ffffff` |
| surface (cells)    | `#33354a`              | `#e8eaf3` |
| surface hover      | `#444863`              | `#dfe2ee` |
| text               | `#f4f5fa`              | `#1e1f29` |
| text dim           | `#9aa0b5`              | `#5c6178` |
| X accent           | `#ff9f43`              | `#e07b1f` |
| O accent           | `#4fc3f7`              | `#0e7fc4` |
| success / win glow | `#2ecc71`              | `#1f9d58` |
| error              | `#ff6b6b`              | `#d43535` |
| border             | rgba(255,255,255,0.06) | `#d4d6e3` |

- X = warm orange, O = cool blue (distinct + blue/orange safe for red-green CVD; shapes reinforce).
- Typography: system stack (`Segoe UI, system-ui, Roboto`), board marks 44px weight 600; radius 12px; shadow `0 18px 40px rgba(0,0,0,0.45)` dark, `0 12px 28px rgba(30,31,41,0.12)` light.
- Contrast: text/text-dim and X/O accents meet WCAG 2.1 AA on both themes; `:focus-visible` outline `2px` accent with 2px offset (mirror calculator-app).

## 3. Win highlight

- Winning line: overlay a `::after` line/glow across the 3 cells using the winner's accent color (X orange, O blue) — e.g. `box-shadow 0 0 0 3px + soft glow` on the 3 cells (or a rotated SVG line for diagonal wins).
- Non-winning cells dim to `opacity: 0.5`; winning cells get `background: accent at 18% + 1px accent border`.
- Animate glow via `filter: drop-shadow(0 0 12px accent)`-style pulse (2-3 iterations, ~1.2s).

## 4. States & transitions

| State   | Trigger                    | UI behavior                                                                               |
| ------- | -------------------------- | ----------------------------------------------------------------------------------------- |
| Initial | page load                  | Empty board, "X's turn", default mode Two-player                                          |
| Loading | (n/a locally; AI thinking) | Status → "AI thinking…" + subtle `pulse` on board, cells disabled                         |
| Playing | each move                  | Mark pop-in `transform: scale(0.6 → 1)` with `opacity`, 150ms ease-out; status flips turn |
| Winner  | 3-in-a-row                 | Win-line glow animation, status "X wins!", banner accent-colored, board locked            |
| Draw    | board full, no line        | Status "It's a draw", board locked                                                        |
| Reset   | Restart click              | Cells clear with fade-out (`opacity 120ms`), then pop-in sequence row-by-row              |

- Recommended: `transition: background-color 0.12s ease, transform 0.05s ease` on cells/buttons (inherit calculator-app); `@keyframes scale-in`, `@keyframes pulse`, `@keyframes glow`.
- `prefers-reduced-motion: reduce` → disable animations, keep instant state swaps.

## 5. Responsive layout

- Breakpoints: `≥768px` desktop — board left (min 320px), side panel 240px right; `<768px` — single column, board ~`min(92vw, 420px)`, panel below.
- Board cells scale with viewport (`aspect-ratio: 1` square cells); cell buttons are **tap targets ≥ 44px** (calculator keys are 56px — reuse).
- Side panel controls 48px height on touch; toggle slide on desktop, inline on mobile.

## 6. Score tracking & reset semantics

- Score panel: `X wins | O wins | Draws`, persisted in `localStorage` (per key `xtt-scores`) across reloads; mode-switch does not clear scores.
- **Restart** = new round only: clears board + status, keeps scores and mode.
- **Reset scores** (small secondary link in panel): zeroes counters and clears `localStorage`.
- AI mode: AI (O) moves after player (X); during AI turn board is read-only, then control returns to player.
