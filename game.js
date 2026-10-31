
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

const keys = new Set();
const targets = [];
const clock = new THREE.Clock();

// CREATE SCENE
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101824);
scene.fog = new THREE.Fog(0x101824, 18, 45);

const camera = new THREE.PerspectiveCamera(
  76,
  window.innerWidth / window.innerHeight,
  0.05,
  90
);

camera.rotation.order = "YXZ";
camera.position.set(0, 1.7, 8);

const renderer = new THREE.WebGLRenderer({
  antialias: true
});

renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;

$("game").appendChild(renderer.domElement);

// LIGHTING
scene.add(new THREE.HemisphereLight(0xabc7e0, 0x354254, 2.2));

const lamp = new THREE.DirectionalLight(0xffffff, 2.2);
lamp.position.set(0, 10, 5);
lamp.castShadow = true;
scene.add(lamp);

// MATERIALS
function material(color, metalness = 0, roughness = 0.75) {
  return new THREE.MeshStandardMaterial({
    color,
    metalness,
    roughness
  });
}

// CREATE BOX
function box(parent, x, y, z, w, h, d, mat) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    mat
  );

  mesh.position.set(x, y, z);
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

// CREATE TRAINING RANGE
const floorMat = material(0x253341);
const wallMat = material(0x263443);
const lineMat = material(0x466071);
const trimMat = material(0x91b1be, 0.5);

box(scene, 0, -0.15, -3, 26, 0.3, 34, floorMat);
box(scene, 0, 6, -3, 26, 0.25, 34, material(0x172430));
box(scene, 0, 3, -14, 26, 6, 0.35, wallMat);
box(scene, -13, 3, -3, 0.35, 6, 34, wallMat);
box(scene, 13, 3, -3, 0.35, 6, 34, wallMat);

// FLOOR GRID
for (let x = -12; x <= 12; x += 2) {
  box(scene, x, 0.015, -3, 0.025, 0.025, 30, lineMat);
}

for (let z = -13; z <= 12; z += 2) {
  box(scene, 0, 0.018, z, 25, 0.025, 0.025, lineMat);
}

// WALL DETAILS
for (let x = -10; x <= 10; x += 5) {
  box(scene, x, 3, -13.75, 0.09, 5.6, 0.1, trimMat);
  box(scene, x, 5.65, -13, 0.65, 0.16, 0.5, material(0xb3e8ff));
}

// CREATE FIRST PERSON GUN
const gun = new THREE.Group();

camera.add(gun);
scene.add(camera);

const gunMetal = material(0x222a32, 0.75, 0.32);
const gunBlack = material(0x11171d, 0.2, 0.55);
const gunGrip = material(0x303a42, 0.1, 0.7);
const gunAccent = material(0x9ca8b1, 0.8, 0.27);

// PISTOL BODY
box(gun, 0.36, -0.31, -0.65, 0.18, 0.16, 0.57, gunMetal);
box(gun, 0.36, -0.395, -0.52, 0.16, 0.11, 0.38, gunBlack);

// HANDLE
const handle = box(
  gun, 0.36, -0.55, -0.41,
  0.13, 0.34, 0.15, gunGrip
);

handle.rotation.x = -0.22;

// PISTOL DETAILS
box(gun, 0.36, -0.23, -0.86, 0.08, 0.04, 0.12, gunAccent);
box(gun, 0.36, -0.27, -0.93, 0.1, 0.09, 0.11, gunBlack);
box(gun, 0.36, -0.43, -0.67, 0.1, 0.035, 0.12, gunAccent);

// MUZZLE FLASH
const muzzleFlash = new THREE.Mesh(
  new THREE.ConeGeometry(0.13, 0.36, 6),
  new THREE.MeshBasicMaterial({
    color: 0xffdd7a,
    transparent: true,
    opacity: 0.9
  })
);

muzzleFlash.rotation.x = -Math.PI / 2;
muzzleFlash.position.set(0.36, -0.27, -1.13);
muzzleFlash.visible = false;

gun.add(muzzleFlash);

// TARGET MATERIALS
const red = material(0xf24a4e);
const white = material(0xe2e8ed);
const lime = material(0xc7ff35);
const dummySkin = material(0xd8a486);
const dummyClothes = material(0x647b91);

// TARGET CIRCLE
function circle(radius, depth, mat) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, depth, 32),
    mat
  );

  mesh.rotation.x = Math.PI / 2;
  return mesh;
}

// BUILD ROUND TARGET
function buildTarget() {
  const group = new THREE.Group();

  group.add(circle(0.5, 0.11, red));

  const middle = circle(0.32, 0.13, white);
  middle.position.z = 0.025;
  group.add(middle);

  const center = circle(0.15, 0.15, lime);
  center.position.z = 0.05;
  group.add(center);

  return group;
}

// BUILD HUMAN-SHAPED DUMMY
function buildDummy() {
  const group = new THREE.Group();

  // TORSO
  const torso = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.36, 0.65, 6, 10),
    dummySkin
  );

  torso.position.y = 0.12;
  group.add(torso);

  // HEAD
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.23, 16, 12),
    dummySkin
  );

  head.position.y = 0.86;
  group.add(head);

  // ARMS
  box(group, -0.43, 0.15, 0, 0.22, 0.84, 0.22, dummyClothes);
  box(group, 0.43, 0.15, 0, 0.22, 0.84, 0.22, dummyClothes);

  // LEGS
  box(group, -0.17, -0.72, 0, 0.24, 0.9, 0.24, dummyClothes);
  box(group, 0.17, -0.72, 0, 0.24, 0.9, 0.24, dummyClothes);

  return group;
}

