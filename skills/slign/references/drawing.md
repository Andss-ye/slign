# Drawing a new object

Read this only when no example fits. Also read the closest example's `.mjs`.

## The style

- One ink: every mark is a pen stroke. No fills, text, gradients or shadows.
- True isometric: you give 3D points, the pen projects and wobbles them.
- Draw only what you would see. With no fills nothing hides anything, so leave
  out edges that would be behind something.
- Show thickness: a panel is two outlines a few units apart, joined at the
  visible corners. Rods (antenna, cable, stem) are one stroke.
- Texture is dots and scribbles, never hatching.
- A face: two eyes where the viewer looks first. Skip it only if it hurts.
- One gesture on hover that fits the object: a lid closes, a flag lifts, steam
  rises. Recipes in `gestures.md`.

## Object file

```js
export const name = 'router';     // kebab-case, unique on the page
export const label = 'Router';    // aria-label

export function draw(pen) {
  const body = pen.line([[-30, -20, 12], [30, -20, 12], [30, 20, 12], [-30, 20, 12]], { closed: true });
  return body + pen.eye([-6, 20, 6]) + pen.eye([6, 20, 6]) + pen.group('antenna', pen.line([[20, -14, 12], [20, -14, 40]]));
}

export const css =
  'ROOT .sl-antenna{transition:transform .4s cubic-bezier(.34,1.56,.64,1)}' +
  'ACTIVE .sl-antenna{transform:translateY(-4px)}';
```

The canvas is cropped to the drawing, so where it sits does not matter.

## Coordinates

Points are `[x, y, z]`. `x` runs down-right, `y` down-left, `z` up. You see the
top (highest `z`), the left face (highest `y`) and the right face (highest `x`).
Keep objects within about 45 units on `x` and `y` and under 100 on `z`.

- Upright round shapes (cylinder, cone, bell): the outline sits at 135 and -45
  degrees around the axis. The visible front arc is `from: -45, to: 135`.
- `ring` angles: flat, 0° points along `x` and 90° along `y`; with `plane: 'xz'`
  or `'yz'`, 0° points along `x` or `y` and 90° straight up.
- Nothing faces the viewer head-on; upright circles lean with the projection.
- A thin part crossing an edge should clearly cross it, not end on it.
- Eyes sit on the surface: on a tapered or round body, use that body's radius at
  the eyes' height, or they float off it.
- Organic closed shapes (leaf, cloud): give `curve` 6+ points in order around
  the shape; with 4 it can cross itself.

## Pen

| Call | Draws |
|---|---|
| `pen.line(points, { closed, thin })` | Strokes with sharp corners: boxes, edges. |
| `pen.curve(points, { closed, thin })` | One smooth stroke through 3+ points. |
| `pen.ring([x, y, z], r, { from, to, plane, thin })` | Circle or arc in degrees; flat by default, `plane: 'xz'` or `'yz'` stands it up. |
| `pen.dot([x, y, z])` | A dot: key, light, rivet. |
| `pen.eye([x, y, z], height)` | One eye; draw two about 14 apart. |
| `pen.group(name, markup)` | `<g class="sl-name">` for the gesture to move. |

`thin: true` is for detail inside a shape.

## Gesture CSS

`ROOT` is the object, `ACTIVE` the object while hovered, focused or pressed.
Animate only `transform` and `opacity`; name keyframes `slign-<name>-…`. For a
pivot, `css` can be a function of `{ hinge, origin }` (see `gestures.md`).

## Check

`draw.mjs` errors block the output; read its warnings. If you can render,
screenshot the drawing at rest and with class `slign-active` added to the
`<svg>`. That shows where transitions end; a looping animation shows its first
frame, so in a scratch copy add
`.slign *{animation-delay:-.4s!important;animation-play-state:paused!important}`.
If you cannot render, say so.
