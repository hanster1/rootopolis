import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Loop } from '../core/Loop';
import { createRenderer, resizeRenderer } from '../core/Renderer';
import { Audio } from '../audio/Audio';
import { StoryPlayer } from '../ui/Story';
import { gearGeometry, gearSvg, GEAR_THICK } from '../render/gearGeometry';
import { World, pickQuality, type Quality } from '../render/world';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { MAT, makeMotor, makeRock, makeTopper, tableTexture, type Topper } from '../render/props';
import { solveNetwork, pitchRadius, dist, MESH_TOL, type Axle, type Gear, type NetworkResult } from '../gears/network';
import { type Frac, eq, frac, toNum, fmt, fmtRpm, mul } from '../gears/fraction';
import { LEVELS, CHAPTERS } from './levels';
import { PROLOGUE, STORIES } from './story';
import type { BuiltLevel, Peg } from './levelTypes';

type Screen = 'loading' | 'title' | 'select' | 'story' | 'play' | 'pause' | 'win' | 'end';

interface Placed {
  id: string;
  pegId: string;
  teeth: number;
  layer: number;
  locked: boolean;
}

interface GearView {
  mesh: THREE.Mesh;
  chip: HTMLElement;
}

const BOARD_W = 16;
const BOARD_H = 9.4;
const LAYER_Y = [0.14, 0.4];
const SNAP = 0.95;
const SANDBOX_TEETH = [10, 12, 16, 20, 24, 30, 36, 40, 48, 60];
const STORE_KEY = 'rootopolis-progress-v1';

const BOLT_QUIPS = {
  mesh: ['Bweep! (Teeth locked!)', 'Clink-beep! (They\'re holding hands!)', 'Boop! (Spinny!)'],
  jam: ['BZZRT! (Jammed! Two gears are fighting.)', 'Bwaaa… (Too many gears pushing the same peg!)', 'Beep-uh-oh. (Undo that one!)'],
  close: ['Beep beep! (So close!)', 'Bip? (Almost the right speed!)'],
  wrongWay: ['Beep… (Right speed, wrong way! Try an idler.)'],
  idle: ['Beep. (Drag a gear from the tray onto a peg.)', 'Boop? (Count the teeth!)', 'Bip-bip. (Small drives big = slower.)'],
};

interface Progress {
  stars: Record<string, number>;
  seen: Record<string, boolean>;
  muted: boolean;
}

function loadProgress(): Progress {
  try {
    const p = JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}') as Partial<Progress>;
    return { stars: p.stars ?? {}, seen: p.seen ?? {}, muted: !!p.muted };
  } catch {
    return { stars: {}, seen: {}, muted: false };
  }
}

const $ = <T extends HTMLElement = HTMLElement>(s: string): T => document.querySelector<T>(s)!;
const dirArrow = (f: Frac): string => (f.n > 0 ? '↻' : f.n < 0 ? '↺' : '•');
const dirWord = (f: Frac): string => (f.n > 0 ? 'clockwise' : 'anticlockwise');
const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];

