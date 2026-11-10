# The project library

One `slign/` folder per project, ordered and regenerable.

```
slign/
  slign.config.json   style, palette, formats, size budgets
  index.json          every piece: name, kind, style, bytes, file
  icons/ illustrations/ components/   the .svg (and .jsx or .swift)
  src/                the object files; `build` redraws everything from them
```

## Commands (`node <skill>/scripts/lib.mjs ...`)

| Command | Does |
|---|---|
| `init [--url <page>] [--format jsx\|swift]` | Reads the page, writes config and an empty index. `--force` overwrites. |
| `add <object.mjs> [--kind icon\|illustration\|component]` | Checks the object, enforces the budget, writes files, updates the index. A duplicate name needs `--force`. |
| `list [--json]` | Name, kind, style, bytes. |
| `place <name> --into <page>` | Replaces `<!-- slign:<name> -->` (or the same drawing already there). |
| `rename <old> <new>`, `remove <name>` | Keep index, files and `src/` in step. |
| `build` | Redraws from `src/`; prints `ok` or the drifted files. |

Errors are one line starting with `error` and say what to fix.

## Budgets and cost

- Icon: about 600 bytes of SVG; `add` warns above 520 and fails above 700.
- Illustration: ideally 8 KB or less, 12 KB is the limit. Smaller means fewer tokens
  and faster pages; drop detail before adding it.
- Name pieces for the product's noun (`invoice-empty`, `deploy-icon`), kebab-case.

## Using pieces

- Static pages: `place`. React: `import Bell from '../slign/icons/bell.jsx'`.
- Never paste the SVG through the model; always `add` then `place` or import.
- Regenerate with `build` after changing `slign.config.json` (palette, style).
