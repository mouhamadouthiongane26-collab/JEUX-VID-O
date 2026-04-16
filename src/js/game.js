import * as THREE from 'https://unpkg.com/three@0.161.0/build/three.module.js';

const canvas = document.getElementById('game');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9ad6ff);
scene.fog = new THREE.Fog(0x9ad6ff, 120, 420);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 16, -28);

const hemi = new THREE.HemisphereLight(0xffffff, 0x446688, 0.95);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1.3);
sun.position.set(80, 120, 40);
sun.castShadow = true;
scene.add(sun);

const clock = new THREE.Clock();
const keyState = {};
const textureLoader = new THREE.TextureLoader();
const ASSANE_HEAD_TEXTURE_PATH = 'assets/images/assane-head.jpg';
const assaneHeadTexture = textureLoader.load(
  ASSANE_HEAD_TEXTURE_PATH,
  (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
  },
  undefined,
  () => {
    console.warn(
      `[Assane Kart] Texture introuvable: ${ASSANE_HEAD_TEXTURE_PATH}. ` +
      'Ajoutez la photo fournie dans assets/images/assane-head.jpg.',
    );
  },
);

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

const characters = [
  { name: 'Assane Thiongane', color: 0x2a6cff },
  { name: 'Kira Volt', color: 0xff4a6e },
  { name: 'Neo Panda', color: 0x2de77b },
  { name: 'Luna Jet', color: 0xffd93d },
];
const karts = [
  { name: 'Éclair', maxSpeed: 66, accel: 30, handling: 2.8 },
  { name: 'Titan', maxSpeed: 75, accel: 24, handling: 2.2 },
  { name: 'Agile-X', maxSpeed: 60, accel: 33, handling: 3.4 },
];

const tracks = {
  city: {
    name: 'Circuit Ville',
    color: 0x6c7a89,
    waypoints: buildOvalWaypoints(68, 44, 22, 0),
    deco: () => addCityDeco(),
  },
  desert: {
    name: 'Circuit Désert',
    color: 0xc89f58,
    waypoints: buildOvalWaypoints(82, 52, 18, 8),
    deco: () => addDesertDeco(),
  },
  jungle: {
    name: 'Circuit Jungle',
    color: 0x4f8f58,
    waypoints: buildOvalWaypoints(74, 48, 26, -6),
    deco: () => addJungleDeco(),
  },
};

let game = {
  state: 'menu',
  selectedCharacter: 0,
  selectedKart: 0,
  selectedTrack: 'city',
  racers: [],
  itemBoxes: [],
  projectiles: [],
  traps: [],
  particles: [],
  trackObj: null,
  decorGroup: null,
  countdown: 4,
  raceTime: 0,
  started: false,
  finished: false,
};

const listener = new THREE.AudioListener();
camera.add(listener);
const audioCtx = listener.context;
let masterVolume = 0.7;

function playTone(freq = 220, duration = 0.08, type = 'square', gain = 0.05) {
  const osc = audioCtx.createOscillator();
  const amp = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  amp.gain.value = gain * masterVolume;
  osc.connect(amp).connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

function buildOvalWaypoints(rx, rz, variance, yOffset) {
  const points = [];
  for (let i = 0; i < 32; i++) {
    const t = (i / 32) * Math.PI * 2;
    const wobble = Math.sin(t * 3) * variance;
    points.push(new THREE.Vector3(Math.cos(t) * (rx + wobble), yOffset, Math.sin(t) * rz));
  }
  return points;
}

function createKartMesh(color, isMainHero = false) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.8, 4), new THREE.MeshStandardMaterial({ color }));
  body.position.y = 1.1;
  body.castShadow = true;
  g.add(body);
  const headMaterial = isMainHero
    ? new THREE.MeshStandardMaterial({ map: assaneHeadTexture })
    : new THREE.MeshStandardMaterial({ color: 0xffddb0 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.75, 24, 24), headMaterial);
  head.position.set(0, 2, -0.25);
  head.rotation.y = -Math.PI / 2;
  g.add(head);
  const wheelGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.5, 10);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
  [[1.3, 0.55, 1.7], [-1.3, 0.55, 1.7], [1.3, 0.55, -1.7], [-1.3, 0.55, -1.7]].forEach((p) => {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(...p);
    g.add(w);
  });
  return g;
}

