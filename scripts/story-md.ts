const { PROLOGUE, STORIES, NAMES } = await import('../src/game/story');
const { CHAPTERS } = await import('../src/game/levels');
const nm = (w: string) => w === 'narrator' ? 'Narrator' : (NAMES as any)[w] ?? w[0].toUpperCase() + w.slice(1);
const lines = (ls: any[]) => ls.map((l) => `- **${nm(l.who)}:** ${l.text}`).join('\n');
let o = `# Story\n\nRootopolis is a city of clever, high-tech mice living in the roots of a giant tree. Inventor **Tink Sprocket** and her clockwork beetle **Bolt** fix the city's machines after Grackle the Crow knocks the Grand Gear loose before the Sunset Festival. Each chapter teaches one gear idea in plain words for ages 8+.\n\n## Cast\n- **Tink Sprocket**: a young mouse inventor who counts every tooth.\n- **Bolt**: her clockwork beetle. He speaks in beeps (subtitled).\n- **${nm('mayor')}**: the fussy mayor.\n- **${nm('crow')}**: a clumsy crow who caused the mess and says sorry at the end.\n\n## Prologue\n${lines(PROLOGUE as any)}\n`;
for (const c of CHAPTERS as any[]) { const s = (STORIES as any)[c.n]; o += `\n## Chapter ${c.n} · ${c.district} · ${c.name}\n\n### Intro\n${lines(s.intro)}\n\n### Outro\n${lines(s.outro)}\n`; }
console.log(o);
