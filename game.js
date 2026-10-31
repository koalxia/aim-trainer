
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

// SCENE
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111b2b);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

camera.position.set(0, 1.7, 6);
camera.rotation.order = "YXZ";

const renderer = new THREE.WebGLRenderer({
  antialias: true
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

// LIGHTS
scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 2));

const light = new THREE.DirectionalLight(0xffffff, 2);
light.position.set(5, 10, 5);
scene.add(light);

// BUILD THE RANGE
function box(x, y, z, w, h, d, color) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color })
  );
  mesh.position.set(x, y, z);
  scene.add(mesh);
  return mesh;
}

box(0, -0.2, -3, 24, 0.4, 30, 0x253549);
box(0, 6, -3, 24, 0.3, 30, 0x1a2638);
box(0, 3, -12, 24, 6, 0.4, 0x33465d);
box(-12, 3, -3, 0.4, 6, 30, 0x28394f);
box(12, 3, -3, 0.4, 6, 30, 0x28394f);

// FLOOR LINES
for (let x = -10; x <= 10; x += 2) {
  box(x, 0.02, -4, 0.035, 0.035, 14, 0x34617a);
}

for (let z = -10; z <= 10; z += 2) {
  box(0, 0.025, z, 22, 0.03, 0.035, 0x34617a);
}

// TARGET
const target = new THREE.Group();

const outer = new THREE.Mesh(
  new THREE.CylinderGeometry(0.48, 0.48, 0.12, 40),
  new THREE.MeshStandardMaterial({
    color: 0xff3344,
    emissive: 0x550011
  })
);

outer.rotation.x = Math.PI / 2;
target.add(outer);

const middle = new THREE.Mesh(
  new THREE.CylinderGeometry(0.29, 0.29, 0.14, 40),
  new THREE.MeshStandardMaterial({
    color: 0xffffff
  })
);

middle.rotation.x = Math.PI / 2;
middle.position.z = 0.02;
target.add(middle);

const bullseye = new THREE.Mesh(
  new THREE.CylinderGeometry(0.14, 0.14, 0.16, 40),
  new THREE.MeshStandardMaterial({
    color: 0xff3344,
    emissive: 0x770011
  })
);

bullseye.rotation.x = Math.PI / 2;
bullseye.position.z = 0.04;
target.add(bullseye);

scene.add(target);

function moveTarget() {
  target.position.set(
    Math.random() * 10 - 5,
    Math.random() * 3.5 + 1,
    -10.5
  );
}

moveTarget();

// GAME STATE
let score = 0;
let hits = 0;
let shots = 0;
let timeLeft = 60;
let playing = false;
let paused = false;
let yaw = 0;
let pitch = 0;
let countdown = null;
let hitTimeout = null;

const hud = document.getElementById("hud");
const crosshair = document.getElementById("crosshair");
const menu = document.getElementById("menu");
const title = document.getElementById("menuTitle");
const startBtn = document.getElementById("startBtn");
const result = document.getElementById("result");
const instructions = document.getElementById("instructions");
const hitmarker = document.getElementById("hitmarker");

const raycaster = new THREE.Raycaster();
const center = new THREE.Vector2(0, 0);

function updateHUD() {
  document.getElementById("timer").textContent = timeLeft;
  document.getElementById("score").textContent = score;
  document.getElementById("hits").textContent = hits;

  const accuracy = shots === 0
    ? 0
    : Math.round((hits / shots) * 100);

  document.getElementById("accuracy").textContent =
    accuracy + "%";
}

function lockMouse() {
  renderer.domElement.requestPointerLock();
}

// START
function startGame() {
  clearInterval(countdown);

  score = 0;
  hits = 0;
  shots = 0;
  timeLeft = 60;
  yaw = 0;
  pitch = 0;
  playing = true;
  paused = false;

  camera.rotation.set(0, 0, 0);
  moveTarget();
  updateHUD();

  hud.style.display = "flex";
  crosshair.style.display = "block";
  menu.style.display = "none";

  lockMouse();

  countdown = setInterval(() => {
    if (!playing || paused) return;

    timeLeft--;
    updateHUD();

    if (timeLeft <= 0) {
      endGame();
    }
  }, 1000);
}

startBtn.addEventListener("click", () => {
  if (playing && paused) {
    lockMouse();
  } else if (!playing) {
    startGame();
  }
});

// LOOK AROUND
document.addEventListener("mousemove", (event) => {
  if (!playing || paused) return;
  if (document.pointerLockElement !== renderer.domElement) return;

  const sensitivity = 0.002;

  yaw -= event.movementX * sensitivity;
  pitch -= event.movementY * sensitivity;

  pitch = THREE.MathUtils.clamp(
    pitch,
    -Math.PI / 2,
    Math.PI / 2
  );

  camera.rotation.y = yaw;
  camera.rotation.x = pitch;
});

// SHOOT
document.addEventListener("mousedown", (event) => {
  if (event.button !== 0 || !playing || paused) return;
  if (document.pointerLockElement !== renderer.domElement) return;

  shots++;

  raycaster.setFromCamera(center, camera);
  const intersections = raycaster.intersectObject(target, true);

  if (intersections.length > 0) {
    hits++;
    score += 100;
    moveTarget();

    hitmarker.style.opacity = "1";
    clearTimeout(hitTimeout);

    hitTimeout = setTimeout(() => {
      hitmarker.style.opacity = "0";
    }, 180);
  }

  updateHUD();
});

// PAUSE / RESUME
document.addEventListener("pointerlockchange", () => {
  if (!playing) return;

  if (document.pointerLockElement === renderer.domElement) {
    paused = false;
    menu.style.display = "none";
  } else {
    paused = true;
    menu.style.display = "flex";
    title.textContent = "PAUSED";
    startBtn.textContent = "RESUME";
    instructions.style.display = "none";
    result.textContent = "Press Resume to keep training.";
  }
});

// END
function endGame() {
  playing = false;
  paused = false;
  clearInterval(countdown);

  if (document.pointerLockElement === renderer.domElement) {
    document.exitPointerLock();
  }

  hud.style.display = "none";
  crosshair.style.display = "none";
  menu.style.display = "flex";

  title.textContent = "TRAINING COMPLETE";
  instructions.style.display = "none";
  startBtn.textContent = "PLAY AGAIN";

  const accuracy = shots === 0
    ? 0
    : Math.round((hits / shots) * 100);

  result.innerHTML =
    "SCORE: " + score +
    "<br>HITS: " + hits +
    "<br>SHOTS: " + shots +
    "<br>ACCURACY: " + accuracy + "%";
}

// ANIMATION
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

animate();

// RESIZE
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
