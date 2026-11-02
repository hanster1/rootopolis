import * as THREE from 'three';
import { MODULE, pitchRadius } from '../gears/network';

export const GEAR_THICK = 0.16;
const cache = new Map<number, THREE.BufferGeometry>();

/**
 * A real spur-gear outline with exactly `teeth` teeth.
 * Tooth i is centred on angle 2πi/teeth, so phase maths can line up meshing teeth.
 */
export function gearGeometry(teeth: number): THREE.BufferGeometry {
  const hit = cache.get(teeth);
  if (hit) return hit;
  const r = pitchRadius(teeth);
  const ra = r + MODULE * 0.95; // tip
  const rr = r - MODULE * 1.15; // root
  const shape = new THREE.Shape();
  const step = (Math.PI * 2) / teeth;
  // Tooth profile: root → flank → tip → flank → root, as fractions of one tooth pitch.
  const prof: [number, number][] = [
    [-0.5, rr], [-0.3, rr], [-0.2, r], [-0.12, ra], [0.12, ra], [0.2, r], [0.3, rr],
  ];
  for (let i = 0; i < teeth; i++) {
    for (const [f, rad] of prof) {
      const a = (i + f) * step;
      const x = Math.cos(a) * rad;
      const y = Math.sin(a) * rad;
      if (i === 0 && f === -0.5) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
  }
  shape.closePath();
  // Axle hole
  const hole = new THREE.Path();
  hole.absarc(0, 0, 0.07, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  // Lightening holes on bigger gears: what makes them read as brass clockwork.
  if (teeth >= 20) {
    const n = teeth >= 40 ? 6 : 5;
    const inner = 0.2;
    const outer = rr - 0.12;
    if (outer - inner > 0.12) {
      const mid = (inner + outer) / 2;
      const hr = Math.min((outer - inner) / 2, mid * Math.sin(Math.PI / n) * 0.72);
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + Math.PI / n;
        const p = new THREE.Path();
        p.absarc(Math.cos(a) * mid, Math.sin(a) * mid, hr, 0, Math.PI * 2, true);
        shape.holes.push(p);
      }
    }
  }
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: GEAR_THICK,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.012,
    bevelSegments: 1,
    curveSegments: 16,
  });
  // Shape lies in XY; turn so it lies flat and board (x, y) maps to world (x, -z).
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -GEAR_THICK / 2, 0);
  geo.computeVertexNormals();
  cache.set(teeth, geo);
  return geo;
}

/** Tiny SVG icon of a gear for the tray. */
export function gearSvg(teeth: number, size = 44, fill = '#d9a441'): string {
  const r = 18;
  const ra = 21;
  const rr = 15.5;
  const n = Math.min(teeth, 24);
  const step = (Math.PI * 2) / n;
  const pts: string[] = [];
  for (let i = 0; i < n; i++) {
    for (const [f, rad] of [[-0.5, rr], [-0.25, rr], [-0.15, ra], [0.15, ra], [0.25, rr]] as [number, number][]) {
      const a = (i + f) * step;
      pts.push(`${(24 + Math.cos(a) * rad).toFixed(1)},${(24 + Math.sin(a) * rad).toFixed(1)}`);
    }
  }
  void r;
  return `<svg viewBox="0 0 48 48" width="${size}" height="${size}" aria-hidden="true"><polygon points="${pts.join(' ')}" fill="${fill}" stroke="#5b3a12" stroke-width="1.2"/><circle cx="24" cy="24" r="4" fill="#3a2410"/></svg>`;
}
