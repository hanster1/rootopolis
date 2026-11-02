const { LEVELS, CHAPTERS } = await import('../src/game/levels');
let o = '# Levels\n\nAll 24 puzzles. Every level is unlocked. Stars: 3 at par gears or fewer, 2 at par + 1, 1 otherwise. Solutions are checked by `npm run test:unit` and played headlessly by `npm test`.\n\n';
for (const L of LEVELS as any[]) {
  if (L.spec.id.endsWith('-1')) { const c = (CHAPTERS as any[]).find((x: any) => x.n === L.spec.chapter); o += `\n## Chapter ${L.spec.chapter}${c ? ` · ${c.district} · ${c.name}` : ""}\n\n| Level | Goal | Targets | Par | One solution |\n|---|---|---|---|---|\n`; }
  const t = L.targets.map((t: any) => `${t.label} ${t.rpm.n}${t.rpm.d > 1 ? '/' + t.rpm.d : ''} RPM`).join(', ');
  const s = L.solution.map((g: any) => `${g.pegId}:${g.teeth}${g.layer ? ' (top)' : ''}`).join(' → ');
  o += `| ${L.spec.id} ${L.spec.title} | ${L.spec.goal.replace(/\|/g, '/')} | ${t} | ${L.par} | ${s} |\n`;
}
console.log(o);
