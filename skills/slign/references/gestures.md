# Gestures

A gesture is the one thing an object does when hovered. Pick the kind that fits
what the object is, then adapt the recipe. In every recipe, `ROOT` is the object
and `ACTIVE` is the object while hovered or focused.

Rules that hold for all of them:

- Only `transform` and `opacity` change. The tool rejects anything else.
- Keyframes are named `slign-<name>-<something>`.
- The part that moves is wrapped with `pen.group('part', …)` and targeted as
  `.sl-part`.
- Reduced-motion is already handled: every animation and transition is switched
  off for people who ask for less motion, so the resting state must look complete.

## Turn on a hinge

A lid, a door, a flap. `css` becomes a function. `origin` gives the pivot point
in CSS, `hinge` gives the matrix for the turn.

```js
export const css = ({ hinge, origin }) =>
  `ROOT .sl-lid{transform-box:view-box;transform-origin:${origin([0, -23, 6])};transition:transform .6s cubic-bezier(.34,1.56,.64,1)}` +
  `ACTIVE .sl-lid{transform:${hinge({ axis: [1, 0, 0], up: [0, 0, 1], deg: -15 })}}`;
```

- `origin` takes any 3D point on the hinge line.
- `axis` is the direction of the hinge line.
- `up` is a direction that lies on the part and crosses the hinge: for a lid
  standing up, `[0, 0, 1]`.
- `deg` is the angle. Try both signs and keep the one that turns the right way.

See `examples/laptop.mjs`.

## Lift with a bounce

A part jumps and settles. The spring curve overshoots, which is what makes it feel
alive.

```js
export const css =
  'ROOT .sl-top{transition:transform .5s cubic-bezier(.34,1.8,.64,1)}' +
  'ACTIVE .sl-top{transform:translateY(-9px)}';
```

See `examples/database.mjs`.

## Staggered sequence

The same animation on several parts, each starting a little later.

```js
export const css =
  'ROOT .sl-led1,ROOT .sl-led2,ROOT .sl-led3{opacity:.3}' +
  'ACTIVE .sl-led1{animation:slign-server-on .9s ease-out infinite}' +
  'ACTIVE .sl-led2{animation:slign-server-on .9s ease-out .15s infinite}' +
  'ACTIVE .sl-led3{animation:slign-server-on .9s ease-out .3s infinite}' +
  '@keyframes slign-server-on{0%,100%{opacity:.3}30%{opacity:1}}';
```

See `examples/server.mjs`.

## Continuous motion

Something that keeps going while hovered: floating, spinning, raining.

```js
export const css =
  'ACTIVE .sl-puff{animation:slign-cloud-float 2.4s ease-in-out infinite alternate}' +
  '@keyframes slign-cloud-float{to{transform:translateY(-5px)}}';
```

See `examples/cloud.mjs`.

## Appear in steps

Parts that are hidden at rest and show up one after another. `step-end` makes
each one pop in instead of fading.

```js
export const css =
  'ROOT .sl-t1,ROOT .sl-t2{opacity:0}' +
  'ACTIVE .sl-t1{animation:slign-terminal-t1 2s step-end infinite}' +
  'ACTIVE .sl-t2{animation:slign-terminal-t2 2s step-end infinite}' +
  '@keyframes slign-terminal-t1{0%{opacity:0}15%,100%{opacity:1}}' +
  '@keyframes slign-terminal-t2{0%{opacity:0}35%,100%{opacity:1}}';
```

See `examples/terminal.mjs`.

## Pieces separating

One part moves away while small parts appear where it was.

```js
export const css =
  'ROOT .sl-ship{transition:transform .5s cubic-bezier(.34,1.56,.64,1)}' +
  'ACTIVE .sl-ship{transform:translateY(-12px)}' +
  'ROOT .sl-smoke1{opacity:0;transform-box:fill-box;transform-origin:center}' +
  'ACTIVE .sl-smoke1{animation:slign-rocket-puff 1s ease-out infinite}' +
  '@keyframes slign-rocket-puff{0%{opacity:0;transform:scale(.4)}30%{opacity:1}100%{opacity:0;transform:scale(1.5)}}';
```

To scale or spin a part around its own center, give it
`transform-box:fill-box;transform-origin:center`.

See `examples/rocket.mjs`.
