---
name: slign
description: Draws small hand-inked isometric illustrations as self-contained animated SVG, in the Slign style - one ink color, wobbly thick strokes, a little face, and a gesture on hover, with no JavaScript. Use it whenever a web page or app needs an illustration, spot drawing, mascot-like object or decorative SVG of a thing - for a hero, a feature section, an empty state, a 404 or error page, an onboarding step, a loading screen or a README - even if the user never says "Slign" and only asks for "an illustration", "a little drawing", "an SVG of a server" or "something visual here". Also use it to edit or add to Slign drawings already in a project. Not for logos, UI icons at 16-24px, charts, diagrams or photos.
---

# Slign

Slign is a drawing style: isometric objects in hand-drawn ink that feel alive. This
skill gives you the rules of the style and a small tool that draws the ink line
for you, so what you make looks like it came from the same hand as every other
Slign drawing.

You describe an object as lines between 3D points. The tool adds the wobble,
projects it, draws it twice so it can shimmer, and writes one self-contained SVG.
Do not write SVG paths by hand: the wobble is what makes the style, and it only
stays consistent when the pen draws it.

## The style

- **One ink.** Every mark is a stroke in `currentColor`. No fills, no second
  color, no gradients, no shadows.
- **Thick, round, slightly unsteady lines.** The pen handles this.
- **True isometric.** You give 3D coordinates; the pen projects them.
- **Draw only what you would see.** With no fills, nothing hides anything. If an
  edge would be behind something, leave it out, or the object turns into a
  wireframe.
- **Show thickness.** A panel is two outlines a few units apart, joined at the
  visible corners. A flat shape with no edge reads as a mistake.
- **Texture is dots and scribbles**, never hatching or gray.
- **A face.** Two short vertical strokes for eyes, placed where a viewer looks
  first. They blink on their own. Leave the face out only when it hurts the
  drawing.
- **One gesture.** On hover the object does something that fits what it is: a
  laptop lid closes a little, a database disc jumps. Do not reuse another
  object's gesture.

## How to make one

1. **Pick the closest example** in `examples/` and read its `.mjs`. Each one is
   short and teaches one kind of shape and one kind of gesture.

   | Example | Shape it teaches | Gesture it teaches |
   |---|---|---|
   | `laptop` | thin panel with thickness | part turning on a hinge |
   | `server` | plain box, repeated detail | staggered sequence |
   | `database` | cylinders | part lifting with a bounce |
   | `cloud` | organic outline | continuous motion |
   | `terminal` | symbols on a face | things appearing in steps |
   | `rocket` | tall object in parts | pieces separating |

2. **Write an object file**, `<name>.mjs`, in a scratch folder:

   ```js
   export const name = 'router';          // kebab-case
   export const label = 'Router';         // becomes the aria-label
   export const oy = 140;                 // optional: moves the drawing down the canvas

   export function draw(pen) {
     const body = pen.line([[-30, -20, 12], [30, -20, 12], [30, 20, 12], [-30, 20, 12]], { closed: true });
     return body + pen.eye([-6, 20, 6]) + pen.eye([6, 20, 6]) + pen.group('antenna', pen.line([[20, -14, 12], [20, -14, 40]]));
   }

   export const css =
     'ROOT .sl-antenna{transition:transform .4s cubic-bezier(.34,1.56,.64,1)}' +
     'ACTIVE .sl-antenna{transform:translateY(-4px)}';
   ```

3. **Draw it**, with the path of this skill's folder:

   ```
   node <skill-folder>/scripts/draw.mjs path/to/router.mjs
   ```

   It writes `router.svg` next to the object file and prints its size. Errors
   stop the output and say what to fix. Warnings are worth reading: no face, no
   gesture, or too heavy.

4. **Look at the result.** Open the SVG or render it if you can. Check it against
   the list at the end of this file and adjust coordinates until it passes.

5. **Put it in the project**, inline. See "Using the SVG" below.

## Coordinates

The canvas is 200 by 200. Points are `[x, y, z]`:

- `x` runs down and to the right, `y` runs down and to the left, `z` goes up.
- The faces you see are the top (highest `z`), the left one (highest `y`) and the
  right one (highest `x`).
- Keep objects within about 45 units of the origin on `x` and `y`, and under 100
  on `z`. Use `oy` (default 131) to move the whole drawing up or down so it sits
  centered.

## The pen

| Call | Draws |
|---|---|
| `pen.line(points, { closed, thin })` | Straight-ish strokes with sharp corners. Use for boxes and edges. |
| `pen.curve(points, { closed, thin })` | One smooth stroke through three or more points. Use for organic shapes. |
| `pen.ring([cx, cy, z], r, { from, to, thin })` | A horizontal circle, or an arc in degrees. The visible front of a cylinder is `from: -45, to: 135`. |
| `pen.dot([x, y, z])` | A dot of ink: a key, a light, a rivet. |
| `pen.eye([x, y, z], height)` | One eye. Draw two, about 14 units apart. |
| `pen.group(name, markup)` | Wraps parts in `<g class="sl-name">` so the gesture can move them. |

`thin: true` is for detail inside a shape: seams, screens, labels.

## The gesture

`css` holds the motion. Write `ROOT` for the object and `ACTIVE` for the object
while hovered or focused; the tool expands both.

- Animate only `transform` and `opacity`. They are cheap for the browser, and the
  tool rejects anything else.
- Name keyframes `slign-<name>-<something>` so two objects on a page never clash.
- At rest the object is still, apart from the blink. Motion belongs to `ACTIVE`.

For a part that turns, such as a lid or a door, `css` can be a function that
receives `hinge` and `origin`. Read `references/gestures.md` for that and for a
recipe for each kind of gesture.

## Using the SVG

Paste the SVG **inline** in the page. Through `<img>` it loses its color and its
hover gesture.

- **Color and weight** come from CSS on the SVG or any parent:
  `color: #2a17d4; --slign-stroke: 3;`
- **Size**: set `width` and `height` on the `<svg>`, or size it with CSS.
- **Trigger from a parent**: add `data-slign-trigger` to a card or button and the
  gesture plays when that element is hovered.
- **React and JSX**: rename `class` to `className`, `stroke-linecap` to
  `strokeLinecap` and `stroke-linejoin` to `strokeLinejoin`, and wrap the content
  of `<style>` in a template string: ``<style>{`…`}</style>``. It needs no client
  code, so it works in a server component.
- **Vue, Svelte, Astro**: paste it as is.

Keep the `.mjs` only if the project has a place for design sources. The SVG is
what ships.

## Before you finish

- It reads as the object without its name.
- One ink, no fills, and no edge showing that should be hidden.
- Every volume shows its thickness.
- It has a face, or a reason not to.
- Hovering does one thing that suits the object.
- `draw.mjs` printed no errors, and you read its warnings.
- It is inline in the page and takes the color of the text around it.
