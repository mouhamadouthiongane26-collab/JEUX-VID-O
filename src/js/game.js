import * as THREE from 'https://unpkg.com/three@0.161.0/build/three.module.js';

/**
 * ASSANE KART 3D - VERSION MARIO KART (avec saut)
 * - Photo joueur: assets/images/player.png
 * - Contrôles MacBook: flèches, espace, shift, J
 */

// -------------------------------------------------
// Setup Three.js
// -------------------------------------------------
const canvas = document.getElementById('game');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x99d7ff);
scene.fog = new THREE.Fog(0x99d7ff, 120, 360);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 13, -20);

scene.add(new THREE.HemisphereLight(0xffffff, 0x5f8ec4, 0.95));
const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(40, 80, 30);
sun.castShadow = true;
scene.add(sun);

const clock = new THREE.Clock();
const keys = {};

// -------------------------------------------------
// UI
// -------------------------------------------------
const ui = {
  main: document.getElementById('main-menu'),
  setup: document.getElementById('setup-menu'),
  options: document.getElementById('options-menu'),
  hud: document.getElementById('hud'),
  result: document.getElementById('result-panel'),
  countdown: document.getElementById('countdown'),
  lap: document.getElementById('lap'),
  position: document.getElementById('position'),
  speed: document.getElementById('speed'),
  chrono: document.getElementById('chrono'),
  item: document.getElementById('item'),
  resultText: document.getElementById('result-text'),
};

// -------------------------------------------------
// Audio
// -------------------------------------------------
const listener = new THREE.AudioListener();
camera.add(listener);
const audioCtx = listener.context;
let masterVolume = 0.75;

