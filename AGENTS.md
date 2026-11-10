# Slign

A skill that teaches coding agents to draw hand-inked isometric illustrations as
self-contained animated SVG. This file is for agents working **on** this repo.
To **use** Slign in another project, read `skills/slign/SKILL.md`.

## Layout

- `skills/slign/SKILL.md` - the skill: when to use it, the style, the steps.
- `skills/slign/scripts/pen.mjs` - projection, the wobbly ink line, hinges.
- `skills/slign/scripts/draw.mjs` - turns an object file into an SVG and checks it.
- `skills/slign/references/` - longer guides the skill points to.
- `skills/slign/examples/` - reference objects: `<name>.mjs` and its generated `<name>.svg`.
- `tests/` - `node:test` suites.
- `evals/` - prompts and a grader used to tune the skill.
- `build.mjs` - regenerates every example SVG and a local preview.

## Commands

- `npm test` - run every test.
- `node build.mjs` - regenerate the example SVGs and `preview/index.html`.
- `node skills/slign/scripts/draw.mjs <object.mjs>` - draw one object.

## Rules

- No dependencies. Node only.
- Example SVGs are generated. Edit the `.mjs`, run `node build.mjs`, commit both.
  A test fails if they drift.
- The style is the product. A change that breaks a rule in `SKILL.md` is a bug.
  `export const style` selects the pen. The default `ink` keeps every rule: one
  ink, no fills, draw only visible edges, show thickness, a face, one gesture,
  only `transform` and `opacity` in motion. The other pens follow their own:
  - `hairline`: thin technical lines; one scoped gradient is allowed.
  - `engrave`: hatched faces; a paper fill under each face is allowed.
  - `icon`: 24 grid, flat, no face.
- Keep `SKILL.md` short: it is loaded every time the skill triggers, and its
  description in every session. `tests/skill.test.mjs` caps both. Long material
  goes in `references/`.
- Everything in this repo is in English.
- Never commit machine paths, usernames, IP addresses, keys or third-party
  reference art.
- Commit messages: `type: what changes`, present tense, no trailers.
