import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

const $ = id => document.getElementById(id);

const screens = ["home", "modes", "settings", "pause", "results"];

const modeNames = {
  targets: "STATIC TARGETS",
  dummies: "STATIC DUMMIES",
  moving: "MOVING DUMMIES"
};

let mode = "targets";
let running = false;
let paused = false;
let score = 0;
let hits = 0;
let shots = 0;
let timeLeft = 60;
let timer = null;
let sensitivity = 1.5;
let soundEnabled = true;
let yaw = 0;
let pitch = 0;
let recoil = 0;
let flashTime = 0;
let movementTime = 0;
let audioContext = null;
let hitTimeout = null;

const keys = new Set();
const targets = [];
const targetZoneZ = -28;

const clock = new THREE.Clock();

// -----------------------------------------------------
// SCENE
// -----------------------------------------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe8b27a);
scene.fog = new THREE.Fog(0xe8b27a, 35, 110);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.05,
  250
);
camera.rotation.order = "YXZ";
camera.position.set(0, 1.75, 10);

const renderer = new THREE.WebGLRenderer({
  antialias: true
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

$("game").appendChild(renderer.domElement);

// -----------------------------------------------------
// LIGHTING
// -----------------------------------------------------
const hemi = new THREE.HemisphereLight(0xfff0d8, 0xb98259, 1.8);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff4d6, 2.8);
sun.position.set(18, 28, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -55;
sun.shadow.camera.right = 55;
sun.shadow.camera.top = 55;
sun.shadow.camera.bottom = -55;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 130;
scene.add(sun);

// -----------------------------------------------------
// HELPERS
// -----------------------------------------------------
function material(color, metalness = 0, roughness = 0.8) {
  return new THREE.MeshStandardMaterial({
    color,
    metalness,
    roughness
  });
}

function addBox(parent, x, y, z, w, h, d, mat, cast = false, receive = true) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    mat
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  parent.add(mesh);
  return mesh;
}

function addCylinder(parent, x, y, z, rt, rb, h, seg, mat, rotX = 0, rotY = 0, rotZ = 0, cast = false, receive = true) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(rt, rb, h, seg),
    mat
  );
  mesh.position.set(x, y, z);
  mesh.rotation.set(rotX, rotY, rotZ);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  parent.add(mesh);
  return mesh;
}

function addSphere(parent, x, y, z, r, mat, cast = false, receive = true) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(r, 20, 16),
    mat
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  parent.add(mesh);
  return mesh;
}

// -----------------------------------------------------
// ENVIRONMENT
// -----------------------------------------------------
const sandMat = material(0xc9a173, 0, 1);
const darkSandMat = material(0xae845b, 0, 1);
const wallMat = material(0xd6b08a, 0, 1);
const shadowWallMat = material(0xbb9671, 0, 1);
const woodMat = material(0x7f5f43, 0.05, 0.95);
const metalMat = material(0x555e67, 0.7, 0.35);
const blackMetalMat = material(0x1b1f23, 0.8, 0.28);
const concreteMat = material(0xb79a79, 0, 1);

// large ground
addBox(scene, 0, -0.2, -10, 220, 0.4, 220, sandMat, false, true);

// shooting lane
addBox(scene, 0, -0.05, -5, 18, 0.12, 72, darkSandMat, false, true);

// side barriers
addBox(scene, -9.8, 1.5, -10, 0.55, 3, 75, concreteMat);
addBox(scene, 9.8, 1.5, -10, 0.55, 3, 75, concreteMat);

// low curb
addBox(scene, 0, 0.15, 26, 22, 0.2, 1, concreteMat);

// target back wall
addBox(scene, 0, 5.5, targetZoneZ - 2.6, 24, 11, 0.6, wallMat);

// simple buildings inspired by screenshot
function rangeBuilding(x, z, w, h, d) {
  const g = new THREE.Group();
  addBox(g, 0, h / 2, 0, w, h, d, shadowWallMat);
  addBox(g, 0, h + 0.2, 0, w + 0.5, 0.35, d + 0.4, wallMat);

  // cut-out windows
  addBox(g, -w * 0.25, h * 0.55, d * 0.51, w * 0.18, h * 0.35, 0.05, material(0xe1bc95));
  addBox(g, w * 0.12, h * 0.48, d * 0.51, w * 0.2, h * 0.28, 0.05, material(0xe1bc95));
  addBox(g, 0.1, h * 0.28, d * 0.51, w * 0.22, h * 0.42, 0.05, material(0xe1bc95));

  g.position.set(x, 0, z);
  scene.add(g);
}
rangeBuilding(-20, -30, 10, 8, 8);
rangeBuilding(19, -34, 13, 9, 10);
rangeBuilding(27, -20, 8, 7, 7);
rangeBuilding(-30, -15, 9, 6, 8);

