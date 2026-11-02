export type Speaker = 'tink' | 'bolt' | 'mayor' | 'crow' | 'narrator';

export interface Line {
  who: Speaker;
  text: string;
  /** Bolt only beeps; Tink "translates" (often wrongly). */
  beep?: string;
}

export interface ChapterStory {
  intro: Line[];
  outro: Line[];
}

export const NAMES: Record<Speaker, string> = {
  tink: 'Tink Sprocket',
  bolt: 'Bolt',
  mayor: 'Mayor Whiskerton',
  crow: 'Grackle the Crow',
  narrator: '',
};

export const PROLOGUE: Line[] = [
  { who: 'narrator', text: 'Under the roots of a giant oak lies Rootopolis — the cleverest mouse city in the world.' },
  { who: 'narrator', text: 'Every lift, tram and sprinkler runs on gears, all powered by the mighty Grand Gear.' },
  { who: 'crow', text: 'CAW! Ooh, shiny! I\'ll just borrow this little bolt… and this one… and — whoops.' },
  { who: 'narrator', text: 'CLANG. The Grand Gear wobbled loose. All across the city, machines spun too fast, too slow, or backwards.' },
  { who: 'mayor', text: 'Disaster! The Great Sunset Festival is TONIGHT. Who can fix our gears?!' },
  { who: 'tink', text: 'Me! Tink Sprocket, inventor, gear-fixer, and part-time cheese tester.' },
  { who: 'bolt', beep: 'Bweep-bweep boop!', text: '(Tink: "Bolt says he\'s ready." Bolt actually said: "Is there snacks?")' },
];

