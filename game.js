
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

const $ = id => document.getElementById(id);

const modeNames = {
  targets: "STATIC TARGETS",
  dummies: "STATIC DUMMIES",
  moving: "MOVING DUMMIES"
};

const screens = ["home", "modes", "settings", "pause", "results"];

let mode = "targets";
let playing = false;
let paused = false;
let score = 0;
let hits = 0;
let shots = 0;
let headshots = 0;
let timeLeft = 60;
let timer = null;
let sensitivity = 1.5;
let sounds = true;
let yaw = 0;
let pitch = 0;
let aiming = false;
let weapon = 0;
let ammo = 12;
let reloading = false;
let reloadTimer = null;
let recoil = 0;
let flashTime = 0;
let elapsed = 0;
let audioContext = null;

const keys = new Set();
const targets = [];
const clock = new THREE.Clock();

// THREE.JS SCENE
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe6b27d);
scene.fog = new THREE.Fog(0xd4a577, 50, 170);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  300
);

camera.rotation.order = "YXZ";
camera.position.set(0, 1.75, 10);

const renderer = new THREE.WebGLRenderer({
  antialias: true
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;

$("game").appendChild(renderer.domElement);

// LIGHTING
scene.add(
  new THREE.HemisphereLight(0xffebcb, 0x886348, 2.5)
);

const sun = new THREE.DirectionalLight(0xffedd0, 3);
sun.position.set(-20, 35, 15);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -60;
sun.shadow.camera.right = 60;
sun.shadow.camera.top = 60;
sun.shadow.camera.bottom = -60;
sun.shadow.camera.far = 150;
scene.add(sun);

// MATERIALS
function mat(color, metalness = 0, roughness = 0.8) {
  return new THREE.MeshStandardMaterial({
    color,
    metalness,
    roughness
  });
}

const sand = mat(0xc79c69);
const tan = mat(0xd9b085);
const plaster = mat(0xba926d);
const wood = mat(0x76543a);
const white = mat(0xf1e8d8);
const red = mat(0xd14c38);
const metal = mat(0x292f34, 0.8, 0.3);
const darkMetal = mat(0x111518, 0.8, 0.3);

// GEOMETRY HELPERS
function box(parent, x, y, z, w, h, d, material) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    material
  );

  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);

  return mesh;
}

function cylinder(parent, x, y, z, radius, depth, material) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, depth, 36),
    material
  );

  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  parent.add(mesh);

  return mesh;
}

// DESERT MAP
box(scene, 0, -0.3, -15, 220, 0.6, 220, sand);
box(scene, 0, -0.02, -15, 23, 0.05, 100, mat(0xb78d5f));

function building(x, z, w, h, d) {
  const group = new THREE.Group();

  box(group, 0, h / 2, 0, w, h, d, plaster);
  box(group, 0, h + 0.15, 0, w + 0.5, 0.3, d + 0.5, tan);

  for (let i = -1; i <= 1; i++) {
    box(
      group,
      i * w * 0.27,
      h * 0.65,
      d / 2 + 0.06,
      w * 0.13,
      h * 0.35,
      0.1,
      mat(0x64503d)
    );
  }

  box(
    group, 0, h * 0.25, d / 2 + 0.08,
    w * 0.24, h * 0.5, 0.1, mat(0x67513d)
  );

  group.position.set(x, 0, z);
  scene.add(group);
}

building(-22, -33, 16, 10, 12);
building(23, -38, 19, 12, 13);
building(-27, -14, 12, 7, 10);
building(28, -21, 14, 9, 11);

box(scene, 0, 3, -48, 40, 6, 0.7, plaster);

for (const side of [-1, 1]) {
  box(scene, side * 13, 1.3, -13, 0.6, 2.6, 85, tan);
}

function platform(x, z, width = 6) {
  box(scene, x, 0.3, z, width, 0.6, 3.4, plaster);

  for (let i = 0; i < 6; i++) {
    box(
      scene,
      x - width / 2 + (i + 0.5) * width / 6,
      0.65,
      z,
      width / 6 - 0.06,
      0.1,
      3.2,
      wood
    );
  }
}

platform(-7, -30, 5);
platform(0, -34, 7);
platform(7, -30, 5);

// WOODEN CRATES
for (let i = 0; i < 12; i++) {
  const side = i % 2 ? 1 : -1;

  box(
    scene,
    side * (12 + Math.random() * 5),
    0.5,
    -15 - Math.random() * 28,
    1.3,
    1,
    1.3,
    wood
  );
}

