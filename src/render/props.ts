import * as THREE from 'three';
import type { Machine } from '../game/levelTypes';

export const MAT = {
  brass: new THREE.MeshStandardMaterial({ color: 0xd9a441, metalness: 0.92, roughness: 0.28 }),
  copper: new THREE.MeshStandardMaterial({ color: 0xc8703f, metalness: 0.9, roughness: 0.33 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x9aa3a8, metalness: 0.85, roughness: 0.35 }),
  darkIron: new THREE.MeshStandardMaterial({ color: 0x3a3430, metalness: 0.7, roughness: 0.5 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x7a4f2c, roughness: 0.75 }),
  cheese: new THREE.MeshStandardMaterial({ color: 0xffc93c, roughness: 0.55 }),
  red: new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.5 }),
  teal: new THREE.MeshStandardMaterial({ color: 0x2f8f83, roughness: 0.45, metalness: 0.3 }),
  glass: new THREE.MeshStandardMaterial({ color: 0xbfe8ff, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.45 }),
  water: new THREE.MeshStandardMaterial({ color: 0x6fd3ff, roughness: 0.1, transparent: true, opacity: 0.8, emissive: 0x114466 }),
  sap: new THREE.MeshStandardMaterial({ color: 0xf0a020, roughness: 0.15, transparent: true, opacity: 0.85, emissive: 0x552200 }),
  moss: new THREE.MeshStandardMaterial({ color: 0x5d8a3a, roughness: 0.9 }),
  stone: new THREE.MeshStandardMaterial({ color: 0x8a8177, roughness: 0.9 }),
  lamp: new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffb84d, emissiveIntensity: 1.6 }),
  cream: new THREE.MeshStandardMaterial({ color: 0xf3e6c8, roughness: 0.6 }),
};

const box = (w: number, h: number, d: number, m: THREE.Material) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
const cyl = (rt: number, rb: number, h: number, m: THREE.Material, seg = 24) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);

export interface Topper {
  group: THREE.Group;
  /** angle: accumulated axle rotation (radians, CCW+); speed in rpm magnitude; t: seconds */
  update(angle: number, rpm: number, t: number, onTarget: boolean): void;
}

