import { type Frac, eq, frac, mul, neg } from './fraction';

/** Size of one tooth in world units: pitch radius = teeth * MODULE. */
export const MODULE = 0.05;
/** How far from a perfect mesh distance two gears may sit and still mesh. */
export const MESH_TOL = 0.06;
export const LAYERS = 2;

export const pitchRadius = (teeth: number): number => teeth * MODULE;

export type AxleKind = 'motor' | 'output' | 'free';

export interface Axle {
  id: string;
  x: number;
  y: number;
  kind: AxleKind;
  /** Motor axles only: the speed the motor drives, in RPM. Positive = clockwise. */
  rpm?: number;
}

export interface Gear {
  id: string;
  axleId: string;
  teeth: number;
  layer: number;
  /** Preset gears belong to the level and cannot be moved. */
  locked?: boolean;
}

export interface Mesh {
  a: string; // gear id
  b: string;
}

export interface NetworkResult {
  /** Speed of every axle that is connected to a motor. */
  axleSpeed: Map<string, Frac>;
  /** Pairs of gears whose teeth touch. */
  meshes: Mesh[];
  /** True when two paths try to spin the same axle at different speeds. */
  jammed: boolean;
  /** Gears involved in a jam, for highlighting. */
  jamGears: Set<string>;
  /** Gears that overlap (bodies collide) on the same layer. */
  overlaps: Mesh[];
}

export function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * The single rule set of the game:
 *  - Two gears on the same layer mesh when their centres are exactly
 *    (r1 + r2) apart. The driven gear turns the other way at
 *    speed x (driver teeth / driven teeth).
 *  - Gears on the same axle (compound gears) share one speed.
 *  - If two routes demand different speeds for one axle, the machine jams.
 */
export function solveNetwork(axles: Axle[], gears: Gear[]): NetworkResult {
  const axleById = new Map(axles.map((a) => [a.id, a]));
  const meshes: Mesh[] = [];
  const overlaps: Mesh[] = [];
  for (let i = 0; i < gears.length; i++) {
    for (let j = i + 1; j < gears.length; j++) {
      const g = gears[i];
      const h = gears[j];
      if (g.layer !== h.layer || g.axleId === h.axleId) continue;
      const A = axleById.get(g.axleId)!;
      const B = axleById.get(h.axleId)!;
      const d = dist(A, B);
      const want = pitchRadius(g.teeth) + pitchRadius(h.teeth);
      if (Math.abs(d - want) <= MESH_TOL) meshes.push({ a: g.id, b: h.id });
      else if (d < want) overlaps.push({ a: g.id, b: h.id });
    }
  }

  const gearById = new Map(gears.map((g) => [g.id, g]));
  const gearsOnAxle = new Map<string, Gear[]>();
  for (const g of gears) {
    const list = gearsOnAxle.get(g.axleId) ?? [];
    list.push(g);
    gearsOnAxle.set(g.axleId, list);
  }
  const neighbours = new Map<string, string[]>();
  for (const m of meshes) {
    (neighbours.get(m.a) ?? neighbours.set(m.a, []).get(m.a)!).push(m.b);
    (neighbours.get(m.b) ?? neighbours.set(m.b, []).get(m.b)!).push(m.a);
  }

  const axleSpeed = new Map<string, Frac>();
  const jamGears = new Set<string>();
  let jammed = false;
  const queue: string[] = [];

  const assign = (axleId: string, speed: Frac, via?: string): void => {
    const prev = axleSpeed.get(axleId);
    if (prev) {
      if (!eq(prev, speed)) {
        jammed = true;
        for (const g of gearsOnAxle.get(axleId) ?? []) jamGears.add(g.id);
        if (via) jamGears.add(via);
      }
      return;
    }
    axleSpeed.set(axleId, speed);
    queue.push(axleId);
  };

  // Motors: two motors at different speeds connected together also jam.
  for (const a of axles) if (a.kind === 'motor') assign(a.id, frac(a.rpm ?? 0));

  while (queue.length) {
    const axleId = queue.shift()!;
    const speed = axleSpeed.get(axleId)!;
    for (const g of gearsOnAxle.get(axleId) ?? []) {
      for (const otherId of neighbours.get(g.id) ?? []) {
        const other = gearById.get(otherId)!;
        // Meshed gears reverse direction; speed scales by driver/driven teeth.
        assign(other.axleId, neg(mul(speed, frac(g.teeth, other.teeth))), g.id);
      }
    }
  }

  // Overlapping gears physically block each other: also a jam.
  for (const o of overlaps) {
    jammed = true;
    jamGears.add(o.a);
    jamGears.add(o.b);
  }

  return { axleSpeed, meshes, jammed, jamGears, overlaps };
}

/** Ratio of a two-gear pair: how many turns the driven gear makes per driver turn. */
export function pairRatio(driverTeeth: number, drivenTeeth: number): Frac {
  return frac(driverTeeth, drivenTeeth);
}
