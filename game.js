
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

// SET UP THE 3D WORLD
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x141d2e);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

camera.position.set(0, 1.7, 6);

const renderer = new THREE.WebGLRenderer({
  antialias: true
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

// LIGHTING
scene.add(new THREE.HemisphereLight(0xffffff, 0x445577, 2));

const light = new THREE.DirectionalLight(0xffffff, 2);
light.position.set(5, 10, 5);
scene.add(light);

// SHOOTING RANGE
function makeBox(x, y, z, w, h, d, color) {
  const object = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color })
  );
  object.position.set(x, y, z);
  scene.add(object);
  return object;
}

// Floor, walls, and ceiling
makeBox(0, -0.2, -3, 24, 0.4, 30, 0x26364b);
makeBox(0, 6, -3, 24, 0.3, 30, 0x202c3d);
makeBox(0, 3, -12, 24, 6, 0.4, 0x34465c);
makeBox(-12, 3, -3, 0.4, 6, 30, 0x28384c);
makeBox(12, 3, -3, 0.4, 6, 30, 0x28384c);

// Decorations
for (let i = -5; i <= 5; i++) {
  makeBox(i * 2, 0.02, -6, 0.06, 0.04, 10, 0x00aacc);
}

// TARGETS
const targetMaterial = new THREE.MeshStandardMaterial({
  color: 0xff3344,
  emissive: 0x660011,
  roughness: 0.4
});

const target = new THREE.Mesh(
  new THREE.SphereGeometry(0.42, 32, 32),
  targetMaterial
);

scene.add(target);

function moveTarget() {
  target.position.set(
    Math.random() * 10 - 5,
    Math.random() * 3.5 + 1,
    -10.5
  );
}

moveTarget();

// GAME VARIABLES
let score = 0;
let shots = 0;
let timeLeft = 60;
let playing = false;
let yaw = 0;
let pitch = 0;
let timerInterval = null;

const hud = document.getElementById("hud");
const menu = document.getElementById("menu");
const startBtn = document.getElementById("startBtn");
const result = document.getElementById("result");
const hitmarker = document.getElementById("hitmarker");

const raycaster = new THREE.Raycaster();
const center = new THREE.Vector2(0, 0);

// START GAME
function startGame() {
  score = 0;
  shots = 0;
  timeLeft = 60;
  yaw = 0;
  pitch = 0;

  camera.rotation.set(0, 0, 0);
  moveTarget();

  document.getElementById("score").textContent = score;
  document.getElementById("timer").textContent = timeLeft;
  document.getElementById("accuracy").textContent = "100%";

  menu.style.display = "none";
  hud.style.display = "block";

  playing = true;

  renderer.domElement.requestPointerLock();

  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (!playing || document.pointerLockElement !== renderer.domElement) {
      return;
    }

    timeLeft--;
    document.getElementById("timer").textContent = timeLeft;

    if (timeLeft <= 0) {
      endGame();
    }
  }, 1000);
}

startBtn.addEventListener("click", startGame);

// MOUSE AIMING
document.addEventListener("mousemove", (event) => {
  if (!playing) return;
  if (document.pointerLockElement !== renderer.domElement) return;

  const sensitivity = 0.002;

  yaw -= event.movementX * sensitivity;
  pitch -= event.movementY * sensitivity;

  pitch = Math.max(
    -Math.PI / 2,
    Math.min(Math.PI / 2, pitch)
  );

  camera.rotation.order = "YXZ";
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;
});

// SHOOTING
document.addEventListener("mousedown", (event) => {
  if (event.button !== 0 || !playing) return;
  if (document.pointerLockElement !== renderer.domElement) return;

  shots++;

  raycaster.setFromCamera(center, camera);

  const hits = raycaster.intersectObject(target);

  if (hits.length > 0) {
    score += 100;
    moveTarget();

    hitmarker.style.opacity = "1";
    setTimeout(() => {
      hitmarker.style.opacity = "0";
    }, 150);
  }

  const accuracy = Math.round(
    (score / 100 / shots) * 100
  );

  document.getElementById("score").textContent = score;
  document.getElementById("accuracy").textContent =
    accuracy + "%";
});

// PAUSE WHEN ESC IS PRESSED
document.addEventListener("pointerlockchange", () => {
  if (!playing) return;

  if (document.pointerLockElement !== renderer.domElement) {
    menu.style.display = "flex";
    document.querySelector("#menu h1").textContent = "PAUSED";
    startBtn.textContent = "RESUME";
    result.textContent = "Press Resume to continue.";

    startBtn.onclick = () => {
      menu.style.display = "none";
      renderer.domElement.requestPointerLock();
    };
  } else {
    menu.style.display = "none";
  }
});

// END GAME
function endGame() {
  playing = false;
  clearInterval(timerInterval);

  if (document.pointerLockElement) {
    document.exitPointerLock();
  }

  const accuracy = shots > 0
    ? Math.round((score / 100 / shots) * 100)
    : 0;

  menu.style.display = "flex";
  hud.style.display = "none";

  document.querySelector("#menu h1").textContent =
    "TRAINING COMPLETE";

  result.innerHTML =
    "Score: " + score +
    "<br>Accuracy: " + accuracy + "%" +
    "<br>Shots fired: " + shots;

  startBtn.textContent = "PLAY AGAIN";
  startBtn.onclick = startGame;
}

// RENDER THE GAME
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

animate();

// RESPONSIVE WINDOW SIZE
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
