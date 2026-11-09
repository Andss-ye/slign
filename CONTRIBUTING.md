# Contributing

Thanks for wanting to add to Slign. Most contributions are one of two things: a
fix to the skill or its scripts, or a new reference object.

## Set up

```
git clone https://github.com/andss-ye/slign
cd slign
npm test
node build.mjs     # then open preview/index.html
```

Node 22 or newer. There are no dependencies to install.

## Adding a reference object

A reference object earns its place by teaching something the others do not: a new
kind of shape or a new kind of gesture. Say which in your pull request.

1. Create `skills/slign/examples/<name>.mjs`. Start from the closest example.
2. Run `node build.mjs`. It writes `<name>.svg` and the preview.
3. Look at it in `preview/index.html`, at rest, hovered, and with the dark toggle.
4. Run `npm test`.
5. Add its name to the example list in `skills/slign/SKILL.md`. A test fails
   if you forget.
6. Commit the `.mjs` and the `.svg` together.

Before you open the pull request, check that:

- It reads as the object without its name.
- It is one ink with no fills, and no edge shows that should be hidden.
- Every volume shows its thickness.
- It has a face, or the pull request says why not.
- Its gesture is its own and animates only `transform` and `opacity`.
- It weighs under 8 KB.
- It looks like it was drawn by the same hand as the others.

Please do not trace other people's artwork, and do not add brand logos.

## Changing the skill

`skills/slign/SKILL.md` is read by agents, so small wording changes can change
behaviour. If you edit it, say what you saw an agent do wrong and how the change
fixes it. `evals/` has prompts you can run to compare before and after.

## Style

- No dependencies.
- Everything in English.
- Commit messages: `type: what changes`, present tense.
