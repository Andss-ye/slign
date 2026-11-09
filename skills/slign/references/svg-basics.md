# How these SVGs work

- **viewBox**: the drawing's own coordinate space; `0 0 w h` with origin at 0 so
  CSS pivots in px match. The canvas is cropped to the drawing. Size comes from CSS
  (`--slign-size` in `em`), never from fixed `width`/`height`.
- **Stroke, not fill**: pieces are strokes (`fill="none"`). That keeps them small,
  lets one `color` recolor them, and lets `--slign-stroke` change the weight.
  Hairline and engrave may use a paper fill only to hide what is behind a face.
- **`currentColor`**: the SVG takes the text color of its container. Inside an
  `<img>` that link is lost (black on light, invisible on dark), so always inline.
- **Motion**: only `transform` and `opacity`, so the browser animates on the
  compositor without repainting. Pieces rest almost still; the gesture plays on
  hover, focus (`:focus-within`) or touch (`:active`) of `[data-slign-trigger]`.
  `prefers-reduced-motion` switches all of it off.
- **Scope**: classes start with `sl-`, keyframes with `slign-<name>-`, and the only
  id is the hairline gradient `slign-<name>-g`, so many pieces share a page safely.
- **Accessibility**: `role="img"` and an `aria-label` from the object's `label`;
  decorative pieces next to their own text can use an empty label.
- **Weight**: every number costs bytes; round to one decimal and keep paths short.
  Cost scales with how many strokes you draw, not with how clever they are.