// TARGET RINGS
function disk(parent, x, y, z, radius, material) {
  const mesh = cylinder(
    parent, x, y, z, radius, 0.025, material
  );

  mesh.rotation.x = Math.PI / 2;
  return mesh;
}

function bullseye(parent, x, y, z, scale = 1, zone = "body") {
  const layers = [
    [0.35, red],
    [0.26, white],
    [0.17, red],
    [0.09, white],
    [0.035, red]
  ];

  layers.forEach(([radius, material], i) => {
    const ring = disk(
      parent,
      x,
      y,
      z + i * 0.025,
      radius * scale,
      material
    );

    ring.userData.zone = zone;
  });
}

// ROUND TARGET
function buildTarget() {
  const group = new THREE.Group();

  box(group, 0, 0.1, 0, 0.9, 0.2, 0.5, wood);
  box(group, -0.3, 1, 0, 0.08, 2, 0.1, wood);
  box(group, 0.3, 1, 0, 0.08, 2, 0.1, wood);

  const board = disk(group, 0, 1.65, 0, 0.58, white);
  board.userData.zone = "body";

  bullseye(group, 0, 1.65, 0.05, 1.4);

  return group;
}

// SILHOUETTE PRACTICE DUMMY
function buildDummy() {
  const group = new THREE.Group();

  box(group, 0, 0.1, 0, 0.9, 0.2, 0.45, wood);
  box(group, -0.28, 0.9, 0, 0.08, 1.6, 0.1, wood);
  box(group, 0.28, 0.9, 0, 0.08, 1.6, 0.1, wood);

  const shape = new THREE.Shape();

  shape.moveTo(-0.46, 0);
  shape.lineTo(0.46, 0);
  shape.lineTo(0.46, 1.12);
  shape.quadraticCurveTo(0.4, 1.42, 0.23, 1.5);
  shape.lineTo(0.23, 1.64);
  shape.quadraticCurveTo(0.25, 2.1, 0, 2.1);
  shape.quadraticCurveTo(-0.25, 2.1, -0.23, 1.64);
  shape.lineTo(-0.23, 1.5);
  shape.quadraticCurveTo(-0.4, 1.42, -0.46, 1.12);
  shape.closePath();

  const board = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, {
      depth: 0.08,
      bevelEnabled: true,
      bevelThickness: 0.012,
      bevelSize: 0.012,
      bevelSegments: 1
    }),
    white
  );

  board.position.y = 0.42;
  board.castShadow = true;
  board.userData.zone = "body";
  group.add(board);

  bullseye(group, 0, 1.42, 0.14, 1.2, "body");
  bullseye(group, 0, 2.28, 0.14, 0.65, "head");

  return group;
}

function reposition(target, index) {
  const lanes = [-7, 0, 7];

  target.position.set(
    lanes[index % 3] + (Math.random() - 0.5) * 0.7,
    0,
    -30 - (index % 2) * 4
  );

  target.userData.anchor = target.position.x;
  target.userData.phase = Math.random() * Math.PI * 2;
  target.userData.speed = 0.8 + Math.random() * 0.6;
}

function spawnTargets() {
  targets.forEach(t => scene.remove(t));
  targets.length = 0;

  for (let i = 0; i < 3; i++) {
    const target = mode === "targets"
      ? buildTarget()
      : buildDummy();

    target.userData.isTarget = true;
    reposition(target, i);

    scene.add(target);
    targets.push(target);
  }
}

// FIRST-PERSON WEAPONS
const gun = new THREE.Group();
camera.add(gun);
scene.add(camera);

// PISTOL
const pistol = new THREE.Group();
gun.add(pistol);

const slide = mat(0x363d43, 0.95, 0.25);
const gripMaterial = mat(0x292e32, 0.2, 0.8);
const silver = mat(0x9ca5ab, 0.95, 0.2);

box(pistol, 0.32, -0.29, -0.8, 0.24, 0.17, 0.9, slide);
box(pistol, 0.32, -0.4, -0.6, 0.2, 0.13, 0.5, metal);

const grip = box(
  pistol, 0.32, -0.61, -0.44,
  0.17, 0.39, 0.2, gripMaterial
);

grip.rotation.x = -0.25;

box(pistol, 0.32, -0.81, -0.42, 0.19, 0.04, 0.2, metal);
box(pistol, 0.32, -0.21, -0.43, 0.08, 0.05, 0.04, darkMetal);
box(pistol, 0.32, -0.19, -1.13, 0.05, 0.04, 0.04, darkMetal);