// crates and platforms
function makePlatform(x, y, z, w, h, d, plankCount = 4) {
  const group = new THREE.Group();

  addBox(group, 0, 0, 0, w, h, d, concreteMat);
  for (let i = 0; i < plankCount; i++) {
    const px = -w / 2 + (w / plankCount) * i + (w / plankCount) / 2;
    addBox(group, px, h / 2 + 0.06, 0, w / plankCount - 0.12, 0.08, d, woodMat);
  }

  group.position.set(x, y, z);
  scene.add(group);
  return group;
}

makePlatform(0, 0.5, targetZoneZ + 0.8, 10, 1, 4.5, 5);
makePlatform(-7.5, 0.35, targetZoneZ + 4.5, 5.5, 0.7, 3, 4);
makePlatform(7.5, 0.35, targetZoneZ + 4.5, 5.5, 0.7, 3, 4);

function crate(x, y, z, s = 1) {
  addBox(scene, x, y + s / 2, z, s, s, s, woodMat);
}
crate(-6.4, 0, targetZoneZ + 7.5, 1.2);
crate(-5.1, 0, targetZoneZ + 7.3, 1.05);
crate(5.7, 0, targetZoneZ + 6.9, 1.15);

// poles
for (let i = -2; i <= 2; i++) {
  addBox(scene, i * 4.2, 1.45, targetZoneZ + 2.5, 0.09, 2.9, 0.09, metalMat, false, true);
}

// -----------------------------------------------------
// GUN
// -----------------------------------------------------
const gun = new THREE.Group();
camera.add(gun);
scene.add(camera);

const gunFrameMat = material(0x111317, 0.85, 0.32);
const gunSlideMat = material(0x2a3138, 0.95, 0.22);
const gunGripMat = material(0x3d312b, 0.2, 0.92);
const gunSilverMat = material(0xb3bcc5, 1, 0.25);
const gunSightMat = material(0x090c0f, 0.9, 0.22);

// slide
addBox(gun, 0.36, -0.19, -0.78, 0.24, 0.15, 0.88, gunSlideMat, true, true);
// frame
addBox(gun, 0.36, -0.30, -0.63, 0.19, 0.12, 0.52, gunFrameMat, true, true);
// dust cover
addBox(gun, 0.36, -0.27, -0.96, 0.16, 0.08, 0.24, gunFrameMat, true, true);
// barrel opening
addCylinder(gun, 0.36, -0.18, -1.23, 0.035, 0.035, 0.05, 20, gunSilverMat, Math.PI / 2, 0, 0, true);
// grip
const grip = addBox(gun, 0.36, -0.53, -0.47, 0.15, 0.38, 0.18, gunGripMat, true, true);
grip.rotation.x = -0.28;
// mag base
addBox(gun, 0.36, -0.72, -0.43, 0.17, 0.03, 0.16, gunFrameMat, true, true);
// trigger guard
addCylinder(gun, 0.36, -0.41, -0.62, 0.08, 0.08, 0.03, 18, gunFrameMat, 0, 0, Math.PI / 2, true);
addBox(gun, 0.36, -0.40, -0.59, 0.06, 0.05, 0.03, gunFrameMat, true, true);
// trigger
addCylinder(gun, 0.36, -0.43, -0.59, 0.015, 0.015, 0.06, 14, gunSilverMat, 0, 0, Math.PI / 2, true);
// sights
addBox(gun, 0.36, -0.09, -0.44, 0.08, 0.04, 0.03, gunSightMat, true, true);
addBox(gun, 0.36, -0.09, -1.10, 0.05, 0.03, 0.04, gunSightMat, true, true);
// slide serrations
for (let i = 0; i < 5; i++) {
  addBox(gun, 0.28, -0.19, -0.46 - i * 0.045, 0.01, 0.11, 0.018, gunSilverMat);
  addBox(gun, 0.44, -0.19, -0.46 - i * 0.045, 0.01, 0.11, 0.018, gunSilverMat);
}
// ejection port look
addBox(gun, 0.36, -0.16, -0.68, 0.11, 0.02, 0.14, gunSilverMat, false, true);

gun.position.set(0.08, -0.02, 0.02);
gun.rotation.set(-0.02, -0.07, 0);

