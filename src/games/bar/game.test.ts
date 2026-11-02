import { describe, expect, it } from 'vitest';
import {
  BOTTLE_COLORS,
  BOTTLE_HEIGHT,
  COUNTER,
  DRINKS,
  LAMP_PERIOD,
  WIPE_PERIOD,
  bar,
  formatPrice,
  lampGlow,
  layoutBar,
  mulberry32,
  priceBoardLines,
  wipeAngle,
} from './game';

const TIMES = Array.from({ length: 200 }, (_, i) => i * 0.037);

describe('DRINKS', () => {
  it('has 6 to 8 drinks with names and whole, positive prices', () => {
    expect(DRINKS.length).toBeGreaterThanOrEqual(6);
    expect(DRINKS.length).toBeLessThanOrEqual(8);
    for (const drink of DRINKS) {
      expect(drink.name.trim()).not.toBe('');
      expect(Number.isInteger(drink.priceCents)).toBe(true);
      expect(drink.priceCents).toBeGreaterThan(0);
    }
  });

  it('has unique kebab-case ids', () => {
    const ids = DRINKS.map((drink) => drink.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });
});

describe('formatPrice', () => {
  it('formats whole cents as dollars', () => {
    expect(formatPrice(350)).toBe('$3.50');
    expect(formatPrice(5)).toBe('$0.05');
    expect(formatPrice(1200)).toBe('$12.00');
  });

  it('rejects negative and non-integer cents', () => {
    expect(() => formatPrice(-1)).toThrow(RangeError);
    expect(() => formatPrice(3.5)).toThrow(RangeError);
    expect(() => formatPrice(Number.NaN)).toThrow(RangeError);
  });
});

describe('priceBoardLines', () => {
  it('lists every drink in order with a formatted price', () => {
    const lines = priceBoardLines();
    expect(lines.map((line) => line.name)).toEqual(DRINKS.map((drink) => drink.name));
    for (const line of lines) expect(line.price).toMatch(/^\$\d+\.\d{2}$/);
  });
});

describe('layoutBar', () => {
  it('gives the same layout for the same seed', () => {
    expect(layoutBar(mulberry32(7))).toEqual(layoutBar(mulberry32(7)));
  });

  it('gives different bottles for different seeds', () => {
    const looks = (seed: number) =>
      layoutBar(mulberry32(seed)).bottles.map((b) => `${b.height}:${b.color}`);
    expect(looks(1)).not.toEqual(looks(2));
  });

  it('puts 8 bottles on each of 2 shelves, inside the shelf and apart', () => {
    const layout = layoutBar(mulberry32(42));
    expect(layout.shelves).toHaveLength(2);
    layout.shelves.forEach((shelf, index) => {
      expect(shelf.x.from).toBeGreaterThanOrEqual(30);
      expect(shelf.x.to).toBeLessThanOrEqual(430);
      const xs = layout.bottles
        .filter((bottle) => bottle.shelf === index)
        .map((bottle) => bottle.x)
        .sort((a, b) => a - b);
      expect(xs).toHaveLength(8);
      for (const x of xs) {
        expect(x).toBeGreaterThanOrEqual(shelf.x.from);
        expect(x).toBeLessThanOrEqual(shelf.x.to);
      }
      for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeGreaterThanOrEqual(6);
    });
  });

  it('keeps heights from 40 to 70 and colours from BOTTLE_COLORS', () => {
    for (const seed of [1, 2, 3, 99]) {
      for (const bottle of layoutBar(mulberry32(seed)).bottles) {
        expect(bottle.height).toBeGreaterThanOrEqual(BOTTLE_HEIGHT.min);
        expect(bottle.height).toBeLessThanOrEqual(BOTTLE_HEIGHT.max);
        expect(BOTTLE_COLORS).toContain(bottle.color);
      }
    }
  });

  it('copes with a random that returns its extremes', () => {
    for (const bottle of layoutBar(() => 0.999999).bottles) {
      expect(bottle.height).toBe(70);
      expect(BOTTLE_COLORS).toContain(bottle.color);
    }
    for (const bottle of layoutBar(() => 0).bottles) expect(bottle.height).toBe(40);
  });

  it('places 4 evenly spaced stools below the counter', () => {
    const { stools } = layoutBar(mulberry32(1));
    expect(stools).toHaveLength(4);
    for (const stool of stools) expect(stool.y).toBeGreaterThan(COUNTER.y + COUNTER.height);
    const gaps = stools.slice(1).map((stool, i) => stool.x - stools[i].x);
    for (const gap of gaps) expect(gap).toBeCloseTo(gaps[0]);
  });
});

describe('wipeAngle', () => {
  it('stays from -0.5 to 0.5 and repeats every WIPE_PERIOD', () => {
    expect(WIPE_PERIOD).toBe(1.6);
    for (const t of TIMES) {
      expect(Math.abs(wipeAngle(t))).toBeLessThanOrEqual(0.5);
      expect(wipeAngle(t + WIPE_PERIOD)).toBeCloseTo(wipeAngle(t), 9);
    }
  });
});

describe('lampGlow', () => {
  it('stays from 0 to 1 and repeats every 2 seconds', () => {
    expect(LAMP_PERIOD).toBe(2);
    for (const index of [0, 1, 2, 7]) {
      for (const t of TIMES) {
        const glow = lampGlow(index, t);
        expect(glow).toBeGreaterThanOrEqual(0);
        expect(glow).toBeLessThanOrEqual(1);
        expect(lampGlow(index, t + 2)).toBeCloseTo(glow, 9);
      }
    }
  });

  it('puts neighbouring lamps out of step', () => {
    expect(TIMES.some((t) => Math.abs(lampGlow(0, t) - lampGlow(1, t)) > 0.1)).toBe(true);
    expect(lampGlow(3, 0)).not.toBeCloseTo(lampGlow(4, 0));
  });
});

describe('bar', () => {
  it('is the default export with the id bar', async () => {
    const module = await import('./game');
    expect(module.default).toBe(bar);
    expect(bar.id).toBe('bar');
    expect(typeof bar.start).toBe('function');
  });
});
