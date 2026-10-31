
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const $ = id => document.getElementById(id);
const screens = ['home','modes','settings','pause','results'];
const names = {
  targets: 'STATIC TARGETS',
  dummies: 'STATIC DUMMIES',
  moving: 'MOVING DUMMIES'
};

let mode = 'targets', playing = false, paused = false;
let score = 0, hits = 0, shots = 0, headshots = 0;
let time = 60, interval = null, look = 1.5, sounds = true;
let yaw = 0, pitch = 0, aim = false, weapon = 0, ammo = 12;
let reloading = false, reloadTimer = null, recoil = 0;
let flash = 0, elapsed = 0, feedbackTimer = null, audio = null;

const keys = new Set();
const targets = [], impacts = [];
const clock = new THREE.Clock();

// SCENE
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe9bc86);
scene.fog = new THREE.FogExp2(0xd2a477, .008);

const camera = new THREE.PerspectiveCamera(
  75, innerWidth / innerHeight, .07, 400
);
camera.rotation.order = 'YXZ';
camera.position.set(0, 1.75, 12);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;

$('game').appendChild(renderer.domElement);

// LIGHTING
scene.add(new THREE.HemisphereLight(0xffeac9, 0x916b50, 2.1));

const sun = new THREE.DirectionalLight(0xfff1cd, 3.3);
sun.position.set(-23, 30, 15);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -55;
sun.shadow.camera.right = 55;
sun.shadow.camera.top = 55;
sun.shadow.camera.bottom = -55;
sun.shadow.camera.far = 130;
sun.shadow.bias = -.0004;
scene.add(sun);

// MATERIALS AND HELPERS
const mat = (c, metalness = 0, roughness = .85) =>
  new THREE.MeshStandardMaterial({ color: c, metalness, roughness });

const sand = mat(0xc69b68);
const tan = mat(0xe0b785);
const plaster = mat(0xc59d73);
const dark = mat(0x705740);
const wood = mat(0x745139);
const iron = mat(0x252b2f, .8, .35);
const white = mat(0xf2e8d7);
const red = mat(0xcc4933);
const ink = mat(0x13191a);

function box(parent,x,y,z,w,h,d,m,shadow=true) {
  const o = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);
  o.position.set(x,y,z);
  o.castShadow = shadow;
  o.receiveShadow = true;
  parent.add(o);
  return o;
}

function cyl(parent,x,y,z,top,bottom,height,m,segments=32) {
  const o = new THREE.Mesh(
    new THREE.CylinderGeometry(top,bottom,height,segments),m
  );
  o.position.set(x,y,z);
  o.castShadow = true;
  o.receiveShadow = true;
  parent.add(o);
  return o;
}

function ball(parent,x,y,z,r,m) {
  const o = new THREE.Mesh(new THREE.SphereGeometry(r,20,14),m);
  o.position.set(x,y,z);
  o.castShadow = true;
  parent.add(o);
  return o;
}

// DESERT SHOOTING COMPOUND
box(scene,0,-.35,-20,250,.7,280,sand,false);
box(scene,0,-.06,-15,22,.1,105,mat(0xb89161),false);

for(let i=0;i<34;i++) {
  const x=(Math.random()-.5)*155;
  const z=-15+(Math.random()-.5)*160;
  if(Math.abs(x)<16) continue;
  const h=2+Math.random()*6;
  box(
    scene,x,h/2,z,
    3+Math.random()*8,h,3+Math.random()*6,
    Math.random()>.5?plaster:tan
  );
}

function building(x,z,w,h,d) {
  const g=new THREE.Group();
  box(g,0,h/2,0,w,h,d,plaster);
  box(g,0,h+.15,0,w+.55,.3,d+.55,tan);

  for(let i=-1;i<=1;i++) {
    box(g,i*w*.25,h*.64,d/2+.06,w*.125,h*.34,.08,dark);
    box(g,i*w*.25,h*.87,d/2+.10,w*.15,.08,.12,tan);
  }

  box(g,0,h*.24,d/2+.08,w*.21,h*.48,.1,dark);
  g.position.set(x,0,z);
  scene.add(g);
}