// muzzle flash
const muzzleFlash = new THREE.Mesh(
  new THREE.ConeGeometry(0.14, 0.34, 8),
  new THREE.MeshBasicMaterial({
    color: 0xffde91,
    transparent: true,
    opacity: 0.95
  })
);
muzzleFlash.rotation.x = -Math.PI / 2;
muzzleFlash.position.set(0.36, -0.18, -1.42);
muzzleFlash.visible = false;
gun.add(muzzleFlash);

// -----------------------------------------------------
// TARGETS / DUMMIES
// -----------------------------------------------------
const dummyWhiteMat = material(0xf4ebdf, 0, 1);
const ringRedMat = material(0xd95136, 0, 0.95);
const standMat = material(0x65492f, 0.05, 0.95);
const baseMat = material(0x514a43, 0.25, 0.8);
const targetGreenMat = material(0xbfdc6b, 0, 0.9);

function addBullseye(parent, x, y, z, scale = 1) {
  const ring1 = addCylinder(parent, x, y, z, 0.26 * scale, 0.26 * scale, 0.04, 32, ringRedMat, Math.PI / 2);
  const ring2 = addCylinder(parent, x, y, z + 0.01, 0.17 * scale, 0.17 * scale, 0.042, 32, dummyWhiteMat, Math.PI / 2);
  const ring3 = addCylinder(parent, x, y, z + 0.02, 0.11 * scale, 0.11 * scale, 0.044, 32, ringRedMat, Math.PI / 2);
  const ring4 = addCylinder(parent, x, y, z + 0.03, 0.055 * scale, 0.055 * scale, 0.046, 32, dummyWhiteMat, Math.PI / 2);
  const ring5 = addCylinder(parent, x, y, z + 0.04, 0.028 * scale, 0.028 * scale, 0.048, 32, ringRedMat, Math.PI / 2);
  return [ring1, ring2, ring3, ring4, ring5];
}

function buildRoundTarget() {
  const group = new THREE.Group();

  const pole1 = addBox(group, -0.18, 1.0, 0, 0.07, 2, 0.07, standMat, false, true);
  const pole2 = addBox(group, 0.18, 1.0, 0, 0.07, 2, 0.07, standMat, false, true);
  const topBar = addBox(group, 0, 1.97, 0, 0.5, 0.08, 0.08, standMat);
  const plate = addCylinder(group, 0, 1.55, 0.03, 0.42, 0.42, 0.10, 40, targetGreenMat, Math.PI / 2, 0, 0, true, true);
  addBullseye(group, 0, 1.55, 0.08, 0.9);
  const foot = addBox(group, 0, 0.1, 0, 0.82, 0.2, 0.34, baseMat);
  group.userData.hitPart = plate;
  return group;
}

function createSilhouetteShape() {
  const shape = new THREE.Shape();

  shape.moveTo(-0.44, -1.10);
  shape.lineTo(-0.44, 0.26);
  shape.quadraticCurveTo(-0.43, 0.66, -0.18, 0.74);
  shape.bezierCurveTo(-0.13, 1.18, 0.13, 1.18, 0.18, 0.74);
  shape.quadraticCurveTo(0.43, 0.66, 0.44, 0.26);
  shape.lineTo(0.44, -1.10);
  shape.lineTo(-0.44, -1.10);

  return shape;
}

function buildSilhouetteDummy() {
  const group = new THREE.Group();

  const base = addBox(group, 0, 0.08, 0, 0.82, 0.16, 0.36, baseMat);
  const stand = addBox(group, 0, 0.72, 0, 0.12, 1.28, 0.10, standMat);

  const shape = createSilhouetteShape();
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: 0.10,
    bevelEnabled: false
  });

  const board = new THREE.Mesh(geom, dummyWhiteMat);
  board.position.set(0, 1.55, -0.05);
  board.castShadow = true;
  board.receiveShadow = true;
  group.add(board);

  addBullseye(group, 0, 1.55, 0.07, 1.15); // chest
  addBullseye(group, 0, 2.36, 0.07, 0.75); // head

  group.userData.hitPart = board;
  return group;
}

function clearTargets() {
  for (const target of targets) {
    scene.remove(target);
    target.traverse(child => {
      if (child.isMesh && child.geometry) child.geometry.dispose();
    });
  }
  targets.length = 0;
}

function reposition(target, index = 0) {
  if (mode === "targets") {
    const lanes = [-6, 0, 6];
    target.position.x = lanes[index % lanes.length] + (Math.random() * 1.2 - 0.6);
    target.position.y = 0;
    target.position.z = targetZoneZ + (Math.random() * 2 - 1.4);
  } else {
    const lanes = [-6, 0, 6];
    target.position.x = lanes[index % lanes.length] + (Math.random() * 1.0 - 0.5);
    target.position.y = 0;
    target.position.z = targetZoneZ + (Math.random() * 2 - 0.8);
  }

  target.userData.anchor = target.position.x;
  target.userData.phase = Math.random() * Math.PI * 2;
  target.userData.speed = 0.9 + Math.random() * 0.8;
}

