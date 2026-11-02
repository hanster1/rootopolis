/**
 * All sound is synthesised live with WebAudio: no samples to download.
 * Music: per-district adaptive score. Layers swell as machines approach target speed.
 * Instruments: deep plucked bass, kick + concert bass drum (no snare), music-box bells,
 * bowed pad, marimba arps. SFX: gear ticks pitched by RPM, mesh clunks, Bolt beeps,
 * jam grind, layered success hit + brass fanfare. Ambience per district.
 */

type Theme = {
  bpm: number;
  root: number; // MIDI note of tonic
  scale: number[]; // semitone offsets
  prog: number[][]; // chords as scale degrees per bar
  melody: (number | null)[]; // 16 steps of scale degrees (2 bars of 8ths) or null
  ambience: 'river' | 'street' | 'rain' | 'factory' | 'night' | 'crowd' | 'hall';
  brightness: number;
};

const MAJ = [0, 2, 4, 5, 7, 9, 11];
const MIN = [0, 2, 3, 5, 7, 8, 10];
const DOR = [0, 2, 3, 5, 7, 9, 10];
const MIX = [0, 2, 4, 5, 7, 9, 10];

export const THEMES: Record<string, Theme> = {
  title: { bpm: 76, root: 50, scale: MAJ, prog: [[0, 2, 4], [5, 0, 2], [3, 5, 0], [4, 6, 1]], melody: [4, null, 2, null, 3, 4, null, 7, 6, null, 4, null, 5, null, null, null], ambience: 'hall', brightness: 0.6 },
  1: { bpm: 84, root: 50, scale: DOR, prog: [[0, 2, 4], [0, 2, 4], [6, 1, 3], [3, 5, 0]], melody: [0, 2, 4, null, 3, 2, null, 0, 4, null, 5, 4, 2, null, 1, null], ambience: 'river', brightness: 0.55 },
  2: { bpm: 96, root: 53, scale: MIX, prog: [[0, 2, 4], [6, 1, 3], [3, 5, 0], [0, 2, 4]], melody: [4, 4, 5, null, 4, 2, 0, null, 1, 2, 4, null, 6, 5, 4, null], ambience: 'street', brightness: 0.7 },
  3: { bpm: 78, root: 45, scale: MIN, prog: [[0, 2, 4], [5, 0, 2], [2, 4, 6], [6, 1, 3]], melody: [4, null, 6, 7, null, 6, 4, null, 2, null, 3, 4, null, 2, 0, null], ambience: 'rain', brightness: 0.5 },
  4: { bpm: 90, root: 48, scale: MIN, prog: [[0, 2, 4], [0, 2, 4], [5, 0, 2], [4, 6, 1]], melody: [0, null, 0, 2, null, 3, null, 4, 3, null, 2, null, 0, null, 6, null], ambience: 'factory', brightness: 0.45 },
  5: { bpm: 72, root: 52, scale: MIN, prog: [[0, 2, 4], [3, 5, 0], [5, 0, 2], [4, 6, 1]], melody: [7, null, 4, null, 6, null, 3, null, 5, null, 2, null, 4, 3, 2, null], ambience: 'night', brightness: 0.4 },
  6: { bpm: 104, root: 55, scale: MAJ, prog: [[0, 2, 4], [4, 6, 1], [5, 0, 2], [3, 5, 0]], melody: [0, 2, 4, 7, null, 6, 4, null, 5, 4, 2, null, 4, null, 7, null], ambience: 'crowd', brightness: 0.8 },
  sandbox: { bpm: 80, root: 52, scale: MAJ, prog: [[0, 2, 4], [3, 5, 0], [4, 6, 1], [0, 2, 4]], melody: [2, null, 4, null, 7, null, 4, null, 3, null, 5, null, 4, null, 2, null], ambience: 'hall', brightness: 0.6 },
};

const mtof = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);

export class Audio {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private ambBus!: GainNode;
  private reverb!: ConvolverNode;
  private reverbSend!: GainNode;
  private layerGains: GainNode[] = [];
  private layerTarget = [1, 0, 0, 0];
  private theme: Theme = THEMES.title;
  private themeKey = 'title';
  private nextStep = 0;
  private step = 0;
  private timer: number | null = null;
  private ambNodes: AudioNode[] = [];
  private ambTimer: number | null = null;
  private noiseBuf!: AudioBuffer;
  private tickAcc = 0;
  muted = false;
  private seed = 7;
  /** For tests: counts of each sound event. */
  readonly events: Record<string, number> = {};