function makeTrack(track) {
  if (game.trackObj) scene.remove(game.trackObj);
  if (game.decorGroup) scene.remove(game.decorGroup);

  const grp = new THREE.Group();
  const roadMaterial = new THREE.MeshStandardMaterial({ color: track.color, roughness: 0.85 });
  const borderMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });

  for (let i = 0; i < track.waypoints.length; i++) {
    const a = track.waypoints[i];
    const b = track.waypoints[(i + 1) % track.waypoints.length];
    const dir = b.clone().sub(a);
    const length = dir.length();
    const mid = a.clone().add(b).multiplyScalar(0.5);

    const road = new THREE.Mesh(new THREE.BoxGeometry(16, 0.8, length), roadMaterial);
    road.position.copy(mid);
    road.position.y = 0;
    road.lookAt(b.x, mid.y, b.z);
    road.rotateY(Math.PI / 2);
    road.receiveShadow = true;
    grp.add(road);

    if (i % 2 === 0) {
      const border = new THREE.Mesh(new THREE.BoxGeometry(1, 1, length), borderMaterial);
      border.position.copy(mid.clone().add(new THREE.Vector3(dir.z, 0, -dir.x).normalize().multiplyScalar(8.5)));
      border.position.y = 0.4;
      border.lookAt(b.x, 0, b.z);
      border.rotateY(Math.PI / 2);
      grp.add(border);
    }
  }

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), new THREE.MeshStandardMaterial({ color: 0x55aa55 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  grp.add(ground);

  game.trackObj = grp;
  scene.add(grp);

  game.decorGroup = track.deco();
  scene.add(game.decorGroup);
}

function addCityDeco() {
  const g = new THREE.Group();
  for (let i = 0; i < 45; i++) {
    const h = 4 + Math.random() * 26;
    const b = new THREE.Mesh(
      new THREE.BoxGeometry(5, h, 5),
      new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.58 + Math.random() * 0.08, 0.5, 0.45) }),
    );
    b.position.set((Math.random() - 0.5) * 220, h / 2, (Math.random() - 0.5) * 220);
    b.castShadow = true;
    g.add(b);
  }
  return g;
}

function addDesertDeco() {
  const g = new THREE.Group();
  scene.fog.color.set(0xf5d8a8);
  for (let i = 0; i < 55; i++) {
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(1 + Math.random() * 2),
      new THREE.MeshStandardMaterial({ color: 0xb8793f }),
    );
    rock.position.set((Math.random() - 0.5) * 220, 1, (Math.random() - 0.5) * 220);
    g.add(rock);
  }
  return g;
}

function addJungleDeco() {
  const g = new THREE.Group();
  scene.fog.color.set(0x9ad6ff);
  for (let i = 0; i < 85; i++) {
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.55, 3.5, 8), new THREE.MeshStandardMaterial({ color: 0x6e3f1f }));
    trunk.position.y = 1.6;
    const top = new THREE.Mesh(new THREE.SphereGeometry(2.2, 10, 10), new THREE.MeshStandardMaterial({ color: 0x2a8f44 }));
    top.position.y = 4.2;
    tree.add(trunk, top);
    tree.position.set((Math.random() - 0.5) * 220, 0, (Math.random() - 0.5) * 220);
    g.add(tree);
  }
  return g;
}

function spawnItemBoxes() {
  game.itemBoxes.forEach((m) => scene.remove(m));
  game.itemBoxes = [];
  const wp = tracks[game.selectedTrack].waypoints;
  for (let i = 0; i < wp.length; i += 3) {
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 1.8, 1.8),
      new THREE.MeshStandardMaterial({ color: 0x3ff5ff, emissive: 0x1b6cff, emissiveIntensity: 0.8 }),
    );
    box.position.copy(wp[i]).add(new THREE.Vector3((Math.random() - 0.5) * 6, 2, (Math.random() - 0.5) * 6));
    box.userData.cooldown = 0;
    scene.add(box);
    game.itemBoxes.push(box);
  }
}

function createRacer(name, color, kartStats, isPlayer = false) {
  const mesh = createKartMesh(color, isPlayer && name === 'Assane Thiongane');
  scene.add(mesh);
  return {
    name,
    mesh,
    color,
    isPlayer,
    kartStats,
    speed: 0,
    heading: 0,
    steer: 0,
    lap: 1,
    distanceDone: 0,
    nextWp: 0,
    item: null,
    boost: 0,
    finished: false,
    driftCharge: 0,
    drifting: false,
    startBoostFrames: 0,
  };
}