function spawnTargets() {
  clearTargets();

  const count = mode === "targets" ? 3 : 3;

  for (let i = 0; i < count; i++) {
    let t;
    if (mode === "targets") {
      t = buildRoundTarget();
    } else {
      t = buildSilhouetteDummy();
    }

    t.userData.isTarget = true;
    reposition(t, i);

    scene.add(t);
    targets.push(t);
  }
}

// -----------------------------------------------------
// UI / HUD
// -----------------------------------------------------
function updateHUD() {
  $("time").textContent = timeLeft;
  $("score").textContent = String(score).padStart(4, "0");

  const accuracy = shots ? Math.round((hits / shots) * 100) : 0;
  $("accuracy").textContent = accuracy + "%";
  $("hits").textContent = hits + " / " + shots;
}

function showScreen(name) {
  for (const screen of screens) {
    $(screen).classList.toggle("hidden", screen !== name);
  }
  $("overlay").classList.remove("hidden");
  $("hud").classList.add("hidden");
}

function lockMouse() {
  renderer.domElement.requestPointerLock();
}

// -----------------------------------------------------
// GAME CONTROL
// -----------------------------------------------------
function startGame(selectedMode = mode) {
  mode = selectedMode;

  score = 0;
  hits = 0;
  shots = 0;
  timeLeft = Number($("duration").value);

  yaw = 0;
  pitch = 0;
  recoil = 0;
  flashTime = 0;
  movementTime = 0;

  camera.position.set(0, 1.75, 10);
  camera.rotation.set(0, 0, 0);

  gun.position.set(0.08, -0.02, 0.02);
  gun.rotation.set(-0.02, -0.07, 0);

  keys.clear();
  spawnTargets();
  updateHUD();

  $("hudMode").textContent = modeNames[mode];

  running = true;
  paused = true;

  clearInterval(timer);
  lockMouse();
}

function finishGame() {
  running = false;
  paused = false;
  clearInterval(timer);
  keys.clear();

  if (document.pointerLockElement === renderer.domElement) {
    document.exitPointerLock();
  }

  $("finalScore").textContent = score;
  $("finalAccuracy").textContent =
    (shots ? Math.round((hits / shots) * 100) : 0) + "%";
  $("finalHits").textContent = hits + " / " + shots;
  $("resultMode").textContent = modeNames[mode];

  showScreen("results");
}

function quitGame() {
  running = false;
  paused = false;
  clearInterval(timer);
  keys.clear();

  if (document.pointerLockElement === renderer.domElement) {
    document.exitPointerLock();
  }

  showScreen("home");
}

