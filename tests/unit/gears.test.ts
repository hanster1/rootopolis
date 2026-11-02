import { describe, expect, it } from 'vitest';
import { frac, mul, neg, eq, fmtRpm, toNum } from '../../src/gears/fraction';
import { solveNetwork, pitchRadius, type Axle, type Gear } from '../../src/gears/network';
import { LEVELS } from '../../src/game/levels';

const ax = (id: string, x: number, y: number, kind: Axle['kind'] = 'free', rpm?: number): Axle => ({ id, x, y, kind, rpm });
const g = (id: string, axleId: string, teeth: number, layer = 0): Gear => ({ id, axleId, teeth, layer });

describe('fractions', () => {
  it('reduces and multiplies exactly', () => {
    expect(frac(12, 36)).toEqual({ n: 1, d: 3 });
    expect(eq(mul(frac(2, 3), frac(3, 4)), frac(1, 2))).toBe(true);
    expect(toNum(neg(frac(6, 4)))).toBe(-1.5);
    expect(typeof fmtRpm(frac(40))).toBe('string');
  });
});

describe('gear network', () => {
  it('speed = driver ÷ driven and meshed gears reverse', () => {
    const d = pitchRadius(12) + pitchRadius(24);
    const r = solveNetwork([ax('m', 0, 0, 'motor', 60), ax('o', d, 0, 'output')], [g('a', 'm', 12), g('b', 'o', 24)]);
    expect(r.axleSpeed.get('o')).toEqual(frac(-30));
    expect(r.jammed).toBe(false);
  });
  it('an idler flips direction back without changing the ratio', () => {
    const d1 = pitchRadius(20) + pitchRadius(16), d2 = pitchRadius(16) + pitchRadius(40);
    const r = solveNetwork(
      [ax('m', 0, 0, 'motor', 30), ax('i', d1, 0), ax('o', d1 + d2, 0, 'output')],
      [g('a', 'm', 20), g('b', 'i', 16), g('c', 'o', 40)],
    );
    expect(r.axleSpeed.get('o')).toEqual(frac(15));
  });
  it('compound gears share an axle and multiply ratios', () => {
    const d1 = pitchRadius(12) + pitchRadius(36), d2 = pitchRadius(12) + pitchRadius(48);
    const r = solveNetwork(
      [ax('m', 0, 0, 'motor', 144), ax('c', d1, 0), ax('o', d1, d2, 'output')],
      [g('a', 'm', 12), g('b', 'c', 36), g('b2', 'c', 12, 1), g('o', 'o', 48, 1)],
    );
    expect(r.axleSpeed.get('o')).toEqual(frac(12)); // 144 × 1/3 × 1/4
  });
  it('gears on different layers do not mesh', () => {
    const d = pitchRadius(12) + pitchRadius(24);
    const r = solveNetwork([ax('m', 0, 0, 'motor', 60), ax('o', d, 0)], [g('a', 'm', 12, 0), g('b', 'o', 24, 1)]);
    expect(r.axleSpeed.has('o')).toBe(false);
  });
  it('overlapping gears jam', () => {
    const r = solveNetwork([ax('m', 0, 0, 'motor', 60), ax('o', 1, 0)], [g('a', 'm', 24), g('b', 'o', 24)]);
    expect(r.jammed).toBe(true);
  });
  it('a triangle of three gears jams', () => {
    const R = pitchRadius(20) * 2;
    const r = solveNetwork(
      [ax('m', 0, 0, 'motor', 60), ax('b', R, 0), ax('c', R / 2, (R * Math.sqrt(3)) / 2)],
      [g('a', 'm', 20), g('b', 'b', 20), g('c', 'c', 20)],
    );
    expect(r.jammed).toBe(true);
  });
});

describe('all 24 levels', () => {
  it('has 24 levels', () => expect(LEVELS.length).toBe(24));
  for (const L of LEVELS) {
    it(`${L.spec.id} solution hits every target exactly`, () => {
      const axles: Axle[] = L.pegs.map((p) => ({ id: p.id, x: p.x, y: p.y, kind: p.kind, rpm: p.rpm }));
      const gears: Gear[] = [...L.presets, ...L.solution].map((s, i) => ({ id: `g${i}`, axleId: s.pegId, teeth: s.teeth, layer: s.layer }));
      const r = solveNetwork(axles, gears);
      expect(r.jammed).toBe(false);
      for (const t of L.targets) expect(r.axleSpeed.get(t.pegId)).toEqual(t.rpm);
      expect(L.solution.length).toBeLessThanOrEqual(L.par);
    });
  }
});