function setupRace() {
  game.started = false;
  game.finished = false;
  game.countdown = 4;
  game.raceTime = 0;
  game.projectiles.forEach((p) => scene.remove(p.mesh));
  game.traps.forEach((t) => scene.remove(t.mesh));
  game.racers.forEach((r) => scene.remove(r.mesh));
  game.projectiles = [];
  game.traps = [];
  game.particles = [];
  game.racers = [];

  const track = tracks[game.selectedTrack];
  makeTrack(track);
  spawnItemBoxes();

  const playerCfg = characters[game.selectedCharacter];
  const kartCfg = karts[game.selectedKart];
  game.racers.push(createRacer(playerCfg.name, playerCfg.color, kartCfg, true));

  for (let i = 0; i < 7; i++) {
    const c = characters[(i + 1) % characters.length];
    const k = karts[i % karts.length];
    game.racers.push(createRacer(`IA ${i + 1} · ${c.name}`, c.color, k, false));
  }

  const start = track.waypoints[0];
  game.racers.forEach((r, idx) => {
    const row = Math.floor(idx / 2);
    const side = idx % 2 === 0 ? -1.6 : 1.6;
    r.mesh.position.set(start.x + side, 1.1, start.z + row * 4);
    r.heading = Math.PI;
    r.mesh.rotation.y = r.heading;
    r.lap = 1;
    r.distanceDone = 0;
    r.nextWp = 1;
    r.item = null;
    r.finished = false;
  });
}

function consumeItem(racer) {
  if (!racer.item) return;
  if (racer.item === 'boost' || racer.item === 'turbo') {
    racer.boost = 1.6;
    playTone(420, 0.08, 'sawtooth', 0.08);
  } else if (racer.item === 'missile') {
    const dir = new THREE.Vector3(Math.sin(racer.heading), 0, Math.cos(racer.heading));
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 8), new THREE.MeshStandardMaterial({ color: 0xff5533, emissive: 0xff2200 }));
    mesh.position.copy(racer.mesh.position).add(dir.multiplyScalar(3));
    scene.add(mesh);
    game.projectiles.push({ owner: racer, mesh, vel: dir.multiplyScalar(95), life: 2.3 });
    playTone(250, 0.06, 'square', 0.08);
  } else if (racer.item === 'trap') {
    const mesh = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.2, 7), new THREE.MeshStandardMaterial({ color: 0x772200 }));
    mesh.position.copy(racer.mesh.position);
    mesh.position.y = 0.7;
    scene.add(mesh);
    game.traps.push({ owner: racer, mesh, life: 14 });
  }
  racer.item = null;
}

function updatePlayer(r, dt) {
  const accel = r.kartStats.accel;
  const maxSpeed = r.kartStats.maxSpeed;

  const throttle = keyState.ArrowUp ? 1 : 0;
  const brake = keyState.ArrowDown ? 0.85 : 0;
  const turn = (keyState.ArrowRight ? 1 : 0) - (keyState.ArrowLeft ? 1 : 0);

  if (!game.started) {
    if (throttle) r.startBoostFrames += 1;
    return;
  }

  r.speed += throttle * accel * dt;
  r.speed -= brake * accel * 1.3 * dt;
  r.speed -= 10 * dt;

  if (Math.abs(turn) > 0.1 && throttle > 0 && r.speed > 24) {
    r.drifting = true;
    r.driftCharge = Math.min(r.driftCharge + dt, 1.4);
  } else if (r.drifting) {
    if (r.driftCharge > 0.4) r.boost = Math.max(r.boost, 0.6 + r.driftCharge * 0.8);
    r.drifting = false;
    r.driftCharge = 0;
    playTone(500, 0.04, 'triangle', 0.07);
  }

  const handling = r.kartStats.handling * (r.drifting ? 1.4 : 1);
  r.steer = THREE.MathUtils.lerp(r.steer, turn, 7 * dt);
  r.heading += r.steer * handling * dt * (r.speed / 40);

  if (r.boost > 0) {
    r.speed += 34 * dt;
    r.boost -= dt;
    spawnSpeedParticle(r.mesh.position.clone(), 0x8de4ff);
  }

  r.speed = THREE.MathUtils.clamp(r.speed, 0, maxSpeed + 20);
  const velocity = new THREE.Vector3(Math.sin(r.heading), 0, Math.cos(r.heading)).multiplyScalar(r.speed * dt);
  r.mesh.position.add(velocity);
  r.mesh.rotation.y = r.heading;

  if (keyState.Space) {
    consumeItem(r);
    keyState.Space = false;
  }

  playTone(120 + r.speed * 3, 0.012, 'sawtooth', 0.016);
}