function playTone(freq = 260, duration = 0.07, type = 'square', gain = 0.05) {
  const osc = audioCtx.createOscillator();
  const amp = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  amp.gain.value = gain * masterVolume;
  osc.connect(amp).connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

// -------------------------------------------------
// Data
// -------------------------------------------------
const characters = [
  { name: 'Assane Thiongane', color: 0x2d71ff },
  { name: 'Kira Volt', color: 0xff4f82 },
  { name: 'Neo Panda', color: 0x2ae07b },
  { name: 'Luna Jet', color: 0xffd44c },
];

const karts = [
  { name: 'Sprint', maxSpeed: 66, accel: 30, handling: 2.6 },
  { name: 'Turbo-X', maxSpeed: 73, accel: 24, handling: 2.2 },
  { name: 'Drift Pro', maxSpeed: 62, accel: 32, handling: 3.2 },
];

const tracks = {
  ville: { name: 'Ville', rx: 68, rz: 44, variance: 16, color: 0x697686 },
  desert: { name: 'Désert', rx: 78, rz: 50, variance: 10, color: 0xc99e59 },
  jungle: { name: 'Jungle', rx: 72, rz: 48, variance: 20, color: 0x4f8c56 },
};

const game = {
  state: 'menu',
  selectedCharacter: 0,
  selectedKart: 0,
  selectedTrack: 'ville',
  started: false,
  finished: false,
  raceTime: 0,
  countdown: 3,
  waypoints: [],
  racers: [],
  itemBoxes: [],
  projectiles: [],
  traps: [],
  ramps: [],
  particles: [],
  worldGroup: null,
};

const textureLoader = new THREE.TextureLoader();
const playerFaceTexture = textureLoader.load(
  'assets/images/player.png',
  (t) => { t.colorSpace = THREE.SRGBColorSpace; },
  undefined,
  () => console.warn('Image non trouvée: assets/images/player.png'),
);

// -------------------------------------------------
// Track / décor
// -------------------------------------------------
function buildWaypoints({ rx, rz, variance }) {
  const pts = [];
  for (let i = 0; i < 36; i++) {
    const t = (i / 36) * Math.PI * 2;
    const wobble = Math.sin(t * 3.2) * variance;
    pts.push(new THREE.Vector3(Math.cos(t) * (rx + wobble), 0, Math.sin(t) * rz));
  }
  return pts;
}

function buildWorld() {
  if (game.worldGroup) scene.remove(game.worldGroup);
  const cfg = tracks[game.selectedTrack];
  game.waypoints = buildWaypoints(cfg);
  game.worldGroup = new THREE.Group();
  game.ramps = [];

  const roadMat = new THREE.MeshStandardMaterial({ color: cfg.color, roughness: 0.85 });
  const borderMat = new THREE.MeshStandardMaterial({ color: 0xffffff });

  for (let i = 0; i < game.waypoints.length; i++) {
    const a = game.waypoints[i];
    const b = game.waypoints[(i + 1) % game.waypoints.length];
    const dir = b.clone().sub(a);
    const len = dir.length();
    const mid = a.clone().add(b).multiplyScalar(0.5);

    const road = new THREE.Mesh(new THREE.BoxGeometry(16, 0.8, len), roadMat);
    road.position.copy(mid);
    road.lookAt(b.x, mid.y, b.z);
    road.rotateY(Math.PI / 2);
    road.receiveShadow = true;
    game.worldGroup.add(road);

    if (i % 3 === 0) {
      const border = new THREE.Mesh(new THREE.BoxGeometry(1, 1, len), borderMat);
      border.position.copy(mid.clone().add(new THREE.Vector3(dir.z, 0, -dir.x).normalize().multiplyScalar(8.5)));
      border.position.y = 0.4;
      border.lookAt(b.x, 0, b.z);
      border.rotateY(Math.PI / 2);
      game.worldGroup.add(border);
    }
  }

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(450, 450), new THREE.MeshStandardMaterial({ color: 0x59b44a }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  game.worldGroup.add(ground);

  // Tremplins (ramps)
  [6, 17, 28].forEach((idx) => {
    const wp = game.waypoints[idx];
    const next = game.waypoints[(idx + 1) % game.waypoints.length];
    const dir = next.clone().sub(wp).normalize();

    const ramp = new THREE.Mesh(
      new THREE.BoxGeometry(5.2, 0.8, 4.4),
      new THREE.MeshStandardMaterial({ color: 0xff9a2f, emissive: 0x7a3f00, emissiveIntensity: 0.6 }),
    );
    ramp.position.copy(wp).add(dir.clone().multiplyScalar(1.6));
    ramp.position.y = 0.7;
    ramp.lookAt(next.x, ramp.position.y, next.z);
    ramp.rotation.x = -0.3;
    ramp.castShadow = true;
    game.worldGroup.add(ramp);

    game.ramps.push({ mesh: ramp, radius: 3.3 });
  });

  scene.add(game.worldGroup);
  spawnItemBoxes();
}

function spawnItemBoxes() {
  game.itemBoxes.forEach((b) => scene.remove(b));
  game.itemBoxes = [];
  for (let i = 0; i < game.waypoints.length; i += 4) {
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 1.6, 1.6),
      new THREE.MeshStandardMaterial({ color: 0x2ce9ff, emissive: 0x1465a8, emissiveIntensity: 0.85 }),
    );
    box.position.copy(game.waypoints[i]).add(new THREE.Vector3((Math.random() - 0.5) * 5, 2, (Math.random() - 0.5) * 5));
    box.userData.cooldown = 0;
    scene.add(box);
    game.itemBoxes.push(box);
  }
}

// -------------------------------------------------
// Karts / personnages
// -------------------------------------------------
function createDriver(isPlayerHero = false) {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xe0b08a });
  const shirt = new THREE.MeshStandardMaterial({ color: 0xf0b12c });

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.8, 8, 10), shirt);
  torso.position.set(0, 2.1, -0.15);
  g.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 20, 16), skin);
  head.position.set(0, 2.9, -0.3);
  g.add(head);

  if (isPlayerHero) {
    const face = new THREE.Mesh(
      new THREE.CircleGeometry(0.35, 32),
      new THREE.MeshStandardMaterial({ map: playerFaceTexture, transparent: true, alphaTest: 0.08 }),
    );
    face.position.set(0, 2.9, -0.63);
    face.rotation.y = Math.PI;
    g.add(face);
  }
  return g;
}

