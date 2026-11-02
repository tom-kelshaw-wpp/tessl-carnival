# The Midway Bar

The red tent on the midway is a bar. Walk up to it and press `E` to step
inside. The bar is a place to look at, not a game: there is no score, no round
and nothing to click. Use "Back to the midway" to leave.

## The price board

Every drink is alcohol free. The board lists `DRINKS` in this order:

| Drink                | Price |
| -------------------- | ----- |
| Sparkling Lemonade   | $3.00 |
| Cherry Cola          | $2.75 |
| Root Beer Float      | $4.50 |
| Blue Raspberry Slush | $3.50 |
| Hot Apple Cider      | $3.25 |
| Ginger Fizz          | $3.75 |
| Cotton Candy Soda    | $4.25 |

Prices are whole US cents, shown with `formatPrice` (`350` is `$3.50`).

## How the scene is built

The scene is drawn on the 800 by 500 canvas from scratch each frame, with plain
canvas calls and the carnival's theme. There are no image files. From the top:
a striped awning with a string of lamps, a back wall with two wooden shelves of
bottles, the price board, a bartender wiping a glass, a wooden counter with
glasses, and 4 stools.

- `layoutBar(random)` places the shelves, the 16 bottles (8 per shelf) and the
  stools. Each bottle takes its height (40 to 70 px), then its colour (one of
  `BOTTLE_COLORS`), from `random`, shelf by shelf. `start` passes a seeded
  generator (`mulberry32(BAR_SEED)`), so the bar looks the same every visit.
- `wipeAngle(t)` swings the bartender's arm between -0.5 and 0.5 radians,
  once every `WIPE_PERIOD` (1.6) seconds.
- `lampGlow(index, t)` makes each lamp twinkle every 2 seconds, out of step
  with its neighbours.
- With reduced motion turned on, time holds at 0 and the scene is still.

The bar never calls `recordScore` and never touches local storage, so the
midway shows no best score for it.

## Files

- `game.ts`: the price list (`DRINKS`, `formatPrice`, `priceBoardLines`), the
  scene (`layoutBar`, `mulberry32`, `wipeAngle`, `lampGlow`) and the `bar`
  entry, the default export the midway finds.
- `game.test.ts`: tests for the price list and the scene's functions.