function updateAI(r, dt) {
  if (!game.started || r.finished) return;
  const wp = tracks[game.selectedTrack].waypoints;
  const target = wp[r.nextWp];
  const toTarget = target.clone().sub(r.mesh.position);
  if (toTarget.length() < 7) r.nextWp = (r.nextWp + 1) % wp.length;

  const desired = Math.atan2(toTarget.x, toTarget.z);
  const delta = THREE.MathUtils.euclideanModulo(desired - r.heading + Math.PI, Math.PI * 2) - Math.PI;
  r.heading += THREE.MathUtils.clamp(delta, -1, 1) * r.kartStats.handling * dt * 0.82;
  const targetSpeed = r.kartStats.maxSpeed * (0.75 + Math.random() * 0.18);
  r.speed = THREE.MathUtils.lerp(r.speed, targetSpeed, dt * 0.85);

  if (Math.random() < dt * 0.22 && r.item) consumeItem(r);
  if (r.boost > 0) {
    r.speed += 26 * dt;
    r.boost -= dt;
    spawnSpeedParticle(r.mesh.position.clone(), 0xfff89a);
  }

  const velocity = new THREE.Vector3(Math.sin(r.heading), 0, Math.cos(r.heading)).multiplyScalar(r.speed * dt);
  r.mesh.position.add(velocity);
  r.mesh.rotation.y = r.heading;
}

function spawnSpeedParticle(pos, color) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.28, 6, 6), new THREE.MeshBasicMaterial({ color, transparent: true }));
  mesh.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 1.6, 1.4, (Math.random() - 0.5) * 1.6));
  scene.add(mesh);
  game.particles.push({ mesh, life: 0.35 });
}

