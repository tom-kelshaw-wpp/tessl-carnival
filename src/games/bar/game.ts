import { canvasFont, theme, type CarnivalGame } from '../../carnival';

const { width: WIDTH, height: HEIGHT } = theme.canvas;

export interface Drink {
  id: string;
  name: string;
  priceCents: number;
}

/** The price board, top to bottom. Every drink is alcohol free. */
export const DRINKS: readonly Drink[] = [
  { id: 'lemonade', name: 'Sparkling Lemonade', priceCents: 300 },
  { id: 'cherry-cola', name: 'Cherry Cola', priceCents: 275 },
  { id: 'root-beer-float', name: 'Root Beer Float', priceCents: 450 },
  { id: 'blue-slush', name: 'Blue Raspberry Slush', priceCents: 350 },
  { id: 'apple-cider', name: 'Hot Apple Cider', priceCents: 325 },
  { id: 'ginger-fizz', name: 'Ginger Fizz', priceCents: 375 },
  { id: 'cotton-candy-soda', name: 'Cotton Candy Soda', priceCents: 425 },
];

/** The theme colours a bottle can be. */
export const BOTTLE_COLORS = ['stripeA', 'accent', 'water', 'stripeB', 'danger'] as const;
export type BottleColor = (typeof BOTTLE_COLORS)[number];

export const AWNING_HEIGHT = 40;
export const SHELF_X = { from: 30, to: 430 } as const;
export const SHELF_YS = [150, 250] as const;
export const BOTTLES_PER_SHELF = 8;
export const BOTTLE_WIDTH = 20;
export const BOTTLE_HEIGHT = { min: 40, max: 70 } as const;
export const COUNTER = { y: 330, height: 70 } as const;
export const STOOL_COUNT = 4;
export const LAMP_COUNT = 16;
/** Seconds for one wipe of the glass, there and back. */
export const WIPE_PERIOD = 1.6;
/** Seconds for one twinkle of a lamp. */
export const LAMP_PERIOD = 2;
/** The seed `start` uses, so the bar looks the same every visit. */
export const BAR_SEED = 0x0ba5;

const BOARD = { x: 470, y: 70, width: 300, height: 250 } as const;
const BARTENDER_X = 250;
const GLASS_XS = [80, 160, 420, 560, 680];

export interface Shelf {
  y: number;
  x: { from: number; to: number };
}

export interface Bottle {
  shelf: number;
  /** The bottle's centre. */
  x: number;
  height: number;
  color: BottleColor;
}

export interface Stool {
  x: number;
  /** The top of the seat. */
  y: number;
}

export interface BarLayout {
  shelves: Shelf[];
  bottles: Bottle[];
  stools: Stool[];
}

/** A tiny seeded generator (mulberry32), so the layout repeats for a seed. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Whole cents as dollars: 350 gives `$3.50`. */
export function formatPrice(cents: number): string {
  if (!Number.isInteger(cents) || cents < 0) {
    throw new RangeError(`Price must be a whole, non-negative number of cents, not ${cents}`);
  }
  const dollars = Math.floor(cents / 100);
  const rest = String(cents % 100).padStart(2, '0');
  return `$${dollars}.${rest}`;
}

export function priceBoardLines(drinks: readonly Drink[] = DRINKS) {
  return drinks.map((drink) => ({ name: drink.name, price: formatPrice(drink.priceCents) }));
}

/**
 * Lays out the shelves, bottles and stools. `random` is called once per bottle
 * for its height and once for its colour, in that order, shelf by shelf.
 */
export function layoutBar(random: () => number): BarLayout {
  const shelves = SHELF_YS.map((y) => ({ y, x: { ...SHELF_X } }));
  const slot = (SHELF_X.to - SHELF_X.from) / BOTTLES_PER_SHELF;
  const bottles: Bottle[] = [];
  shelves.forEach((_, shelf) => {
    for (let i = 0; i < BOTTLES_PER_SHELF; i++) {
      const height =
        BOTTLE_HEIGHT.min + Math.round(random() * (BOTTLE_HEIGHT.max - BOTTLE_HEIGHT.min));
      const pick = Math.min(Math.floor(random() * BOTTLE_COLORS.length), BOTTLE_COLORS.length - 1);
      bottles.push({
        shelf,
        x: SHELF_X.from + slot * (i + 0.5),
        height,
        color: BOTTLE_COLORS[pick],
      });
    }
  });
  const stools = Array.from({ length: STOOL_COUNT }, (_, i) => ({
    x: (WIDTH / STOOL_COUNT) * (i + 0.5),
    y: COUNTER.y + COUNTER.height + 30,
  }));
  return { shelves, bottles, stools };
}

/** The bartender's arm angle in radians at `t` seconds, from -0.5 to 0.5. */
export function wipeAngle(t: number): number {
  return 0.5 * Math.sin((2 * Math.PI * t) / WIPE_PERIOD);
}

/** How bright lamp `index` is at `t` seconds, from 0 to 1. Neighbours are out of step. */
export function lampGlow(index: number, t: number): number {
  const glow = 0.5 + 0.5 * Math.sin((2 * Math.PI * t) / LAMP_PERIOD + index * 2.1);
  return Math.min(1, Math.max(0, glow));
}

