# Audio

All music and sound is made live in the browser with the Web Audio API (`src/audio/Audio.ts`). There are no audio files, so the download stays small and the music can react to play. Sound starts on the first tap or click, as browsers require. A Sound on/off button sits on the title and pause screens, and the choice is saved.

## Adaptive score
Each district has its own theme: tempo, key, mode, a 4-bar chord loop and a 16-step melody. Music is never soft electronic pads alone. It is built on a deep plucked bass and a strong kick.

| Theme | BPM | Key / mode | Ambience |
|---|---|---|---|
| Title | 76 | D major | Hall |
| 1 Root Docks | 84 | D dorian | River |
| 2 Trunk Town | 96 | F mixolydian | Street and tram bell |
| 3 Moss Greenhouses | 78 | A minor | Rain and drips |
| 4 Sap Works | 90 | C minor | Factory and sap blips |
| 5 Clocktower | 72 | E minor | Night and crickets |
| 6 Grand Gear | 104 | G major | Crowd |
| Workshop (sandbox) | 80 | E major | Hall |

The song has four layers. They come in as your machine gets closer to the target speed (`setCloseness`):
1. **Foundation** (always on): plucked saw and sub bass, lowpass envelope, kick on the beat.
2. **Weight** (from about 25% close): concert bass drum hits (no snare) and a warm saw pad.
3. **Motion** (30–60%): marimba arpeggios.
4. **Melody** (70–90%): FM bell melody. All four play when the machine is almost right.

## Sound effects
- **Gear ticks**: click rate follows the fastest spinning gear's RPM.
- **Clunk**: when a gear meshes. Bigger gears sound lower.
- **Pop**: placing and removing gears. **UI tap** for buttons.
- **Bolt beeps**: square-wave chirps while Bolt talks, and in stories.
- **Jam grind**: filtered noise and a low buzz when gears lock up.
- **Success hit**: a deep, layered hit (kick, two concert bass drums, a tom, a brass fanfare chord, bells), then one rising chime per star.
- **Ambience**: looping filtered noise with a slow wobble, plus random events for each district.