export class Game {
  readonly audio = new Audio();
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
  private world = new THREE.Group();
  private board = new THREE.Group();
  private loop: Loop;
  private story: StoryPlayer;
  private raycaster = new THREE.Raycaster();
  private quality: Quality = pickQuality();
  private city!: World;
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  private slowFrames = 0;
  private tableMat = new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0.05 });
  private screen: Screen = 'loading';
  private progress = loadProgress();

  // level state
  private level: BuiltLevel | null = null;
  private sandbox = false;
  private sandboxRpm = 60;
  private pegs: Peg[] = [];
  private placed: Placed[] = [];
  private history: Placed[][] = [];
  private net: NetworkResult | null = null;
  private axleAngleBase = new Map<string, number>();
  private axleOmega = new Map<string, number>();
  private motorAngle = 0;
  private t = 0;
  private gearViews = new Map<string, GearView>();
  private pegMeshes = new Map<string, THREE.Mesh>();
  private toppers = new Map<string, Topper>();
  private motor: ReturnType<typeof makeMotor> | null = null;
  private targetEls = new Map<string, HTMLElement>();
  private wasJammed = false;
  private winTimer = 0;
  private lastWinCheck = 0;
  private won = false;
  private hintLevel = 0;
  private hintGhost: THREE.Mesh | null = null;
  private nextId = 1;
  private selectedTeeth: number | null = null;
  private selectedGear: string | null = null;
  private drag: { teeth: number; from?: Placed; startX: number; startY: number; moved: boolean; pointerId: number } | null = null;
  private ghost: THREE.Mesh;
  private ghostMat = new THREE.MeshStandardMaterial({ color: 0xffe08a, transparent: true, opacity: 0.55, metalness: 0.6, roughness: 0.3 });
  private confetti: THREE.InstancedMesh;
  private confettiVel: THREE.Vector3[] = [];
  private confettiPos: THREE.Vector3[] = [];
  private confettiLife = 0;
  private quipTimer = 0;
  private portrait = false;
  private settled = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = createRenderer(canvas);
    this.renderer.toneMappingExposure = 1.1;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.background = new THREE.Color(0x6a4a24);
    this.scene.fog = new THREE.Fog(0x7a4f22, 18, 46);
    this.scene.environmentIntensity = 0.4;
    this.city = new World(this.quality);
    this.scene.add(this.city.root);
    this.setupPost();
    this.scene.add(this.world);
    this.world.add(this.board);
    this.buildStage();
    this.ghost = new THREE.Mesh(gearGeometry(12), this.ghostMat);
    this.ghost.visible = false;
    this.world.add(this.ghost);
    const cg = new THREE.BoxGeometry(0.12, 0.02, 0.07);
    this.confetti = new THREE.InstancedMesh(cg, new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.4 }), 160);
    const colors = [0xffc93c, 0xe74c3c, 0x3fb5a3, 0xffffff, 0xd9a441, 0x8e6bd8];
    for (let i = 0; i < 160; i++) {
      this.confetti.setColorAt(i, new THREE.Color(colors[i % colors.length]));
      this.confettiVel.push(new THREE.Vector3());
      this.confettiPos.push(new THREE.Vector3(0, -50, 0));
    }
    this.confetti.visible = false;
    this.scene.add(this.confetti);

    this.story = new StoryPlayer(this.audio);
    this.loop = new Loop((dt) => this.update(dt), () => (this.composer ? this.composer.render() : this.renderer.render(this.scene, this.camera)));
    this.bindUi();
    this.bindPointer();
    this.audio.setMuted(this.progress.muted);
    this.syncMute();
    (window as unknown as { __ROOT: unknown }).__ROOT = this.testApi();
  }

  private setupPost(): void {
    if (this.quality !== 'high') {
      this.renderer.shadowMap.type = THREE.PCFShadowMap;
      return;
    }
    const size = this.renderer.getSize(new THREE.Vector2());
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x || 1, size.y || 1), 0.4, 0.5, 0.92);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }

  /** Drop to the light tier if the device can't keep up (sustained >40 ms frames). */
  private watchPerf(dt: number): void {
    if (this.quality !== 'high' || this.screen !== 'play') return;
    this.slowFrames = dt > 0.04 ? this.slowFrames + 1 : Math.max(0, this.slowFrames - 2);
    if (this.slowFrames > 90) {
      this.quality = 'low';
      this.composer?.dispose();
      this.composer = null;
      this.bloom = null;
      document.body.dataset.quality = 'low';
    }
  }

  // ───────────────────────────── stage ─────────────────────────────
  private buildStage(): void {
    const hemi = new THREE.HemisphereLight(0xffd59a, 0x241808, 0.5);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffb86a, 3.3);
    sun.position.set(-11, 15, 1);
    sun.castShadow = true;
    sun.shadow.mapSize.setScalar(this.quality === 'high' ? 2048 : 1024);
    const s = sun.shadow.camera;
    s.left = -22;
    s.right = 22;
    s.top = 20;
    s.bottom = -14;
    s.far = 60;
    sun.shadow.bias = -0.0005;
    this.scene.add(sun);
    const rim = new THREE.DirectionalLight(0xffb070, 0.7);
    rim.position.set(8, 6, -10);
    this.scene.add(rim);

  }

  private tableGroup = new THREE.Group();
  private tableKey = '';
  /** Brass-framed workbench sized to the level, sitting on a mossy root stump. */
  private buildTable(W: number, H: number, cx: number, cz: number): void {
    const key = [W, H, cx, cz].map((v) => v.toFixed(2)).join();
    if (key === this.tableKey) return;
    this.tableKey = key;
    const g = this.tableGroup;
    g.traverse((o) => { if ((o as THREE.Mesh).isMesh && o !== g) (o as THREE.Mesh).geometry.dispose(); });
    g.clear();
    if (!g.parent) this.world.add(g);
    g.position.set(cx, 0, cz);
    const top = new THREE.Mesh(new THREE.BoxGeometry(W, 0.3, H), this.tableMat);
    top.position.y = -0.15;
    top.receiveShadow = true;
    g.add(top);
    const fw = 0.28;
    for (const [w, d, x, z] of [
      [W + fw * 2, fw, 0, H / 2 + fw / 2],
      [W + fw * 2, fw, 0, -H / 2 - fw / 2],
      [fw, H, W / 2 + fw / 2, 0],
      [fw, H, -W / 2 - fw / 2, 0],
    ] as [number, number, number, number][]) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(w, 0.42, d), MAT.brass);
      f.position.set(x, -0.09, z);
      f.castShadow = true;
      f.receiveShadow = true;
      g.add(f);
    }
    const rivetGeo = new THREE.SphereGeometry(0.05, 8, 6);
    const n = Math.round(W / 0.9);
    for (let i = 0; i <= n; i++) {
      for (const z of [H / 2 + fw / 2, -H / 2 - fw / 2]) {
        const r = new THREE.Mesh(rivetGeo, MAT.copper);
        r.position.set(-W / 2 + (i * W) / n, 0.13, z);
        g.add(r);
      }
    }
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), MAT.lamp);
      lamp.position.set(sx * (W / 2 + fw / 2), 0.2, sz * (H / 2 + fw / 2));
      g.add(lamp);
    }
    const stump = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.12, 1, 28), new THREE.MeshStandardMaterial({ color: 0x5a3a20, roughness: 0.95 }));
    stump.scale.set(W / 2 + 0.9, 1, H / 2 + 0.9);
    stump.position.y = -0.8;
    stump.receiveShadow = true;
    g.add(stump);
    const moss = new THREE.Mesh(new THREE.TorusGeometry(1, 0.12, 8, 40), new THREE.MeshStandardMaterial({ color: 0x3f6420, roughness: 1 }));
    moss.rotation.x = Math.PI / 2;
    moss.scale.set(W / 2 + 0.85, H / 2 + 0.85, 2.2);
    moss.position.y = -0.32;
    g.add(moss);
  }

  private districtTint(ch: number): string {
    return ['#8a5a32', '#8a5a32', '#7a5a3a', '#6d6a3e', '#7a4a2a', '#4f4a5e', '#8a5530'][ch] ?? '#8a5a32';
  }

  // ───────────────────────────── lifecycle ─────────────────────────────
  start(): void {
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.loop.start();
    const imgs = ['art/title.webp', ...CHAPTERS.map((c) => c.art), 'art/tink.webp', 'art/bolt.webp', 'art/mayor.webp', 'art/crow.webp'];
    let n = 0;
    const bar = $('#loading-bar');
    const done = (): void => {
      n++;
      bar.style.width = `${Math.round((n / imgs.length) * 100)}%`;
      if (n === imgs.length) window.setTimeout(() => this.showTitle(), 250);
    };
    for (const src of imgs) {
      const im = new Image();
      im.onload = done;
      im.onerror = done;
      im.src = src;
    }
  }

  dispose(): void {
    this.loop.stop();
    this.audio.dispose();
    this.renderer.dispose();
  }

  private resize(): void {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.portrait = h > w * 1.1;
    this.world.rotation.y = this.portrait ? Math.PI / 2 : 0;
    resizeRenderer(this.renderer, this.camera, this.quality === 'high' ? 2 : 1.5);
    if (this.composer) {
      this.composer.setPixelRatio(this.renderer.getPixelRatio());
      this.composer.setSize(w, h);
    }
    this.camera.aspect = w / Math.max(1, h);
    // Fit the board, leaving room for the HUD at the top and the gear tray at the bottom.
    // Frame the level's pegs (plus room for big gears) instead of the whole table.
    let fw = BOARD_W, fh = BOARD_H, cx = 0, cy = 0;
    if (this.pegs.length && !this.sandbox) {
      const xs = this.pegs.map((p) => p.x), ys = this.pegs.map((p) => p.y);
      const pad = 2.6;
      const x0 = Math.min(...xs) - pad, x1 = Math.max(...xs) + pad;
      const y0 = Math.min(...ys) - pad, y1 = Math.max(...ys) + pad;
      fw = Math.min(BOARD_W, Math.max(9, x1 - x0)); fh = Math.min(BOARD_H, Math.max(6, y1 - y0));
      cx = (x0 + x1) / 2; cy = (y0 + y1) / 2;
    }
    this.buildTable(fw + 0.4, fh + 0.4, cx, -cy);
    // board (x,y) -> world (x,-z); portrait rotates world by +90deg about Y
    const fx = this.portrait ? -cy : cx, fz = this.portrait ? -cx : -cy;
    const bw = (this.portrait ? fh : fw) + 1.2;
    const bd = (this.portrait ? fw : fh) + 1.2;
    const tilt = THREE.MathUtils.degToRad(this.portrait ? 46 : 33);
    const vfov = THREE.MathUtils.degToRad(this.camera.fov);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * this.camera.aspect);
    const shortLand = !this.portrait && window.innerHeight < 480;
    const usable = this.portrait ? 0.56 : shortLand ? 0.4 : 0.46; // fraction of screen height for the board
    const dW = bw / 2 / Math.tan(hfov / 2) + 1.5;
    const dH = (bd * Math.sin(tilt)) / 2 / Math.tan((vfov * usable) / 2) + 1.5;
    const d = Math.max(dW, dH);
    const lookZ = this.portrait ? -1.4 : -1.7;
    this.camera.position.set(fx, Math.sin(tilt) * d, fz + Math.cos(tilt) * d + lookZ);
    this.camera.lookAt(fx, 0, fz + lookZ);
    this.camera.updateProjectionMatrix();
  }

  // ───────────────────────────── screens ─────────────────────────────
  private setScreen(s: Screen): void {
    this.screen = s;
    document.body.dataset.screen = s;
    for (const id of ['title', 'select', 'pause', 'win', 'end', 'loading']) $(`#${id}`).hidden = id !== s;
    $('#hud').hidden = !(s === 'play' || s === 'pause' || s === 'win');
    $('#tray').hidden = s !== 'play';
    $('#labels').hidden = !(s === 'play' || s === 'pause' || s === 'win');
  }

  private showTitle(): void {
    this.setScreen('title');
    this.loadSandbox(true);
    this.audio.setTheme('title');
    this.audio.setCloseness(0.5);
  }

  private showSelect(): void {
    this.setScreen('select');
    this.audio.setTheme('title');
    this.audio.setCloseness(0.5);
    const list = $('#chapters');
    list.innerHTML = '';
    for (const c of CHAPTERS) {
      const card = document.createElement('section');
      card.className = 'chapter';
      card.style.setProperty('--art', `url(${c.art})`);
      const levels = LEVELS.filter((l) => l.spec.chapter === c.n);
      const total = levels.reduce((s, l) => s + (this.progress.stars[l.spec.id] ?? 0), 0);
      card.innerHTML = `<header><span class="ch-num">Chapter ${c.n}</span><h3>${c.name}</h3><span class="ch-district">${c.district} · ★ ${total}/${levels.length * 3}</span></header><div class="lv-row"></div><button class="ch-story" type="button">▶ Story</button>`;
      const row = card.querySelector('.lv-row')!;
      for (const l of levels) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'lv';
        b.dataset.level = l.spec.id;
        const st = this.progress.stars[l.spec.id] ?? 0;
        b.innerHTML = `<b>${l.spec.id}</b><span>${l.spec.title}</span><i>${'★'.repeat(st)}${'☆'.repeat(3 - st)}</i>`;
        b.addEventListener('click', () => {
          this.audio.uiTap();
          this.startLevel(LEVELS.indexOf(l), true);
        });
        row.appendChild(b);
      }
      card.querySelector('.ch-story')!.addEventListener('click', () => {
        this.audio.uiTap();
        this.playChapterIntro(c.n, () => this.showSelect());
      });
      list.appendChild(card);
    }
  }

  private playChapterIntro(ch: number, then: () => void): void {
    const c = CHAPTERS[ch - 1];
    this.setScreen('story');
    this.audio.setTheme(String(ch));
    this.audio.setCloseness(0.35);
    this.progress.seen[`intro-${ch}`] = true;
    this.save();
    this.story.play(c.art, `Chapter ${ch} · ${c.name}`, STORIES[ch].intro, then);
  }

  private playChapterOutro(ch: number, then: () => void): void {
    const c = CHAPTERS[ch - 1];
    this.setScreen('story');
    this.audio.setCloseness(1);
    this.story.play(c.art, `${c.district} is fixed!`, STORIES[ch].outro, then);
  }

  private startStoryMode(): void {
    const first = LEVELS.findIndex((l) => !this.progress.stars[l.spec.id]);
    const idx = first < 0 ? 0 : first;
    if (!this.progress.seen.prologue) {
      this.progress.seen.prologue = true;
      this.save();
      this.setScreen('story');
      this.audio.setTheme('title');
      this.story.play('art/title.webp', 'Gearworks Garden: Rootopolis', PROLOGUE, () => this.startLevel(idx, true));
    } else this.startLevel(idx, true);
  }

  /** withIntro: play the chapter's story first if this is a chapter's opening level. */
  private startLevel(idx: number, withIntro: boolean): void {
    const L = LEVELS[idx];
    if (withIntro && L.spec.id.endsWith('-1') && !this.progress.seen[`intro-${L.spec.chapter}`]) {
      this.playChapterIntro(L.spec.chapter, () => this.startLevel(idx, false));
      return;
    }
    this.loadLevel(L);
    this.setScreen('play');
  }

  // ───────────────────────────── level loading ─────────────────────────────
  private clearBoard(): void {
    for (const v of this.gearViews.values()) v.chip.remove();
    this.gearViews.clear();
    for (const el of this.targetEls.values()) el.remove();
    this.targetEls.clear();
    this.board.clear();
    this.pegMeshes.clear();
    this.toppers.clear();
    this.motor = null;
    this.hintGhost = null;
    this.selectedGear = null;
    this.hideGearMenu();
    this.won = false;
    this.winTimer = 0;
    this.lastWinCheck = 0;
    this.wasJammed = false;
    this.hintLevel = 0;
    this.history = [];
    this.confetti.visible = false;
    $('#jam-banner').hidden = true;
  }

  loadLevel(L: BuiltLevel): void {
    this.clearBoard();
    this.level = L;
    this.sandbox = false;
    this.pegs = L.pegs.map((p) => ({ ...p }));
    this.resize();
    this.placed = L.presets.map((p) => ({ id: `g${this.nextId++}`, pegId: p.pegId, teeth: p.teeth, layer: p.layer, locked: true }));
    this.tableMat.map = tableTexture(this.districtTint(L.spec.chapter));
    this.tableMat.needsUpdate = true;
    for (const r of L.spec.rocks ?? []) {
      const rock = makeRock(r.r);
      rock.position.set(r.x, 0, -r.y);
      this.board.add(rock);
    }
    this.buildPegs();
    this.buildTray(L.spec.tray);
    this.audio.setTheme(String(L.spec.chapter));
    this.city.setChapter(L.spec.chapter);
    $('#lv-id').textContent = `${L.spec.id}`;
    $('#lv-title').textContent = L.spec.title;
    $('#goal').textContent = L.spec.goal;
    $('#hint-btn').hidden = false;
    $('#sandbox-ctl').hidden = true;
    this.say(pick(BOLT_QUIPS.idle));
    this.rebuild();
  }

  private loadSandbox(silent = false): void {
    this.clearBoard();
    this.level = null;
    this.sandbox = true;
    this.pegs = [{ id: 'motor', x: -5.5, y: 0, kind: 'motor', rpm: this.sandboxRpm }];
    this.resize();
    this.placed = [];
    this.tableMat.map = tableTexture('#7d5634');
    this.tableMat.needsUpdate = true;
    this.buildPegs();
    this.buildTray(SANDBOX_TEETH);
    $('#lv-id').textContent = 'Sandbox';
    $('#lv-title').textContent = 'The Workshop';
    $('#goal').textContent = 'Build anything! Drop gears near another gear and they snap together. Drop on a gear’s middle to stack a compound gear.';
    $('#hint-btn').hidden = true;
    $('#sandbox-ctl').hidden = false;
    if (silent) {
      // Title backdrop: a little demo machine turning behind the menu.
      const demo: [number, number, number][] = [[-5.5, 0, 24], [-5.5 + 1.2 + 0.6, 0, 12], [-3.7 + 0.6 + 1.8, 0, 36]];
      demo.forEach(([x, y, t], i) => {
        const id = i === 0 ? 'motor' : `s${this.nextId++}`;
        if (i > 0) this.pegs.push({ id, x, y, kind: 'free' });
        this.placed.push({ id: `g${this.nextId++}`, pegId: id, teeth: t, layer: 0, locked: false });
      });
      this.buildPegs();
    } else {
      this.setScreen('play');
      this.audio.setTheme('sandbox');
      this.say('Beep! (Anything goes in the workshop. Try a gear train!)');
    }
    this.rebuild();
  }

  private buildPegs(): void {
    for (const m of this.pegMeshes.values()) this.board.remove(m);
    this.pegMeshes.clear();
    for (const t of this.toppers.values()) this.board.remove(t.group);
    this.toppers.clear();
    for (const el of this.targetEls.values()) el.remove();
    this.targetEls.clear();
    const pegGeo = new THREE.CylinderGeometry(0.11, 0.14, 0.12, 16);
    const ringGeo = new THREE.TorusGeometry(0.3, 0.035, 8, 32);
    for (const p of this.pegs) {
      const m = new THREE.Mesh(pegGeo, p.kind === 'motor' ? MAT.copper : MAT.darkIron);
      m.position.set(p.x, 0.06, -p.y);
      m.castShadow = true;
      m.userData.pegId = p.id;
      const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: p.kind === 'output' ? 0x7dffb0 : 0xffe1a0, transparent: true, opacity: p.kind === 'free' ? 0.35 : 0.7 }));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = -0.04;
      ring.name = 'ring';
      m.add(ring);
      this.board.add(m);
      this.pegMeshes.set(p.id, m);
      if (p.kind === 'motor') {
        this.motor = makeMotor();
        this.motor.group.position.set(p.x, 0, -p.y);
        this.board.add(this.motor.group);
      }
      if (p.kind === 'output' && p.machine) {
        const tp = makeTopper(p.machine);
        tp.group.position.set(p.x, LAYER_Y[1] + 0.12, -p.y);
        this.board.add(tp.group);
        this.toppers.set(p.id, tp);
        const el = document.createElement('div');
        el.className = 'tlabel';
        $('#labels').appendChild(el);
        this.targetEls.set(p.id, el);
      }
    }
  }

  private buildTray(teeth: number[]): void {
    const tray = $('#tray-items');
    tray.innerHTML = '';
    for (const t of teeth) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tray-gear';
      b.dataset.teeth = String(t);
      b.setAttribute('aria-label', `${t}-tooth gear`);
      b.innerHTML = `${gearSvg(t, 34 + Math.min(t, 48) * 0.35)}<b>${t}</b>`;
      b.addEventListener('pointerdown', (e) => this.trayDown(e, t));
      tray.appendChild(b);
    }
    this.selectedTeeth = null;
  }

  // ───────────────────────────── model ─────────────────────────────
  private pegById(id: string): Peg | undefined {
    return this.pegs.find((p) => p.id === id);
  }

  private snapshot(): void {
    this.history.push(this.placed.map((g) => ({ ...g })));
    if (this.history.length > 60) this.history.shift();
  }

  private solve(placed = this.placed): NetworkResult {
    const axles: Axle[] = this.pegs.map((p) => ({ id: p.id, x: p.x, y: p.y, kind: p.kind, rpm: p.rpm }));
    const gears: Gear[] = placed.map((g) => ({ id: g.id, axleId: g.pegId, teeth: g.teeth, layer: g.layer, locked: g.locked }));
    return solveNetwork(axles, gears);
  }

  /** Pick a layer for a new gear on this peg: the one where it meshes without crashing into anything. */
  chooseLayer(pegId: string, teeth: number, ignore?: string): number | null {
    const on = this.placed.filter((g) => g.pegId === pegId && g.id !== ignore);
    const free = [0, 1].filter((l) => !on.some((g) => g.layer === l));
    if (!free.length) return null;
    const peg = this.pegById(pegId)!;
    let best = free[0];
    let bestScore = -Infinity;
    for (const l of free) {
      let meshes = 0;
      let overlaps = 0;
      for (const g of this.placed) {
        if (g.id === ignore || g.layer !== l || g.pegId === pegId) continue;
        const q = this.pegById(g.pegId)!;
        const d = dist(peg, q);
        const want = pitchRadius(g.teeth) + pitchRadius(teeth);
        if (Math.abs(d - want) <= MESH_TOL) meshes++;
        else if (d < want) overlaps++;
      }
      const score = meshes * 2 - overlaps * 10 - l * 0.1;
      if (score > bestScore) {
        bestScore = score;
        best = l;
      }
    }
    return best;
  }

  /** Place a gear. Returns the new gear id, or null if the peg is full. */
  placeGear(pegId: string, teeth: number, layer?: number): string | null {
    const L = layer ?? this.chooseLayer(pegId, teeth);
    if (L === null || this.placed.some((g) => g.pegId === pegId && g.layer === L)) {
      this.toast('That peg is full — two gears per peg, max!');
      this.audio.pop();
      return null;
    }
    this.snapshot();
    const before = this.solve().meshes.length;
    const id = `g${this.nextId++}`;
    this.placed.push({ id, pegId, teeth, layer: L, locked: false });
    this.rebuild();
    const meshed = (this.net?.meshes.length ?? 0) > before;
    this.audio.clunk(meshed, teeth);
    if (meshed && !this.net?.jammed && Math.random() < 0.4) this.say(pick(BOLT_QUIPS.mesh));
    this.bumpGear(id);
    return id;
  }

  removeGear(id: string): void {
    const g = this.placed.find((p) => p.id === id);
    if (!g || g.locked) return;
    this.snapshot();
    this.placed = this.placed.filter((p) => p.id !== id);
    if (this.sandbox) this.prunePegs();
    this.audio.pop();
    this.rebuild();
  }

  private flipGear(id: string): void {
    const g = this.placed.find((p) => p.id === id);
    if (!g || g.locked) return;
    const other = 1 - g.layer;
    if (this.placed.some((p) => p.pegId === g.pegId && p.layer === other)) {
      this.toast('No room — the other layer on this peg already has a gear.');
      return;
    }
    this.snapshot();
    g.layer = other;
    this.audio.clunk(false, g.teeth);
    this.rebuild();
  }

  private prunePegs(): void {
    const used = new Set(this.placed.map((g) => g.pegId));
    const before = this.pegs.length;
    this.pegs = this.pegs.filter((p) => p.kind === 'motor' || used.has(p.id));
    if (this.pegs.length !== before) this.buildPegs();
  }

  undo(): void {
    const prev = this.history.pop();
    if (!prev) return;
    this.placed = prev;
    if (this.sandbox) {
      // Bring back any sandbox axles that undo needs.
      this.prunePegs();
    }
    this.audio.pop();
    this.rebuild();
  }

  reset(): void {
    if (this.sandbox) {
      this.snapshot();
      this.placed = [];
      this.prunePegs();
      this.rebuild();
      return;
    }
    if (!this.level) return;
    this.snapshot();
    this.placed = this.placed.filter((g) => g.locked);
    this.audio.pop();
    this.rebuild();
  }

  /** Re-solve the machine and rebuild gear meshes and motion after any change. */
  private rebuild(): void {
    const net = this.solve();
    this.net = net;
    // Gear meshes
    const keep = new Set(this.placed.map((g) => g.id));
    for (const [id, v] of this.gearViews) {
      if (!keep.has(id)) {
        this.board.remove(v.mesh);
        v.chip.remove();
        this.gearViews.delete(id);
      }
    }
    for (const g of this.placed) {
      let v = this.gearViews.get(g.id);
      const peg = this.pegById(g.pegId)!;
      if (!v) {
        const preset = g.locked;
        const mesh = new THREE.Mesh(gearGeometry(g.teeth), (preset ? MAT.copper : MAT.brass).clone());
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.gearId = g.id;
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, GEAR_THICK + 0.06, 12), MAT.darkIron);
        mesh.add(hub);
        // marker spoke so slow rotations are visible
        const mark = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.12, pitchRadius(g.teeth) - 0.25), 0.02, 0.05), preset ? MAT.cream : MAT.red);
        mark.position.set(Math.max(0.12, pitchRadius(g.teeth) - 0.25) / 2 + 0.1, GEAR_THICK / 2 + 0.012, 0);
        mesh.add(mark);
        this.board.add(mesh);
        const chip = document.createElement('div');
        chip.className = preset ? 'chip preset' : 'chip';
        $('#labels').appendChild(chip);
        v = { mesh, chip };
        this.gearViews.set(g.id, v);
      }
      v.mesh.position.set(peg.x, LAYER_Y[g.layer], -peg.y);
      v.chip.dataset.layer = String(g.layer);
    }
    // Shaft heights: a peg carrying a top-layer gear gets a taller shaft.
    for (const [pid, m] of this.pegMeshes) {
      const top = this.placed.some((g) => g.pegId === pid && g.layer === 1);
      m.scale.y = top ? 5.2 : 2.6;
      m.position.y = (0.12 * m.scale.y) / 2;
      const ring = m.getObjectByName('ring');
      if (ring) ring.scale.y = 1 / m.scale.y;
    }

    // Motion: angle = base + omega * t, with base phases chosen so meshing teeth interlock.
    this.axleAngleBase.clear();
    this.axleOmega.clear();
    const motor = this.pegs.find((p) => p.kind === 'motor')!;
    if (!net.jammed) {
      const gearsByAxle = new Map<string, Placed[]>();
      for (const g of this.placed) (gearsByAxle.get(g.pegId) ?? gearsByAxle.set(g.pegId, []).get(g.pegId)!).push(g);
      const nb = new Map<string, string[]>();
      for (const m of net.meshes) {
        (nb.get(m.a) ?? nb.set(m.a, []).get(m.a)!).push(m.b);
        (nb.get(m.b) ?? nb.set(m.b, []).get(m.b)!).push(m.a);
      }
      const byId = new Map(this.placed.map((g) => [g.id, g]));
      const motorRpm = motor.rpm ?? 60;
      this.axleAngleBase.set(motor.id, 0);
      const q = [motor.id];
      while (q.length) {
        const a = q.shift()!;
        const pa = this.pegById(a)!;
        const phiA = this.axleAngleBase.get(a)!;
        for (const g of gearsByAxle.get(a) ?? []) {
          for (const oid of nb.get(g.id) ?? []) {
            const o = byId.get(oid)!;
            if (this.axleAngleBase.has(o.pegId)) continue;
            const pb = this.pegById(o.pegId)!;
            const th = Math.atan2(pb.y - pa.y, pb.x - pa.x);
            const k = g.teeth / o.teeth;
            this.axleAngleBase.set(o.pegId, th + Math.PI + Math.PI / o.teeth - k * (phiA - th));
            q.push(o.pegId);
          }
        }
      }
      // Each axle turns at a fixed signed multiple of the motor angle.
      for (const [axle, s] of net.axleSpeed) this.axleOmega.set(axle, toNum(s) / motorRpm);
    }
    this.updateObjective();
    if (net.jammed && !this.wasJammed) {
      this.audio.jam();
      this.say(pick(BOLT_QUIPS.jam));
      this.toast('Jammed! Those gears are fighting each other.');
    }
    $('#jam-banner').hidden = !net.jammed || this.screen !== 'play';
    this.wasJammed = net.jammed;
    for (const [id, v] of this.gearViews) {
      const mat = v.mesh.material as THREE.MeshStandardMaterial;
      const jam = net.jamGears.has(id);
      mat.emissive.setHex(jam ? 0xaa1100 : 0x000000);
      mat.emissiveIntensity = jam ? 0.8 : 0;
    }
    this.updateHintGhost();
    $('#undo-btn').toggleAttribute('disabled', this.history.length === 0);
  }

  private playerGearCount(): number {
    return this.placed.filter((g) => !g.locked).length;
  }

  /** 0..1 musical closeness of the machine to its targets. */
  closeness(): number {
    if (!this.level || !this.net) return 0.5;
    if (this.net.jammed) return 0.05;
    let sum = 0;
    for (const t of this.level.targets) {
      const s = this.net.axleSpeed.get(t.pegId);
      if (!s) continue;
      const a = Math.abs(toNum(s));
      const b = Math.abs(toNum(t.rpm));
      let c = Math.min(a, b) / Math.max(a, b);
      if (Math.sign(toNum(s)) !== Math.sign(toNum(t.rpm))) c *= 0.55;
      sum += eq(s, t.rpm) ? 1 : c * 0.85;
    }
    return sum / this.level.targets.length;
  }

  isSolved(): boolean {
    if (!this.level || !this.net || this.net.jammed) return false;
    return this.level.targets.every((t) => {
      const s = this.net!.axleSpeed.get(t.pegId);
      return !!s && eq(s, t.rpm);
    });
  }

  private updateObjective(): void {
    const box = $('#targets');
    box.innerHTML = '';
    if (this.sandbox || !this.level) {
      box.innerHTML = `<div class="target sandbox">Motor <b>${this.sandboxRpm}</b> RPM ↻</div>`;
      $('#par').textContent = `${this.playerGearCount()} gears`;
      this.audio.setCloseness(Math.min(1, 0.25 + this.playerGearCount() * 0.12));
      return;
    }
    const motorRpm = this.level.spec.motor.rpm;
    for (const t of this.level.targets) {
      const s = this.net?.jammed ? undefined : this.net?.axleSpeed.get(t.pegId);
      const ok = !!s && eq(s, t.rpm);
      const d = document.createElement('div');
      d.className = `target${ok ? ' ok' : ''}`;
      const now = s ? `${fmtRpm(s)} ${dirArrow(s)}` : this.net?.jammed ? 'jammed' : 'stopped';
      d.innerHTML = `<span class="t-label">${t.label}</span><span class="t-want"><b>${fmtRpm(t.rpm)}</b> RPM ${dirArrow(t.rpm)}</span><span class="t-now">now ${now}${ok ? ' ✓' : ''}</span>`;
      box.appendChild(d);
      const el = this.targetEls.get(t.pegId);
      if (el) {
        el.className = `tlabel${ok ? ' ok' : ''}`;
        el.innerHTML = `<b>${t.label}</b><span>Target <strong>${fmtRpm(t.rpm)}</strong> ${dirArrow(t.rpm)}</span><em>${now}</em>`;
      }
    }
    $('#motor-rpm').textContent = `Motor ${motorRpm} RPM ↻`;
    const used = this.playerGearCount();
    $('#par').textContent = `Gears ${used} · Par ${this.level.par}`;
    this.audio.setCloseness(this.closeness());
  }

  // ───────────────────────────── hints ─────────────────────────────
  private hint(): void {
    if (!this.level) return;
    this.hintLevel++;
    this.audio.bolt(2);
    if (this.hintLevel === 1) this.say(`Beep! (${this.level.spec.hint})`, 9000);
    else {
      const next = this.nextSolutionStep();
      if (next) {
        this.say(`Bwip! (Try a ${next.teeth}-tooth gear on the glowing peg.)`, 7000);
      } else this.say('Beep? (Your gears look right — check for extra gears!)');
    }
    this.updateHintGhost();
  }

  private nextSolutionStep(): BuiltLevel['solution'][number] | null {
    if (!this.level) return null;
    for (const s of this.level.solution) {
      if (!this.placed.some((g) => g.pegId === s.pegId && g.teeth === s.teeth && g.layer === s.layer)) return s;
    }
    return null;
  }

  private updateHintGhost(): void {
    if (this.hintGhost) {
      this.board.remove(this.hintGhost);
      this.hintGhost = null;
    }
    if (this.hintLevel < 2 || !this.level) return;
    const s = this.nextSolutionStep();
    if (!s) return;
    const peg = this.pegById(s.pegId)!;
    const m = new THREE.Mesh(gearGeometry(s.teeth), new THREE.MeshBasicMaterial({ color: 0x7dffb0, transparent: true, opacity: 0.35, depthWrite: false }));
    m.position.set(peg.x, LAYER_Y[s.layer] + 0.01, -peg.y);
    this.board.add(m);
    this.hintGhost = m;
  }

  // ───────────────────────────── winning ─────────────────────────────
  private checkWin(dt: number): void {
    if (this.won || !this.level || this.screen !== 'play') return;
    if (this.isSolved()) {
      // Count real time so a slow device still celebrates after ~0.9 s.
      const now = performance.now() / 1000;
      this.winTimer += Math.max(dt, Math.min(0.5, now - (this.lastWinCheck || now)));
      this.lastWinCheck = now;
      if (this.winTimer > 0.9) this.win();
    } else { this.winTimer = 0; this.lastWinCheck = 0; }
  }

  private starsFor(used: number, par: number): number {
    return used <= par ? 3 : used <= par + 1 ? 2 : 1;
  }

  private win(): void {
    const L = this.level!;
    this.won = true;
    const used = this.playerGearCount();
    const stars = this.starsFor(used, L.par);
    this.progress.stars[L.spec.id] = Math.max(this.progress.stars[L.spec.id] ?? 0, stars);
    this.save();
    this.audio.success();
    this.burstConfetti();
    this.say(pick(['BWEEEP! (We did it!)', 'Beep-beep-HOORAY!', 'Boop boop! (Bolt dance!)']));
    const motor = L.spec.motor.rpm;
    const lines = L.targets
      .map((t) => {
        const ratio = mul(t.rpm, frac(1, motor));
        const r = Math.abs(toNum(ratio));
        const how = r === 1 ? 'the same speed' : r < 1 ? `${fmt(frac(Math.abs(ratio.d), Math.abs(ratio.n)))}× slower` : `${fmt(frac(Math.abs(ratio.n), ratio.d))}× faster`;
        const way = ratio.n > 0 ? 'same way as the motor' : 'opposite way to the motor';
        return `<li><b>${t.label}</b>: ${motor} → ${fmtRpm(t.rpm)} RPM. That's ${how}, turning ${way} (${dirWord(t.rpm)}).</li>`;
      })
      .join('');
    window.setTimeout(() => {
      if (this.level !== L) return;
      this.setScreen('win');
      $('#win-title').textContent = pick(['Machine fixed!', 'Purr-fect gearing!', 'Squeak-tacular!', 'Cheese-tastic!']);
      $('#win-used').textContent = `You used ${used} gear${used === 1 ? '' : 's'} · par is ${L.par}`;
      $('#win-lesson').innerHTML = lines;
      const starsEl = $('#win-stars');
      starsEl.innerHTML = '';
      for (let i = 0; i < 3; i++) {
        const s = document.createElement('span');
        s.textContent = '★';
        s.className = i < stars ? 'on' : '';
        s.style.animationDelay = `${0.25 + i * 0.3}s`;
        starsEl.appendChild(s);
        if (i < stars) window.setTimeout(() => this.audio.star(i), 250 + i * 300);
      }
      $('#win-tip').textContent = stars < 3 ? `Tip: can you do it with only ${L.par} gear${L.par === 1 ? '' : 's'} for 3 stars?` : '';
      const idx = LEVELS.indexOf(L);
      $('#win-next').textContent = idx === LEVELS.length - 1 ? 'Finale ▶' : 'Next ▶';
    }, 1300);
  }

  private nextLevel(): void {
    const L = this.level;
    if (!L) return;
    const idx = LEVELS.indexOf(L);
    const chapterEnd = idx === LEVELS.length - 1 || LEVELS[idx + 1].spec.chapter !== L.spec.chapter;
    if (chapterEnd) {
      this.playChapterOutro(L.spec.chapter, () => {
        if (idx === LEVELS.length - 1) this.showEnd();
        else this.playChapterIntro(L.spec.chapter + 1, () => this.startLevel(idx + 1, false));
      });
    } else this.startLevel(idx + 1, false);
  }

  private showEnd(): void {
    this.setScreen('end');
    this.audio.setTheme('6');
    this.audio.setCloseness(1);
    const total = Object.values(this.progress.stars).reduce((a, b) => a + b, 0);
    $('#end-stars').textContent = `★ ${total} / ${LEVELS.length * 3}`;
    this.burstConfetti();
  }

  private burstConfetti(): void {
    this.confetti.visible = true;
    this.confettiLife = 4;
    for (let i = 0; i < this.confettiPos.length; i++) {
      this.confettiPos[i].set((Math.random() - 0.5) * 6, 1 + Math.random(), (Math.random() - 0.5) * 3);
      this.confettiVel[i].set((Math.random() - 0.5) * 8, 6 + Math.random() * 6, (Math.random() - 0.5) * 6);
    }
  }

  // ───────────────────────────── HUD helpers ─────────────────────────────
  private toastTimer = 0;
  private toast(msg: string): void {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => t.classList.remove('show'), 2600);
  }

  private sayTimer = 0;
  private say(msg: string, ms = 4500): void {
    const b = $('#bolt-bubble');
    b.textContent = msg;
    b.classList.add('show');
    $('#bolt').classList.remove('hop');
    void $('#bolt').offsetWidth;
    $('#bolt').classList.add('hop');
    window.clearTimeout(this.sayTimer);
    this.sayTimer = window.setTimeout(() => b.classList.remove('show'), ms);
  }

  private save(): void {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(this.progress));
    } catch {
      /* private mode */
    }
  }

  private syncMute(): void {
    for (const b of document.querySelectorAll<HTMLElement>('.mute-btn')) {
      b.textContent = this.progress.muted ? '🔇 Sound off' : '🔊 Sound on';
      b.setAttribute('aria-pressed', String(!this.progress.muted));
    }
  }

  private bumpGear(id: string): void {
    const v = this.gearViews.get(id);
    if (v) v.mesh.userData.bump = 1;
  }

  private pause(): void {
    if (this.screen !== 'play') return;
    this.setScreen('pause');
    $('#pause-title').textContent = this.sandbox ? 'Workshop paused' : `Paused · ${this.level?.spec.id} ${this.level?.spec.title}`;
  }

  private resume(): void {
    if (this.screen === 'pause') this.setScreen('play');
  }

  // ───────────────────────────── UI wiring ─────────────────────────────
  private bindUi(): void {
    const unlock = (): void => this.audio.unlock();
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });
    const on = (sel: string, fn: () => void): void =>
      document.querySelectorAll(sel).forEach((el) =>
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          this.audio.unlock();
          this.audio.uiTap();
          fn();
        }),
      );
    on('#play-btn', () => this.startStoryMode());
    on('#levels-btn', () => this.showSelect());
    on('#sandbox-btn', () => this.loadSandbox());
    on('#select-sandbox', () => this.loadSandbox());
    on('#select-back', () => this.showTitle());
    on('#prologue-btn', () => {
      this.setScreen('story');
      this.story.play('art/title.webp', 'Gearworks Garden: Rootopolis', PROLOGUE, () => this.showSelect());
    });
    on('.mute-btn', () => {
      this.progress.muted = !this.progress.muted;
      this.audio.setMuted(this.progress.muted);
      this.save();
      this.syncMute();
    });
    on('#pause-btn', () => this.pause());
    on('#resume-btn', () => this.resume());
    on('#restart-btn', () => {
      this.reset();
      this.setScreen('play');
    });
    on('#pause-levels', () => this.showSelect());
    on('#pause-title-btn', () => this.showTitle());
    on('#hint-btn', () => this.hint());
    on('#undo-btn', () => this.undo());
    on('#reset-btn', () => this.reset());
    on('#jam-undo', () => this.undo());
    on('#win-next', () => this.nextLevel());
    on('#win-replay', () => {
      if (this.level) this.loadLevel(this.level);
      this.setScreen('play');
    });
    on('#win-levels', () => this.showSelect());
    on('#end-sandbox', () => this.loadSandbox());
    on('#end-title', () => this.showTitle());
    on('#menu-remove', () => {
      if (this.selectedGear) this.removeGear(this.selectedGear);
      this.hideGearMenu();
    });
    on('#menu-flip', () => {
      if (this.selectedGear) this.flipGear(this.selectedGear);
      this.hideGearMenu();
    });
    document.querySelectorAll<HTMLButtonElement>('[data-rpm]').forEach((b) =>
      b.addEventListener('click', () => {
        this.sandboxRpm = Number(b.dataset.rpm);
        const m = this.pegs.find((p) => p.kind === 'motor');
        if (m) m.rpm = this.sandboxRpm;
        document.querySelectorAll('[data-rpm]').forEach((x) => x.classList.toggle('on', x === b));
        this.rebuild();
      }),
    );
    window.addEventListener('keydown', (e) => {
      if (this.story.active) return;
      if (e.key === 'Escape' || e.key === 'p') {
        if (this.screen === 'play') this.pause();
        else if (this.screen === 'pause') this.resume();
      } else if (this.screen === 'play') {
        if ((e.key === 'z' && (e.ctrlKey || e.metaKey)) || e.key === 'u') this.undo();
        else if (e.key === 'r') this.reset();
        else if (e.key === 'h') this.hint();
        else if (/^[1-9]$/.test(e.key)) {
          const b = document.querySelectorAll<HTMLElement>('.tray-gear')[Number(e.key) - 1];
          if (b) this.selectTray(Number(b.dataset.teeth));
        }
      }
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.pause();
    });
  }

  private selectTray(t: number | null): void {
    this.selectedTeeth = this.selectedTeeth === t ? null : t;
    document.querySelectorAll<HTMLElement>('.tray-gear').forEach((b) => b.classList.toggle('sel', Number(b.dataset.teeth) === this.selectedTeeth));
    if (this.selectedTeeth) this.toast(`${this.selectedTeeth}-tooth gear ready — tap a peg to place it.`);
  }

  private hideGearMenu(): void {
    $('#gear-menu').hidden = true;
    this.selectedGear = null;
  }

  // ───────────────────────────── pointer → board ─────────────────────────────
  private ndc = new THREE.Vector2();
  private setNdc(e: PointerEvent): void {
    const r = this.canvas.getBoundingClientRect();
    this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
  }

  /** Board coordinates under the pointer on the plane at height y. */
  private boardPoint(e: PointerEvent, y = LAYER_Y[0]): { x: number; y: number } | null {
    this.setNdc(e);
    const hit = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), hit)) return null;
    this.world.worldToLocal(hit);
    return { x: hit.x, y: -hit.z };
  }

  private gearUnder(e: PointerEvent): Placed | null {
    this.setNdc(e);
    const meshes = [...this.gearViews.values()].map((v) => v.mesh);
    const hits = this.raycaster.intersectObjects(meshes, false);
    for (const h of hits) {
      const g = this.placed.find((p) => p.id === h.object.userData.gearId);
      if (g) return g;
    }
    // Generous touch: nearest gear centre within its radius.
    const p = this.boardPoint(e);
    if (!p) return null;
    let best: Placed | null = null;
    let bd = Infinity;
    for (const g of this.placed) {
      const q = this.pegById(g.pegId)!;
      const d = dist(p, q);
      if (d < pitchRadius(g.teeth) && d < bd - (g.layer ? 0.01 : 0)) {
        bd = d;
        best = g;
      }
    }
    return best;
  }

  private nearestPeg(p: { x: number; y: number }): Peg | null {
    let best: Peg | null = null;
    let bd = SNAP;
    for (const q of this.pegs) {
      const d = dist(p, q);
      if (d < bd) {
        bd = d;
        best = q;
      }
    }
    return best;
  }

  /** Sandbox: stack on a gear centre, else snap to the exact mesh distance of the nearest gear. */
  private sandboxSpot(p: { x: number; y: number }, teeth: number, ignore?: string): { pegId?: string; x: number; y: number; layer?: number } {
    for (const q of this.pegs) {
      if (dist(p, q) < 0.35 && this.placed.some((g) => g.pegId === q.id && g.id !== ignore)) return { pegId: q.id, x: q.x, y: q.y };
    }
    const motor = this.pegs.find((q) => q.kind === 'motor')!;
    if (dist(p, motor) < 0.5) return { pegId: motor.id, x: motor.x, y: motor.y };
    let best: { x: number; y: number; layer: number } | null = null;
    let bd = 0.6;
    for (const g of this.placed) {
      if (g.id === ignore) continue;
      const q = this.pegById(g.pegId)!;
      const want = pitchRadius(g.teeth) + pitchRadius(teeth);
      const d = dist(p, q);
      const err = Math.abs(d - want);
      if (err < bd && d > 0.01) {
        bd = err;
        best = { x: q.x + ((p.x - q.x) / d) * want, y: q.y + ((p.y - q.y) / d) * want, layer: g.layer };
      }
    }
    const spot = best ?? { x: p.x, y: p.y };
    spot.x = THREE.MathUtils.clamp(spot.x, -BOARD_W / 2 + 0.4, BOARD_W / 2 - 0.4);
    spot.y = THREE.MathUtils.clamp(spot.y, -BOARD_H / 2 + 0.4, BOARD_H / 2 - 0.4);
    return spot;
  }

  private dropAt(e: PointerEvent, teeth: number, ignore?: string): boolean {
    const p = this.boardPoint(e);
    if (!p) return false;
    if (Math.abs(p.x) > BOARD_W / 2 + 0.5 || Math.abs(p.y) > BOARD_H / 2 + 0.5) return false;
    if (this.sandbox) {
      const s = this.sandboxSpot(p, teeth, ignore);
      let pegId = s.pegId;
      if (!pegId) {
        pegId = `s${this.nextId++}`;
        this.pegs.push({ id: pegId, x: s.x, y: s.y, kind: 'free' });
        this.buildPegs();
      }
      return this.placeGear(pegId, teeth, s.layer !== undefined && !this.placed.some((g) => g.pegId === pegId && g.layer === s.layer) ? s.layer : undefined) !== null;
    }
    const peg = this.nearestPeg(p);
    if (!peg) {
      this.toast('Gears need a peg — drop it on one of the little brass studs.');
      return false;
    }
    return this.placeGear(peg.id, teeth) !== null;
  }

  private trayDown(e: PointerEvent, teeth: number): void {
    e.preventDefault();
    this.audio.unlock();
    this.hideGearMenu();
    this.drag = { teeth, startX: e.clientX, startY: e.clientY, moved: false, pointerId: e.pointerId };
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
  }

  private bindPointer(): void {
    this.canvas.addEventListener('pointerdown', (e) => {
      if (this.screen !== 'play') return;
      this.audio.unlock();
      const g = this.gearUnder(e);
      if (g && !g.locked) {
        this.drag = { teeth: g.teeth, from: g, startX: e.clientX, startY: e.clientY, moved: false, pointerId: e.pointerId };
        return;
      }
      if (g?.locked) {
        this.toast(`That ${g.teeth}-tooth gear is bolted down — it's part of the machine.`);
        this.hideGearMenu();
        return;
      }
      this.hideGearMenu();
      if (this.selectedTeeth) {
        this.dropAt(e, this.selectedTeeth);
      }
    });
    window.addEventListener('pointermove', (e) => {
      const d = this.drag;
      if (!d || e.pointerId !== d.pointerId) return;
      if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 8) {
        d.moved = true;
        this.hideGearMenu();
        this.ghost.geometry = gearGeometry(d.teeth);
        this.ghost.visible = true;
        if (d.from) {
          const v = this.gearViews.get(d.from.id);
          if (v) v.mesh.visible = false;
        }
      }
      if (!d.moved) return;
      const p = this.boardPoint(e, LAYER_Y[0]);
      if (!p) return;
      let x = p.x;
      let y = p.y;
      let ok = false;
      if (this.sandbox) {
        const s = this.sandboxSpot(p, d.teeth, d.from?.id);
        x = s.x;
        y = s.y;
        ok = true;
      } else {
        const peg = this.nearestPeg(p);
        if (peg) {
          x = peg.x;
          y = peg.y;
          ok = true;
        }
      }
      this.ghost.position.set(x, LAYER_Y[1] + 0.25, -y);
      this.ghostMat.color.setHex(ok ? 0x9dffb8 : 0xffe08a);
    });
    window.addEventListener('pointerup', (e) => {
      const d = this.drag;
      if (!d || e.pointerId !== d.pointerId) return;
      this.drag = null;
      this.ghost.visible = false;
      if (d.from) {
        const v = this.gearViews.get(d.from.id);
        if (v) v.mesh.visible = true;
        if (!d.moved) {
          this.openGearMenu(d.from, e);
          return;
        }
        // Move = remove + place, as one undo step.
        const from = d.from;
        const snap = this.placed.map((g) => ({ ...g }));
        this.placed = this.placed.filter((g) => g.id !== from.id);
        const ok = this.screen === 'play' && this.dropAtSilent(e, from.teeth);
        if (!ok) {
          // dropped off the board: remove it
          this.audio.pop();
        }
        this.history.splice(this.history.length - (ok ? 1 : 0), ok ? 1 : 0, snap);
        if (this.sandbox) this.prunePegs();
        this.rebuild();
        return;
      }
      if (!d.moved) {
        this.selectTray(d.teeth);
        return;
      }
      if (this.screen === 'play') this.dropAt(e, d.teeth);
    });
  }

  private dropAtSilent(e: PointerEvent, teeth: number): boolean {
    const hist = this.history.length;
    const ok = this.dropAt(e, teeth);
    if (ok && this.history.length > hist) this.history.pop();
    return ok;
  }

  private openGearMenu(g: Placed, e: PointerEvent): void {
    this.selectedGear = g.id;
    const m = $('#gear-menu');
    m.hidden = false;
    m.style.left = `${Math.min(window.innerWidth - 170, Math.max(10, e.clientX - 80))}px`;
    m.style.top = `${Math.max(10, e.clientY - 90)}px`;
    $('#menu-info').textContent = `${g.teeth} teeth · ${g.layer ? 'top' : 'bottom'} layer`;
    this.bumpGear(g.id);
  }

  // ───────────────────────────── frame ─────────────────────────────
  private v3 = new THREE.Vector3();
  private dummy = new THREE.Object3D();

  private update(dt: number): void {
    this.resizeIfNeeded();
    const paused = this.screen === 'pause';
    if (!paused) this.t += dt;
    const motorPeg = this.pegs.find((p) => p.kind === 'motor');
    const motorRpm = motorPeg?.rpm ?? 60;
    // Motor angle in radians (CCW+): clockwise motor → negative.
    if (!paused && this.net && !this.net.jammed) this.motorAngle += dt * (-motorRpm / 60) * Math.PI * 2;
    const jamWobble = this.net?.jammed ? Math.sin(this.t * 40) * 0.03 : 0;
    let maxRpm = 0;
    for (const g of this.placed) {
      const v = this.gearViews.get(g.id);
      if (!v) continue;
      const base = this.axleAngleBase.get(g.pegId);
      const om = this.axleOmega.get(g.pegId);
      let a = 0;
      if (base !== undefined && om !== undefined) {
        // om = this axle's speed as a signed multiple of the motor's.
        a = base + om * this.motorAngle;
        maxRpm = Math.max(maxRpm, Math.abs(om * motorRpm));
      }
      v.mesh.rotation.y = a + jamWobble;
      const bump = (v.mesh.userData.bump as number) ?? 0;
      if (bump > 0) {
        v.mesh.userData.bump = Math.max(0, bump - dt * 4);
        v.mesh.scale.setScalar(1 + Math.sin(bump * Math.PI) * 0.08);
      }
    }
    for (const [pid, tp] of this.toppers) {
      const base = this.axleAngleBase.get(pid) ?? 0;
      const om = this.axleOmega.get(pid);
      const a = om !== undefined ? base + om * this.motorAngle : 0;
      const target = this.level?.targets.find((t) => t.pegId === pid);
      const s = this.net?.axleSpeed.get(pid);
      const on = !!(target && s && !this.net?.jammed && eq(s, target.rpm));
      tp.update(a, om !== undefined ? Math.abs(om * motorRpm) : 0, this.t, on);
    }
    this.motor?.update(this.motorAngle, this.t);
    if (!paused && (this.screen === 'play' || this.screen === 'title' || this.screen === 'win')) this.audio.gearTicks(dt, this.screen === 'title' ? 0 : maxRpm);
    this.checkWin(dt);
    if (this.won || (this.level && this.isSolvedCached())) this.city.celebrate();
    else this.city.idle();
    if (!paused) this.city.update(this.t, dt);
    this.watchPerf(dt);
    this.updateLabels();
    this.updateConfetti(dt);
    this.quipTimer += dt;
    if (this.screen === 'play' && this.quipTimer > 28 && !this.won && this.level) {
      this.quipTimer = 0;
      const c = this.closeness();
      this.say(c > 0.7 ? pick(BOLT_QUIPS.close) : pick(BOLT_QUIPS.idle));
    }
    // Title: slow orbit of the diorama.
    if (this.screen === 'title' || this.screen === 'select' || this.screen === 'loading') {
      this.world.rotation.y = (this.portrait ? Math.PI / 2 : 0) + Math.sin(this.t * 0.15) * 0.12;
    } else this.world.rotation.y = this.portrait ? Math.PI / 2 : 0;
    this.settled += dt;
  }

  private solvedKey = '';
  private solvedVal = false;
  /** isSolved() walks the network; only recompute when gears change. */
  private isSolvedCached(): boolean {
    const k = this.placed.map((g) => g.pegId + g.teeth + g.layer).join() + (this.level?.spec.id ?? '');
    if (k !== this.solvedKey) {
      this.solvedKey = k;
      this.solvedVal = this.isSolved();
    }
    return this.solvedVal;
  }

  private lastSize = '';
  private resizeIfNeeded(): void {
    const k = `${this.canvas.clientWidth}x${this.canvas.clientHeight}`;
    if (k !== this.lastSize) {
      this.lastSize = k;
      this.resize();
    }
  }

  private project(x: number, y: number, h: number): { x: number; y: number } {
    this.v3.set(x, h, -y);
    this.world.localToWorld(this.v3);
    this.v3.project(this.camera);
    return { x: (this.v3.x * 0.5 + 0.5) * this.canvas.clientWidth, y: (-this.v3.y * 0.5 + 0.5) * this.canvas.clientHeight };
  }

  private updateLabels(): void {
    if (this.screen !== 'play' && this.screen !== 'win' && this.screen !== 'pause') return;
    for (const g of this.placed) {
      const v = this.gearViews.get(g.id);
      if (!v) continue;
      const p = this.pegById(g.pegId)!;
      const r = pitchRadius(g.teeth);
      const s = this.project(p.x + r * 0.62, p.y - r * 0.62, LAYER_Y[g.layer] + 0.1);
      v.chip.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px) translate(-50%, -50%)`;
      let txt = `${g.teeth}`;
      if (this.sandbox) {
        const sp = this.net?.jammed ? undefined : this.net?.axleSpeed.get(g.pegId);
        if (sp) txt += ` · ${fmtRpm(sp)}${dirArrow(sp)}`;
      }
      if (v.chip.textContent !== txt) v.chip.textContent = txt;
      v.chip.hidden = !v.mesh.visible;
    }
    for (const [pid, el] of this.targetEls) {
      const p = this.pegById(pid)!;
      const s = this.project(p.x, p.y, 1.9);
      el.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px) translate(-50%, -100%)`;
    }
    const m = this.pegs.find((p) => p.kind === 'motor');
    if (m) {
      const s = this.project(m.x, m.y - 0.9, 0.2);
      $('#motor-tag').style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px) translate(-50%, 0)`;
      $('#motor-tag').textContent = `Motor ${m.rpm} RPM ↻`;
    }
  }

  private updateConfetti(dt: number): void {
    if (!this.confetti.visible) return;
    this.confettiLife -= dt;
    if (this.confettiLife <= 0) {
      this.confetti.visible = false;
      return;
    }
    for (let i = 0; i < this.confettiPos.length; i++) {
      const v = this.confettiVel[i];
      v.y -= 9 * dt;
      v.multiplyScalar(1 - dt * 0.8);
      this.confettiPos[i].addScaledVector(v, dt);
      this.dummy.position.copy(this.confettiPos[i]);
      this.dummy.rotation.set(this.t * 5 + i, this.t * 3 + i * 2, 0);
      this.dummy.updateMatrix();
      this.confetti.setMatrixAt(i, this.dummy.matrix);
    }
    this.confetti.instanceMatrix.needsUpdate = true;
  }

  // ───────────────────────────── test API ─────────────────────────────
  private testApi() {
    return {
      levels: () => LEVELS.map((l) => ({ id: l.spec.id, par: l.par, solution: l.solution, targets: l.targets.map((t) => ({ pegId: t.pegId, rpm: fmt(t.rpm) })) })),
      screen: () => this.screen,
      load: (id: string) => {
        const i = LEVELS.findIndex((l) => l.spec.id === id);
        this.startLevel(i, false);
      },
      sandbox: () => this.loadSandbox(),
      place: (pegId: string, teeth: number, layer?: number) => this.placeGear(pegId, teeth, layer),
      remove: (id: string) => this.removeGear(id),
      undo: () => this.undo(),
      reset: () => this.reset(),
      placed: () => this.placed.map((g) => ({ ...g })),
      solved: () => this.isSolved(),
      jammed: () => !!this.net?.jammed,
      closeness: () => this.closeness(),
      speeds: () => Object.fromEntries([...(this.net?.axleSpeed ?? new Map())].map(([k, v]) => [k, fmt(v)])),
      won: () => this.won,
      stars: (id: string) => this.progress.stars[id] ?? 0,
      audio: () => ({ theme: this.audio.currentTheme, layers: this.audio.layers, events: { ...this.audio.events }, state: this.audio.ctx?.state ?? 'none' }),
      pegScreen: (pegId: string) => {
        const p = this.pegById(pegId)!;
        const r = this.canvas.getBoundingClientRect();
        const s = this.project(p.x, p.y, LAYER_Y[0]);
        return { x: s.x + r.left, y: s.y + r.top };
      },
      next: () => this.nextLevel(),
      skipStory: () => this.story.finish(),
      hint: () => this.hint(),
      pause: () => this.pause(),
      resume: () => this.resume(),
    };
  }
}
