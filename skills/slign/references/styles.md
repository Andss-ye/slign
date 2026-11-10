# Styles

Pick one per project from the page profile (`lib.mjs init` stores it in
`slign/slign.config.json`). An object selects its pen with `export const style`;
`add` fills `palette` from the config when the object leaves it out.

| Style | For | Look | Rules |
|---|---|---|---|
| `ink` | playful, monospace, friendly pages | Thick wobbly hand line, isometric | One `currentColor` ink, no fills, a face (two eyes), one gesture |
| `hairline` | dark or clean SaaS pages | Precise isometric thin line, gradient, soft glow | No face. One gradient from `palette.stops`; `pen.face` hides edges behind it |
| `engrave` | cream or paper pages with serif type | Hatched shading, paper fill | No face. Draw back to front with `pen.face`; hatch density follows tone |
| `icon` | 24px UI icons | Flat 24 grid, one stroke, `currentColor` | No face, no gradient, a tiny gesture on hover |

## Palette

```js
export const palette = { ink: '#002ede', paper: '#f7f5f1', stops: ['#8fd0f5', '#3f73d9'], accent: '#ff7ad9' };
```

- `ink`: the page's heading or link color. Leave it out in icons so they follow `color`.
- `paper`: the page's section background. On a dark page set it too, or filled faces turn white; at runtime override with `--slign-paper`.
- `stops` (hairline): two colors from the page's own gradient or accent.
- Check contrast against the page: ink on paper at 3:1 or more.

## Pen calls

- `ink`, `hairline`, `engrave`: `line`, `curve`, `ring`, `dot`, `group`, with 3D points `[x, y, z]`
  (x down-right, y down-left, z up). `ink` adds `eye`; `engrave` and `hairline` add `face`.
- `icon`: the same calls with 2D points `[x, y]` on 0..24.

## Choosing when unsure

Match the page's corners and weight: square and serif means `engrave`; rounded
and thin means `hairline`; chunky and warm means `ink`. A mix is fine for
different jobs (icons for lists, an illustration for a hero) but keep one
palette. A pixel-art or photo-heavy page may clash with any hand style: say so.
