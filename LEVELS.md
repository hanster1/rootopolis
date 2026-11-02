# Levels

All 24 puzzles. Every level is unlocked. Stars: 3 at par gears or fewer, 2 at par + 1, 1 otherwise. Negative RPM means the machine turns the opposite way to the motor. Solutions are checked by `npm run test:unit` and played headlessly by `npm test`.


## Chapter 1 · Root Docks · The Cheese Lift

| Level | Goal | Targets | Par | One solution |
|---|---|---|---|---|
| 1-1 Gentle Lift | The cheese is wobbling! Make the lift turn at HALF the motor speed. | Cheese Lift -30 RPM | 1 | out-a:24 |
| 1-2 Slow and Cheesy | Both pegs are empty. Make the lift turn THREE times slower than the motor. | Cheese Lift -20 RPM | 2 | motor:12 → out-a:36 |
| 1-3 Express Cheese | Breakfast rush! Make the lift spin THREE times FASTER than the motor. | Express Lift -180 RPM | 2 | motor:36 → out-a:12 |
| 1-4 Two-Thirds Throttle | The fancy lift needs exactly 40 RPM. The motor runs at 60. | Fancy Lift -40 RPM | 2 | motor:24 → out-a:36 |

## Chapter 2 · Trunk Town · The Backwards Tram

| Level | Goal | Targets | Par | One solution |
|---|---|---|---|---|
| 2-1 Wrong Way Tram | The tram must roll the SAME way as the motor, at the same speed. | Tram 30 RPM | 1 | p0:16 |
| 2-2 The Lazy Middle | Same direction as the motor, at half speed. | Tram 15 RPM | 1 | p0:18 |
| 2-3 Around the Acorn | A giant acorn blocks the street. Get the tram moving the OPPOSITE way to the motor. | Tram -30 RPM | 2 | p0:20 → p1:20 |
| 2-4 Rush Hour Loop | Same direction as the motor, but the route goes over the sap pipe. | Tram 30 RPM | 3 | p0:16 → p1:24 → p2:16 |

## Chapter 3 · Moss Greenhouses · The Greenhouse Sprinklers

| Level | Goal | Targets | Par | One solution |
|---|---|---|---|---|
| 3-1 Drip and Drench | The fern likes a slow drip; the mushrooms like a fast spray. Drive BOTH sprinklers. | Fern -20 RPM, Mushrooms -80 RPM | 2 | out-a:48 → out-b:12 |
| 3-2 Two-Way Watering | One sprinkler spins with the motor, the other against it. | Moss 40 RPM, Lily -20 RPM | 2 | p0:20 → out-b:40 |
| 3-3 Triple Sprinkle | Three thirsty plants, three different speeds. Water them all! | Clover -40 RPM, Orchid 30 RPM, Cactus -20 RPM | 4 | out-a:24 → p0:16 → out-b:32 → out-c:48 |
| 3-4 The Busy Branch | Drive both sprinklers from ONE helper gear in the middle. | Tulip 60 RPM, Pumpkin 20 RPM | 3 | p0:24 → out-a:12 → out-b:36 |

## Chapter 4 · Sap Works · The Sap Works Pumps

| Level | Goal | Targets | Par | One solution |
|---|---|---|---|---|
| 4-1 Double Decker | The sap pump must run NINE times slower than the motor. | Sap Pump 10 RPM | 2 | p0:36 → p0:12 (top) |
| 4-2 Turbo Pump | The motor is sleepy (10 RPM). Make the pump race at 90 RPM! | Turbo Pump 90 RPM | 2 | p0:12 → p0:36 (top) |
| 4-3 Sticky Situation | Thick sap needs a slow, strong pump: 15 RPM, same way as the motor. | Thick Pump 15 RPM | 3 | p0:48 → p0:16 (top) → out-a:48 (top) |
| 4-4 Pipe Dream | Slow it down with a compound gear, then steer around the tank with an idler. | Tank Pump -30 RPM | 3 | p0:36 → p0:24 (top) → p1:16 (top) |

## Chapter 5 · Canopy Observatory · The Tower Clock

| Level | Goal | Targets | Par | One solution |
|---|---|---|---|---|
| 5-1 Calm the Hands | The clock hand whirls at 160 RPM. Make it 16 times slower. | Clock Hand 10 RPM | 2 | p0:48 → p0:12 (top) |
| 5-2 Twelve Times Slower | Make the hand turn exactly 10 RPM from a 120 RPM motor. | Clock Hand 10 RPM | 3 | p0:30 → p0:10 (top) → out-a:40 (top) |
| 5-3 The Gear Staircase | Three stages! Bring 192 RPM down to just 8 RPM. | Clock Hand -8 RPM | 4 | p0:36 → p0:24 (top) → p1:48 (top) → p1:12 |
| 5-4 Minutes and Hours | A real clock: the hour hand turns 12 times slower than the minute hand. | Minute Hand 12 RPM, Hour Hand 1 RPM | 6 | p0:36 → p0:12 (top) → out-m:48 (top) → out-m:12 → p1:48 → p1:10 (top) |

## Chapter 6 · Festival Square · The Grand Gear

| Level | Goal | Targets | Par | One solution |
|---|---|---|---|---|
| 6-1 Festival Fans | Two lantern fans: one fast and backwards, one slow and forwards. | Fast Fan -120 RPM, Slow Fan 10 RPM | 3 | out-a:12 → p0:48 → p0:16 (top) |
| 6-2 Crow's Mess | Grackle the crow dropped acorns everywhere. Thread the power to the Festival Lift. | Festival Lift 20 RPM | 4 | p0:36 → p0:16 (top) → p1:24 (top) → p2:24 (top) |
| 6-3 Everything Everywhere | Tram, sprinkler and pump — all from one motor for the parade. | Parade Tram 60 RPM, Confetti -120 RPM, Lemonade Pump 20 RPM | 4 | p0:16 → out-b:12 → p1:36 → p1:12 (top) |
| 6-4 The Grand Gear | The Grand Gear must turn slowly and mightily — exactly 1 RPM. Rootopolis is counting on you! | Grand Gear -1 RPM | 4 | p0:36 → p0:12 (top) → p1:48 (top) → p1:12 |

