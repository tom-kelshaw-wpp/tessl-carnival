# Three Cups

The classic shell game: follow the ball as the cups shuffle, then pick the cup
that hides it.

## How to play

- Each round is 8 hands. In each hand the cups lift for 1.2 seconds to show the
  ball, drop over it (0.5 seconds), then shuffle. The cup that moves right
  passes in front of the cup that moves left.
- When the shuffle stops, pick a cup. Take as long as you like. The picked cup
  and the ball's cup lift for 1.4 seconds to show the result, then the next hand
  starts.
- The round ends after the 8th hand's result.
- Click again, or press `Enter` or `Space`, on the game over screen to play
  another round.

### Controls

- Mouse: click a cup to pick it.
- Keyboard: press `1`, `2` or `3` to pick the left, middle or right cup.
- Picks only count once the shuffle has stopped.

## Scoring

A correct pick on hand `n` scores `10 * n` points, and a wrong pick scores 0.
Each hand has `4 + 2 * (n - 1)` swaps, capped at 14, and each swap takes
`0.55 - 0.05 * (n - 1)` seconds, never less than 0.2.

| Hand | Swaps | Seconds per swap | Points |
| ---- | ----- | ---------------- | ------ |
| 1    | 4     | 0.55             | 10     |
| 2    | 6     | 0.50             | 20     |
| 3    | 8     | 0.45             | 30     |
| 4    | 10    | 0.40             | 40     |
| 5    | 12    | 0.35             | 50     |
| 6    | 14    | 0.30             | 60     |
| 7    | 14    | 0.25             | 70     |
| 8    | 14    | 0.20             | 80     |

The best possible round is 360. Your final score, even 0, is saved to the
carnival's score board when the round ends.

## Files

- `game.ts`: the game logic (`createState`, `shuffleSequence`, `applySwap`,
  `swapCount`, `swapSeconds`, `pointsForHand`, `cupPositionDuringSwap`,
  `slotAtPoint`, `pick`, `step`) and the `threeCups` entry, the
  default export the midway finds. Every random choice comes from the `random`
  passed in, so tests can pin the shuffle.
- `game.test.ts`: tests for the game logic.
