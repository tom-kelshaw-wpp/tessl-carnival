import { canvasFont, recordScore, theme, type CarnivalGame } from '../../carnival';

const { width: WIDTH, height: HEIGHT } = theme.canvas;

export const HANDS = 8;
export const SLOT_X = [200, 400, 600] as const;
export const REST_Y = 300;
export const CUP_WIDTH = 90;
export const CUP_HEIGHT = 100;
export const SHOW_SECONDS = 1.2;
export const COVER_SECONDS = 0.5;
export const REVEAL_SECONDS = 1.4;
const ARC_HEIGHT = 40;
const LIFT = 70;
const BALL_RADIUS = 14;

/** A swap is the two slots whose cups trade places. */
export type Swap = readonly [number, number];
export const PAIRS: readonly Swap[] = [
  [0, 1],
  [1, 2],
  [0, 2],
];

export type Phase = 'showing' | 'covering' | 'shuffling' | 'picking' | 'revealing' | 'over';

export interface ThreeCupsState {
  hand: number;
  score: number;
  phase: Phase;
  /** `cups[i]` is the slot cup `i` sits in. */
  cups: number[];
  ballCup: number;
  swaps: Swap[];
  /** The swap in progress while shuffling. */
  swapIndex: number;
  /** Seconds spent in the current phase, or in the current swap while shuffling. */
  timer: number;
  /** The slot picked this hand, once there is one. */
  pickedSlot?: number;
  lastHit?: boolean;
}

/** Swaps in hand `n`: 4 + 2 * (n - 1), capped at 14. */
export function swapCount(hand: number): number {
  return Math.min(4 + 2 * (hand - 1), 14);
}

/** Seconds per swap in hand `n`: 0.55 - 0.05 * (n - 1), never below 0.2. */
export function swapSeconds(hand: number): number {
  return Math.max(0.2, Math.round((0.55 - 0.05 * (hand - 1)) * 100) / 100);
}

/** A correct pick on hand `n` scores 10 * n. */
export function pointsForHand(hand: number): number {
  return 10 * hand;
}

/** `count` swaps, one `random()` call each, never the same pair twice in a row. */
export function shuffleSequence(count: number, random: () => number): Swap[] {
  const swaps: Swap[] = [];
  let previous = -1;
  for (let i = 0; i < count; i++) {
    let index = Math.floor(random() * 3);
    if (index === previous) index = (index + 1) % 3;
    swaps.push(PAIRS[index]);
    previous = index;
  }
  return swaps;
}

/** Returns new cup slots with the cups in the swap's two slots traded. */
export function applySwap(cups: readonly number[], swap: Swap): number[] {
  const [a, b] = swap;
  return cups.map((slot) => (slot === a ? b : slot === b ? a : slot));
}

/** Draws the ball cup and the shuffle for `hand`, and puts the cups back in order. */
function startHand(state: ThreeCupsState, hand: number, random: () => number): void {
  state.hand = hand;
  state.phase = 'showing';
  state.cups = [0, 1, 2];
  state.ballCup = Math.floor(random() * 3);
  state.swaps = shuffleSequence(swapCount(hand), random);
  state.swapIndex = 0;
  state.timer = 0;
  state.pickedSlot = undefined;
  state.lastHit = undefined;
}