building(-19,-35,15,10,10);
building(19,-43,19,12,12);
building(-28,-13,13,7,11);
building(28,-23,15,8,13);

box(scene,0,2.3,-49,38,4.6,.6,plaster);

for(const s of [-1,1]) {
  box(scene,s*12.5,1.3,-13,.65,2.6,85,tan);
  for(let z=-42;z<20;z+=7) {
    box(scene,s*12.5,1.5,z,.8,3.1,.7,plaster);
  }
}

function platform(x,z,w=5) {
  box(scene,x,.27,z,w,.54,3.2,plaster);
  for(let i=0;i<6;i++) {
    box(scene,x-w/2+(i+.5)*w/6,.58,z,w/6-.07,.1,3.15,wood);
  }
}

platform(-7,-31,5);
platform(0,-35,7);
platform(7,-31,5);

for(let i=0;i<10;i++) {
  let x=(i%2?1:-1)*(12+Math.random()*5);
  let z=-22-Math.random()*20;
  box(scene,x,.55,z,1.2,1.1,1.2,wood);
}

// PAPER TARGET RINGS
function disk(parent,x,y,z,r,m) {
  const o=cyl(parent,x,y,z,r,r,.025,m,48);
  o.rotation.x=Math.PI/2;
  return o;
}

function rings(parent,x,y,z,s=1) {
  disk(parent,x,y,z,.32*s,red);
  disk(parent,x,y,z+.025,.235*s,white);
  disk(parent,x,y,z+.052,.15*s,red);
  disk(parent,x,y,z+.077,.07*s,white);
  disk(parent,x,y,z+.098,.025*s,red);
}

// SILHOUETTE DUMMIES
function targetDummy() {
  const g=new THREE.Group();

  box(g,0,.08,0,.85,.17,.43,wood);
  box(g,-.27,.85,-.06,.09,1.6,.12,wood);
  box(g,.27,.85,-.06,.09,1.6,.12,wood);

  const shape=new THREE.Shape();
  shape.moveTo(-.46,0);
  shape.lineTo(.46,0);
  shape.lineTo(.46,1.16);
  shape.quadraticCurveTo(.40,1.45,.23,1.50);
  shape.lineTo(.23,1.61);
  shape.quadraticCurveTo(.26,2.08,0,2.1);
  shape.quadraticCurveTo(-.26,2.08,-.23,1.61);
  shape.lineTo(-.23,1.5);
  shape.quadraticCurveTo(-.40,1.45,-.46,1.16);
  shape.closePath();

  const board=new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape,{
      depth:.08,
      bevelEnabled:true,
      bevelThickness:.012,
      bevelSize:.012,
      bevelSegments:1
    }),
    white
  );

  board.position.set(0,.43,0);
  board.castShadow=true;
  g.add(board);

  rings(g,0,1.43,.13,1.15);
  rings(g,0,2.27,.13,.57);

  g.userData.parts={head:[],body:[]};
  board.userData.zone='body';
  g.userData.parts.body.push(board);

  for(const child of g.children) {
    if(child.geometry?.type==='CylinderGeometry') {
      child.userData.zone=child.position.y>1.93?'head':'body';
      g.userData.parts[child.userData.zone].push(child);
    }
  }

  return g;
}

function roundTarget() {
  const g=new THREE.Group();

  box(g,0,.11,0,.8,.22,.42,wood);
  box(g,-.3,1.1,0,.08,2,.1,wood);
  box(g,.3,1.1,0,.08,2,.1,wood);

  const board=disk(g,0,1.65,0,.56,white);
  board.userData.zone='body';
  rings(g,0,1.65,.09,1.3);

  for(const child of g.children) {
    if(child.geometry?.type==='CylinderGeometry') {
      child.userData.zone='body';
    }
  }

  return g;
}