/** A little diorama machine that sits on top of an output shaft and reacts to its speed. */
export function makeTopper(machine: Machine): Topper {
  const g = new THREE.Group();
  const spin = new THREE.Group();
  g.add(spin);
  const post = cyl(0.06, 0.06, 0.5, MAT.steel);
  post.position.y = 0.25;
  g.add(post);
  spin.position.y = 0.55;
  const glow = new THREE.PointLight(0xffc870, 0, 2.5);
  glow.position.y = 1.2;
  g.add(glow);
  let update: Topper['update'] = (a) => {
    spin.rotation.y = a;
  };

  if (machine === 'lift') {
    // Rotating winch drum with a cheese platform going up and down.
    const drum = cyl(0.22, 0.22, 0.25, MAT.wood);
    spin.add(drum);
    const tower = new THREE.Group();
    for (const sx of [-0.35, 0.35]) {
      const p = box(0.06, 1.6, 0.06, MAT.brass);
      p.position.set(sx, 0.8, -0.5);
      tower.add(p);
    }
    g.add(tower);
    const plat = new THREE.Group();
    plat.add(box(0.7, 0.05, 0.4, MAT.wood));
    const cheese = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.18, 3, 1, false, 0, Math.PI * 0.6), MAT.cheese);
    cheese.position.y = 0.12;
    plat.add(cheese);
    plat.position.set(0, 0.3, -0.5);
    g.add(plat);
    update = (a, rpm, t) => {
      spin.rotation.y = a;
      plat.position.y = 0.3 + 0.55 * (0.5 + 0.5 * Math.sin(a * 0.25));
      cheese.rotation.z = rpm > 100 ? Math.sin(t * 30) * 0.15 : 0;
    };
  } else if (machine === 'tram') {
    // A tram car running round a circular track.
    const track = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.025, 8, 48), MAT.steel);
    track.rotation.x = Math.PI / 2;
    track.position.y = 0.55;
    g.add(track);
    const car = new THREE.Group();
    const body = box(0.34, 0.22, 0.2, MAT.red);
    body.position.y = 0.11;
    car.add(body);
    const roof = box(0.38, 0.04, 0.24, MAT.brass);
    roof.position.y = 0.24;
    car.add(roof);
    const win = box(0.3, 0.08, 0.21, MAT.glass);
    win.position.y = 0.15;
    car.add(win);
    car.position.set(0.55, 0, 0);
    spin.add(car);
    spin.add(cyl(0.05, 0.05, 0.05, MAT.brass));
    const arm = box(0.55, 0.02, 0.03, MAT.brass);
    arm.position.x = 0.27;
    spin.add(arm);
  } else if (machine === 'sprinkler') {
    const head = cyl(0.1, 0.14, 0.18, MAT.copper);
    spin.add(head);
    const drops: THREE.Mesh[] = [];
    for (const s of [-1, 1]) {
      const arm = box(0.8, 0.04, 0.04, MAT.copper);
      arm.position.set(0.4 * s, 0.05, 0);
      arm.scale.x = 0.5;
      arm.position.x = 0.2 * s;
      spin.add(arm);
      for (let i = 0; i < 6; i++) {
        const d = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), MAT.water);
        d.userData = { s, i };
        spin.add(d);
        drops.push(d);
      }
    }
    update = (a, rpm, t) => {
      spin.rotation.y = a;
      const amt = Math.min(1, rpm / 60);
      for (const d of drops) {
        const { s, i } = d.userData as { s: number; i: number };
        const ph = (t * 1.5 + i / 6) % 1;
        d.visible = rpm > 0.5;
        d.position.set(s * (0.4 + ph * 0.9 * amt), 0.05 + Math.sin(ph * Math.PI) * 0.35 - ph * 0.2, s * ph * 0.25);
      }
    };
  } else if (machine === 'pump') {
    // Crank + piston that pumps glowing sap up a glass tube.
    const crank = box(0.35, 0.05, 0.08, MAT.darkIron);
    crank.position.x = 0.12;
    spin.add(crank);
    const tube = cyl(0.12, 0.12, 1.2, MAT.glass);
    tube.position.set(0, 1.1, -0.45);
    g.add(tube);
    const sap = cyl(0.1, 0.1, 1, MAT.sap);
    sap.position.set(0, 0.6, -0.45);
    g.add(sap);
    const piston = cyl(0.08, 0.08, 0.4, MAT.brass);
    piston.position.set(0, 0.9, -0.2);
    g.add(piston);
    update = (a, rpm) => {
      spin.rotation.y = a;
      piston.position.y = 0.9 + Math.sin(a) * 0.12;
      const fill = Math.min(1, 0.15 + Math.abs(a) * 0.002 + rpm * 0.002);
      sap.scale.y = fill;
      sap.position.y = 0.5 + fill * 0.5;
    };
  } else if (machine === 'clock-min' || machine === 'clock-hour') {
    const face = cyl(0.7, 0.7, 0.05, MAT.cream, 48);
    face.position.y = 0.5;
    g.add(face);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.04, 8, 48), MAT.brass);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.53;
    g.add(rim);
    for (let i = 0; i < 12; i++) {
      const m = box(0.04, 0.02, i % 3 === 0 ? 0.14 : 0.07, MAT.darkIron);
      const a = (i / 12) * Math.PI * 2;
      m.position.set(Math.cos(a) * 0.6, 0.54, Math.sin(a) * 0.6);
      m.rotation.y = -a + Math.PI / 2;
      g.add(m);
    }
    const len = machine === 'clock-min' ? 0.6 : 0.4;
    const hand = box(len, 0.02, machine === 'clock-min' ? 0.05 : 0.09, MAT.darkIron);
    hand.position.x = len / 2;
    spin.add(hand);
    spin.position.y = 0.56;
  } else if (machine === 'fan') {
    spin.add(cyl(0.08, 0.08, 0.12, MAT.brass));
    for (let i = 0; i < 4; i++) {
      const blade = box(0.55, 0.02, 0.18, i % 2 ? MAT.red : MAT.cheese);
      blade.position.x = 0.3;
      const holder = new THREE.Group();
      holder.rotation.y = (i / 4) * Math.PI * 2;
      blade.rotation.x = 0.35;
      holder.add(blade);
      spin.add(holder);
    }
  } else if (machine === 'grand') {
    // The Grand Gear crown: a ring of festival lanterns.
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.06, 10, 64), MAT.brass);
    ring.rotation.x = Math.PI / 2;
    spin.add(ring);
    const lamps: THREE.Mesh[] = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 10), MAT.lamp);
      l.position.set(Math.cos(a) * 0.85, 0.1, Math.sin(a) * 0.85);
      spin.add(l);
      lamps.push(l);
    }
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), MAT.lamp);
    star.position.y = 0.45;
    spin.add(star);
    glow.distance = 6;
    update = (a, _rpm, t, on) => {
      spin.rotation.y = a;
      star.rotation.y = t;
      glow.intensity = on ? 4 : 0.6;
    };
  }

  const inner = update;
  return {
    group: g,
    update(a, rpm, t, on) {
      inner(a, rpm, t, on);
      if (machine !== 'grand') glow.intensity += ((on ? 2.2 : 0) - glow.intensity) * 0.1;
    },
  };
}