// -----------------------------------------------------
// SOUND
// -----------------------------------------------------
function playSound(hit) {
  if (!soundEnabled) return;

  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();

    osc.type = hit ? "triangle" : "square";
    osc.frequency.setValueAtTime(hit ? 420 : 160, audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(
      hit ? 1200 : 80,
      audioContext.currentTime + 0.08
    );

    gain.gain.setValueAtTime(hit ? 0.06 : 0.04, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.start();
    osc.stop(audioContext.currentTime + 0.12);
  } catch (error) {
    console.warn("Audio unavailable", error);
  }
}

// -----------------------------------------------------
// SHOOTING
// -----------------------------------------------------
const raycaster = new THREE.Raycaster();
const screenCenter = new THREE.Vector2(0, 0);

function shoot() {
  if (!running || paused) return;
  if (document.pointerLockElement !== renderer.domElement) return;

  shots++;
  recoil = 0.10;
  flashTime = 0.06;

  raycaster.setFromCamera(screenCenter, camera);

  const intersections = raycaster.intersectObjects(targets, true);

  let hit = false;

  if (intersections.length > 0) {
    let object = intersections[0].object;

    while (object.parent && !object.userData.isTarget) {
      object = object.parent;
    }

    if (object.userData.isTarget) {
      hit = true;
      hits++;
      score += 100;

      reposition(object, targets.indexOf(object));

      $("hitmarker").style.opacity = "1";
      clearTimeout(hitTimeout);
      hitTimeout = setTimeout(() => {
        $("hitmarker").style.opacity = "0";
      }, 180);
    }
  }

  playSound(hit);
  updateHUD();
}

// -----------------------------------------------------
// MENU EVENTS
// -----------------------------------------------------
$("playBtn").onclick = () => showScreen("modes");
$("settingsBtn").onclick = () => showScreen("settings");
$("modeBack").onclick = () => showScreen("home");
$("settingsBack").onclick = () => showScreen("home");

$("saveSettings").onclick = () => {
  sensitivity = Number($("sensitivity").value);
  soundEnabled = $("sound").checked;

  document.documentElement.style.setProperty(
    "--reticle",
    $("crosshairColor").value
  );

  showScreen("home");
};

$("sensitivity").oninput = () => {
  $("sensitivityValue").textContent = $("sensitivity").value;
};

document.querySelectorAll(".mode-card").forEach(button => {
  button.onclick = () => startGame(button.dataset.mode);
});

$("resumeBtn").onclick = lockMouse;
$("restartBtn").onclick = () => startGame(mode);
$("quitBtn").onclick = quitGame;
$("againBtn").onclick = () => startGame(mode);
$("homeBtn").onclick = quitGame;

// -----------------------------------------------------
// POINTER LOCK / PAUSE
// -----------------------------------------------------
document.addEventListener("pointerlockchange", () => {
  if (!running) return;

  if (document.pointerLockElement === renderer.domElement) {
    paused = false;
    $("overlay").classList.add("hidden");
    $("hud").classList.remove("hidden");

    clearInterval(timer);
    timer = setInterval(() => {
      if (!running || paused) return;

      timeLeft--;
      updateHUD();

      if (timeLeft <= 0) {
        finishGame();
      }
    }, 1000);
  } else {
    paused = true;
    clearInterval(timer);
    showScreen("pause");
  }
});

// -----------------------------------------------------
// INPUT
// -----------------------------------------------------
document.addEventListener("mousemove", event => {
  if (!running || paused) return;
  if (document.pointerLockElement !== renderer.domElement) return;

  yaw -= event.movementX * 0.0013 * sensitivity;
  pitch -= event.movementY * 0.0013 * sensitivity;

  pitch = THREE.MathUtils.clamp(pitch, -1.15, 1.15);
  camera.rotation.set(pitch, yaw, 0);
});

document.addEventListener("mousedown", event => {
  if (event.button === 0) {
    shoot();
  }
});

document.addEventListener("keydown", event => {
  keys.add(event.code);

  if (["Space", "ArrowUp", "ArrowDown"].includes(event.code)) {
    event.preventDefault();
  }
});

document.addEventListener("keyup", event => {
  keys.delete(event.code);
});

// -----------------------------------------------------
// ANIMATION
// -----------------------------------------------------
function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.05);

  if (running && !paused) {
    movementTime += dt;

    // moving dummy mode
    if (mode === "moving") {
      for (const target of targets) {
        target.position.x =
          target.userData.anchor +
          Math.sin(
            movementTime * target.userData.speed * 1.4 +
            target.userData.phase
          ) * 2.1;

        target.position.x = THREE.MathUtils.clamp(target.position.x, -7.5, 7.5);
      }
    }

    // movement
    const move = new THREE.Vector3();

    if (keys.has("KeyW")) move.z -= 1;
    if (keys.has("KeyS")) move.z += 1;
    if (keys.has("KeyA")) move.x -= 1;
    if (keys.has("KeyD")) move.x += 1;

    if (move.lengthSq() > 0) {
      move.normalize();
      move.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);

      const speed = keys.has("ShiftLeft") ? 7.5 : 4.6;
      camera.position.addScaledVector(move, dt * speed);

      camera.position.x = THREE.MathUtils.clamp(camera.position.x, -8.5, 8.5);
      camera.position.z = THREE.MathUtils.clamp(camera.position.z, 5.5, 18);
    }

    // gun sway / bob
    const isMoving = move.lengthSq() > 0;
    const bob = isMoving ? Math.sin(movementTime * 9) * 0.01 : 0;
    const sway = isMoving ? Math.cos(movementTime * 9) * 0.008 : 0;

    recoil = Math.max(0, recoil - dt * 0.55);

    gun.position.x = 0.08 + sway;
    gun.position.y = -0.02 + bob - recoil * 0.40;
    gun.position.z = 0.02 + recoil * 0.18;

    gun.rotation.x = -0.02 + recoil * 1.2;
    gun.rotation.y = -0.07 + sway * 1.5;
    gun.rotation.z = bob * 1.4;
  }

  flashTime -= dt;
  muzzleFlash.visible = flashTime > 0;

  renderer.render(scene, camera);
}

animate();

// -----------------------------------------------------
// RESIZE
// -----------------------------------------------------
window.addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// -----------------------------------------------------
// START SCREEN
// -----------------------------------------------------
showScreen("home");