function clearTargets() {
  for(const t of targets) scene.remove(t);
  targets.length=0;

  for(const p of impacts) scene.remove(p.mesh);
  impacts.length=0;
}

function moveTarget(t,i) {
  const lane=[-7,0,7][i%3];
  t.position.set(
    lane+(Math.random()-.5)*.8,
    0,
    -30-(i%2)*4
  );
  t.userData.anchor=t.position.x;
  t.userData.phase=Math.random()*6.28;
  t.userData.speed=.8+Math.random()*.55;
}

function spawn() {
  clearTargets();

  for(let i=0;i<3;i++) {
    const t=mode==='targets'?roundTarget():targetDummy();
    t.userData.target=true;
    moveTarget(t,i);
    scene.add(t);
    targets.push(t);
  }
}

// FIRST-PERSON PISTOL
const gun=new THREE.Group();
camera.add(gun);
scene.add(camera);

const steel=mat(0x24292f,.95,.28);
const slide=mat(0x363d43,.95,.24);
const black=mat(0x111517,.55,.35);
const rubber=mat(0x272e32,.12,.9);
const silver=mat(0x9ca5ab,1,.2);
const sight=mat(0x070b0d,.7,.28);
const brass=mat(0xb19862,.75,.3);

const pistol=new THREE.Group();
gun.add(pistol);

box(pistol,.31,-.30,-.73,.23,.18,.90,slide);
box(pistol,.31,-.39,-.55,.20,.13,.52,steel);
box(pistol,.31,-.36,-.99,.19,.09,.25,steel);

let grip=box(pistol,.31,-.61,-.42,.165,.37,.20,rubber);
grip.rotation.x=-.25;

box(pistol,.31,-.79,-.40,.18,.035,.21,steel);
box(pistol,.31,-.23,-.41,.08,.06,.06,sight);
box(pistol,.31,-.21,-1.08,.045,.06,.045,sight);

for(let i=0;i<8;i++) {
  for(const x of [.187,.433]) {
    box(pistol,x,-.30,-.36-i*.052,.009,.105,.016,black);
  }
}

for(let i=0;i<6;i++) {
  box(pistol,.225,-.61+i*.045,-.405,.01,.012,.12,steel);
  box(pistol,.395,-.61+i*.045,-.405,.01,.012,.12,steel);
}

box(pistol,.31,-.275,-.74,.13,.018,.19,black);
box(pistol,.31,-.28,-.75,.07,.022,.11,brass);

const barrel=cyl(pistol,.31,-.315,-1.205,.067,.067,.06,black,32);
barrel.rotation.x=Math.PI/2;

const bore=cyl(pistol,.31,-.315,-1.24,.039,.039,.009,sight,32);
bore.rotation.x=Math.PI/2;

box(pistol,.31,-.48,-.64,.14,.025,.26,steel);
box(pistol,.31,-.49,-.53,.035,.08,.035,black);

// SCOPED SNIPER
const sniper=new THREE.Group();
gun.add(sniper);
sniper.visible=false;

box(sniper,.28,-.26,-1.08,.22,.20,1.22,steel);
box(sniper,.28,-.34,-.42,.19,.16,.53,black);

let stock=box(sniper,.28,-.40,.00,.19,.24,.67,rubber);
stock.rotation.x=.06;

box(sniper,.28,-.62,-.69,.16,.42,.22,rubber);

const tube=cyl(sniper,.28,-.22,-2.02,.055,.055,1.35,slide);
tube.rotation.x=Math.PI/2;

const muzzle=cyl(sniper,.28,-.22,-2.73,.075,.075,.30,black);
muzzle.rotation.x=Math.PI/2;

const optic=cyl(sniper,.28,-.025,-.97,.105,.105,.66,black);
optic.rotation.x=Math.PI/2;

