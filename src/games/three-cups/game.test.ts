import { describe, expect, it } from 'vitest';
import {
  COVER_SECONDS,
  CUP_HEIGHT,
  HANDS,
  REST_Y,
  REVEAL_SECONDS,
  SHOW_SECONDS,
  SLOT_X,
  applySwap,
  createState,
  cupPositionDuringSwap,
  pick,
  pointsForHand,
  shuffleSequence,
  slotAtPoint,
  step,
  swapCount,
  swapSeconds,
  threeCups,
  type ThreeCupsState,
} from './game';

const zero = () => 0;

/** A repeatable stand-in for Math.random. */
function seeded(seed: number) {
  let value = seed;
  return () => {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
}

const DT = 0.01;

/** Steps until the phase changes, or gives up after `limit` seconds. */
function stepUntilPhaseChanges(state: ThreeCupsState, random: () => number, limit = 20) {
  const phase = state.phase;
  for (let t = 0; t < limit && state.phase === phase; t += DT) step(state, DT, random);
}

function stepUntil(state: ThreeCupsState, phase: string, random: () => number, limit = 20) {
  for (let t = 0; t < limit && state.phase !== phase; t += DT) step(state, DT, random);
}

function ballSlot(state: ThreeCupsState) {
  return state.cups[state.ballCup];
}

describe('three cups', () => {
  it('has the right id and name', () => {
    expect(threeCups.id).toBe('three-cups');
    expect(threeCups.name).toBe('Three Cups');
  });

  it('starts on hand 1 with no score, showing the ball', () => {
    const state = createState(zero);
    expect(state.hand).toBe(1);
    expect(state.score).toBe(0);
    expect(state.phase).toBe('showing');
    expect(state.cups).toEqual([0, 1, 2]);
    expect(state.ballCup).toBe(0);
    expect(createState(() => 0.99).ballCup).toBe(2);
    expect(createState(() => 0.5).ballCup).toBe(1);
  });

  describe('shuffleSequence', () => {
    it('makes the right number of valid swaps, never the same pair twice in a row', () => {
      const swaps = shuffleSequence(14, seeded(7));
      expect(swaps).toHaveLength(14);
      for (const [a, b] of swaps) {
        expect(a).not.toBe(b);
        for (const slot of [a, b]) expect([0, 1, 2]).toContain(slot);
      }
      for (let i = 1; i < swaps.length; i++) expect(swaps[i]).not.toEqual(swaps[i - 1]);
    });

    it('gives the same sequence for the same random', () => {
      expect(shuffleSequence(10, seeded(3))).toEqual(shuffleSequence(10, seeded(3)));
    });

    it('calls random exactly once per swap', () => {
      let calls = 0;
      shuffleSequence(9, () => {
        calls += 1;
        return 0.4;
      });
      expect(calls).toBe(9);
    });

    it('matches the worked example when random always returns 0', () => {
      expect(shuffleSequence(4, zero)).toEqual([
        [0, 1],
        [1, 2],
        [0, 1],
        [1, 2],
      ]);
    });
  });

  describe('applySwap', () => {
    it('trades the two cups in the swap and leaves the third alone', () => {
      expect(applySwap([0, 1, 2], [0, 2])).toEqual([2, 1, 0]);
      expect(applySwap([2, 0, 1], [0, 1])).toEqual([2, 1, 0]);
    });

    it('keeps the cups a permutation over a whole sequence', () => {
      let cups = [0, 1, 2];
      for (const swap of shuffleSequence(14, seeded(11))) {
        cups = applySwap(cups, swap);
        expect([...cups].sort()).toEqual([0, 1, 2]);
      }
    });

    it('ends the worked example in [1, 2, 0]', () => {
      const cups = shuffleSequence(4, zero).reduce(applySwap, [0, 1, 2]);
      expect(cups).toEqual([1, 2, 0]);
    });
  });

  it('shuffles more and faster each hand, with a cap and a floor', () => {
    expect([1, 2, 6, 8].map(swapCount)).toEqual([4, 6, 14, 14]);
    expect([1, 2, 6, 8].map(swapSeconds)).toEqual([0.55, 0.5, 0.3, 0.2]);
    expect(swapSeconds(20)).toBe(0.2);
    expect([1, 2, 6, 8].map(pointsForHand)).toEqual([10, 20, 60, 80]);
  });

  describe('cupPositionDuringSwap', () => {
    it('starts and ends at rest in the two slots', () => {
      expect(cupPositionDuringSwap(0, 2, 0)).toEqual({ x: SLOT_X[0], y: REST_Y });
      expect(cupPositionDuringSwap(0, 2, 1).x).toBeCloseTo(SLOT_X[2]);
      expect(cupPositionDuringSwap(0, 2, 1).y).toBeCloseTo(REST_Y);
    });

    it('clamps progress to 0 to 1', () => {
      expect(cupPositionDuringSwap(1, 0, -1)).toEqual(cupPositionDuringSwap(1, 0, 0));
      expect(cupPositionDuringSwap(1, 0, 2)).toEqual(cupPositionDuringSwap(1, 0, 1));
    });

    it('passes the cup moving right in front of the cup moving left', () => {
      const right = cupPositionDuringSwap(0, 1, 0.5);
      const left = cupPositionDuringSwap(1, 0, 0.5);
      expect(right.x).toBeCloseTo(left.x);
      expect(right.y).toBeCloseTo(REST_Y + 40);
      expect(left.y).toBeCloseTo(REST_Y - 40);
    });
  });

  it('finds the cup under a point, and nothing between cups', () => {
    SLOT_X.forEach((x, slot) => expect(slotAtPoint(x, REST_Y)).toBe(slot));
    expect(slotAtPoint(300, REST_Y)).toBeUndefined();
    expect(slotAtPoint(SLOT_X[1], REST_Y - CUP_HEIGHT)).toBeUndefined();
  });

  describe('pick', () => {
    it('scores the hand on a hit', () => {
      const state = createState(zero);
      stepUntil(state, 'picking', zero);
      expect(pick(state, ballSlot(state))).toBe(true);
      expect(state.score).toBe(pointsForHand(1));
      expect(state.lastHit).toBe(true);
      expect(state.phase).toBe('revealing');
    });

    it('scores nothing on a miss', () => {
      const state = createState(zero);
      stepUntil(state, 'picking', zero);
      expect(pick(state, (ballSlot(state) + 1) % 3)).toBe(true);
      expect(state.score).toBe(0);
      expect(state.lastHit).toBe(false);
      expect(state.phase).toBe('revealing');
    });

    it('is ignored outside the pick step', () => {
      const state = createState(zero);
      expect(pick(state, ballSlot(state))).toBe(false);
      expect(state.phase).toBe('showing');
      expect(state.score).toBe(0);
    });

    it('does not score twice in one hand', () => {
      const state = createState(zero);
      stepUntil(state, 'picking', zero);
      pick(state, ballSlot(state));
      expect(pick(state, ballSlot(state))).toBe(false);
      expect(state.score).toBe(pointsForHand(1));
    });
  });

  describe('step', () => {
    it('runs a hand through its phases and waits for a pick', () => {
      const state = createState(zero);
      const phases: string[] = [state.phase];
      for (let i = 0; i < 3; i++) {
        stepUntilPhaseChanges(state, zero);
        phases.push(state.phase);
      }
      expect(phases).toEqual(['showing', 'covering', 'shuffling', 'picking']);
      expect(state.cups).toEqual([1, 2, 0]);

      for (let i = 0; i < 1000; i++) step(state, DT, zero);
      expect(state.phase).toBe('picking');

      pick(state, 0);
      expect(state.phase).toBe('revealing');
      stepUntilPhaseChanges(state, zero);
      expect(state.phase).toBe('showing');
      expect(state.hand).toBe(2);
      expect(state.cups).toEqual([0, 1, 2]);
      expect(state.pickedSlot).toBeUndefined();
    });

    it('takes the timings in the brief', () => {
      const state = createState(zero);
      step(state, SHOW_SECONDS - DT, zero);
      expect(state.phase).toBe('showing');
      step(state, DT, zero);
      expect(state.phase).toBe('covering');
      step(state, COVER_SECONDS, zero);
      expect(state.phase).toBe('shuffling');
      step(state, swapCount(1) * swapSeconds(1), zero);
      expect(state.phase).toBe('picking');
      pick(state, 0);
      step(state, REVEAL_SECONDS - DT, zero);
      expect(state.phase).toBe('revealing');
      step(state, DT, zero);
      expect(state.hand).toBe(2);
    });

    it('ends after hand 8, totals 360 for a perfect round, and stays over', () => {
      const random = seeded(42);
      const state = createState(random);
      for (let hand = 1; hand <= HANDS; hand++) {
        expect(state.hand).toBe(hand);
        stepUntil(state, 'picking', random);
        expect(pick(state, ballSlot(state))).toBe(true);
        stepUntilPhaseChanges(state, random);
      }
      expect(state.phase).toBe('over');
      expect(state.score).toBe(360);

      for (let i = 0; i < 1000; i++) step(state, DT, random);
      expect(state.phase).toBe('over');
      expect(state.hand).toBe(HANDS);
      expect(state.score).toBe(360);
    });
  });
});
