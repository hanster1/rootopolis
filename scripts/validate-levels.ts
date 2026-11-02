(globalThis as any).__NO_LEVELS__ = true;
const { LEVEL_SPECS } = await import('../src/game/levels');
const { buildLevel } = await import('../src/game/buildLevel');
const LEVELS: any[] = [];
let bad = 0;
for (const s of LEVEL_SPECS) { try { LEVELS.push(buildLevel(s)); } catch (e) { console.log('❌', (e as Error).message); bad++; } }
import { pitchRadius, MESH_TOL } from '../src/gears/network';
for (const L of LEVELS) {
  const all = [...L.presets, ...L.solution].map((g) => ({ ...g, p: L.pegs.find((p) => p.id === g.pegId)! }));
  const issues: string[] = [];
  for (const g of all) {
    const r = pitchRadius(g.teeth) + 0.08;
    if (Math.abs(g.p.x) + r > 7.6 || Math.abs(g.p.y) + r > 4.4) issues.push(`out of board ${g.pegId} t${g.teeth} (${g.p.x.toFixed(2)},${g.p.y.toFixed(2)})`);
    for (const k of L.spec.rocks ?? []) if (Math.hypot(k.x - g.p.x, k.y - g.p.y) < k.r + r) issues.push(`rock hits ${g.pegId}`);
  }
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    const a = all[i], b = all[j];
    if (a.pegId === b.pegId) continue;
    const d = Math.hypot(a.p.x - b.p.x, a.p.y - b.p.y);
    const want = pitchRadius(a.teeth) + pitchRadius(b.teeth);
    if (a.layer === b.layer && d < want - MESH_TOL) issues.push(`overlap ${a.pegId}/${b.pegId}`);
    if (a.layer !== b.layer && d < Math.max(pitchRadius(a.teeth), pitchRadius(b.teeth)) - 0.1) console.log('  note: shaft passes under a gear', L.spec.id, a.pegId, b.pegId);
  }
  for (let i = 0; i < L.pegs.length; i++) for (let j = i + 1; j < L.pegs.length; j++) if (Math.hypot(L.pegs[i].x - L.pegs[j].x, L.pegs[i].y - L.pegs[j].y) < 0.9) issues.push(`pegs close ${L.pegs[i].id}/${L.pegs[j].id}`);
  console.log(L.spec.id, 'par', L.par, L.targets.map((t) => `${t.label}=${t.rpm.n}/${t.rpm.d}`).join(' '), issues.length ? '❌ ' + issues.join('; ') : '✓');
  bad += issues.length;
}
process.exit(bad ? 1 : 0);