/** The motor: a steam boiler with a pulsing flywheel. */
export function makeMotor(): { group: THREE.Group; update(a: number, t: number): void } {
  const g = new THREE.Group();
  const boiler = cyl(0.32, 0.36, 0.7, MAT.copper);
  boiler.position.set(0, 0.35, 0.75);
  boiler.rotation.z = 0;
  g.add(boiler);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.32, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), MAT.copper);
  cap.position.set(0, 0.7, 0.75);
  g.add(cap);
  const stack = cyl(0.07, 0.09, 0.5, MAT.darkIron);
  stack.position.set(0.15, 1.05, 0.75);
  g.add(stack);
  const gauge = cyl(0.1, 0.1, 0.03, MAT.cream);
  gauge.rotation.x = Math.PI / 2;
  gauge.position.set(0, 0.45, 0.39);
  g.add(gauge);
  const puffs: THREE.Mesh[] = [];
  const puffMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, roughness: 1 });
  for (let i = 0; i < 4; i++) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), puffMat);
    g.add(p);
    puffs.push(p);
  }
  const plate = cyl(0.22, 0.25, 0.06, MAT.darkIron);
  plate.position.y = -0.04;
  g.add(plate);
  return {
    group: g,
    update(_a, t) {
      puffs.forEach((p, i) => {
        const ph = (t * 0.5 + i / 4) % 1;
        p.position.set(0.15 + ph * 0.3, 1.3 + ph * 0.8, 0.75);
        p.scale.setScalar(0.6 + ph * 1.6);
      });
      puffMat.opacity = 0.35;
    },
  };
}

/** Procedural planks + inlaid brass for the diorama table top. */
export function tableTexture(tint: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 600;
  const x = c.getContext('2d')!;
  x.fillStyle = tint;
  x.fillRect(0, 0, c.width, c.height);
  let s = 3;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let row = 0; row < 10; row++) {
    const y = row * 60;
    x.fillStyle = `rgba(0,0,0,${0.05 + rnd() * 0.08})`;
    x.fillRect(0, y, c.width, 60);
    x.strokeStyle = 'rgba(30,15,5,0.55)';
    x.lineWidth = 2;
    x.beginPath();
    x.moveTo(0, y);
    x.lineTo(c.width, y);
    x.stroke();
    for (let k = 0; k < 40; k++) {
      x.strokeStyle = `rgba(40,20,5,${0.05 + rnd() * 0.1})`;
      x.lineWidth = 1;
      x.beginPath();
      const yy = y + rnd() * 60;
      x.moveTo(0, yy);
      x.bezierCurveTo(300, yy + rnd() * 8 - 4, 700, yy + rnd() * 8 - 4, 1024, yy);
      x.stroke();
    }
    const off = rnd() * 400;
    x.fillStyle = 'rgba(25,12,3,0.6)';
    x.fillRect(off, y, 2, 60);
    x.fillRect(off + 500, y, 2, 60);
  }
  // faint blueprint grid
  x.strokeStyle = 'rgba(255,230,170,0.06)';
  for (let gx = 0; gx < c.width; gx += 34) {
    x.beginPath();
    x.moveTo(gx, 0);
    x.lineTo(gx, c.height);
    x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function makeRock(r: number): THREE.Group {
  const g = new THREE.Group();
  const geo = new THREE.DodecahedronGeometry(r, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const k = 0.85 + 0.3 * Math.abs(Math.sin(i * 12.9898) * 43758.5453 % 1);
    pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k * 0.6, pos.getZ(i) * k);
  }
  geo.computeVertexNormals();
  const rock = new THREE.Mesh(geo, MAT.stone);
  rock.castShadow = true;
  rock.position.y = r * 0.3;
  g.add(rock);
  const moss = new THREE.Mesh(new THREE.SphereGeometry(r * 0.7, 12, 8, 0, Math.PI * 2, 0, Math.PI / 3), MAT.moss);
  moss.position.y = r * 0.5;
  g.add(moss);
  return g;
}

export function makeMushroom(scale: number, capMat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const stem = cyl(0.08 * scale, 0.11 * scale, 0.5 * scale, MAT.cream, 10);
  stem.position.y = 0.25 * scale;
  g.add(stem);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.3 * scale, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), capMat);
  cap.position.y = 0.48 * scale;
  cap.castShadow = true;
  g.add(cap);
  for (let i = 0; i < 5; i++) {
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.04 * scale, 6, 6), MAT.cream);
    const a = i * 1.3;
    dot.position.set(Math.cos(a) * 0.18 * scale, 0.66 * scale, Math.sin(a) * 0.18 * scale);
    g.add(dot);
  }
  return g;
}