export const STORIES: Record<number, ChapterStory> = {
  1: {
    intro: [
      { who: 'mayor', text: 'The Root Docks cheese lift is going SO fast the cheese keeps flying off the top!' },
      { who: 'tink', text: 'Easy fix. Here\'s the big gear secret: when a gear with FEW teeth turns a gear with MANY teeth, the big one turns SLOWER.' },
      { who: 'tink', text: 'Count the teeth. 12 teeth turning 24 teeth? The big one only goes half as fast. 12 ÷ 24 = ½.' },
      { who: 'bolt', beep: 'Boop? Beep-beep.', text: '(Translation: "So small gear on the motor = slow lift. Big gear on the motor = zoomy lift.")' },
      { who: 'tink', text: 'Exactly! We call that the gear RATIO: driver teeth ÷ driven teeth. Let\'s save the cheese.' },
    ],
    outro: [
      { who: 'mayor', text: 'Slow, fast, and just right! The cheese has arrived safely. Mostly.' },
      { who: 'bolt', beep: 'Nom-beep. Nom-beep.', text: '(Bolt is "testing" the cheese. For science.)' },
      { who: 'tink', text: 'Did you see? Two touching gears ALWAYS spin opposite ways. That\'s going to matter in Trunk Town…' },
    ],
  },
  2: {
    intro: [
      { who: 'narrator', text: 'Trunk Town. The tram is going backwards. The passengers are going "AAAAAH".' },
      { who: 'tink', text: 'When two gears touch, they spin opposite directions. Clockwise turns the next one anticlockwise.' },
      { who: 'tink', text: 'So to make something spin the SAME way as the motor, slip one extra gear in the middle. We call it an IDLER.' },
      { who: 'bolt', beep: 'Beep! Bee-bee-boop!', text: '(Translation: "An idler is a gear that does no work. Like Bolt on a Sunday.")' },
      { who: 'tink', text: 'And the best part: an idler doesn\'t change the speed. It only flips the direction.' },
    ],
    outro: [
      { who: 'mayor', text: 'Forwards! The tram goes forwards! I could kiss you. I won\'t. But I could.' },
      { who: 'tink', text: 'Remember: count the flips. Even number of gears in a row = opposite way. Odd number = same way.' },
      { who: 'crow', text: 'Caw… I definitely did not just drop a bolt in the greenhouse pipes. Nope.' },
    ],
  },
  3: {
    intro: [
      { who: 'narrator', text: 'The Moss Greenhouses. One sprinkler is a waterfall. One is a sad little drip.' },
      { who: 'tink', text: 'Here\'s a trick: one motor can drive LOTS of gears at once — like branches on a tree.' },
      { who: 'tink', text: 'Each branch does its own maths. A big gear makes its sprinkler slow, a small one makes it fast.' },
      { who: 'bolt', beep: 'Bloop. Blip-bloop.', text: '(Bolt has an umbrella. Bolt is prepared.)' },
    ],
    outro: [
      { who: 'mayor', text: 'Every plant is happy! Even the cactus, and he\'s NEVER happy.' },
      { who: 'tink', text: 'Next stop: the Sap Works. Those pumps need to be REALLY slow… slower than any two gears can do.' },
      { who: 'bolt', beep: 'Beep-uh-oh.', text: '(Translation: "Sounds sticky.")' },
    ],
  },
  4: {
    intro: [
      { who: 'narrator', text: 'The Sap Works, where golden tree sap is pumped up to the whole city.' },
      { who: 'tink', text: 'New trick: put TWO gears on the SAME peg, stacked like a sandwich. They spin together as one — a COMPOUND gear.' },
      { who: 'tink', text: 'The bottom gear slows things down once. The top gear passes that slow speed to the next gear, which slows it AGAIN.' },
      { who: 'tink', text: 'So ÷3 and then ÷3 again is ÷9. The ratios MULTIPLY!' },
      { who: 'bolt', beep: 'Beep… stuck… beep.', text: '(Bolt has stepped in sap. Bolt lives here now.)' },
    ],
    outro: [
      { who: 'mayor', text: 'The sap flows! Pancakes for everyone at the Festival!' },
      { who: 'tink', text: 'Compound gears let us go super slow or super fast. Perfect for the Tower Clock…' },
      { who: 'crow', text: 'Caw. I may have also… bumped the clock. With my face. By accident.' },
    ],
  },
  5: {
    intro: [
      { who: 'narrator', text: 'High in the Canopy Observatory, the Tower Clock hands are spinning like a helicopter.' },
      { who: 'tink', text: 'Clocks need BIG slow-downs. Too big for one pair of gears. So we chain stages: ÷3, then ÷4…' },
      { who: 'tink', text: 'Multiply them: 3 × 4 = 12 times slower. Add more stages to go even slower!' },
      { who: 'bolt', beep: 'Wheeeee-beep.', text: '(Bolt\'s eyes have gone spirally. He watched the clock too long.)' },
    ],
    outro: [
      { who: 'mayor', text: 'Tick… tock… perfect time! The Festival starts at sunset — and that\'s in ONE HOUR!' },
      { who: 'crow', text: 'Caw… okay, okay. It was me. I knocked the Grand Gear loose. I just like shiny things. I\'m sorry.' },
      { who: 'tink', text: 'Then help us fix it, Grackle! We\'ll need every trick we\'ve learned.' },
    ],
  },
  6: {
    intro: [
      { who: 'narrator', text: 'Festival Square. The whole city is waiting. The Grand Gear sits silent.' },
      { who: 'tink', text: 'Everything together now: ratios for speed, idlers for direction, compound gears to multiply.' },
      { who: 'crow', text: 'And I promise not to touch anything. Caw. Much.' },
      { who: 'bolt', beep: 'BEEP BEEP BEEP!', text: '(Translation: "LET\'S GOOOO!")' },
    ],
    outro: [
      { who: 'narrator', text: 'The Grand Gear turned — slow, steady and strong. Lights flickered on across Rootopolis.' },
      { who: 'mayor', text: 'Tink Sprocket, you have saved the Great Sunset Festival! You get the Golden Cog… and a lifetime of cheese.' },
      { who: 'crow', text: 'Caw! I brought back all the bolts. And a spoon. The spoon is not yours, I just like it.' },
      { who: 'bolt', beep: 'Beep… boop… beep. ♥', text: '(Translation: "Best. Day. Ever.")' },
      { who: 'tink', text: 'Thanks, gear-fixer. Come build anything you like in the Sandbox — the workshop is always open!' },
    ],
  },
};