function createKartMesh(color, isPlayerHero = false) {
  const g = new THREE.Group();

  const body = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.8, 4.2), new THREE.MeshStandardMaterial({ color }));
  body.position.y = 1.1;
  body.castShadow = true;
  g.add(body);

  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 1.2), new THREE.MeshStandardMaterial({ color: 0x232323 }));
  seat.position.set(0, 1.55, -0.2);
  g.add(seat);

  const wheelGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.5, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x161616 });
  [[1.3, 0.55, 1.7], [-1.3, 0.55, 1.7], [1.3, 0.55, -1.7], [-1.3, 0.55, -1.7]].forEach((p) => {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(...p);
    g.add(wheel);
  });

  g.add(createDriver(isPlayerHero));
  return g;
}

function createRacer(name, color, kartStats, isPlayer = false) {
  const mesh = createKartMesh(color, isPlayer && name === 'Assane Thiongane');
  scene.add(mesh);
  return {
    name,
    mesh,
    isPlayer,
    kartStats,
    speed: 0,
    heading: Math.PI,
    steer: 0,
    lap: 1,
    nextWp: 1,
    progress: 0,
    item: null,
    boost: 0,
    driftCharge: 0,
    onGround: true,
    verticalVel: 0,
    jumpCooldown: 0,
    jumpFromRamp: false,
    airTime: 0,
    finished: false,
  };
}

// -------------------------------------------------
// Jump & air/ground detection
// -------------------------------------------------
function jump(racer, power = 7.5, fromRamp = false) {
  if (!racer.onGround || racer.jumpCooldown > 0) return;
  racer.onGround = false;
  racer.verticalVel = power;
  racer.jumpCooldown = 0.3;
  racer.jumpFromRamp = fromRamp;
  playTone(520, 0.09, 'triangle', 0.08); // son de saut
}

function spawnLandingEffect(pos) {
  for (let i = 0; i < 16; i++) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true }));
    p.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 1.8, 0.2, (Math.random() - 0.5) * 1.8));
    scene.add(p);
    game.particles.push({ mesh: p, life: 0.35 });
  }
}

function updateVerticalPhysics(r, dt) {
  const groundY = 1.1;
  r.jumpCooldown = Math.max(0, r.jumpCooldown - dt);

  if (!r.onGround) {
    r.airTime += dt;
    r.verticalVel -= 19 * dt; // gravité réaliste arcade
    r.mesh.position.y += r.verticalVel * dt;

    // Animation du saut
    r.mesh.rotation.x = THREE.MathUtils.lerp(r.mesh.rotation.x, -0.18 + Math.min(r.verticalVel * 0.015, 0.22), dt * 8);

    if (r.mesh.position.y <= groundY) {
      r.mesh.position.y = groundY;
      r.onGround = true;
      r.verticalVel = 0;
      r.mesh.rotation.x = 0;
      spawnLandingEffect(r.mesh.position.clone());
      playTone(180, 0.07, 'square', 0.06);

      // Boost après saut réussi (tremplin)
      if (r.jumpFromRamp && r.airTime > 0.25) {
        r.boost = Math.max(r.boost, 1.2);
        playTone(720, 0.05, 'sawtooth', 0.07);
      }
      r.jumpFromRamp = false;
      r.airTime = 0;
    }
  }
}

function checkRamps(r) {
  if (!r.onGround || r.speed < 22) return;
  for (const ramp of game.ramps) {
    if (r.mesh.position.distanceTo(ramp.mesh.position) < ramp.radius) {
      jump(r, 8.2, true);
      break;
    }
  }
}

