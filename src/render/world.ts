import * as THREE from 'three';
import { gearGeometry } from './gearGeometry';
import { MAT } from './props';
import { createSeededRandom as mulberry } from '../utils/random';

/** 'high' = bloom, 2k shadows, dense dressing. 'low' = phones / slow GPUs. */
export type Quality = 'high' | 'low';

export function pickQuality(): Quality {
  const q = new URLSearchParams(location.search).get('q');
  if (q === 'low' || q === 'high') return q;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  const small = Math.min(window.innerWidth, window.innerHeight) < 600;
  return coarse || small ? 'low' : 'high';
}

function barkTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 512;
  const g = c.getContext('2d')!;
  const rnd = mulberry(7);
  g.fillStyle = '#3b2616';
  g.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 420; i++) {
    const x = rnd() * 256;
    const w = 2 + rnd() * 9;
    const l = ['#2a1a0e', '#4d331d', '#5e4127', '#24160b', '#6b4b2c'][i % 5];
    g.strokeStyle = l;
    g.lineWidth = w;
    g.globalAlpha = 0.35 + rnd() * 0.5;
    g.beginPath();
    let y = -20;
    g.moveTo(x, y);
    let xx = x;
    while (y < 532) {
      y += 20 + rnd() * 30;
      xx += (rnd() - 0.5) * 8;
      g.lineTo(xx, y);
    }
    g.stroke();
  }
  // mossy flecks
  g.globalAlpha = 0.5;
  for (let i = 0; i < 260; i++) {
    g.fillStyle = rnd() > 0.5 ? '#5f7f2a' : '#7c9a34';
    g.beginPath();
    g.arc(rnd() * 256, rnd() * 512, 1 + rnd() * 4, 0, 7);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function glowSprite(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,240,200,1)');
  gr.addColorStop(0.3, 'rgba(255,200,120,.55)');
  gr.addColorStop(1, 'rgba(255,160,60,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function shaftTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const g = c.getContext('2d')!;
  const gx = g.createLinearGradient(0, 0, 64, 0);
  gx.addColorStop(0, 'rgba(255,210,140,0)');
  gx.addColorStop(0.5, 'rgba(255,215,150,1)');
  gx.addColorStop(1, 'rgba(255,210,140,0)');
  g.fillStyle = gx;
  g.fillRect(0, 0, 64, 256);
  g.globalCompositeOperation = 'destination-in';
  const gy = g.createLinearGradient(0, 0, 0, 256);
  gy.addColorStop(0, 'rgba(0,0,0,1)');
  gy.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gy;
  g.fillRect(0, 0, 64, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const DISTRICT_LAMP = [0xffb45a, 0xffb45a, 0x9fe0ff, 0xb8ff7a, 0xffa040, 0xc9a0ff, 0xffd27a];

interface Mover { update(t: number, dt: number, speed: number): void }

/**
 * The living oak-city diorama around the puzzle table. Lives in scene space (does not rotate
 * with the portrait board) so the city always sits behind and beside the board on screen.
 */
export class World {
  readonly root = new THREE.Group();
  /** Far city: built at full size, then shrunk toward the table (forced perspective). */
  private far = new THREE.Group();
  private host: THREE.Group = this.root;
  private movers: Mover[] = [];
  private lampMats: THREE.MeshStandardMaterial[] = [];
  private lampLights: THREE.PointLight[] = [];
  private windowMat = new THREE.MeshStandardMaterial({ color: 0x5a3008, emissive: 0xff9a30, emissiveIntensity: 0.8, roughness: 0.4 });
  private energy = 0.35;
  private energyTarget = 0.35;
  private surge = 0;
  private dust?: THREE.Points;
  private dustBase: Float32Array | null = null;
  private engine = new THREE.Group();
  private engineGlow!: THREE.MeshStandardMaterial;
  private steam: THREE.Sprite[] = [];
  private rnd = mulberry(42);
  private bark = barkTexture();
  private barkMat: THREE.MeshStandardMaterial;
  private mossMat = new THREE.MeshStandardMaterial({ color: 0x34501a, roughness: 0.95 });
  private mossHi = new THREE.MeshStandardMaterial({ color: 0x5a7d22, roughness: 0.9 });
  private brass = new THREE.MeshStandardMaterial({ color: 0xc9933a, metalness: 1, roughness: 0.32 });
  private brassDark = new THREE.MeshStandardMaterial({ color: 0x7a5524, metalness: 0.9, roughness: 0.45 });
  private copper = new THREE.MeshStandardMaterial({ color: 0xb8673a, metalness: 0.95, roughness: 0.35 });
  private glass = new THREE.MeshPhysicalMaterial({ color: 0xfff0d0, metalness: 0, roughness: 0.08, transmission: 0, transparent: true, opacity: 0.28, depthWrite: false });
  private glow = glowSprite();

  constructor(private quality: Quality) {
    this.barkMat = new THREE.MeshStandardMaterial({ map: this.bark, bumpMap: this.bark, bumpScale: 3, roughness: 0.95, color: 0xb59070 });
    this.build();
  }

  // ───────────────────────── building ─────────────────────────
  private build(): void {
    this.backdrop();
    this.ground();
    this.mice();
    this.lights();
    this.host = this.far;
    this.trunk();
    this.city();
    this.train();
    this.elevators();
    this.wallGears();
    this.buildEngine();
    this.dustAndShafts();
    this.host = this.root;
    const k = 0.6;
    const pivot = new THREE.Vector3(0, -0.95, -6.5);
    this.far.scale.setScalar(k);
    this.far.position.copy(pivot).multiplyScalar(1 - k);
    this.root.add(this.far);
  }

  private add<T extends THREE.Object3D>(o: T, shadow = true): T {
    o.traverse((m) => {
      if ((m as THREE.Mesh).isMesh) {
        m.castShadow = shadow && this.quality === 'high';
        m.receiveShadow = true;
      }
    });
    this.host.add(o);
    return o;
  }

  private backdrop(): void {
    const tex = new THREE.TextureLoader().load('art/backdrop.webp');
    tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.MeshBasicMaterial({ map: tex, fog: false, color: 0xb8a088 });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(48, 27), m);
    p.position.set(0, 4, -14);
    p.rotation.x = 0.1;
    this.host.add(p);
    // Golden sky glow behind everything.
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glow, color: 0xffc070, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    s.scale.set(22, 22, 1);
    s.position.set(-14, 9, -13.5);
    this.host.add(s);
  }

  private trunk(): void {
    // Great curved oak wall behind the board, with glowing burrow arches.
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(30, 34, 40, 64, 6, true, Math.PI * 0.62, Math.PI * 0.76), this.barkMat);
    this.bark.repeat.set(6, 2);
    wall.material.side = THREE.DoubleSide;
    wall.position.set(4, 15, 8);
    this.add(wall, false);
    for (const [x, y, z, s] of [[-9, 3.5, -19, 2.4], [8, 2.2, -19.5, 3], [16, 7, -15, 2], [-2, 9, -21, 1.6]] as number[][]) {
      const arch = new THREE.Group();
      const hole = new THREE.Mesh(new THREE.CircleGeometry(s, 24, 0, Math.PI), new THREE.MeshBasicMaterial({ color: 0x2a1205 }));
      arch.add(hole);
      const inner = new THREE.Mesh(new THREE.PlaneGeometry(s * 2, s * 0.9), new THREE.MeshBasicMaterial({ color: 0x2a1205 }));
      inner.position.y = -s * 0.45;
      arch.add(inner);
      const g = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glow, color: 0xffa040, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
      g.scale.set(s * 2.6, s * 2.2, 1);
      g.position.set(0, 0, 0.1);
      arch.add(g);
      for (let i = 0; i < 4; i++) {
        const w = new THREE.Mesh(new THREE.BoxGeometry(s * 0.25, s * 0.4, 0.05), this.windowMat);
        w.position.set(-s * 0.6 + i * s * 0.4, s * 0.05 - (i % 2) * s * 0.4, 0.05);
        arch.add(w);
      }
      const rim = new THREE.Mesh(new THREE.TorusGeometry(s * 1.04, s * 0.18, 8, 24, Math.PI), this.mossMat);
      arch.add(rim);
      arch.position.set(x, y, z);
      arch.lookAt(4, y, 8);
      this.host.add(arch);
    }
    // Roots: thick mossy tubes sweeping down to the ground around the table.
    const roots: number[][][] = [
      [[-22, 9, -18], [-17, 3, -12], [-13, 0.2, -8], [-11, -0.6, -2]],
      [[22, 10, -17], [17, 4, -11], [13.5, 0.3, -6], [12, -0.6, 2]],
      [[-6, 6, -20], [-7, 1.5, -14], [-6, -0.4, -9.5]],
      [[12, 6, -19], [11, 1, -13], [9, -0.5, -9]],
      [[-26, 3, -4], [-19, 0.8, 1], [-14, -0.6, 6]],
      [[26, 3, -3], [19, 0.8, 3], [14, -0.6, 7]],
    ];
    const rootTex = this.bark.clone();
    rootTex.repeat.set(10, 1.5);
    rootTex.rotation = Math.PI / 2;
    rootTex.needsUpdate = true;
    const rootMat = new THREE.MeshStandardMaterial({ map: rootTex, bumpMap: rootTex, bumpScale: 2, roughness: 0.95, color: 0x9a7a60 });
    roots.forEach((pts, i) => {
      const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
      const r = 1.4 - i * 0.12;
      const geo = new THREE.TubeGeometry(curve, 40, r, 12);
      // taper toward tip
      const pos = geo.attributes.position;
      this.add(new THREE.Mesh(geo, rootMat));
      void pos;
      const moss = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, r * 1.02, 12, false), this.mossMat);
      moss.scale.set(1, 1, 1);
      // Only keep the top half of the moss tube: clip via a thin cap mesh along the top.
      const cap = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, r * 0.7, 8), this.mossMat);
      cap.position.y = r * 0.36;
      this.add(cap, false);
      moss.visible = false;
    });
  }

  private ground(): void {
    const g = new THREE.Mesh(new THREE.CircleGeometry(60, 48), new THREE.MeshStandardMaterial({ color: 0x1f2e12, roughness: 1 }));
    g.rotation.x = -Math.PI / 2;
    g.position.y = -0.95;
    g.receiveShadow = true;
    this.host.add(g);
    // Moss clumps + grass tufts as instanced blobs.
    const n = this.quality === 'high' ? 420 : 160;
    const geo = new THREE.IcosahedronGeometry(1, 1);
    const inst = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 1, color: 0x2a4214 }), n);
    const d = new THREE.Object3D();
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      let x = 0, z = 0;
      do {
        x = (this.rnd() - 0.5) * 50;
        z = -24 + this.rnd() * 36;
      } while (Math.abs(x) < 10.2 && Math.abs(z) < 6.4);
      const s = 0.3 + this.rnd() * 1.1;
      d.position.set(x, -0.95 + s * 0.15, z);
      d.scale.set(s * 1.3, s * 0.28, s);
      d.rotation.y = this.rnd() * 6;
      d.updateMatrix();
      inst.setMatrixAt(i, d.matrix);
      c.setHSL(0.2 + this.rnd() * 0.07, 0.6, 0.05 + this.rnd() * 0.07);
    }
    inst.receiveShadow = true;
    this.host.add(inst);
    // Fern fronds / mushrooms in the foreground corners.
    const capMat = new THREE.MeshStandardMaterial({ color: 0xd2552e, roughness: 0.55 });
    for (const [x, z, s] of [[-12, 5, 1.6], [12.5, 4.5, 1.3], [-11, -7, 1.2], [13, -8, 1.8], [-14, 0, 1]]) {
      const m = new THREE.Group();
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.15 * s, 0.22 * s, 1 * s, 10), MAT.cream);
      stem.position.y = 0.5 * s;
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.6 * s, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), capMat);
      cap.position.y = 0.95 * s;
      m.add(stem, cap);
      m.position.set(x, -0.95, z);
      this.add(m);
    }
  }

  private tower(x: number, z: number, h: number, r: number): THREE.Group {
    const g = new THREE.Group();
    let y = 0;
    const floors = Math.max(2, Math.round(h / 1.4));
    for (let i = 0; i < floors; i++) {
      const rr = r * (1 - i * 0.08);
      const body = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr, 1.1, 12), this.brassDark);
      body.position.y = y + 0.55;
      g.add(body);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        const w = new THREE.Mesh(new THREE.PlaneGeometry(rr * 0.5, 0.55), this.windowMat);
        w.position.set(Math.sin(a) * (rr + 0.01), y + 0.55, Math.cos(a) * (rr + 0.01));
        w.rotation.y = a;
        g.add(w);
      }
      const ring = new THREE.Mesh(new THREE.TorusGeometry(rr * 1.08, 0.07, 6, 20), this.brass);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = y + 1.1;
      g.add(ring);
      y += 1.15;
    }
    const top = r * (1 - floors * 0.08);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(top * 1.05, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), this.brass);
    dome.position.y = y;
    g.add(dome);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(0.12, 1, 8), this.brass);
    spire.position.y = y + top + 0.4;
    g.add(spire);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), this.lampMat());
    lamp.position.y = y + top + 0.95;
    g.add(lamp);
    g.position.set(x, -0.9, z);
    return g;
  }

  private lampMat(): THREE.MeshStandardMaterial {
    const m = new THREE.MeshStandardMaterial({ color: 0xffe2a8, emissive: 0xffb45a, emissiveIntensity: 2.2 });
    this.lampMats.push(m);
    return m;
  }

  private glassDome(x: number, z: number, r: number): THREE.Group {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.05, r * 1.15, 0.35, 24), this.brass);
    base.position.y = 0.17;
    g.add(base);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), this.glass);
    dome.position.y = 0.35;
    g.add(dome);
    // lattice ribs
    for (let i = 0; i < 8; i++) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(r, 0.03, 4, 24, Math.PI), this.brass);
      rib.position.y = 0.35;
      rib.rotation.y = (i / 8) * Math.PI;
      g.add(rib);
    }
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), this.brass);
    knob.position.y = 0.35 + r;
    g.add(knob);
    // plants inside
    for (let i = 0; i < 7; i++) {
      const p = new THREE.Mesh(new THREE.IcosahedronGeometry(r * (0.18 + this.rnd() * 0.15), 0), i % 2 ? this.mossHi : this.mossMat);
      const a = this.rnd() * 6.28, d = this.rnd() * r * 0.6;
      p.position.set(Math.cos(a) * d, 0.5, Math.sin(a) * d);
      g.add(p);
    }
    const inner = new THREE.PointLight(0xffc070, 0, 3);
    g.position.set(x, -0.9, z);
    void inner;
    return g;
  }

  private city(): void {
    const towers: number[][] = [
      [-12.5, -12, 7, 1.1], [-9.5, -13.5, 9.5, 1.3], [-15.5, -9, 5, 0.9], [11, -13, 8.5, 1.2],
      [14.5, -10.5, 6, 1], [3.5, -13.8, 6.5, 0.9], [-4, -14, 5.5, 0.8], [17.5, -6, 4.5, 0.8],
    ];
    for (const [x, z, h, r] of towers) this.add(this.tower(x, z, h, r));
    for (const [x, z, r] of [[-1.5, -11.5, 2.4], [6.5, -11, 1.5], [-13.5, -4.5, 1.6], [14, -2.5, 1.3]]) this.add(this.glassDome(x, z, r));
    // Copper pipes snaking between towers.
    const pipes: number[][][] = [
      [[-12.5, 3, -12], [-10, 4.2, -12.5], [-6, 2.5, -12], [-3, 0.5, -11.5]],
      [[11, 4, -13], [8.5, 2.2, -12], [6.5, 0.6, -11]],
      [[-16, -0.5, -7], [-15, 2.5, -8], [-12.5, 2.5, -12]],
      [[14.5, 2.5, -10.5], [16, 1.5, -7], [17.5, 1.2, -6]],
    ];
    for (const pts of pipes) {
      const c = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
      this.add(new THREE.Mesh(new THREE.TubeGeometry(c, 30, 0.14, 8), this.copper));
    }
    // Moss terraces / platforms in front of the trunk.
    for (const [x, z, w, d, y] of [[-6, -13, 8, 3, 1.2], [8, -15, 7, 3, 2.4], [-14, -14, 6, 3, 3]]) {
      const plat = new THREE.Mesh(new THREE.CylinderGeometry(w / 2, w / 2 + 0.4, 0.6, 18), this.barkMat);
      plat.scale.z = d / w;
      plat.position.set(x, y - 0.9, z);
      this.add(plat);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(w / 2 + 0.05, w / 2 + 0.05, 0.12, 18), this.mossHi);
      top.scale.z = d / w;
      top.position.set(x, y - 0.55, z);
      this.add(top, false);
    }
    // Hanging lanterns on arms near the table.
    for (const [x, z, y] of [[-10.6, -6.4, 3.4], [10.6, -6.4, 3.4], [-11, 3, 2.6], [11, 3, 2.6]]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, y + 1, 8), this.brassDark);
      post.position.set(x, (y - 1) / 2 - 0.4, z);
      this.add(post);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.06, 0.06), this.brassDark);
      arm.position.set(x + Math.sign(-x) * 0.35, y + 0.1, z);
      this.add(arm);
      const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.45, 8, 1, true), this.brass);
      cage.position.set(x + Math.sign(-x) * 0.7, y - 0.2, z);
      this.add(cage);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), this.lampMat());
      bulb.position.copy(cage.position);
      this.host.add(bulb);
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glow, color: 0xffb860, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
      s.scale.setScalar(1.8);
      s.position.copy(bulb.position);
      this.host.add(s);
    }
  }

  private train(): void {
    // Elevated looping track behind the table on brass trestles.
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * 14, 3.2 + Math.sin(a * 2) * 1.1, -12 + Math.sin(a) * 3.6));
    }
    const curve = new THREE.CatmullRomCurve3(pts, true);
    const rail = new THREE.Mesh(new THREE.TubeGeometry(curve, 160, 0.06, 6, true), this.brassDark);
    this.add(rail);
    const rail2 = rail.clone();
    rail2.scale.set(1.012, 1, 1.03);
    rail2.position.z = 0.36;
    this.host.add(rail2);
    const tieGeo = new THREE.BoxGeometry(0.7, 0.06, 0.12);
    const ties = new THREE.InstancedMesh(tieGeo, MAT.wood, 120);
    const d = new THREE.Object3D();
    for (let i = 0; i < 120; i++) {
      const p = curve.getPointAt(i / 120);
      const tg = curve.getTangentAt(i / 120);
      d.position.copy(p).add(new THREE.Vector3(0, -0.06, 0.18));
      d.rotation.set(0, Math.atan2(tg.x, tg.z) + Math.PI / 2, 0);
      d.updateMatrix();
      ties.setMatrixAt(i, d.matrix);
    }
    this.host.add(ties);
    for (let i = 0; i < 16; i++) {
      const p = curve.getPointAt(i / 16);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, p.y + 0.9, 6), this.brassDark);
      leg.position.set(p.x, (p.y - 0.9) / 2, p.z + 0.18);
      this.add(leg);
    }
    const cars: THREE.Group[] = [];
    const bodyMats = [new THREE.MeshStandardMaterial({ color: 0x7a1f14, metalness: 0.4, roughness: 0.4 }), this.brass];
    for (let i = 0; i < 4; i++) {
      const car = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.5, 1.1), i === 0 ? this.brass : bodyMats[0]);
      body.position.y = 0.32;
      car.add(body);
      const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 1.16, 12, 1, false, 0, Math.PI), this.brass);
      roof.rotation.z = Math.PI / 2;
      roof.rotation.y = Math.PI / 2;
      roof.position.y = 0.57;
      car.add(roof);
      for (const s of [-1, 1]) {
        const w = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.2), this.windowMat);
        w.position.set(s * 0.315, 0.38, 0);
        w.rotation.y = (s * Math.PI) / 2;
        car.add(w);
      }
      if (i === 0) {
        const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.07, 0.4, 8), this.brassDark);
        stack.position.set(0, 0.8, 0.35);
        car.add(stack);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), this.lampMat());
        head.position.set(0, 0.35, 0.56);
        car.add(head);
      }
      cars.push(car);
      this.add(car);
    }
    let u = 0;
    const up = new THREE.Vector3(0, 1, 0);
    const look = new THREE.Vector3();
    this.movers.push({
      update: (_t, dt, speed) => {
        u = (u + dt * 0.03 * speed) % 1;
        cars.forEach((car, i) => {
          const k = (u - i * 0.012 + 1) % 1;
          const p = curve.getPointAt(k);
          car.position.set(p.x, p.y, p.z + 0.18);
          look.copy(p).add(curve.getTangentAt(k));
          look.z += 0.18;
          car.up.copy(up);
          car.lookAt(look);
        });
      },
    });
  }

  private elevators(): void {
    for (const [x, z, h, ph] of [[-7.5, -10.5, 7, 0], [5, -12.5, 8.5, 2], [16.5, -8, 5.5, 4]]) {
      const shaft = new THREE.Group();
      for (const [sx, sz] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, h, 6), this.brass);
        p.position.set(sx, h / 2, sz);
        shaft.add(p);
      }
      for (let y = 0.5; y < h; y += 0.8) {
        const r = new THREE.Mesh(new THREE.TorusGeometry(0.64, 0.025, 4, 4), this.brassDark);
        r.rotation.set(Math.PI / 2, 0, Math.PI / 4);
        r.position.y = y;
        shaft.add(r);
      }
      const wheel = new THREE.Mesh(gearGeometry(16), this.brass);
      wheel.rotation.x = Math.PI / 2;
      wheel.scale.setScalar(0.55);
      wheel.position.set(0, h + 0.3, 0.1);
      const wheelPivot = new THREE.Group();
      wheelPivot.position.set(0, h + 0.3, 0);
      wheel.position.set(0, 0, 0);
      wheelPivot.add(wheel);
      shaft.add(wheelPivot);
      const cab = new THREE.Group();
      const cb = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.8, 0.75), this.glass);
      cb.position.y = 0.4;
      cab.add(cb);
      const floor = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.08, 0.8), this.brass);
      cab.add(floor);
      const roof = floor.clone();
      roof.position.y = 0.8;
      cab.add(roof);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), this.lampMat());
      lamp.position.y = 0.66;
      cab.add(lamp);
      const mouse = this.mouse(0x8a7f78);
      mouse.scale.setScalar(0.8);
      cab.add(mouse);
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1, 4), this.brassDark);
      shaft.add(cable);
      shaft.add(cab);
      shaft.position.set(x, -0.9, z);
      this.add(shaft);
      let a = ph;
      this.movers.push({
        update: (_t, dt, speed) => {
          a += dt * 0.45 * speed;
          const y = 0.1 + (h - 1.2) * (0.5 - 0.5 * Math.cos(a));
          cab.position.y = y;
          cable.scale.y = h - y;
          cable.position.y = y + 0.8 + (h - y - 0.8) / 2;
          wheel.rotation.z = Math.sin(a) * 4;
          wheelPivot.rotation.z = 0;
        },
      });
    }
  }

  private wallGears(): void {
    const specs: number[][] = [
      [-4.5, 5, -14, 24, 1.3], [-1.35, 3.4, -13.6, 12, 1.3], [9.5, 6.5, -13.5, 30, 1.1], [13.05, 4.6, -12.8, 14, 1.1],
      [-15, 6, -12.5, 20, 1], [-17.15, 4.4, -12, 10, 1],
    ];
    // Pairs mesh: speed ratio honours tooth counts (big turns slow, small turns fast).
    const gs: { m: THREE.Mesh; w: number }[] = [];
    specs.forEach(([x, y, z, teeth, s], i) => {
      const m = new THREE.Mesh(gearGeometry(teeth), i % 3 === 2 ? this.copper : this.brass);
      const piv = new THREE.Group();
      m.rotation.x = Math.PI / 2;
      piv.add(m);
      piv.scale.setScalar(s);
      piv.position.set(x, y, z);
      piv.lookAt(x * 0.3, y, 6);
      this.add(piv, false);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.4, 12), this.brassDark);
      hub.rotation.x = Math.PI / 2;
      piv.add(hub);
      const dir = i % 2 ? -1 : 1;
      const base = 12 / specs[i - (i % 2)][3];
      const w = i % 2 ? (base * specs[i - 1][3]) / teeth : base;
      gs.push({ m, w: w * dir });
    });
    this.movers.push({
      update: (_t, dt, speed) => {
        for (const g of gs) g.m.rotation.y += dt * g.w * 0.9 * speed;
      },
    });
  }

  /** The district engine: idles slowly, roars to life when a puzzle is solved. */
  private buildEngine(): void {
    const e = this.engine;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.9, 0.9, 20), this.brassDark);
    base.position.y = 0.45;
    e.add(base);
    this.engineGlow = new THREE.MeshStandardMaterial({ color: 0xffd08a, emissive: 0xff8a20, emissiveIntensity: 0.4 });
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 2.2, 16), this.glass);
    core.position.y = 2;
    e.add(core);
    const heart = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), this.engineGlow);
    heart.position.y = 2;
    e.add(heart);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(1.1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), this.brass);
    cap.position.y = 3.1;
    e.add(cap);
    const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 1.6, 10), this.copper);
    chimney.position.set(0.5, 4, 0);
    e.add(chimney);
    const fly = new THREE.Mesh(gearGeometry(20), this.brass);
    const flyP = new THREE.Group();
    fly.rotation.x = Math.PI / 2;
    flyP.add(fly);
    flyP.position.set(0, 2.2, 1.0);
    flyP.scale.setScalar(0.9);
    e.add(flyP);
    const fly2 = new THREE.Mesh(gearGeometry(10), this.copper);
    const flyP2 = new THREE.Group();
    fly2.rotation.x = Math.PI / 2;
    flyP2.add(fly2);
    flyP2.position.set(1.6, 1.4, 1.0);
    flyP2.scale.setScalar(0.9);
    e.add(flyP2);
    e.position.set(0, -0.9, -9.6);
    this.add(e);
    const smat = new THREE.SpriteMaterial({ map: this.glow, color: 0xfff4e0, transparent: true, opacity: 0, depthWrite: false });
    for (let i = 0; i < 8; i++) {
      const s = new THREE.Sprite(smat.clone());
      s.position.set(0.5, 5, -9.6);
      s.userData.ph = i / 8;
      this.steam.push(s);
      this.host.add(s);
    }
    this.movers.push({
      update: (t, dt, speed) => {
        fly.rotation.y += dt * 0.8 * speed;
        fly2.rotation.y -= dt * 1.6 * speed;
        heart.scale.setScalar(1 + Math.sin(t * 3 * speed) * 0.06 * speed);
        this.engineGlow.emissiveIntensity = 0.4 + speed * 1.2 + this.surge * 3;
        for (const s of this.steam) {
          const k = (s.userData.ph + t * 0.18 * Math.max(0.4, speed)) % 1;
          s.position.set(-9.1 + 9.6 + k * 0.6, -0.9 + 4.9 + k * 3.5, -9.6 - k);
          s.scale.setScalar(0.6 + k * 2.2);
          (s.material as THREE.SpriteMaterial).opacity = (1 - k) * 0.35 * Math.min(1, speed);
        }
      },
    });
  }

  private mouse(fur = 0x9a8a80): THREE.Group {
    const g = new THREE.Group();
    const furM = new THREE.MeshStandardMaterial({ color: fur, roughness: 0.85 });
    const pink = new THREE.MeshStandardMaterial({ color: 0xe8a0a0, roughness: 0.7 });
    const coat = new THREE.MeshStandardMaterial({ color: [0x7a2a1a, 0x2b4a6a, 0x5a4a1a][Math.floor(this.rnd() * 3)], roughness: 0.7 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), coat);
    body.scale.set(1, 1.35, 0.9);
    body.position.y = 0.32;
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), furM);
    head.position.set(0, 0.62, 0.05);
    g.add(head);
    const snout = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.18, 8), furM);
    snout.rotation.x = Math.PI / 2;
    snout.position.set(0, 0.6, 0.22);
    g.add(snout);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4), pink);
    nose.position.set(0, 0.6, 0.31);
    g.add(nose);
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.CircleGeometry(0.1, 12), pink);
      ear.position.set(s * 0.12, 0.78, 0.02);
      ear.material.side = THREE.DoubleSide;
      g.add(ear);
      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), furM);
      foot.position.set(s * 0.08, 0.04, 0.05);
      foot.name = s < 0 ? 'fl' : 'fr';
      g.add(foot);
    }
    const goggles = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.022, 6, 12), this.brass);
    goggles.position.set(0, 0.7, 0.1);
    goggles.rotation.x = -0.3;
    g.add(goggles);
    const tail = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.2, -0.15), new THREE.Vector3(0, 0.1, -0.4), new THREE.Vector3(0, 0.25, -0.6)]), 10, 0.02, 4),
      pink,
    );
    g.add(tail);
    return g;
  }

  private mice(): void {
    const paths: THREE.CatmullRomCurve3[] = [
      new THREE.CatmullRomCurve3([[-11, 6.5], [-3, 7.6], [5, 7.2], [11.5, 6.4], [12.5, -2], [11, -7.5], [-11, -7.5], [-12, 0]].map(([x, z]) => new THREE.Vector3(x, -0.9, z)), true),
      new THREE.CatmullRomCurve3([[-8, -8.6], [-2, -9], [3, -8.4], [8, -8.8], [3, -8], [-3, -8.3]].map(([x, z]) => new THREE.Vector3(x, -0.9, z)), true),
    ];
    const n = this.quality === 'high' ? 9 : 5;
    for (let i = 0; i < n; i++) {
      const m = this.mouse([0x9a8a80, 0x7f6f66, 0xb8aaa0][i % 3]);
      m.scale.setScalar(1.25);
      this.add(m);
      const path = paths[i % 2];
      let u = this.rnd();
      const dir = i % 3 === 0 ? -1 : 1;
      const sp = 0.012 + this.rnd() * 0.01;
      const fl = m.getObjectByName('fl')!;
      const fr = m.getObjectByName('fr')!;
      const look = new THREE.Vector3();
      this.movers.push({
        update: (t, dt, speed) => {
          u = (u + dir * dt * sp * (0.6 + speed * 0.6) + 1) % 1;
          const p = path.getPointAt(u);
          m.position.copy(p);
          m.position.y += Math.abs(Math.sin(t * 9 + i)) * 0.06;
          look.copy(path.getPointAt((u + dir * 0.002 + 1) % 1));
          look.y = m.position.y;
          m.lookAt(look);
          fl.position.z = 0.05 + Math.sin(t * 9 + i) * 0.06;
          fr.position.z = 0.05 - Math.sin(t * 9 + i) * 0.06;
        },
      });
    }
  }

  private lights(): void {
    const n = this.quality === 'high' ? 4 : 2;
    const spots = [[-10.4, 3.2, -6.4], [10.4, 3.2, -6.4], [0, 3.5, -9], [-11, 2.4, 3]].slice(0, n);
    for (const [x, y, z] of spots) {
      const l = new THREE.PointLight(0xffa850, 9, 12, 1.7);
      l.position.set(x, y, z);
      this.lampLights.push(l);
      this.host.add(l);
    }
  }

  private dustAndShafts(): void {
    const sh = shaftTexture();
    for (const [x, rz, w] of [[-9, 0.45, 5], [-4, 0.38, 3.5], [3, 0.42, 4.5]]) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(w, 34),
        new THREE.MeshBasicMaterial({ map: sh, transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }),
      );
      m.position.set(x, 9, -10);
      m.rotation.z = rz;
      m.renderOrder = 5;
      this.host.add(m);
    }
    const n = this.quality === 'high' ? 600 : 180;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (this.rnd() - 0.5) * 34;
      pos[i * 3 + 1] = this.rnd() * 12;
      pos[i * 3 + 2] = -16 + this.rnd() * 20;
    }
    this.dustBase = pos.slice();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.dust = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ map: this.glow, size: 0.16, color: 0xffd8a0, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    this.host.add(this.dust);
  }

  // ───────────────────────── runtime ─────────────────────────
  setChapter(ch: number): void {
    const c = DISTRICT_LAMP[ch] ?? 0xffb45a;
    for (const m of this.lampMats) m.emissive.setHex(c);
    for (const l of this.lampLights) l.color.setHex(c).lerp(new THREE.Color(0xffa850), 0.5);
    this.energyTarget = 0.35;
  }

  /** The level's machine is running at target speed: the city spins up. */
  celebrate(): void {
    this.energyTarget = 1.6;
    this.surge = 1;
  }

  idle(): void {
    this.energyTarget = 0.35;
  }

  update(t: number, dt: number): void {
    this.energy += (this.energyTarget - this.energy) * Math.min(1, dt * 1.5);
    this.surge = Math.max(0, this.surge - dt * 0.6);
    for (const m of this.movers) m.update(t, dt, this.energy);
    const li = 0.9 + this.energy * 0.25 + this.surge * 0.8;
    this.lampMats.forEach((m, i) => (m.emissiveIntensity = 2 * li + Math.sin(t * 7 + i) * 0.08));
    for (const l of this.lampLights) l.intensity = 8 * li;
    this.windowMat.emissiveIntensity = (this.quality === 'high' ? 0.75 : 0.6) * li;
    if (this.dust && this.dustBase) {
      const a = this.dust.geometry.attributes.position as THREE.BufferAttribute;
      const arr = a.array as Float32Array;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i] = this.dustBase[i] + Math.sin(t * 0.3 + i) * 0.6;
        arr[i + 1] = (this.dustBase[i + 1] + t * 0.15 + Math.sin(t * 0.5 + i * 0.7) * 0.3) % 12;
        arr[i + 2] = this.dustBase[i + 2] + Math.cos(t * 0.25 + i) * 0.4;
      }
      a.needsUpdate = true;
    }
  }
}
