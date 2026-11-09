---
name: slign
description: Draws SVG icons and illustrations that match the page they go in, kept as a small ordered library per project (slign/). Use when a page, app or README needs an icon set, an empty state, a hero or a feature drawing, even if Slign is not named. Not for logos, charts, diagrams or photos.
---

# Slign

Never write SVG paths by hand: write a short object file and let a pen draw it,
so every piece shares one hand and stays small. `<skill>` is this folder.

## 1. Read the page, once per project

`node <skill>/scripts/lib.mjs init --url <dev url or page.html>` measures the
page and writes `slign/slign.config.json` (style, palette). Pick the style:

| Page | Style |
|---|---|
| Dark, or light sans-serif product | `hairline` |
| Light with serif headings | `engrave` |
| Playful or monospace | `ink` (hand-drawn, with a face) |
| 24px UI icon, any page | `icon` |

Rules and palette per style: `<skill>/references/styles.md`.

## 2. Draw the piece

- **Icon**: copy the closest `<skill>/examples/icons/*.mjs`.
- **Illustration**: draw the product's own noun for that slot. Start from the
  closest example: `laptop`, `server`, `database`, `cloud`, `terminal`,
  `rocket`, `phone`, `bell` (ink) or `<skill>/pens/samples/` (other styles);
  read `<skill>/references/drawing.md` only if none fits.
- Use the strongest model for a new illustration; placing and exporting need none.

## 3. Register and place

- `lib.mjs add <object.mjs> --kind icon|illustration` checks it, enforces the
  size budget and files it under `slign/`. Also `list`, `rename`, `remove`,
  `build`. Details: `<skill>/references/library.md`.
- HTML, Vue, Svelte, Astro: put `<!-- slign:<name> -->` where it goes, then
  `lib.mjs place <name> --into <page>`.
- React: import the `.jsx` from `slign/`; SwiftUI: `draw.mjs --swift` (ink only).

## 4. Look before you finish

`node <skill>/scripts/page.mjs <url> --text "<heading>" --svg <file.svg> --out shot.png`,
then Read the PNG. Fix the worst thing once. Never use `<img>`: it loses the
color and the gesture.

## Fit

Size with `--slign-size` in `em`: icon `1.5em`, card `4em`-`5em`, empty state
`8em`, hero `clamp(8em, 28vw, 18em)`. Ink follows `color`; weight is
`--slign-stroke`. Put `data-slign-trigger` on the card or button around it.
How SVG works here (viewBox, strokes, motion): `<skill>/references/svg-basics.md`.

## Done when

It matches the page's palette, radius and mood, reads without its label, has
one gesture, and `lib.mjs build` says `ok`.