// REMOVE EXISTING TARGETS
function clearTargets() {
  for (const target of targets) {
    scene.remove(target);

    target.traverse(child => {
      if (child.isMesh) child.geometry.dispose();
    });
  }

  targets.length = 0;
}

// RANDOM TARGET POSITION
function reposition(target) {
  target.position.x = (Math.random() - 0.5) * 14;

  target.position.y = mode === "targets"
    ? 1 + Math.random() * 3.5
    : 1.55;

  target.position.z = -10.8 - Math.random() * 1.1;

  target.userData.anchor = target.position.x;
  target.userData.phase = Math.random() * Math.PI * 2;
  target.userData.speed = 0.8 + Math.random() * 0.9;
}

// SPAWN TARGETS
function spawnTargets() {
  clearTargets();

  const count = mode === "targets"
    ? 3
    : mode === "dummies" ? 4 : 3;

  for (let i = 0; i < count; i++) {
    const target = mode === "targets"
      ? buildTarget()
      : buildDummy();

    target.userData.isTarget = true;

    reposition(target);
    scene.add(target);
    targets.push(target);
  }
}

// UPDATE HUD
function updateHUD() {
  $("time").textContent = timeLeft;
  $("score").textContent = String(score).padStart(4, "0");

  const accuracy = shots
    ? Math.round((hits / shots) * 100)
    : 0;

  $("accuracy").textContent = accuracy + "%";
  $("hits").textContent = hits + " / " + shots;
}

// SHOW MENU SCREEN
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

// START GAME
function startGame(selectedMode = mode) {
  mode = selectedMode;

  score = 0;
  hits = 0;
  shots = 0;

  timeLeft = Number($("duration").value);

  yaw = 0;
  pitch = 0;
  recoil = 0;
  movementTime = 0;

  camera.position.set(0, 1.7, 8);
  camera.rotation.set(0, 0, 0);

  keys.clear();

  spawnTargets();
  updateHUD();

  $("hudMode").textContent = modeNames[mode];

  running = true;
  paused = true;

  clearInterval(timer);
  lockMouse();
}

// END GAME
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

// QUIT GAME
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

// SOUND EFFECTS
function playSound(hit) {
  if (!soundEnabled) return;

  try {
    if (!audioContext) {
      audioContext = new (
        window.AudioContext || window.webkitAudioContext
      )();
    }

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = hit ? "sine" : "triangle";

    oscillator.frequency.setValueAtTime(
      hit ? 740 : 140,
      audioContext.currentTime
    );

    oscillator.frequency.exponentialRampToValueAtTime(
      hit ? 1100 : 65,
      audioContext.currentTime + 0.075
    );

    gain.gain.setValueAtTime(0.08, audioContext.currentTime);

    gain.gain.exponentialRampToValueAtTime(
      0.001,
      audioContext.currentTime + 0.11
    );

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.12);
  } catch (error) {
    console.warn("Sound unavailable", error);
  }
}

// SHOOTING
const raycaster = new THREE.Raycaster();
const screenCenter = new THREE.Vector2(0, 0);
let hitTimeout = null;

function shoot() {
  if (!running || paused) return;

  if (document.pointerLockElement !== renderer.domElement) {
    return;
  }

  shots++;

  recoil = 0.075;
  flashTime = 0.07;

  raycaster.setFromCamera(screenCenter, camera);

  const intersections = raycaster.intersectObjects(
    targets,
    true
  );

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

      reposition(object);

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

// MENU BUTTONS
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

// POINTER LOCK AND PAUSE
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

// MOUSE AIM
document.addEventListener("mousemove", event => {
  if (!running || paused) return;

  if (document.pointerLockElement !== renderer.domElement) {
    return;
  }

  yaw -= event.movementX * 0.0015 * sensitivity;
  pitch -= event.movementY * 0.0015 * sensitivity;

  pitch = THREE.MathUtils.clamp(pitch, -1.35, 1.35);

  camera.rotation.set(pitch, yaw, 0);
});

// LEFT CLICK TO SHOOT
document.addEventListener("mousedown", event => {
  if (event.button === 0) {
    shoot();
  }
});

// MOVEMENT CONTROLS
document.addEventListener("keydown", event => {
  keys.add(event.code);

  if (["Space", "ArrowUp", "ArrowDown"].includes(event.code)) {
    event.preventDefault();
  }
});

document.addEventListener("keyup", event => {
  keys.delete(event.code);
});

// ANIMATION LOOP
function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.05);

  if (running && !paused) {
    movementTime += dt;

    // MOVING DUMMY AI
    if (mode === "moving") {
      for (const target of targets) {
        target.position.x =
          target.userData.anchor +
          Math.sin(
            movementTime * target.userData.speed * 1.5 +
            target.userData.phase
          ) * 1.8;

        target.position.x = THREE.MathUtils.clamp(
          target.position.x,
          -9,
          9
        );
      }
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

      const speed = keys.has("ShiftLeft") ? 7 : 4;

      camera.position.addScaledVector(direction, dt * speed);

      camera.position.x = THREE.MathUtils.clamp(
        camera.position.x,
        -11,
        11
      );

      camera.position.z = THREE.MathUtils.clamp(
        camera.position.z,
        -1,
        11
      );
    }
  }

  // GUN RECOIL
  recoil = Math.max(0, recoil - dt * 0.48);

  gun.position.y = -recoil;
  gun.rotation.x = recoil * 1.5;

  // MUZZLE FLASH
  flashTime -= dt;
  muzzleFlash.visible = flashTime > 0;

  renderer.render(scene, camera);
}

animate();

// RESIZE
window.addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(innerWidth, innerHeight);
});

// INITIAL SCREEN
showScreen("home");