  private rand(): number {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  private count(name: string): void {
    this.events[name] = (this.events[name] ?? 0) + 1;
  }

  /** Must be called from a user gesture. */
  unlock(): void {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      this.ctx = ctx;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 3;
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.9;
      this.master.connect(comp).connect(ctx.destination);
      this.reverb = ctx.createConvolver();
      this.reverb.buffer = this.makeImpulse(2.8);
      this.reverbSend = ctx.createGain();
      this.reverbSend.gain.value = 0.35;
      this.reverbSend.connect(this.reverb).connect(this.master);
      this.musicBus = ctx.createGain();
      this.musicBus.gain.value = 0.55;
      this.musicBus.connect(this.master);
      this.musicBus.connect(this.reverbSend);
      this.sfxBus = ctx.createGain();
      this.sfxBus.gain.value = 0.8;
      this.sfxBus.connect(this.master);
      this.ambBus = ctx.createGain();
      this.ambBus.gain.value = 0.22;
      this.ambBus.connect(this.master);
      for (let i = 0; i < 4; i++) {
        const g = ctx.createGain();
        g.gain.value = i === 0 ? 1 : 0;
        g.connect(this.musicBus);
        this.layerGains.push(g);
      }
      this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = this.rand() * 2 - 1;
      this.nextStep = ctx.currentTime + 0.1;
      this.timer = window.setInterval(() => this.schedule(), 50);
      this.startAmbience();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05);
  }

  setTheme(key: string): void {
    if (key === this.themeKey) return;
    this.themeKey = key;
    this.theme = THEMES[key] ?? THEMES.title;
    this.step = 0;
    if (this.ctx) {
      this.nextStep = this.ctx.currentTime + 0.15;
      this.startAmbience();
    }
  }

  get currentTheme(): string {
    return this.themeKey;
  }

  /** 0 = far from target, 1 = on target. Layers swell in with closeness. */
  setCloseness(c: number): void {
    this.layerTarget = [1, c > 0.25 ? 1 : c / 0.25, c > 0.6 ? 1 : Math.max(0, (c - 0.3) / 0.3), c > 0.9 ? 1 : Math.max(0, (c - 0.7) / 0.2)];
    if (!this.ctx) return;
    this.layerTarget.forEach((v, i) => this.layerGains[i].gain.setTargetAtTime(v, this.ctx!.currentTime, 0.6));
  }

  get layers(): number[] {
    return [...this.layerTarget];
  }

  // ───────────── music scheduler ─────────────
  private schedule(): void {
    const ctx = this.ctx!;
    const t = this.theme;
    const stepDur = 60 / t.bpm / 2; // 8th notes
    while (this.nextStep < ctx.currentTime + 0.25) {
      this.playStep(this.step, this.nextStep, stepDur);
      this.nextStep += stepDur;
      this.step = (this.step + 1) % 64;
    }
  }

  private note(deg: number, oct = 0): number {
    const s = this.theme.scale;
    const o = Math.floor(deg / s.length);
    const i = ((deg % s.length) + s.length) % s.length;
    return this.theme.root + s[i] + 12 * (o + oct);
  }

  private playStep(step: number, time: number, dur: number): void {
    const t = this.theme;
    const bar = Math.floor(step / 8) % 4;
    const s8 = step % 8;
    const chord = t.prog[bar];
    const L = this.layerGains;
    // Layer 0: deep plucked bass + kick
    if (s8 === 0) this.pluckBass(mtof(this.note(chord[0], -1)), time, dur * 3.5, L[0]);
    if (s8 === 3) this.pluckBass(mtof(this.note(chord[0], -1)), time, dur * 1.5, L[0], 0.55);
    if (s8 === 5) this.pluckBass(mtof(this.note(chord[2], -1)), time, dur * 2.5, L[0], 0.7);
    if (s8 === 0 || s8 === 4) this.kick(time, L[0], s8 === 0 ? 0.9 : 0.6);
    // Layer 1: concert bass drum + bowed pad
    if (s8 === 0 && bar % 2 === 0) this.concertDrum(time, L[1], 0.8);
    if (s8 === 6 && bar === 3) this.concertDrum(time, L[1], 0.5);
    if (s8 === 0) for (const d of chord) this.pad(mtof(this.note(d, 0)), time, dur * 8, L[1]);
    // Layer 2: marimba arpeggio
    if (s8 % 2 === 1 || s8 === 2) {
      const d = chord[(s8 >> 1) % 3] + (s8 > 4 ? 7 : 0);
      this.marimba(mtof(this.note(d, 1)), time, L[2]);
    }
    // Layer 3: music-box melody
    const m = t.melody[step % 16];
    if (m !== null) this.bell(mtof(this.note(m, 2)), time, L[3]);
  }