// -------------------------------------------------
// Gameplay update
// -------------------------------------------------
function setupRace() {
  game.started = false;
  game.finished = false;
  game.countdown = 3;
  game.raceTime = 0;

  game.projectiles.forEach((p) => scene.remove(p.mesh));
  game.traps.forEach((t) => scene.remove(t.mesh));
  game.racers.forEach((r) => scene.remove(r.mesh));
  game.particles.forEach((p) => scene.remove(p.mesh));
  game.projectiles = [];
  game.traps = [];
  game.particles = [];
  game.racers = [];

  buildWorld();

  const playerChar = characters[game.selectedCharacter];
  const playerKart = karts[game.selectedKart];
  game.racers.push(createRacer(playerChar.name, playerChar.color, playerKart, true));

  for (let i = 0; i < 7; i++) {
    const c = characters[(i + 1) % characters.length];
    const k = karts[i % karts.length];
    game.racers.push(createRacer(`IA ${i + 1}`, c.color, k, false));
  }

  const start = game.waypoints[0];
  game.racers.forEach((r, idx) => {
    const row = Math.floor(idx / 2);
    const side = idx % 2 === 0 ? -1.8 : 1.8;
    r.mesh.position.set(start.x + side, 1.1, start.z + row * 4);
    r.heading = Math.PI;
    r.mesh.rotation.y = r.heading;
    r.lap = 1;
    r.nextWp = 1;
    r.progress = 0;
    r.item = null;
    r.finished = false;
    r.speed = 0;
    r.onGround = true;
    r.verticalVel = 0;
    r.jumpFromRamp = false;
    r.airTime = 0;
  });
}

function useItem(racer) {
  if (!racer.item) return;
  if (racer.item === 'boost' || racer.item === 'turbo') {
    racer.boost = 1.4;
    playTone(430, 0.08, 'sawtooth', 0.08);
  } else if (racer.item === 'missile') {
    const dir = new THREE.Vector3(Math.sin(racer.heading), 0, Math.cos(racer.heading));
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 8), new THREE.MeshStandardMaterial({ color: 0xff4f2b, emissive: 0xff1b00 }));
    mesh.position.copy(racer.mesh.position).add(dir.clone().multiplyScalar(3));
    scene.add(mesh);
    game.projectiles.push({ owner: racer, mesh, vel: dir.multiplyScalar(90), life: 2.4 });
  } else if (racer.item === 'trap') {
    const mesh = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.1, 7), new THREE.MeshStandardMaterial({ color: 0x793000 }));
    mesh.position.copy(racer.mesh.position);
    mesh.position.y = 0.7;
    scene.add(mesh);
    game.traps.push({ owner: racer, mesh, life: 12 });
  }
  racer.item = null;
}

function updatePlayer(r, dt) {
  const throttle = keys.ArrowUp ? 1 : 0;
  const brake = keys.ArrowDown ? 1 : 0;
  const turn = (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0);
  const drifting = !!keys.ShiftLeft || !!keys.ShiftRight;

  if (!game.started || r.finished) return;

  r.speed += throttle * r.kartStats.accel * dt;
  r.speed -= brake * r.kartStats.accel * 1.1 * dt;
  r.speed -= 9.5 * dt;

  // Drift (SHIFT)
  if (drifting && Math.abs(turn) > 0.1 && r.speed > 20 && r.onGround) {
    r.driftCharge = Math.min(r.driftCharge + dt, 1.6);
  } else if (r.driftCharge > 0.35) {
    r.boost = Math.max(r.boost, 0.5 + r.driftCharge * 0.7);
    r.driftCharge = 0;
    playTone(580, 0.05, 'triangle', 0.06);
  } else {
    r.driftCharge = Math.max(0, r.driftCharge - dt * 2);
  }

  const handling = r.kartStats.handling * (drifting ? 1.35 : 1);
  r.steer = THREE.MathUtils.lerp(r.steer, turn, dt * 8);
  r.heading += r.steer * handling * dt * (r.speed / 35) * (r.onGround ? 1 : 0.45);

  if (r.boost > 0) {
    r.speed += 35 * dt;
    r.boost -= dt;
  }

  r.speed = THREE.MathUtils.clamp(r.speed, -20, r.kartStats.maxSpeed + 18);
  const vel = new THREE.Vector3(Math.sin(r.heading), 0, Math.cos(r.heading)).multiplyScalar(r.speed * dt);
  r.mesh.position.add(vel);
  r.mesh.rotation.y = r.heading;

  // J = saut manuel
  if (keys.KeyJ) {
    jump(r, 7.5, false);
    keys.KeyJ = false;
  }

  if (keys.Space) {
    useItem(r);
    keys.Space = false;
  }

  checkRamps(r);
  updateVerticalPhysics(r, dt);
}

