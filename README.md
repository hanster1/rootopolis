# Gearworks Garden: Rootopolis

A 3D gear-puzzle game for ages 8+. Help Tink Sprocket and Bolt the beetle fix a city of high-tech mice by choosing gears with exactly the right number of teeth.

**Play:** https://rootopolis.vercel.app It runs on desktop and phones.

## Gear rules
- Speed of the driven gear = motor speed × (driver teeth ÷ driven teeth).
- Gears that touch turn opposite ways. An idler in between flips the direction back without changing the speed.
- Gears on the same shaft (compound gears) turn together, so ratios multiply.
- If two paths demand different speeds, or gears overlap, the machine jams.

## Features
24 puzzles in 6 chapters, with stars for using the fewest gears, two-step hints and a free-build Workshop sandbox. All levels are unlocked. Funny story scenes open and close each chapter. The music adapts to each district, and every sound is synthesized.

## Develop
```
npm install
npm run dev          # http://127.0.0.1:5188
npm run test:unit    # gear math and all 24 level solutions
npm test             # Playwright: plays all 24 levels on desktop and mobile, checks console errors
npm run build
```
Docs: [STORY.md](STORY.md), [LEVELS.md](LEVELS.md), [AUDIO.md](AUDIO.md), [VISUAL.md](VISUAL.md).