function draw(ctx: CanvasRenderingContext2D, layout: BarLayout, t: number) {
  const { colors } = theme;

  // Back wall.
  ctx.fillStyle = colors.surface;
  ctx.fillRect(0, 0, WIDTH, COUNTER.y);
  ctx.fillStyle = colors.background;
  ctx.fillRect(0, COUNTER.y, WIDTH, HEIGHT - COUNTER.y);

  // Shelves and bottles.
  for (const shelf of layout.shelves) {
    ctx.fillStyle = colors.background;
    ctx.globalAlpha = 0.4;
    ctx.fillRect(shelf.x.from, shelf.y + 8, shelf.x.to - shelf.x.from, 6);
    ctx.globalAlpha = 1;
    ctx.fillStyle = colors.wood;
    ctx.fillRect(shelf.x.from, shelf.y, shelf.x.to - shelf.x.from, 8);
  }
  for (const bottle of layout.bottles) {
    const base = layout.shelves[bottle.shelf].y;
    const left = bottle.x - BOTTLE_WIDTH / 2;
    const neck = bottle.height * 0.35;
    ctx.fillStyle = colors[bottle.color];
    ctx.fillRect(left, base - bottle.height + neck, BOTTLE_WIDTH, bottle.height - neck);
    ctx.fillRect(bottle.x - 4, base - bottle.height, 8, neck);
    ctx.fillStyle = colors.wood;
    ctx.fillRect(bottle.x - 4, base - bottle.height - 4, 8, 5);
  }

  // Price board.
  ctx.fillStyle = colors.wood;
  ctx.fillRect(BOARD.x - 8, BOARD.y - 8, BOARD.width + 16, BOARD.height + 16);
  ctx.fillStyle = colors.background;
  ctx.fillRect(BOARD.x, BOARD.y, BOARD.width, BOARD.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = colors.accent;
  ctx.font = canvasFont('title', 'bold');
  ctx.fillText('Drinks', BOARD.x + BOARD.width / 2, BOARD.y + 42);
  ctx.font = canvasFont('body');
  priceBoardLines().forEach((line, i) => {
    const y = BOARD.y + 82 + i * 24;
    ctx.fillStyle = colors.text;
    ctx.textAlign = 'left';
    ctx.fillText(line.name, BOARD.x + 18, y);
    ctx.fillStyle = colors.accent;
    ctx.textAlign = 'right';
    ctx.fillText(line.price, BOARD.x + BOARD.width - 18, y);
  });

  // Bartender: body, apron, head, then the wiping arm with a glass.
  ctx.fillStyle = colors.stripeA;
  ctx.fillRect(BARTENDER_X - 30, 230, 60, COUNTER.y - 230);
  ctx.fillStyle = colors.muted;
  ctx.fillRect(BARTENDER_X - 20, 260, 40, COUNTER.y - 260);
  ctx.fillStyle = colors.stripeB;
  ctx.beginPath();
  ctx.arc(BARTENDER_X, 205, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colors.background;
  ctx.fillRect(BARTENDER_X - 9, 200, 4, 4);
  ctx.fillRect(BARTENDER_X + 5, 200, 4, 4);
  ctx.save();
  ctx.translate(BARTENDER_X + 26, 245);
  ctx.rotate(wipeAngle(t));
  ctx.fillStyle = colors.stripeA;
  ctx.fillRect(0, -6, 50, 12);
  ctx.fillStyle = colors.stripeB;
  ctx.beginPath();
  ctx.arc(52, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colors.water;
  ctx.globalAlpha = 0.6;
  ctx.fillRect(46, -26, 16, 22);
  ctx.globalAlpha = 1;
  ctx.restore();

  // Counter and glasses.
  ctx.fillStyle = colors.wood;
  ctx.fillRect(0, COUNTER.y, WIDTH, COUNTER.height);
  ctx.fillStyle = colors.background;
  ctx.globalAlpha = 0.3;
  ctx.fillRect(0, COUNTER.y + 12, WIDTH, 4);
  ctx.globalAlpha = 1;
  for (const x of GLASS_XS) {
    ctx.fillStyle = colors.water;
    ctx.globalAlpha = 0.6;
    ctx.fillRect(x - 8, COUNTER.y - 24, 16, 24);
    ctx.globalAlpha = 1;
    ctx.fillStyle = colors.text;
    ctx.fillRect(x - 8, COUNTER.y - 24, 16, 3);
  }

  // Stools.
  for (const stool of layout.stools) {
    ctx.fillStyle = colors.background;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.ellipse(stool.x, HEIGHT - 12, 30, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = colors.muted;
    ctx.fillRect(stool.x - 4, stool.y, 8, HEIGHT - 14 - stool.y);
    ctx.fillStyle = colors.stripeA;
    ctx.beginPath();
    ctx.ellipse(stool.x, stool.y, 28, 9, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Awning, then the lamps along its edge.
  const stripe = WIDTH / 16;
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i % 2 === 0 ? colors.stripeA : colors.stripeB;
    ctx.fillRect(i * stripe, 0, stripe, AWNING_HEIGHT);
  }
  ctx.fillStyle = colors.background;
  ctx.globalAlpha = 0.3;
  ctx.fillRect(0, AWNING_HEIGHT, WIDTH, 6);
  ctx.globalAlpha = 1;
  const lampGap = WIDTH / LAMP_COUNT;
  for (let i = 0; i < LAMP_COUNT; i++) {
    const x = lampGap * (i + 0.5);
    const glow = lampGlow(i, t);
    ctx.fillStyle = colors.accent;
    ctx.globalAlpha = 0.25 * glow;
    ctx.beginPath();
    ctx.arc(x, AWNING_HEIGHT + 4, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.4 + 0.6 * glow;
    ctx.beginPath();
    ctx.arc(x, AWNING_HEIGHT + 4, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

export const bar: CarnivalGame = {
  id: 'bar',
  name: 'The Midway Bar',
  description: 'Step in for a cold drink and check the price board.',

  start(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    const layout = layoutBar(mulberry32(BAR_SEED));
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let frame = 0;
    let first: number | undefined;
    const loop = (time: number) => {
      first ??= time;
      draw(ctx, layout, still ? 0 : (time - first) / 1000);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(frame);
  },
};

export default bar;
