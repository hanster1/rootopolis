import { solveNetwork, pitchRadius, type Axle, type Gear } from '../gears/network';
import type { BuiltLevel, LevelSpec, Peg } from './levelTypes';

const r3 = (v: number): number => Math.round(v * 1e6) / 1e6;

/** Turn a level's construction steps into pegs, preset gears, a known solution and targets. */
export function buildLevel(spec: LevelSpec): BuiltLevel {
  const motorPeg: Peg = { id: 'motor', x: spec.motor.x, y: spec.motor.y, kind: 'motor', rpm: spec.motor.rpm };
  const pegs: Peg[] = [motorPeg];
  const stepPeg: Peg[] = [];
  const stepLayer: number[] = [];
  const presets: BuiltLevel['presets'] = [];
  const solution: BuiltLevel['solution'] = [];
  let free = 0;

  spec.steps.forEach((s, i) => {
    let peg: Peg;
    let layer = 0;
    if (s.motor) {
      peg = motorPeg;
    } else if (s.stack) {
      peg = stepPeg[s.from!];
      layer = 1 - stepLayer[s.from!];
    } else {
      const prev = stepPeg[s.from!];
      layer = stepLayer[s.from!];
      const d = pitchRadius(spec.steps[s.from!].teeth) + pitchRadius(s.teeth);
      const a = ((s.angle ?? 0) * Math.PI) / 180;
      peg = {
        id: s.out ? `out-${s.out.id}` : `p${free++}`,
        x: r3(prev.x + Math.cos(a) * d),
        y: r3(prev.y + Math.sin(a) * d),
        kind: s.out ? 'output' : 'free',
      };
      pegs.push(peg);
    }
    if (s.out) {
      peg.kind = 'output';
      peg.machine = s.out.machine;
      peg.label = s.out.label;
    }
    stepPeg[i] = peg;
    stepLayer[i] = layer;
    (s.preset ? presets : solution).push({ pegId: peg.id, teeth: s.teeth, layer });
  });

  (spec.extraPegs ?? []).forEach(([x, y], i) => pegs.push({ id: `x${i}`, x, y, kind: 'free' }));

  // Targets are whatever the reference solution produces.
  const axles: Axle[] = pegs.map((p) => ({ id: p.id, x: p.x, y: p.y, kind: p.kind, rpm: p.rpm }));
  const gears: Gear[] = [...presets, ...solution].map((g, i) => ({ id: `g${i}`, axleId: g.pegId, teeth: g.teeth, layer: g.layer }));
  const net = solveNetwork(axles, gears);
  if (net.jammed) throw new Error(`Level ${spec.id} reference solution jams: ${net.overlaps.map((o) => o.a + "/" + o.b).join(",")} ${[...net.jamGears].join(",")}`);
  const targets = pegs
    .filter((p) => p.kind === 'output')
    .map((p) => {
      const rpm = net.axleSpeed.get(p.id);
      if (!rpm) throw new Error(`Level ${spec.id}: output ${p.id} not driven by solution`);
      return { pegId: p.id, rpm, machine: p.machine!, label: p.label! };
    });
  return { spec, pegs, presets, solution, targets, par: solution.length };
}
