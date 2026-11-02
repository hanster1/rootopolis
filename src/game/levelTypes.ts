import type { Frac } from '../gears/fraction';

export type Machine = 'lift' | 'tram' | 'sprinkler' | 'pump' | 'clock-min' | 'clock-hour' | 'grand' | 'fan';

export interface Step {
  /** Put this gear on the motor peg. */
  motor?: boolean;
  /** Mesh with the gear made by step `from` (index) at `angle` degrees. */
  from?: number;
  angle?: number;
  /** Put this gear on the same peg as step `from`, on the other layer (a compound gear). */
  stack?: boolean;
  teeth: number;
  /** Gear is part of the level, not placed by the player. */
  preset?: boolean;
  /** This step's peg is a machine the player must drive. */
  out?: { id: string; machine: Machine; label: string };
}

export interface LevelSpec {
  id: string;
  chapter: number;
  title: string;
  /** One-line goal in plain words. */
  goal: string;
  hint: string;
  motor: { x: number; y: number; rpm: number };
  steps: Step[];
  tray: number[];
  /** Decoy pegs. */
  extraPegs?: [number, number][];
  rocks?: { x: number; y: number; r: number }[];
}

export interface Peg {
  id: string;
  x: number;
  y: number;
  kind: 'motor' | 'output' | 'free';
  rpm?: number;
  machine?: Machine;
  label?: string;
}

export interface BuiltLevel {
  spec: LevelSpec;
  pegs: Peg[];
  presets: { pegId: string; teeth: number; layer: number }[];
  solution: { pegId: string; teeth: number; layer: number }[];
  targets: { pegId: string; rpm: Frac; machine: Machine; label: string }[];
  par: number;
}
