---
name: review-carnival-house-rules
description: Review a change to a carnival game for house rules 1 to 3 in AGENTS.md: the game registers on the midway, reports scores through recordScore from src/carnival, and draws with theme and canvasFont. Use as one lens in a code review run on changes under src/games/.
---

# Review lens: Carnival House Rules

Review whether each game in the change follows house rules 1 to 3 in `AGENTS.md`, the rules that keep every booth on the midway working the same way.

## Scope

- **Registration** A game lives in `src/games/<game-id>/`, its `game.ts` has its `CarnivalGame` as the default export, and the game's `id` matches its folder name. `src/games/index.ts` finds every `./*/game.ts` and builds the midway's booths from them.
- **Scores** A game reports a finished round by calling `recordScore(game.id, score)` from `src/carnival`, once, when the round ends. It does not read or write local storage itself, keep its own high score table, or import from `src/carnival/scores.ts` past the `src/carnival` index.
- **Theme** A game draws with `theme` and `canvasFont` from `src/carnival`. A hex colour, `rgb()` or named colour, or a hand-written font string inside a game breaks the rule.

Code outside `src/games/` is out of scope: `src/carnival/` defines the theme and the scores, and `src/midway/palette.ts` has its own scenery colours.

## Method

Read house rules 1 to 3 in `AGENTS.md`, then `src/games/index.ts` and `src/carnival/index.ts`, so each finding rests on what the code does today rather than on this lens.

For each changed game folder, check the folder name against the `id` in `game.ts`, and that `game.ts` default-exports the game.

Follow each round from start to end and count the `recordScore` calls on that path. Look for `localStorage`, `sessionStorage` or a module-level best score kept beside it.

Read every `fillStyle`, `strokeStyle`, `shadowColor`, gradient stop and `font` assignment in the changed drawing code back to where its value comes from.

## Threshold

Report a game that breaks one of the three rules in the changed code.

Do not report:

- A value derived from the theme, such as a colour picked from `theme.colors`, a size computed from `theme.canvas` or `theme.font`, or a transparency built on a theme colour.
- Test data in `game.test.ts`.
- Anything lint, the type-checker or the tests already enforce. `src/games/index.test.ts` already fails when a game folder has no default export from `game.ts` or an `id` that differs from its folder, so report those only when the change also edits that test or `src/games/index.ts` so it no longer catches them.
- Code outside `src/games/`.

## Reporting

- Name the rule, the file and line, and the value or call that breaks it.
- Be accurate about the consequence, from the code as it is:
  - A folder with no `game.ts` gets no booth, and the registry test fails because the folder has no game.
  - A `game.ts` with no default export, or with an `id` that differs from its folder, makes `src/games/index.ts` throw when the midway loads, so no booth shows, not only this one.
  - A score recorded twice, or never, puts the wrong entries on the booth card and the scoreboard.
  - A game that stores scores itself keeps a table the midway never shows, and its scores are missing from the shared one.
  - A colour or font outside the theme looks out of place now and does not follow the theme when it changes.
- State the fix: the theme key to use, such as `theme.colors.water` for a blue, the `canvasFont` call that matches the size, or where the single `recordScore` call belongs.