function updateProjectiles(dt) {
  game.projectiles = game.projectiles.filter((p) => {
    p.mesh.position.addScaledVector(p.vel, dt);
    p.life -= dt;
    let hit = false;
    game.racers.forEach((r) => {
      if (r === p.owner) return;
      if (r.mesh.position.distanceTo(p.mesh.position) < 2.4) {
        r.speed *= 0.42;
        r.boost = 0;
        hit = true;
        playTone(90, 0.15, 'square', 0.09);
        for (let i = 0; i < 14; i++) spawnSpeedParticle(r.mesh.position, 0xff5533);
      }
    });
    if (p.life <= 0 || hit) {
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
      if (r.mesh.position.distanceTo(t.mesh.position) < 2.2) {
        r.speed *= 0.35;
        t.life = -1;
        playTone(70, 0.2, 'triangle', 0.1);
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
    p.mesh.position.y += dt * 5;
    p.mesh.material.opacity = p.life / 0.35;
    if (p.life <= 0) {
      scene.remove(p.mesh);
      return false;
    }
    return true;
  });
}

function updateItemBoxes(dt) {
  game.itemBoxes.forEach((box) => {
    box.rotation.x += dt;
    box.rotation.y += dt * 1.2;
    box.userData.cooldown = Math.max(0, box.userData.cooldown - dt);
    box.visible = box.userData.cooldown <= 0;

    if (!box.visible) return;
    game.racers.forEach((r) => {
      if (!r.item && r.mesh.position.distanceTo(box.position) < 2.3) {
        r.item = ['boost', 'missile', 'trap', 'turbo'][Math.floor(Math.random() * 4)];
        box.userData.cooldown = 4;
        playTone(650, 0.06, 'triangle', 0.09);
      }
    });
  });
}

function updateCollisions() {
  const r = game.racers;
  for (let i = 0; i < r.length; i++) {
    for (let j = i + 1; j < r.length; j++) {
      const d = r[i].mesh.position.distanceTo(r[j].mesh.position);
      if (d < 2.2) {
        const push = r[i].mesh.position.clone().sub(r[j].mesh.position).normalize().multiplyScalar((2.2 - d) * 0.6);
        r[i].mesh.position.add(push);
        r[j].mesh.position.sub(push);
        r[i].speed *= 0.98;
        r[j].speed *= 0.98;
      }
    }
  }
}

function updateRaceProgress() {
  const wp = tracks[game.selectedTrack].waypoints;
  const total = wp.length;

  game.racers.forEach((r) => {
    const target = wp[r.nextWp];
    if (r.mesh.position.distanceTo(target) < 6) {
      r.nextWp = (r.nextWp + 1) % total;
      r.distanceDone += 1;
      if (r.nextWp === 1) {
        r.lap += 1;
        if (r.lap > 3 && !r.finished) {
          r.finished = true;
          if (r.isPlayer) {
            game.finished = true;
            ui.result.classList.remove('hidden');
            ui.hud.classList.add('hidden');
          }
        }
      }
    }
  });

  const ranking = [...game.racers].sort((a, b) => (b.lap * 1000 + b.distanceDone) - (a.lap * 1000 + a.distanceDone));
  const playerPos = ranking.findIndex((r) => r.isPlayer) + 1;
  const player = game.racers[0];
  ui.position.textContent = `Position: ${playerPos}/8`;
  ui.lap.textContent = `Tour: ${Math.min(player.lap, 3)}/3`;
}

function updateHUD() {
  const p = game.racers[0];
  ui.speed.textContent = `Vitesse: ${Math.round(p.speed * 3.2)} km/h`;
  ui.item.textContent = `Bonus: ${p.item ? p.item.toUpperCase() : 'Aucun'}`;
  const t = game.raceTime;
  const mins = String(Math.floor(t / 60)).padStart(2, '0');
  const secs = String(Math.floor(t % 60)).padStart(2, '0');
  const ms = String(Math.floor((t % 1) * 1000)).padStart(3, '0');
  ui.chrono.textContent = `Temps: ${mins}:${secs}.${ms}`;
}

function updateCamera(dt) {
  const p = game.racers[0];
  if (!p) return;
  const desired = p.mesh.position.clone().add(new THREE.Vector3(Math.sin(p.heading) * -12, 8, Math.cos(p.heading) * -12));
  camera.position.lerp(desired, dt * 5);
  camera.lookAt(p.mesh.position.x, p.mesh.position.y + 2.5, p.mesh.position.z);
}

function tick() {
  const dt = Math.min(clock.getDelta(), 0.033);
  if (game.state === 'racing') {
    if (!game.started) {
      game.countdown -= dt;
      const cd = Math.ceil(game.countdown);
      if (cd > 0) ui.countdown.textContent = String(cd);
      else if (cd === 0) ui.countdown.textContent = 'GO!';
      if (game.countdown <= 0) {
        game.started = true;
        ui.countdown.textContent = '';
        const p = game.racers[0];
        if (p.startBoostFrames > 20 && p.startBoostFrames < 130) p.boost = 2.1;
      }
    } else if (!game.finished) {
      game.raceTime += dt;
    }

    game.racers.forEach((r) => {
      if (r.isPlayer) updatePlayer(r, dt);
      else updateAI(r, dt);
    });

    updateItemBoxes(dt);
    updateCollisions();
    updateProjectiles(dt);
    updateTraps(dt);
    updateParticles(dt);
    updateRaceProgress();
    updateHUD();
    updateCamera(dt);

    if (game.finished) {
      const ranking = [...game.racers].sort((a, b) => (b.lap * 1000 + b.distanceDone) - (a.lap * 1000 + a.distanceDone));
      const playerPos = ranking.findIndex((r) => r.isPlayer) + 1;
      ui.resultText.textContent = `${game.racers[0].name} termine en position #${playerPos} en ${ui.chrono.textContent.replace('Temps: ', '')}`;
    }
  }

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

function fillSelect(select, items) {
  items.forEach((item, idx) => {
    const opt = document.createElement('option');
    opt.value = String(idx);
    opt.textContent = item.name;
    select.appendChild(opt);
  });
}

function initUI() {
  const cSel = document.getElementById('character-select');
  const kSel = document.getElementById('kart-select');
  const tSel = document.getElementById('track-select');
  fillSelect(cSel, characters);
  fillSelect(kSel, karts);
  Object.keys(tracks).forEach((key) => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = tracks[key].name;
    tSel.appendChild(opt);
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
    game.selectedCharacter = Number(cSel.value);
    game.selectedKart = Number(kSel.value);
    game.selectedTrack = tSel.value;
    setupRace();
    ui.setup.classList.add('hidden');
    ui.result.classList.add('hidden');
    ui.hud.classList.remove('hidden');
    ui.countdown.textContent = '3';
    game.state = 'racing';
  };
  document.getElementById('race-again-btn').onclick = () => {
    ui.result.classList.add('hidden');
    ui.setup.classList.remove('hidden');
    game.state = 'menu';
  };
}

document.addEventListener('keydown', (e) => {
  keyState[e.code.replace('Key', '')] = true;
  if (audioCtx.state === 'suspended') audioCtx.resume();
});
document.addEventListener('keyup', (e) => {
  keyState[e.code.replace('Key', '')] = false;
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

initUI();
makeTrack(tracks.city);
tick();