for (let i = 0; i < 7; i++) {
  box(
    pistol,
    0.19,
    -0.29,
    -0.45 - i * 0.05,
    0.01,
    0.11,
    0.014,
    darkMetal
  );

  box(
    pistol,
    0.45,
    -0.29,
    -0.45 - i * 0.05,
    0.01,
    0.11,
    0.014,
    darkMetal
  );
}

box(pistol, 0.32, -0.27, -0.75, 0.12, 0.02, 0.19, darkMetal);

const barrel = cylinder(
  pistol, 0.32, -0.3, -1.26, 0.065, 0.06, metal
);

barrel.rotation.x = Math.PI / 2;

// SNIPER
const sniper = new THREE.Group();
gun.add(sniper);
sniper.visible = false;

box(sniper, 0.3, -0.28, -1.1, 0.22, 0.2, 1.3, metal);
box(sniper, 0.3, -0.4, -0.4, 0.2, 0.2, 0.8, gripMaterial);
box(sniper, 0.3, -0.62, -0.7, 0.16, 0.4, 0.2, gripMaterial);

const sniperBarrel = cylinder(
  sniper, 0.3, -0.25, -2.05, 0.055, 1.5, metal
);

sniperBarrel.rotation.x = Math.PI / 2;

const sniperMuzzle = cylinder(
  sniper, 0.3, -0.25, -2.86, 0.08, 0.3, darkMetal
);

sniperMuzzle.rotation.x = Math.PI / 2;

const scopeModel = cylinder(
  sniper, 0.3, -0.02, -1.04, 0.12, 0.7, darkMetal
);

scopeModel.rotation.x = Math.PI / 2;

box(sniper, 0.3, -0.14, -1.04, 0.1, 0.13, 0.22, metal);

// MUZZLE FLASH
const muzzleFlash = new THREE.Mesh(
  new THREE.ConeGeometry(0.13, 0.38, 8),
  new THREE.MeshBasicMaterial({
    color: 0xffdd83,
    transparent: true,
    opacity: 0.95
  })
);

muzzleFlash.rotation.x = -Math.PI / 2;
muzzleFlash.position.set(0.32, -0.3, -1.5);
muzzleFlash.visible = false;
gun.add(muzzleFlash);

const flashLight = new THREE.PointLight(0xffad58, 0, 5);
gun.add(flashLight);

// MENU FUNCTIONS
function showScreen(name) {
  screens.forEach(screen => {
    $(screen).classList.toggle("hidden", screen !== name);
  });

  $("overlay").classList.remove("hidden");
  $("hud").classList.add("hidden");
}

function showGameplay() {
  $("overlay").classList.add("hidden");
  $("hud").classList.remove("hidden");
}

function updateHUD() {
  $("time").textContent = timeLeft;
  $("score").textContent = score;

  $("accuracy").textContent = shots
    ? Math.round(hits / shots * 100) + "%"
    : "0%";

  $("heads").textContent = headshots;
  $("modeLabel").textContent = modeNames[mode];

  $("weaponLabel").textContent =
    (weapon === 0 ? "TACTICAL PISTOL" : "SCOUT SNIPER") +
    " · " +
    (reloading ? "RELOADING" : ammo + " / " + (weapon ? 5 : 12));
}

// FIXED START FUNCTION
function startGame(selectedMode = mode) {
  mode = selectedMode;

  playing = true;
  paused = false;

  score = 0;
  hits = 0;
  shots = 0;
  headshots = 0;

  timeLeft = Number($("duration").value);

  yaw = 0;
  pitch = 0;
  recoil = 0;
  elapsed = 0;

  keys.clear();

  camera.position.set(0, 1.75, 10);
  camera.rotation.set(0, 0, 0);

  selectWeapon(0);
  spawnTargets();
  updateHUD();

  clearInterval(timer);

  // OPEN THE TRAINING SCREEN IMMEDIATELY
  showGameplay();

  timer = setInterval(() => {
    if (!playing || paused) return;

    timeLeft--;
    updateHUD();

    if (timeLeft <= 0) {
      endGame();
    }
  }, 1000);

  lockMouse();
}

function lockMouse() {
  if (!renderer.domElement.requestPointerLock) {
    return;
  }

  try {
    const request = renderer.domElement.requestPointerLock();

    if (request && typeof request.catch === "function") {
      request.catch(() => {
        // Keep gameplay visible if the browser rejects mouse lock.
        if (playing) {
          paused = false;
          showGameplay();
        }
      });
    }
  } catch (error) {
    console.warn("Mouse lock unavailable:", error);
  }
}

function pauseGame() {
  if (!playing) return;

  paused = true;
  aiming = false;

  $("scope").classList.add("hidden");
  $("crosshair").classList.remove("hidden");

  camera.fov = 75;
  camera.updateProjectionMatrix();

  showScreen("pause");
}