function updateAI(r, dt) {
  if (!game.started || r.finished) return;
  const target = game.waypoints[r.nextWp];
  const toTarget = target.clone().sub(r.mesh.position);
  if (toTarget.length() < 7) r.nextWp = (r.nextWp + 1) % game.waypoints.length;

  const desired = Math.atan2(toTarget.x, toTarget.z);
  const delta = THREE.MathUtils.euclideanModulo(desired - r.heading + Math.PI, Math.PI * 2) - Math.PI;
  r.heading += THREE.MathUtils.clamp(delta, -1, 1) * r.kartStats.handling * dt * 0.85;

  const targetSpeed = r.kartStats.maxSpeed * (0.7 + Math.random() * 0.2);
  r.speed = THREE.MathUtils.lerp(r.speed, targetSpeed, dt * 0.9);

  if (Math.random() < dt * 0.2 && r.item) useItem(r);
  if (r.boost > 0) {
    r.speed += 28 * dt;
    r.boost -= dt;
  }

  const vel = new THREE.Vector3(Math.sin(r.heading), 0, Math.cos(r.heading)).multiplyScalar(r.speed * dt);
  r.mesh.position.add(vel);
  r.mesh.rotation.y = r.heading;

  checkRamps(r);
  updateVerticalPhysics(r, dt);
}

function updateBoxes(dt) {
  game.itemBoxes.forEach((b) => {
    b.rotation.x += dt;
    b.rotation.y += dt * 1.1;
    b.userData.cooldown = Math.max(0, b.userData.cooldown - dt);
    b.visible = b.userData.cooldown <= 0;

    if (!b.visible) return;
    game.racers.forEach((r) => {
      if (!r.item && r.mesh.position.distanceTo(b.position) < 2.2) {
        r.item = ['boost', 'turbo', 'missile', 'trap'][Math.floor(Math.random() * 4)];
        b.userData.cooldown = 4;
        playTone(640, 0.05, 'triangle', 0.07);
      }
    });
  });
}

function updateProjectiles(dt) {
  game.projectiles = game.projectiles.filter((p) => {
    p.mesh.position.addScaledVector(p.vel, dt);
    p.life -= dt;
    let exploded = false;

    game.racers.forEach((r) => {
      if (r === p.owner) return;
      if (r.mesh.position.distanceTo(p.mesh.position) < 2.2) {
        r.speed *= 0.45;
        exploded = true;
        playTone(95, 0.14, 'square', 0.08);
        spawnLandingEffect(r.mesh.position.clone());
      }
    });

    if (exploded || p.life <= 0) {
      scene.remove(p.mesh);
      return false;
    }
    return true;
  });
}

function updateTraps(dt) {
  game.traps = game.traps.filter((t) => {
    t.life -= dt;
    game.racers.forEach((r) => {
      if (r === t.owner) return;
      if (r.mesh.position.distanceTo(t.mesh.position) < 2) {
        r.speed *= 0.4;
        t.life = -1;
        playTone(70, 0.2, 'triangle', 0.08);
      }
    });
    if (t.life <= 0) {
      scene.remove(t.mesh);
      return false;
    }
    return true;
  });
}

