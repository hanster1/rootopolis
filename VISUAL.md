# Visual design: Brass Diorama

The game looks like a tabletop model: warm wood planks inside a riveted brass frame, with tree roots, mushrooms and lanterns around the edge, lit by a low golden sun with soft shadows.

- **Painted art** (`public/art/*.webp`): the title, one scene per chapter (Ken Burns pan in stories), and portraits of Tink, Bolt, the Mayor and Grackle.
- **3D gears** (`src/render/gearGeometry.ts`): real tooth outlines extruded from the exact tooth count. Every gear has an axle hole, and gears with 20 or more teeth have lightening holes. Teeth line up as gears turn. Each gear shows a tooth-count chip.
- **Two layers**: the lower and upper planes, so compound gears stack on one shaft.
- **Machines** (`src/render/props.ts`): cheese lift, tram, sprinkler, sap pump, clock hands, fan and the Grand Gear. They glow when they hit their target. The motor is a little steam boiler that puffs.
- **HUD order** (top to bottom): status (level, gear count and par), big target cards (target RPM, direction, current speed), toasts and the jam banner, then Bolt's speech bubble. The gear tray and Hint, Undo and Reset buttons sit at the bottom.
- **Camera**: frames each level's pegs. It tilts 58° in landscape. Portrait phones rotate the board 90° and tilt 62°, so the board fills the tall screen.
- **Palette**: brass (#d9a441), dark walnut (#2a170b), cream parchment for dialogue, and a green glow for success.