function endGame() {
  playing = false;
  paused = false;

  clearInterval(timer);
  clearTimeout(reloadTimer);
  keys.clear();

  if (document.pointerLockElement === renderer.domElement) {
    document.exitPointerLock();
  }

  $("finalScore").textContent = score;

  $("finalAccuracy").textContent = shots
    ? Math.round(hits / shots * 100) + "%"
    : "0%";

  $("finalHeads").textContent = headshots;
  $("finalMode").textContent = modeNames[mode];

  showScreen("results");
}

function quitGame() {
  playing = false;
  paused = false;

  clearInterval(timer);
  clearTimeout(reloadTimer);
  keys.clear();

  if (document.pointerLockElement === renderer.domElement) {
    document.exitPointerLock();
  }

  showScreen("home");
}

// WEAPON SYSTEM
function selectWeapon(number) {
  weapon = number;
  ammo = weapon === 0 ? 12 : 5;

  reloading = false;
  aiming = false;

  clearTimeout(reloadTimer);

  pistol.visible = weapon === 0;
  sniper.visible = weapon === 1;

  camera.fov = 75;
  camera.updateProjectionMatrix();

  $("scope").classList.add("hidden");
  $("crosshair").classList.remove("hidden");

  updateHUD();
}

function reload() {
  if (!playing || paused || reloading) return;

  reloading = true;
  updateHUD();

  reloadTimer = setTimeout(() => {
    ammo = weapon === 0 ? 12 : 5;
    reloading = false;
    updateHUD();
  }, weapon === 0 ? 950 : 1450);
}

function ads(enabled) {
  if (!playing || paused) return;

  aiming = enabled;

  camera.fov = aiming
    ? (weapon === 1 ? 18 : 53)
    : 75;

  camera.updateProjectionMatrix();

  $("scope").classList.toggle(
    "hidden",
    !(aiming && weapon === 1)
  );

  $("crosshair").classList.toggle(
    "hidden",
    aiming && weapon === 1
  );
}

// AUDIO
function sound(frequency) {
  if (!sounds) return;

  try {
    if (!audioContext) {
      audioContext = new (
        window.AudioContext || window.webkitAudioContext
      )();
    }

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = "triangle";

    oscillator.frequency.setValueAtTime(
      frequency,
      audioContext.currentTime
    );

    oscillator.frequency.exponentialRampToValueAtTime(
      frequency * 0.4,
      audioContext.currentTime + 0.12
    );

    gain.gain.setValueAtTime(0.07, audioContext.currentTime);

    gain.gain.exponentialRampToValueAtTime(
      0.001,
      audioContext.currentTime + 0.12
    );

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.12);
  } catch (error) {}
}

// SHOOTING
const raycaster = new THREE.Raycaster();
let feedbackTimeout = null;

function showFeedback(message) {
  $("feedback").textContent = message;
  $("feedback").style.opacity = "1";

  clearTimeout(feedbackTimeout);

  feedbackTimeout = setTimeout(() => {
    $("feedback").style.opacity = "0";
  }, 250);
}

function shoot() {
  if (!playing || paused || reloading) return;
  if (document.pointerLockElement !== renderer.domElement) return;

  if (ammo <= 0) {
    reload();
    return;
  }

  ammo--;
  shots++;

  recoil = weapon === 0 ? 0.15 : 0.25;
  flashTime = weapon === 0 ? 0.08 : 0.12;

  muzzleFlash.position.z = weapon === 0 ? -1.5 : -3.1;
  muzzleFlash.position.y = weapon === 0 ? -0.3 : -0.25;

  sound(weapon === 0 ? 150 : 90);

  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  raycaster.far = 200;

  const intersections = raycaster.intersectObjects(targets, true);

  if (intersections.length > 0) {
    const hitObject = intersections[0].object;

    let target = hitObject;

    while (target.parent && !target.userData.isTarget) {
      target = target.parent;
    }

    if (target.userData.isTarget) {
      hits++;

      if (
        hitObject.userData.zone === "head" &&
        mode !== "targets"
      ) {
        headshots++;
        score += 250;
        showFeedback("HEADSHOT +250");
      } else {
        score += 100;
        showFeedback("HIT +100");
      }

      sound(750);
      reposition(target, targets.indexOf(target));
    }
  }

  updateHUD();

  if (ammo <= 0) {
    reload();
  }
}

// BUTTONS
$("playBtn").onclick = () => showScreen("modes");
$("settingsBtn").onclick = () => showScreen("settings");