function updateParticles(dt) {
  game.particles = game.particles.filter((p) => {
    p.life -= dt;
    p.mesh.position.y += dt * 3;
    p.mesh.material.opacity = p.life / 0.35;
    if (p.life <= 0) {
      scene.remove(p.mesh);
      return false;
    }
    return true;
  });
}

function updateCollisions() {
  for (let i = 0; i < game.racers.length; i++) {
    for (let j = i + 1; j < game.racers.length; j++) {
      const a = game.racers[i];
      const b = game.racers[j];
      const d = a.mesh.position.distanceTo(b.mesh.position);
      if (d < 2.3) {
        const push = a.mesh.position.clone().sub(b.mesh.position).normalize().multiplyScalar((2.3 - d) * 0.55);
        a.mesh.position.add(push);
        b.mesh.position.sub(push);
        a.speed *= 0.99;
        b.speed *= 0.99;
      }
    }
  }
}

function updateProgressAndHUD() {
  game.racers.forEach((r) => {
    const target = game.waypoints[r.nextWp];
    if (r.mesh.position.distanceTo(target) < 6) {
      r.nextWp = (r.nextWp + 1) % game.waypoints.length;
      r.progress += 1;
      if (r.nextWp === 1) {
        r.lap += 1;
        if (r.lap > 3 && !r.finished) {
          r.finished = true;
          if (r.isPlayer) {
            game.finished = true;
            ui.hud.classList.add('hidden');
            ui.result.classList.remove('hidden');
          }
        }
      }
    }
  });

  const rank = [...game.racers].sort((a, b) => (b.lap * 1000 + b.progress) - (a.lap * 1000 + a.progress));
  const player = game.racers[0];
  const pos = rank.findIndex((r) => r.isPlayer) + 1;

  ui.position.textContent = `Position: ${pos}/8`;
  ui.lap.textContent = `Tour: ${Math.min(player.lap, 3)}/3`;
  ui.speed.textContent = `Vitesse: ${Math.round(Math.abs(player.speed) * 3.1)} km/h`;
  ui.item.textContent = `Bonus: ${player.item ? player.item.toUpperCase() : 'Aucun'}`;
}

function updateTimerText() {
  const t = game.raceTime;
  const mm = String(Math.floor(t / 60)).padStart(2, '0');
  const ss = String(Math.floor(t % 60)).padStart(2, '0');
  const ms = String(Math.floor((t % 1) * 1000)).padStart(3, '0');
  ui.chrono.textContent = `Temps: ${mm}:${ss}.${ms}`;
}

function updateCamera(dt) {
  const player = game.racers[0];
  if (!player) return;
  const desired = player.mesh.position.clone().add(new THREE.Vector3(Math.sin(player.heading) * -11, 7.5, Math.cos(player.heading) * -11));
  camera.position.lerp(desired, dt * 5);
  camera.lookAt(player.mesh.position.x, player.mesh.position.y + 2.2, player.mesh.position.z);
}