for(let z of [-.65,-1.25]) {
  const ring=cyl(sniper,.28,-.025,z,.13,.13,.07,steel);
  ring.rotation.x=Math.PI/2;
}

box(sniper,.28,-.14,-.97,.10,.12,.25,steel);
box(sniper,.28,-.38,-1.16,.16,.07,.48,brass);

// MUZZLE FLASH
const flashMesh=new THREE.Mesh(
  new THREE.ConeGeometry(.11,.38,7),
  new THREE.MeshBasicMaterial({
    color:0xffdf89,
    transparent:true,
    opacity:.93
  })
);

flashMesh.rotation.x=-Math.PI/2;
flashMesh.position.set(.31,-.315,-1.48);
gun.add(flashMesh);

const muzzleLight=new THREE.PointLight(0xffb25e,0,4);
gun.add(muzzleLight);
muzzleLight.position.copy(flashMesh.position);

// HUD AND MENUS
function show(name) {
  for(const s of screens) {
    $(s).classList.toggle('hidden',name!==s);
  }
  $('overlay').classList.remove('hidden');
  $('hud').classList.add('hidden');
}

function hud() {
  $('time').textContent=time;
  $('score').textContent=score;
  $('accuracy').textContent=
    (shots?Math.round(hits/shots*100):0)+'%';
  $('heads').textContent=headshots;
  $('modeLabel').textContent=names[mode];

  $('weaponLabel').textContent=
    (weapon?'SCOUT SNIPER':'TACTICAL PISTOL')+
    ' · '+
    (reloading?'RELOADING':ammo+' / '+(weapon?5:12));
}

// WEAPON SWITCHING
function selectWeapon(n) {
  weapon=n;
  ammo=n?5:12;
  reloading=false;
  clearTimeout(reloadTimer);
  sniper.visible=!!n;
  pistol.visible=!n;
  aim=false;

  camera.fov=75;
  camera.updateProjectionMatrix();

  $('scope').classList.add('hidden');
  $('crosshair').classList.remove('hidden');
  hud();
}

function start(chosen=mode) {
  mode=chosen;
  playing=true;
  paused=true;
  score=hits=shots=headshots=0;
  time=Number($('duration').value);

  yaw=pitch=recoil=elapsed=0;
  keys.clear();

  camera.position.set(0,1.75,12);
  camera.rotation.set(0,0,0);

  selectWeapon(0);
  spawn();
  hud();
  clearInterval(interval);
  lock();
}

function lock() {
  renderer.domElement.requestPointerLock();
}

function pause() {
  if(!playing) return;

  paused=true;
  clearInterval(interval);
  aim=false;

  camera.fov=75;
  camera.updateProjectionMatrix();

  $('scope').classList.add('hidden');
  $('crosshair').classList.remove('hidden');
  show('pause');
}

function end() {
  playing=false;
  paused=false;
  clearInterval(interval);
  keys.clear();

  if(document.pointerLockElement===renderer.domElement) {
    document.exitPointerLock();
  }

  $('finalScore').textContent=score;
  $('finalAccuracy').textContent=
    (shots?Math.round(hits/shots*100):0)+'%';
  $('finalHeads').textContent=headshots;
  $('finalMode').textContent=
    names[mode]+' · '+hits+' HITS / '+shots+' SHOTS';

  show('results');
}

function quit() {
  playing=false;
  paused=false;
  clearInterval(interval);
  clearTimeout(reloadTimer);
  keys.clear();

  if(document.pointerLockElement===renderer.domElement) {
    document.exitPointerLock();
  }

  show('home');
}

// SOUND ENGINE
function tone(freq,duration=.11) {
  if(!sounds) return;

  try {
    audio??=new AudioContext();

    const osc=audio.createOscillator();
    const gain=audio.createGain();

    osc.type='triangle';
    osc.frequency.setValueAtTime(freq,audio.currentTime);
    osc.frequency.exponentialRampToValueAtTime(
      freq*.45,audio.currentTime+duration
    );

    gain.gain.setValueAtTime(.065,audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      .001,audio.currentTime+duration
    );

    osc.connect(gain).connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime+duration);
  } catch(e) {}
}

