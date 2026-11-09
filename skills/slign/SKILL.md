---
name: slign
description: Hand-inked isometric SVG illustrations with a face and a hover gesture, sized to the page, no JavaScript. Use when a page needs a drawing of a thing (empty state, hero, feature card, 404, onboarding, README), even if Slign is not named. Not for UI icons, logos, charts, diagrams or photos.
---

# Slign

Never write SVG paths by hand. The pen draws them; that keeps every drawing in
the same hand. `<skill>` below is this folder.

## 1. Get the drawing

Draw the product's own noun for that slot: an empty inbox gets a mailbox, a
quiet alerts page gets a bell.

- **An example fits** (`laptop`, `server`, `database`, `cloud`, `terminal`,
  `rocket`): use `<skill>/examples/<name>.mjs` as the object.
- **Otherwise**: read `<skill>/references/drawing.md` and the closest example,
  then write `<name>.mjs` in a scratch folder.

## 2. Put it in the page without reading the SVG

Read the page to find the slot; let the CLI write the drawing.

- HTML, Vue, Svelte, Astro: write `<!-- slign:<name> -->` where it goes, then
  `node <skill>/scripts/draw.mjs <object.mjs> --into <page>`. Running it again
  redraws in place.
- React: `node <skill>/scripts/draw.mjs <object.mjs> <dir>/<name>.svg --jsx`,
  then import the default export of `<name>.jsx`.

Errors stop the output and say what to fix. Never paste through `<img>`: it
loses the color and the gesture.

## 3. Fit it to the page

Set these on the container (or the `<svg>`). Size with `--slign-size`, in `em`
so it follows the text:

| Slot | `--slign-size` |
|---|---|
| Card or list item | `4em`-`5em` |
| Empty state | `7em`-`8em` (default `8em`) |
| 404 or onboarding | `10em`-`12em` |
| Hero | `clamp(8em, 28vw, 18em)` |

It never grows past its container. Ink is `color` (the text color, or the
page's accent; reset the text after it if needed), weight is `--slign-stroke`
(default `3`; `2.4` on small or dense UI, `3.6` on a big hero). Put
`data-slign-trigger` on the card or button around it so hover, keyboard focus
and touch all play the gesture.

## Done when

It reads as the object without its label, draws the product's noun, has a face
and one gesture, and `draw.mjs` printed no errors.