function gameLoop() {
  const dt = Math.min(clock.getDelta(), 0.033);

  if (game.state === 'racing') {
    if (!game.started) {
      game.countdown -= dt;
      const c = Math.ceil(game.countdown);
      if (c > 0) ui.countdown.textContent = String(c);
      else if (c === 0) ui.countdown.textContent = 'GO!';
      else {
        game.started = true;
        ui.countdown.textContent = '';
      }
    } else if (!game.finished) {
      game.raceTime += dt;
    }

    game.racers.forEach((r) => {
      if (r.isPlayer) updatePlayer(r, dt);
      else updateAI(r, dt);
    });

    updateBoxes(dt);
    updateProjectiles(dt);
    updateTraps(dt);
    updateParticles(dt);
    updateCollisions();
    updateProgressAndHUD();
    updateTimerText();

    if (game.finished) {
      const rank = [...game.racers].sort((a, b) => (b.lap * 1000 + b.progress) - (a.lap * 1000 + a.progress));
      const pos = rank.findIndex((r) => r.isPlayer) + 1;
      ui.resultText.textContent = `${game.racers[0].name} termine #${pos} en ${ui.chrono.textContent.replace('Temps: ', '')}`;
    }
  }

  updateCamera(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(gameLoop);
}

// -------------------------------------------------
// UI init + tutoriel
// -------------------------------------------------
function initUI() {
  const characterSelect = document.getElementById('character-select');
  const kartSelect = document.getElementById('kart-select');
  const trackSelect = document.getElementById('track-select');

  characterSelect.innerHTML = '';
  kartSelect.innerHTML = '';
  trackSelect.innerHTML = '';

  characters.forEach((c, i) => {
    const o = document.createElement('option');
    o.value = String(i);
    o.textContent = c.name;
    characterSelect.appendChild(o);
  });

  karts.forEach((k, i) => {
    const o = document.createElement('option');
    o.value = String(i);
    o.textContent = `${k.name} (V${k.maxSpeed}/A${k.accel}/M${k.handling.toFixed(1)})`;
    kartSelect.appendChild(o);
  });

  Object.entries(tracks).forEach(([key, t]) => {
    const o = document.createElement('option');
    o.value = key;
    o.textContent = t.name;
    trackSelect.appendChild(o);
  });

  document.getElementById('play-btn').onclick = () => {
    ui.main.classList.add('hidden');
    ui.setup.classList.remove('hidden');
  };

  document.getElementById('options-btn').onclick = () => {
    ui.main.classList.add('hidden');
    ui.options.classList.remove('hidden');
  };

  document.getElementById('quit-btn').onclick = () => window.close();

  document.getElementById('back-btn').onclick = () => {
    ui.setup.classList.add('hidden');
    ui.main.classList.remove('hidden');
  };

  document.getElementById('options-back-btn').onclick = () => {
    ui.options.classList.add('hidden');
    ui.main.classList.remove('hidden');
  };

  document.getElementById('volume-range').oninput = (e) => {
    masterVolume = Number(e.target.value) / 100;
  };

  document.getElementById('start-btn').onclick = () => {
    game.selectedCharacter = Number(characterSelect.value);
    game.selectedKart = Number(kartSelect.value);
    game.selectedTrack = trackSelect.value;

    ui.setup.classList.add('hidden');
    ui.result.classList.add('hidden');
    ui.hud.classList.remove('hidden');
    game.state = 'racing';

    setupRace();
    showTutorial();
  };

  document.getElementById('race-again-btn').onclick = () => {
    ui.result.classList.add('hidden');
    ui.setup.classList.remove('hidden');
    game.state = 'menu';
  };
}

function showTutorial() {
  const old = document.getElementById('tutorial-box');
  if (old) old.remove();

  const tutorial = document.createElement('div');
  tutorial.id = 'tutorial-box';
  tutorial.className = 'panel';
  tutorial.style.position = 'absolute';
  tutorial.style.top = '12px';
  tutorial.style.left = '50%';
  tutorial.style.transform = 'translateX(-50%)';
  tutorial.style.width = 'min(680px, 94vw)';
  tutorial.style.padding = '0.8rem';
  tutorial.style.fontSize = '0.92rem';
  tutorial.innerHTML = `
    <strong>Tutoriel rapide (MacBook)</strong><br>
    ↑ accélérer · ↓ freiner/reculer · ←/→ tourner · SHIFT drift · J sauter · ESPACE bonus.<br>
    Prends les tremplins pour faire des sauts + boost à l'atterrissage.
  `;
  document.getElementById('ui-root').appendChild(tutorial);

  setTimeout(() => tutorial.remove(), 6500);
}

// Keyboard
window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (audioCtx.state === 'suspended') audioCtx.resume();
});
window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

initUI();
buildWorld();
gameLoop();