// RELOADING
function reload() {
  if(!playing||paused||reloading) return;

  reloading=true;
  hud();
  tone(400,.13);

  reloadTimer=setTimeout(()=>{
    ammo=weapon?5:12;
    reloading=false;
    hud();
    tone(650,.08);
  },weapon?1450:950);
}

// HIT FEEDBACK
function feedback(t) {
  $('feedback').textContent=t;
  $('feedback').style.opacity='1';

  clearTimeout(feedbackTimer);
  feedbackTimer=setTimeout(()=>{
    $('feedback').style.opacity='0';
  },240);
}

const ray=new THREE.Raycaster();

function impact(point) {
  const mesh=new THREE.Mesh(
    new THREE.SphereGeometry(.055,8,8),
    new THREE.MeshBasicMaterial({color:0x33251d})
  );

  mesh.position.copy(point);
  scene.add(mesh);

  impacts.push({mesh,until:elapsed+1.8});

  if(impacts.length>30) {
    const old=impacts.shift();
    scene.remove(old.mesh);
  }
}

// SHOOTING AND HEADSHOT DETECTION
function shoot() {
  if(!playing||paused||
     document.pointerLockElement!==renderer.domElement) return;

  if(reloading) return;

  if(ammo<=0) {
    reload();
    return;
  }

  ammo--;
  shots++;
  recoil=weapon?.24:.14;
  flash=weapon?.12:.075;

  flashMesh.position.z=weapon?-2.94:-1.48;
  flashMesh.position.y=weapon?-.22:-.315;

  tone(weapon?90:155,weapon?.20:.12);

  ray.setFromCamera(new THREE.Vector2(),camera);
  ray.far=160;

  const intersections=ray.intersectObjects(targets,true);

  if(intersections.length) {
    let obj=intersections[0].object;
    const zone=obj.userData.zone||'body';

    while(obj.parent&&!obj.userData.target) {
      obj=obj.parent;
    }

    if(obj.userData.target) {
      hits++;

      if(zone==='head'&&mode!=='targets') {
        headshots++;
        score+=250;
        feedback('HEADSHOT +250');
      } else {
        score+=100;
        feedback(mode==='targets'?'PRECISION +100':'HIT +100');
      }

      impact(intersections[0].point);
      moveTarget(obj,targets.indexOf(obj));
    }
  }

  hud();

  if(ammo===0) reload();
}

// AIM DOWN SIGHTS
function ads(on) {
  if(!playing||paused) return;

  aim=on;
  camera.fov=aim?(weapon?18:53):75;
  camera.updateProjectionMatrix();

  $('scope').classList.toggle('hidden',!(aim&&weapon===1));
  $('crosshair').classList.toggle('hidden',aim&&weapon===1);
}

// MENU BUTTONS
$('playBtn').onclick=()=>show('modes');
$('settingsBtn').onclick=()=>show('settings');
$('modeBack').onclick=()=>show('home');
$('settingsBack').onclick=()=>show('home');

$('sens').oninput=()=>{
  $('sensOut').textContent=$('sens').value;
};

$('saveBtn').onclick=()=>{
  look=Number($('sens').value);
  sounds=$('sound').checked;

  document.documentElement.style.setProperty(
    '--reticle',$('color').value
  );

  show('home');
};

document.querySelectorAll('.mode').forEach(b=>{
  b.onclick=()=>start(b.dataset.mode);
});

$('resumeBtn').onclick=lock;
$('restartBtn').onclick=()=>start(mode);
$('quitBtn').onclick=quit;
$('againBtn').onclick=()=>start(mode);
$('homeBtn').onclick=quit;