  private env(g: GainNode, time: number, peak: number, attack: number, decay: number): void {
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(peak, time + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, time + attack + decay);
  }

  private pluckBass(f: number, time: number, len: number, out: AudioNode, vel = 0.9): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f;
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = f / 2;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 4;
    lp.frequency.setValueAtTime(f * 14, time);
    lp.frequency.exponentialRampToValueAtTime(f * 1.6, time + 0.25);
    const g = ctx.createGain();
    this.env(g, time, 0.32 * vel, 0.004, Math.max(0.4, len));
    const sg = ctx.createGain();
    this.env(sg, time, 0.42 * vel, 0.01, Math.max(0.5, len));
    o.connect(lp).connect(g).connect(out);
    sub.connect(sg).connect(out);
    o.start(time);
    sub.start(time);
    o.stop(time + len + 0.6);
    sub.stop(time + len + 0.6);
  }

  private kick(time: number, out: AudioNode, vel: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(130, time);
    o.frequency.exponentialRampToValueAtTime(42, time + 0.14);
    const g = ctx.createGain();
    this.env(g, time, 0.9 * vel, 0.002, 0.42);
    o.connect(g).connect(out);
    o.start(time);
    o.stop(time + 0.5);
  }

  private concertDrum(time: number, out: AudioNode, vel: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(78, time);
    o.frequency.exponentialRampToValueAtTime(48, time + 0.5);
    const g = ctx.createGain();
    this.env(g, time, 0.7 * vel, 0.01, 1.6);
    o.connect(g).connect(out);
    g.connect(this.reverbSend);
    const n = ctx.createBufferSource();
    n.buffer = this.noiseBuf;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 220;
    const ng = ctx.createGain();
    this.env(ng, time, 0.5 * vel, 0.005, 0.5);
    n.connect(lp).connect(ng).connect(out);
    o.start(time);
    o.stop(time + 1.8);
    n.start(time, this.rand());
    n.stop(time + 0.6);
  }

  private pad(f: number, time: number, len: number, out: AudioNode): void {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(0.05, time + len * 0.35);
    g.gain.linearRampToValueAtTime(0.0001, time + len * 1.05);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900 + 1200 * this.theme.brightness;
    for (const det of [-7, 6]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = det;
      o.connect(lp);
      o.start(time);
      o.stop(time + len * 1.1);
    }
    lp.connect(g).connect(out);
  }

  private marimba(f: number, time: number, out: AudioNode): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = f * 4;
    const g = ctx.createGain();
    this.env(g, time, 0.14, 0.003, 0.35);
    const g2 = ctx.createGain();
    this.env(g2, time, 0.04, 0.002, 0.06);
    o.connect(g).connect(out);
    o2.connect(g2).connect(out);
    o.start(time);
    o2.start(time);
    o.stop(time + 0.5);
    o2.stop(time + 0.2);
  }

  private bell(f: number, time: number, out: AudioNode, gain = 0.09): void {
    const ctx = this.ctx!;
    const car = ctx.createOscillator();
    car.frequency.value = f;
    const mod = ctx.createOscillator();
    mod.frequency.value = f * 3.5;
    const mg = ctx.createGain();
    mg.gain.setValueAtTime(f * 1.2, time);
    mg.gain.exponentialRampToValueAtTime(1, time + 0.8);
    mod.connect(mg).connect(car.frequency);
    const g = ctx.createGain();
    this.env(g, time, gain, 0.002, 1.2);
    car.connect(g).connect(out);
    g.connect(this.reverbSend);
    car.start(time);
    mod.start(time);
    car.stop(time + 1.4);
    mod.stop(time + 1.4);
  }

  private makeImpulse(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (this.rand() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    return buf;
  }

  // ───────────── ambience ─────────────
  private startAmbience(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    for (const n of this.ambNodes) {
      try {
        (n as AudioScheduledSourceNode).stop?.();
      } catch {
        /* already stopped */
      }
      n.disconnect();
    }
    this.ambNodes = [];
    if (this.ambTimer) window.clearInterval(this.ambTimer);
    const kind = this.theme.ambience;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    const cfg: Record<string, [BiquadFilterType, number, number]> = {
      river: ['lowpass', 500, 0.7],
      street: ['bandpass', 700, 0.3],
      rain: ['highpass', 3000, 0.45],
      factory: ['lowpass', 180, 1],
      night: ['lowpass', 300, 0.35],
      crowd: ['bandpass', 1100, 0.4],
      hall: ['lowpass', 260, 0.3],
    };
    const [type, freq, gain] = cfg[kind];
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = gain;
    // slow swell, like wind or water
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.08;
    const lg = ctx.createGain();
    lg.gain.value = gain * 0.4;
    lfo.connect(lg).connect(g.gain);
    src.connect(f).connect(g).connect(this.ambBus);
    src.start();
    lfo.start();
    this.ambNodes.push(src, f, g, lfo, lg);
    this.ambTimer = window.setInterval(() => this.ambEvent(kind), 700);
  }

  private ambEvent(kind: Theme['ambience']): void {
    const ctx = this.ctx!;
    if (this.rand() > 0.35) return;
    const t = ctx.currentTime + 0.05;
    const out = this.ambBus;
    if (kind === 'river' || kind === 'rain') this.bell(1400 + this.rand() * 1600, t, out, 0.05); // drips
    else if (kind === 'night') {
      for (let i = 0; i < 3; i++) this.chirp(4200 + this.rand() * 400, t + i * 0.07, out); // crickets
    } else if (kind === 'factory') this.blip(90 + this.rand() * 60, t, out); // bubbling sap
    else if (kind === 'street' && this.rand() < 0.3) this.bell(1320, t, out, 0.05); // tram bell
    else if (kind === 'crowd' && this.rand() < 0.4) this.chirp(2400 + this.rand() * 800, t, out);
  }

  private chirp(f: number, time: number, out: AudioNode): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.frequency.value = f;
    const g = ctx.createGain();
    this.env(g, time, 0.03, 0.005, 0.04);
    o.connect(g).connect(out);
    o.start(time);
    o.stop(time + 0.08);
  }

  private blip(f: number, time: number, out: AudioNode): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(f, time);
    o.frequency.exponentialRampToValueAtTime(f * 2.2, time + 0.12);
    const g = ctx.createGain();
    this.env(g, time, 0.25, 0.01, 0.14);
    o.connect(g).connect(out);
    o.start(time);
    o.stop(time + 0.2);
  }

  // ───────────── sfx ─────────────
  private ready(): boolean {
    return !!this.ctx && this.ctx.state === 'running';
  }

  /** Called every frame with the fastest visible gear RPM; emits clicks at a rate tied to speed. */
  gearTicks(dt: number, rpm: number): void {
    if (rpm <= 0.01) return;
    const rate = Math.min(22, 1.5 + rpm / 12); // clicks per second
    this.tickAcc += dt * rate;
    while (this.tickAcc >= 1) {
      this.tickAcc -= 1;
      this.count('tick');
      if (!this.ready()) continue;
      const ctx = this.ctx!;
      const t = ctx.currentTime + 0.01;
      const n = ctx.createBufferSource();
      n.buffer = this.noiseBuf;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = Math.min(6000, 1200 + rpm * 18) * (0.96 + this.rand() * 0.08);
      bp.Q.value = 8;
      const g = ctx.createGain();
      this.env(g, t, 0.12, 0.001, 0.025);
      n.connect(bp).connect(g).connect(this.sfxBus);
      n.start(t, this.rand());
      n.stop(t + 0.05);
    }
  }

  clunk(meshed: boolean, teeth = 24): void {
    this.count(meshed ? 'mesh' : 'place');
    if (!this.ready()) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime + 0.005;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(220 - teeth, t);
    o.frequency.exponentialRampToValueAtTime(70, t + 0.1);
    const g = ctx.createGain();
    this.env(g, t, 0.5, 0.002, 0.16);
    o.connect(g).connect(this.sfxBus);
    o.start(t);
    o.stop(t + 0.25);
    if (meshed) {
      // metallic teeth catching
      this.bell(900 + 2000 / teeth * 10, t + 0.03, this.sfxBus, 0.06);
      for (let i = 0; i < 3; i++) {
        const n = ctx.createBufferSource();
        n.buffer = this.noiseBuf;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 2500 + i * 500;
        bp.Q.value = 10;
        const ng = ctx.createGain();
        this.env(ng, t + 0.03 + i * 0.045, 0.25, 0.001, 0.03);
        n.connect(bp).connect(ng).connect(this.sfxBus);
        n.start(t + 0.03 + i * 0.045, this.rand());
        n.stop(t + 0.1 + i * 0.045);
      }
    }
  }

  pop(): void {
    this.count('pop');
    if (!this.ready()) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(500, t);
    o.frequency.exponentialRampToValueAtTime(180, t + 0.1);
    const g = ctx.createGain();
    this.env(g, t, 0.25, 0.002, 0.12);
    o.connect(g).connect(this.sfxBus);
    o.start(t);
    o.stop(t + 0.2);
  }

  uiTap(): void {
    this.count('tap');
    if (!this.ready()) return;
    this.marimba(880, this.ctx!.currentTime, this.sfxBus);
  }

  bolt(n = 3 + Math.floor(this.rand() * 3)): void {
    this.count('bolt');
    if (!this.ready()) return;
    const ctx = this.ctx!;
    let t = ctx.currentTime + 0.02;
    for (let i = 0; i < n; i++) {
      const o = ctx.createOscillator();
      o.type = 'square';
      const f = 700 + this.rand() * 900;
      o.frequency.setValueAtTime(f, t);
      o.frequency.exponentialRampToValueAtTime(f * (this.rand() < 0.5 ? 1.5 : 0.7), t + 0.08);
      const lp = ctx.createBiquadFilter();
      lp.frequency.value = 2400;
      const g = ctx.createGain();
      this.env(g, t, 0.07, 0.005, 0.08);
      o.connect(lp).connect(g).connect(this.sfxBus);
      o.start(t);
      o.stop(t + 0.12);
      t += 0.09 + this.rand() * 0.05;
    }
  }

  jam(): void {
    this.count('jam');
    if (!this.ready()) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(70, t);
    o.frequency.linearRampToValueAtTime(40, t + 0.6);
    const wob = ctx.createOscillator();
    wob.frequency.value = 23;
    const wg = ctx.createGain();
    wg.gain.value = 20;
    wob.connect(wg).connect(o.frequency);
    const g = ctx.createGain();
    this.env(g, t, 0.3, 0.01, 0.7);
    const n = ctx.createBufferSource();
    n.buffer = this.noiseBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800;
    const ng = ctx.createGain();
    this.env(ng, t, 0.25, 0.01, 0.5);
    o.connect(g).connect(this.sfxBus);
    n.connect(bp).connect(ng).connect(this.sfxBus);
    o.start(t);
    wob.start(t);
    n.start(t);
    o.stop(t + 0.8);
    wob.stop(t + 0.8);
    n.stop(t + 0.6);
  }

  /** Deep, layered, subtle success hit + warm brass swell. */
  success(): void {
    this.count('success');
    if (!this.ready()) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime + 0.03;
    const bus = ctx.createGain();
    bus.gain.value = 0.9;
    bus.connect(this.sfxBus);
    bus.connect(this.reverbSend);
    this.kick(t, bus, 1);
    this.concertDrum(t, bus, 1);
    this.concertDrum(t + 0.012, bus, 0.6);
    // low tom-ish body
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(65, t + 0.4);
    const g = ctx.createGain();
    this.env(g, t, 0.35, 0.005, 0.9);
    o.connect(g).connect(bus);
    o.start(t);
    o.stop(t + 1.1);
    // brass fanfare: root-fifth-octave swell, then a bright chord
    const r = this.theme.root;
    const notes = [[r, r + 7], [r + 4, r + 12], [r + 7, r + 12, r + 16]];
    notes.forEach((ch, i) => {
      for (const m of ch) this.brass(mtof(m), t + 0.15 + i * 0.22, i === 2 ? 1.6 : 0.3, bus);
    });
    for (let i = 0; i < 5; i++) this.bell(mtof(r + 24 + [0, 4, 7, 12, 16][i]), t + 0.8 + i * 0.08, bus, 0.05);
  }

  private brass(f: number, time: number, len: number, out: AudioNode): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(f * 1.5, time);
    lp.frequency.linearRampToValueAtTime(f * 6, time + 0.08);
    lp.frequency.linearRampToValueAtTime(f * 3, time + len);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(0.07, time + 0.06);
    g.gain.setValueAtTime(0.07, time + len);
    g.gain.exponentialRampToValueAtTime(0.0001, time + len + 0.5);
    o.connect(lp).connect(g).connect(out);
    o.start(time);
    o.stop(time + len + 0.6);
  }

  star(i: number): void {
    this.count('star');
    if (!this.ready()) return;
    this.bell(mtof(this.theme.root + 24 + [0, 4, 7][i % 3]), this.ctx!.currentTime + 0.02, this.sfxBus, 0.09);
  }

  dispose(): void {
    if (this.timer) window.clearInterval(this.timer);
    if (this.ambTimer) window.clearInterval(this.ambTimer);
    void this.ctx?.close();
  }
}
