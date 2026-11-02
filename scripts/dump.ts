(globalThis as any).__NO_LEVELS__ = true;
const { LEVEL_SPECS } = await import('../src/game/levels');
const { pitchRadius } = await import('../src/gears/network');
for (const id of process.argv.slice(2)) {
  const s = LEVEL_SPECS.find((l) => l.id === id)!;
  const pos: { x: number; y: number }[] = [];
  s.steps.forEach((st, i) => {
    let p;
    if (st.motor) p = { x: s.motor.x, y: s.motor.y };
    else if (st.stack) p = pos[st.from!];
    else { const q = pos[st.from!]; const d = pitchRadius(s.steps[st.from!].teeth) + pitchRadius(st.teeth); const a = (st.angle! * Math.PI) / 180; p = { x: q.x + Math.cos(a) * d, y: q.y + Math.sin(a) * d }; }
    pos[i] = p;
    console.log(id, i, st.teeth, p.x.toFixed(2), p.y.toFixed(2), 'r', pitchRadius(st.teeth));
  });
  console.log('rocks', JSON.stringify(s.rocks));
}