export function createState(random: () => number): ThreeCupsState {
  const state: ThreeCupsState = {
    hand: 1,
    score: 0,
    phase: 'showing',
    cups: [0, 1, 2],
    ballCup: 0,
    swaps: [],
    swapIndex: 0,
    timer: 0,
  };
  startHand(state, 1, random);
  return state;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * Where a cup moving from slot `from` to slot `to` is at `progress` (0 to 1).
 * The cup moving right arcs lower on screen, in front; the one moving left arcs higher.
 */
export function cupPositionDuringSwap(
  from: number,
  to: number,
  progress: number,
): { x: number; y: number } {
  const p = Math.min(Math.max(progress, 0), 1);
  const x = SLOT_X[from] + (SLOT_X[to] - SLOT_X[from]) * smoothstep(p);
  const arc = ARC_HEIGHT * Math.sin(Math.PI * p);
  return { x, y: REST_Y + (to > from ? arc : to < from ? -arc : 0) };
}

/** The slot whose cup, at rest, covers the canvas point, or undefined. */
export function slotAtPoint(x: number, y: number): number | undefined {
  if (Math.abs(y - REST_Y) > CUP_HEIGHT / 2) return undefined;
  const slot = SLOT_X.findIndex((slotX) => Math.abs(x - slotX) <= CUP_WIDTH / 2);
  return slot === -1 ? undefined : slot;
}

/** Picks the cup in `slot`. Returns false and changes nothing outside the pick step. */
export function pick(state: ThreeCupsState, slot: number): boolean {
  if (state.phase !== 'picking') return false;
  const hit = state.cups.indexOf(slot) === state.ballCup;
  if (hit) state.score += pointsForHand(state.hand);
  state.pickedSlot = slot;
  state.lastHit = hit;
  state.phase = 'revealing';
  state.timer = 0;
  return true;
}

/** Advances the game by `dt` seconds. Waits in `picking` for a pick, and stops in `over`. */
export function step(state: ThreeCupsState, dt: number, random: () => number): void {
  if (state.phase === 'picking' || state.phase === 'over') return;
  state.timer += dt;

  for (;;) {
    if (state.phase === 'showing' && state.timer >= SHOW_SECONDS) {
      state.timer -= SHOW_SECONDS;
      state.phase = 'covering';
    } else if (state.phase === 'covering' && state.timer >= COVER_SECONDS) {
      state.timer -= COVER_SECONDS;
      state.phase = state.swaps.length > 0 ? 'shuffling' : 'picking';
    } else if (state.phase === 'shuffling' && state.timer >= swapSeconds(state.hand)) {
      state.timer -= swapSeconds(state.hand);
      state.cups = applySwap(state.cups, state.swaps[state.swapIndex]);
      state.swapIndex += 1;
      if (state.swapIndex >= state.swaps.length) {
        state.phase = 'picking';
        state.timer = 0;
      }
    } else if (state.phase === 'revealing' && state.timer >= REVEAL_SECONDS) {
      if (state.hand >= HANDS) {
        state.phase = 'over';
        state.timer = 0;
      } else {
        const leftover = state.timer - REVEAL_SECONDS;
        startHand(state, state.hand + 1, random);
        state.timer = leftover;
      }
    } else {
      return;
    }
  }
}

/** Where each cup is drawn, and how far it is lifted off the table. */
function cupPlacements(state: ThreeCupsState) {
  const swap = state.phase === 'shuffling' ? state.swaps[state.swapIndex] : undefined;
  const progress = swap ? state.timer / swapSeconds(state.hand) : 0;

  let lift = 0;
  if (state.phase === 'showing') lift = LIFT;
  if (state.phase === 'covering') lift = LIFT * (1 - state.timer / COVER_SECONDS);

  return state.cups.map((slot, cup) => {
    let position: { x: number; y: number } = { x: SLOT_X[slot], y: REST_Y };
    if (swap && (slot === swap[0] || slot === swap[1])) {
      const to = slot === swap[0] ? swap[1] : swap[0];
      position = cupPositionDuringSwap(slot, to, progress);
    }
    let cupLift = lift;
    if (state.phase === 'revealing' || state.phase === 'over') {
      const shown = slot === state.pickedSlot || cup === state.ballCup;
      cupLift = shown ? LIFT * Math.min(state.timer / 0.25, 1) : 0;
      if (state.phase === 'over') cupLift = cup === state.ballCup ? LIFT : 0;
    }
    return { cup, slot, ...position, lift: cupLift };
  });
}

function drawCup(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const { colors } = theme;
  const top = y - CUP_HEIGHT / 2;
  const bottom = y + CUP_HEIGHT / 2;
  ctx.fillStyle = colors.stripeA;
  ctx.beginPath();
  ctx.moveTo(x - CUP_WIDTH * 0.3, top);
  ctx.lineTo(x + CUP_WIDTH * 0.3, top);
  ctx.lineTo(x + CUP_WIDTH / 2, bottom);
  ctx.lineTo(x - CUP_WIDTH / 2, bottom);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = colors.accent;
  ctx.fillRect(x - CUP_WIDTH / 2 - 2, bottom - 10, CUP_WIDTH + 4, 10);
}

function draw(ctx: CanvasRenderingContext2D, state: ThreeCupsState) {
  const { colors } = theme;

  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Booth awning.
  const stripe = WIDTH / 16;
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i % 2 === 0 ? colors.stripeA : colors.stripeB;
    ctx.fillRect(i * stripe, 0, stripe, 40);
  }

  // Table.
  const tableTop = REST_Y + CUP_HEIGHT / 2 - 20;
  ctx.fillStyle = colors.wood;
  ctx.fillRect(80, tableTop, WIDTH - 160, 90);

  const placements = cupPlacements(state);

  // The ball sits on the table under its cup, and shows whenever the cups lift.
  const ballSlot = placements[state.ballCup];
  if (state.phase !== 'shuffling' && state.phase !== 'picking') {
    ctx.fillStyle = colors.accent;
    ctx.beginPath();
    ctx.arc(
      SLOT_X[ballSlot.slot],
      REST_Y + CUP_HEIGHT / 2 - BALL_RADIUS,
      BALL_RADIUS,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  // Draw back to front, so the cup moving right passes in front.
  for (const placement of [...placements].sort((a, b) => a.y - b.y)) {
    drawCup(ctx, placement.x, placement.y - placement.lift);
  }

  ctx.textAlign = 'center';
  ctx.font = canvasFont('title', 'bold');
  if (state.phase === 'revealing') {
    ctx.fillStyle = state.lastHit ? colors.accent : colors.danger;
    ctx.fillText(state.lastHit ? `Hit! +${pointsForHand(state.hand)}` : 'Miss!', WIDTH / 2, 100);
  } else if (state.phase === 'picking') {
    ctx.fillStyle = colors.text;
    ctx.fillText('Which cup hides the ball?', WIDTH / 2, 100);
  }

  ctx.fillStyle = colors.text;
  ctx.font = canvasFont('body', 'bold');
  ctx.textAlign = 'left';
  ctx.fillText(`Hand ${state.hand}/${HANDS}`, 16, HEIGHT - 20);
  ctx.textAlign = 'right';
  ctx.fillText(`Score ${state.score}`, WIDTH - 16, HEIGHT - 20);

  if (state.phase === 'over') {
    ctx.fillStyle = colors.background;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.accent;
    ctx.font = canvasFont('title', 'bold');
    ctx.fillText(`Round over! You scored ${state.score}`, WIDTH / 2, HEIGHT / 2);
    ctx.fillStyle = colors.text;
    ctx.font = canvasFont('body');
    ctx.fillText('Click or press Enter to play again', WIDTH / 2, HEIGHT / 2 + 40);
  }
}

export const threeCups: CarnivalGame = {
  id: 'three-cups',
  name: 'Three Cups',
  description: 'Follow the ball and pick the right cup. Later hands shuffle faster.',

  start(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    const random = Math.random;
    let state = createState(random);
    let scoreRecorded = false;

    const restart = () => {
      state = createState(random);
      scoreRecorded = false;
    };

    const onDown = (event: PointerEvent) => {
      if (state.phase === 'over') {
        restart();
        return;
      }
      const rect = canvas.getBoundingClientRect();
      const slot = slotAtPoint(
        ((event.clientX - rect.left) / rect.width) * WIDTH,
        ((event.clientY - rect.top) / rect.height) * HEIGHT,
      );
      if (slot !== undefined) pick(state, slot);
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key === ' ') event.preventDefault();
      if (state.phase === 'over') {
        if (event.key === 'Enter' || event.key === ' ') restart();
        return;
      }
      if (event.key === '1' || event.key === '2' || event.key === '3') {
        pick(state, Number(event.key) - 1);
      }
    };

    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);

    let frame = 0;
    let last = performance.now();
    const loop = (time: number) => {
      // Cap the step so a background tab doesn't skip the shuffle.
      const dt = Math.min((time - last) / 1000, 0.05);
      last = time;
      step(state, dt, random);
      if (state.phase === 'over' && !scoreRecorded) {
        recordScore(threeCups.id, state.score);
        scoreRecorded = true;
      }
      draw(ctx, state);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  },
};

export default threeCups;