// POINTER LOCK AND PAUSE
document.addEventListener('pointerlockchange',()=>{
  if(!playing) return;

  if(document.pointerLockElement===renderer.domElement) {
    paused=false;
    $('overlay').classList.add('hidden');
    $('hud').classList.remove('hidden');

    clearInterval(interval);

    interval=setInterval(()=>{
      if(paused||!playing) return;
      time--;
      hud();
      if(time<=0) end();
    },1000);
  } else {
    pause();
  }
});

// MOUSE LOOK
document.addEventListener('mousemove',e=>{
  if(!playing||paused||
     document.pointerLockElement!==renderer.domElement) return;

  const mult=(aim?.55:1)*look*.00135;

  yaw-=e.movementX*mult;
  pitch=THREE.MathUtils.clamp(
    pitch-e.movementY*mult,-1.34,1.34
  );

  camera.rotation.set(pitch,yaw,0);
});

// SHOOT AND SCOPE
document.addEventListener('mousedown',e=>{
  if(e.button===0) shoot();
  if(e.button===2) ads(true);
});

document.addEventListener('mouseup',e=>{
  if(e.button===2) ads(false);
});

document.addEventListener('contextmenu',e=>e.preventDefault());

// KEYBOARD
document.addEventListener('keydown',e=>{
  keys.add(e.code);

  if(['Space','ArrowUp','ArrowDown'].includes(e.code)) {
    e.preventDefault();
  }

  if(!playing||paused||e.repeat) return;

  if(e.code==='KeyR') reload();
  if(e.code==='Digit1') selectWeapon(0);
  if(e.code==='Digit2') selectWeapon(1);
});

document.addEventListener('keyup',e=>{
  keys.delete(e.code);
});

window.addEventListener('blur',()=>{
  keys.clear();
  ads(false);
});

// MAIN ANIMATION LOOP
function loop() {
  requestAnimationFrame(loop);
  const dt=Math.min(clock.getDelta(),.05);

  if(playing&&!paused) {
    elapsed+=dt;

    const m=new THREE.Vector3();

    if(keys.has('KeyW')) m.z--;
    if(keys.has('KeyS')) m.z++;
    if(keys.has('KeyA')) m.x--;
    if(keys.has('KeyD')) m.x++;

    if(m.lengthSq()) {
      m.normalize().applyAxisAngle(
        new THREE.Vector3(0,1,0),yaw
      );

      const speed=keys.has('ShiftLeft')?7:4.5;
      camera.position.addScaledVector(m,dt*speed);

      camera.position.x=THREE.MathUtils.clamp(
        camera.position.x,-9,9
      );

      camera.position.z=THREE.MathUtils.clamp(
        camera.position.z,5,20
      );
    }

    // MOVING DUMMIES
    if(mode==='moving') {
      targets.forEach(t=>{
        t.position.x=THREE.MathUtils.clamp(
          t.userData.anchor+
          Math.sin(
            elapsed*t.userData.speed*1.6+
            t.userData.phase
          )*2.1,
          -9,9
        );
      });
    }

    // IMPACT MARKS
    for(let i=impacts.length-1;i>=0;i--) {
      if(elapsed>impacts[i].until) {
        scene.remove(impacts[i].mesh);
        impacts.splice(i,1);
      }
    }

    // GUN BOB AND RECOIL
    const bob=m.lengthSq()?Math.sin(elapsed*10)*.012:0;

    recoil=Math.max(0,recoil-dt*.8);

    gun.position.set(
      aim?-.11:.03,
      bob-recoil*.34,
      aim?-.1:0
    );

    gun.rotation.x=recoil*1.2;
    gun.rotation.y=aim?0:-.045;
    gun.visible=!(aim&&weapon===1);
  }

  flash-=dt;
  flashMesh.visible=flash>0;
  muzzleLight.intensity=flash>0?3:0;

  renderer.render(scene,camera);
}

loop();

// RESIZE
window.addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
});

// INITIAL MENU
show('home');