$("modeBack").onclick = () => showScreen("home");
$("settingsBack").onclick = () => showScreen("home");

$("sens").oninput = () => {
  $("sensOut").textContent = $("sens").value;
};

$("saveBtn").onclick = () => {
  sensitivity = Number($("sens").value);
  sounds = $("sound").checked;

  document.documentElement.style.setProperty(
    "--reticle",
    $("color").value
  );

  showScreen("home");
};

document.querySelectorAll(".mode").forEach(button => {
  button.addEventListener("click", () => {
    startGame(button.dataset.mode);
  });
});

$("resumeBtn").onclick = () => {
  paused = false;
  showGameplay();
  lockMouse();
};

$("restartBtn").onclick = () => startGame(mode);
$("quitBtn").onclick = quitGame;
$("againBtn").onclick = () => startGame(mode);
$("homeBtn").onclick = quitGame;

// POINTER LOCK
document.addEventListener("pointerlockchange", () => {
  if (!playing) return;

  if (document.pointerLockElement === renderer.domElement) {
    paused = false;
    showGameplay();
  } else if (!paused) {
    pauseGame();
  }
});

// MOUSE CONTROLS
document.addEventListener("mousemove", event => {
  if (!playing || paused) return;

  if (document.pointerLockElement !== renderer.domElement) {
    return;
  }

  const multiplier = sensitivity * 0.00135 * (aiming ? 0.55 : 1);

  yaw -= event.movementX * multiplier;
  pitch -= event.movementY * multiplier;

  pitch = THREE.MathUtils.clamp(pitch, -1.3, 1.3);

  camera.rotation.set(pitch, yaw, 0);
});

document.addEventListener("mousedown", event => {
  if (event.button === 0) shoot();
  if (event.button === 2) ads(true);
});

document.addEventListener("mouseup", event => {
  if (event.button === 2) ads(false);
});

document.addEventListener("contextmenu", event => {
  event.preventDefault();
});

// KEYBOARD
document.addEventListener("keydown", event => {
  keys.add(event.code);

  if (event.code === "Space") {
    event.preventDefault();
  }

  if (!playing || paused || event.repeat) return;

  if (event.code === "KeyR") reload();
  if (event.code === "Digit1") selectWeapon(0);
  if (event.code === "Digit2") selectWeapon(1);
});

document.addEventListener("keyup", event => {
  keys.delete(event.code);
});

window.addEventListener("blur", () => {
  keys.clear();
});

// ANIMATION
function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.05);

  if (playing && !paused) {
    elapsed += dt;

    // MOVING DUMMIES
    if (mode === "moving") {
      targets.forEach(target => {
        target.position.x = THREE.MathUtils.clamp(
          target.userData.anchor +
          Math.sin(
            elapsed * target.userData.speed * 1.6 +
            target.userData.phase
          ) * 2.2,
          -9,
          9
        );
      });
    }

    // PLAYER MOVEMENT
    const direction = new THREE.Vector3();

    if (keys.has("KeyW")) direction.z -= 1;
    if (keys.has("KeyS")) direction.z += 1;
    if (keys.has("KeyA")) direction.x -= 1;
    if (keys.has("KeyD")) direction.x += 1;

    if (direction.lengthSq() > 0) {
      direction.normalize();

      direction.applyAxisAngle(
        new THREE.Vector3(0, 1, 0),
        yaw
      );

      const speed = keys.has("ShiftLeft") ? 7 : 4.5;

      camera.position.addScaledVector(direction, dt * speed);

      camera.position.x = THREE.MathUtils.clamp(
        camera.position.x, -9, 9
      );

      camera.position.z = THREE.MathUtils.clamp(
        camera.position.z, 5, 20
      );
    }

    // GUN ANIMATION
    const bob = direction.lengthSq() > 0
      ? Math.sin(elapsed * 10) * 0.012
      : 0;

    recoil = Math.max(0, recoil - dt * 0.8);

    gun.position.x = aiming ? -0.12 : 0.03;
    gun.position.y = bob - recoil * 0.35;
    gun.position.z = aiming ? -0.1 : 0;

    gun.rotation.x = recoil * 1.2;
    gun.rotation.y = aiming ? 0 : -0.045;

    gun.visible = !(aiming && weapon === 1);
  }

  flashTime -= dt;

  muzzleFlash.visible = flashTime > 0 && gun.visible;
  flashLight.intensity = flashTime > 0 ? 3 : 0;

  renderer.render(scene, camera);
}

animate();

// RESIZE
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
});

// INITIAL MENU
showScreen("home");
