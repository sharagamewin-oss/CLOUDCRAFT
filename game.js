// CLOUDCRAFT - Phase 1: Playable Cloud World
(function () {
  'use strict';

  if (typeof THREE === 'undefined') {
    document.body.innerHTML = '<p style="padding:24px;font-family:sans-serif;color:#000">Could not load Three.js. Please check your internet connection and reload the page.</p>';
    return;
  }

  // ---------------------------------------------------------------
  // Block types
  // ---------------------------------------------------------------
  const GRASS = 0, DIRT = 1, STONE = 2, WOOD = 3, GLASS = 4, BRICK = 5;
  const NAMES = ['Grass', 'Dirt', 'Stone', 'Wood', 'Glass', 'Brick'];

  // ---------------------------------------------------------------
  // Procedural 16x16 textures (original, no copied assets)
  // ---------------------------------------------------------------
  function rng(seed) {
    let s = seed;
    return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  }
  const cl = v => Math.max(0, Math.min(255, Math.round(v)));

  function fillN(g, r, c, amt, x0, y0, w, h) {
    x0 = x0 || 0; y0 = y0 || 0; w = w === undefined ? 16 : w; h = h === undefined ? 16 : h;
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        const d = (r() - 0.5) * amt;
        g.fillStyle = 'rgb(' + cl(c[0] + d) + ',' + cl(c[1] + d) + ',' + cl(c[2] + d) + ')';
        g.fillRect(x, y, 1, 1);
      }
    }
  }

  function makeTex(seed, draw) {
    const c = document.createElement('canvas');
    c.width = c.height = 16;
    const g = c.getContext('2d');
    draw(g, rng(seed));
    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    return { tex: t, url: c.toDataURL() };
  }

  const GREEN = [104, 196, 84], BROWN = [136, 98, 68];

  const T = {};
  T.grassTop = makeTex(11, (g, r) => fillN(g, r, GREEN, 36));
  T.dirt = makeTex(22, (g, r) => fillN(g, r, BROWN, 34));
  T.grassSide = makeTex(33, (g, r) => {
    fillN(g, r, BROWN, 34);
    fillN(g, r, GREEN, 36, 0, 0, 16, 4);
    for (let x = 0; x < 16; x++) if (r() < 0.5) fillN(g, r, GREEN, 36, x, 4, 1, 1 + (r() < 0.4 ? 1 : 0));
  });
  T.stone = makeTex(44, (g, r) => {
    fillN(g, r, [142, 146, 154], 32);
    g.fillStyle = 'rgba(70,72,80,0.35)';
    for (let i = 0; i < 6; i++) g.fillRect(Math.floor(r() * 14), Math.floor(r() * 15), 2 + Math.floor(r() * 3), 1);
  });
  T.wood = makeTex(55, (g, r) => {
    fillN(g, r, [200, 150, 92], 18);
    g.fillStyle = 'rgba(90,55,25,0.65)';
    for (let y = 0; y < 16; y += 4) g.fillRect(0, y, 16, 1);
    g.fillRect(5, 0, 1, 4); g.fillRect(11, 4, 1, 4); g.fillRect(4, 8, 1, 4); g.fillRect(12, 12, 1, 4);
  });
  T.brick = makeTex(66, (g, r) => {
    fillN(g, r, [205, 198, 186], 10);
    for (let row = 0; row < 4; row++) {
      const off = row % 2 ? 4 : 0;
      for (let bx = -8 + off; bx < 16; bx += 8) {
        const x0 = Math.max(0, bx + 1), x1 = Math.min(16, bx + 8);
        if (x1 > x0) fillN(g, r, [178, 76, 62], 22, x0, row * 4 + 1, x1 - x0, 3);
      }
    }
  });
  T.glass = makeTex(77, (g) => {
    g.clearRect(0, 0, 16, 16);
    g.fillStyle = 'rgba(190,230,255,0.28)'; g.fillRect(0, 0, 16, 16);
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.fillRect(0, 0, 16, 1); g.fillRect(0, 15, 16, 1); g.fillRect(0, 0, 1, 16); g.fillRect(15, 0, 1, 16);
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.fillRect(3, 3, 2, 1); g.fillRect(4, 4, 2, 1); g.fillRect(5, 5, 2, 1);
  });

  const lam = (t, extra) => new THREE.MeshLambertMaterial(Object.assign({ map: t.tex }, extra || {}));
  const all6 = m => [m, m, m, m, m, m];
  const glassMat = lam(T.glass, { transparent: true, depthWrite: false });
  // Face order for BoxGeometry: +x, -x, +y, -y, +z, -z
  const dirtMat = lam(T.dirt), sideMat = lam(T.grassSide), topMat = lam(T.grassTop);
  const MATS = [
    [sideMat, sideMat, topMat, dirtMat, sideMat, sideMat],
    all6(dirtMat),
    all6(lam(T.stone)),
    all6(lam(T.wood)),
    all6(glassMat),
    all6(lam(T.brick))
  ];
  const ICONS = [T.grassTop.url, T.dirt.url, T.stone.url, T.wood.url, T.glass.url, T.brick.url];

  // ---------------------------------------------------------------
  // Scene, camera, renderer, lights
  // ---------------------------------------------------------------
  const container = document.getElementById('game');
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fd8ff);
  scene.fog = new THREE.Fog(0xbfe6ff, 70, 260);

  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 500);
  camera.rotation.order = 'YXZ';

  scene.add(new THREE.HemisphereLight(0xddf1ff, 0xb59b7a, 0.85));
  const sun = new THREE.DirectionalLight(0xfff2cf, 0.75);
  sun.position.set(60, 100, 40);
  scene.add(sun);

  // Decorative sun in the sky
  const sunBall = new THREE.Mesh(new THREE.BoxGeometry(18, 18, 18), new THREE.MeshBasicMaterial({ color: 0xfff1a8, fog: false }));
  sunBall.position.set(220, 260, 140);
  scene.add(sunBall);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ---------------------------------------------------------------
  // World storage + instanced rendering (one InstancedMesh per type)
  // ---------------------------------------------------------------
  const world = new Map();
  const K = (x, y, z) => (x + 256) + (y + 256) * 512 + (z + 256) * 262144;
  const setBlock = (x, y, z, t) => world.set(K(x, y, z), { x: x, y: y, z: z, t: t });
  const hasBlock = (x, y, z) => world.has(K(x, y, z));

  const CAP = 20000;
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const meshes = MATS.map(m => {
    const im = new THREE.InstancedMesh(boxGeo, m, CAP);
    im.frustumCulled = false;
    im.count = 0;
    scene.add(im);
    return im;
  });
  const dummy = new THREE.Object3D();
  let dirty = true;

  const NB = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  function exposed(b) {
    for (let i = 0; i < 6; i++) {
      const n = world.get(K(b.x + NB[i][0], b.y + NB[i][1], b.z + NB[i][2]));
      if (!n || (n.t === GLASS && b.t !== GLASS)) return true;
    }
    return false;
  }

  function rebuild() {
    const counts = [0, 0, 0, 0, 0, 0];
    world.forEach(b => {
      if (counts[b.t] >= CAP || !exposed(b)) return;
      dummy.position.set(b.x + 0.5, b.y + 0.5, b.z + 0.5);
      dummy.updateMatrix();
      meshes[b.t].setMatrixAt(counts[b.t]++, dummy.matrix);
    });
    meshes.forEach((m, i) => { m.count = counts[i]; m.instanceMatrix.needsUpdate = true; });
    dirty = false;
  }

  // ---------------------------------------------------------------
  // World generation: floating islands
  // ---------------------------------------------------------------
  const heightAt = (x, z) => Math.round((Math.sin(x * 0.35) + Math.cos(z * 0.3)) * 0.5);

  function island(cx, cy, cz, R, hills) {
    for (let x = -R; x <= R; x++) {
      for (let z = -R; z <= R; z++) {
        const d = Math.hypot(x, z) + Math.sin(x * 1.7 + z * 0.9) * 0.8;
        if (d > R) continue;
        const h = hills ? heightAt(x, z) : 0;
        const depth = Math.floor((1 - d / R) * R * 0.8) + 2;
        for (let i = 0; i <= depth; i++) {
          setBlock(cx + x, cy + h - i, cz + z, i === 0 ? GRASS : (i <= 2 ? DIRT : STONE));
        }
      }
    }
  }

  function topY(x, z) {
    for (let y = 20; y > -40; y--) if (hasBlock(x, y, z)) return y;
    return null;
  }

  function generate() {
    world.clear();
    island(0, 0, 0, 13, true);            // main island
    island(34, 6, -10, 5, false);         // small faraway islands
    island(-30, -8, 22, 6, false);
    island(10, 14, -40, 4, false);
    // little stone boulders as decoration
    [[5, 5, 1], [-6, 4, 2], [8, -7, 1], [-9, -8, 2], [-3, 9, 1]].forEach(p => {
      const y = topY(p[0], p[1]);
      if (y === null) return;
      for (let i = 1; i <= p[2]; i++) setBlock(p[0], y + i, p[1], STONE);
    });
    dirty = true;
  }

  // ---------------------------------------------------------------
  // Clouds (decoration)
  // ---------------------------------------------------------------
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 });
  const clouds = [];
  const cr = rng(999);
  for (let i = 0; i < 22; i++) {
    const g = new THREE.Group();
    const n = 3 + Math.floor(cr() * 4);
    for (let j = 0; j < n; j++) {
      const w = 5 + cr() * 8, d = 4 + cr() * 6;
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 1.6 + cr() * 1.2, d), cloudMat);
      m.position.set(j * 4 - n * 2 + cr() * 2, cr() * 1.2, cr() * 4 - 2);
      g.add(m);
    }
    const a = cr() * Math.PI * 2, rad = 40 + cr() * 100;
    g.position.set(Math.cos(a) * rad, -22 + cr() * 42, Math.sin(a) * rad);
    g.userData.speed = 0.4 + cr() * 0.8;
    scene.add(g);
    clouds.push(g);
  }

  // ---------------------------------------------------------------
  // Player
  // ---------------------------------------------------------------
  const P = { x: 0.5, y: 5, z: 0.5, vy: 0, ground: false, yaw: 0, pitch: 0 };
  const keys = {};
  let locked = false;

  function respawn() {
    const y = topY(0, 0);
    P.x = 0.5; P.z = 0.5; P.y = (y === null ? 0 : y) + 1.01; P.vy = 0; P.yaw = 0; P.pitch = 0;
  }

  function collides(x, y, z) {
    const x0 = Math.floor(x - 0.3), x1 = Math.floor(x + 0.3);
    const y0 = Math.floor(y), y1 = Math.floor(y + 1.79);
    const z0 = Math.floor(z - 0.3), z1 = Math.floor(z + 0.3);
    for (let a = x0; a <= x1; a++)
      for (let b = y0; b <= y1; b++)
        for (let c = z0; c <= z1; c++)
          if (hasBlock(a, b, c)) return true;
    return false;
  }

  function updatePlayer(dt) {
    let f = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
    let s = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
    const len = Math.hypot(f, s) || 1;
    f /= len; s /= len;
    const sp = 4.5, sy = Math.sin(P.yaw), cy = Math.cos(P.yaw);
    const dx = (-sy * f + cy * s) * sp * dt;
    const dz = (-cy * f - sy * s) * sp * dt;

    if (keys.Space && P.ground) { P.vy = 8.2; P.ground = false; }
    P.vy = Math.max(P.vy - 24 * dt, -50);

    if (!collides(P.x + dx, P.y, P.z)) P.x += dx;
    if (!collides(P.x, P.y, P.z + dz)) P.z += dz;

    const ny = P.y + P.vy * dt;
    P.ground = false;
    if (collides(P.x, ny, P.z)) {
      if (P.vy < 0) { P.ground = true; P.y = Math.floor(ny) + 1.001; }
      P.vy = 0;
    } else {
      P.y = ny;
    }

    if (P.y < -60) respawn();   // fell off the world
  }

  function updateCamera() {
    camera.position.set(P.x, P.y + 1.6, P.z);
    camera.rotation.set(P.pitch, P.yaw, 0);
  }

  // ---------------------------------------------------------------
  // Targeting (voxel raycast) + highlight outline
  // ---------------------------------------------------------------
  const dir = new THREE.Vector3();
  function raycast(maxD) {
    camera.getWorldDirection(dir);
    const o = camera.position, d = [dir.x, dir.y, dir.z], oo = [o.x, o.y, o.z];
    const c = [Math.floor(o.x), Math.floor(o.y), Math.floor(o.z)];
    const st = d.map(v => (v > 0 ? 1 : -1));
    const td = d.map(v => Math.abs(1 / v));
    const tm = d.map((v, i) => v === 0 ? Infinity : (v > 0 ? c[i] + 1 - oo[i] : oo[i] - c[i]) * td[i]);
    for (let guard = 0; guard < 64; guard++) {
      const a = tm[0] < tm[1] ? (tm[0] < tm[2] ? 0 : 2) : (tm[1] < tm[2] ? 1 : 2);
      if (tm[a] > maxD) return null;
      c[a] += st[a]; tm[a] += td[a];
      if (hasBlock(c[0], c[1], c[2])) {
        const n = [0, 0, 0]; n[a] = -st[a];
        return { c: c.slice(), n: n };
      }
    }
    return null;
  }

  const outline = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1.01, 1.01, 1.01)),
    new THREE.LineBasicMaterial({ color: 0x1b2b44 })
  );
  outline.visible = false;
  scene.add(outline);

  let target = null;
  function updateTarget() {
    target = locked ? raycast(6) : null;
    if (target) { outline.position.set(target.c[0] + 0.5, target.c[1] + 0.5, target.c[2] + 0.5); outline.visible = true; }
    else outline.visible = false;
  }

  // ---------------------------------------------------------------
  // Break / place
  // ---------------------------------------------------------------
  let selected = 0;

  function breakBlock() {
    if (!target) return;
    world.delete(K(target.c[0], target.c[1], target.c[2]));
    dirty = true;
  }

  function placeBlock() {
    if (!target) return;
    const x = target.c[0] + target.n[0], y = target.c[1] + target.n[1], z = target.c[2] + target.n[2];
    if (hasBlock(x, y, z)) return;
    if (Math.abs(x) > 200 || Math.abs(z) > 200 || y < -120 || y > 120) return;
    // not inside the player
    if (x + 1 > P.x - 0.3 && x < P.x + 0.3 && y + 1 > P.y && y < P.y + 1.8 && z + 1 > P.z - 0.3 && z < P.z + 0.3) return;
    setBlock(x, y, z, selected);
    dirty = true;
  }

  // ---------------------------------------------------------------
  // Hotbar
  // ---------------------------------------------------------------
  const hotbar = document.getElementById('hotbar');
  const nameEl = document.getElementById('blockName');
  const slots = [];
  let nameTimer = null;

  NAMES.forEach((n, i) => {
    const s = document.createElement('div');
    s.className = 'slot';
    s.innerHTML = '<span class="num">' + (i + 1) + '</span><img src="' + ICONS[i] + '" alt="' + n + '">';
    s.addEventListener('click', e => { e.stopPropagation(); select(i); });
    hotbar.appendChild(s);
    slots.push(s);
  });

  function select(i) {
    selected = (i + 6) % 6;
    slots.forEach((s, k) => s.classList.toggle('selected', k === selected));
    nameEl.textContent = NAMES[selected];
    nameEl.classList.add('show');
    clearTimeout(nameTimer);
    nameTimer = setTimeout(() => nameEl.classList.remove('show'), 1600);
  }
  select(0);

  // ---------------------------------------------------------------
  // Input + menu
  // ---------------------------------------------------------------
  const overlay = document.getElementById('overlay');
  const playBtn = document.getElementById('playBtn');
  const restartBtn = document.getElementById('restartBtn');
  const msg = document.getElementById('msg');
  const canvas = renderer.domElement;

  function lock() { canvas.requestPointerLock(); }

  playBtn.addEventListener('click', lock);
  overlay.addEventListener('click', e => { if (e.target === overlay) lock(); });
  restartBtn.addEventListener('click', () => { generate(); respawn(); rebuild(); lock(); });

  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === canvas;
    overlay.style.display = locked ? 'none' : 'flex';
    if (!locked) {
      msg.textContent = 'Game paused';
      playBtn.textContent = 'Resume';
      restartBtn.style.display = 'block';
      for (const k in keys) keys[k] = false;
    }
  });

  document.addEventListener('mousemove', e => {
    if (!locked) return;
    P.yaw -= e.movementX * 0.0022;
    P.pitch = Math.max(-1.55, Math.min(1.55, P.pitch - e.movementY * 0.0022));
  });

  document.addEventListener('mousedown', e => {
    if (!locked) return;
    if (e.button === 0) breakBlock();
    else if (e.button === 2) placeBlock();
  });
  document.addEventListener('contextmenu', e => e.preventDefault());

  document.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'Space') e.preventDefault();
    if (e.code >= 'Digit1' && e.code <= 'Digit6') select(parseInt(e.code.slice(5), 10) - 1);
  });
  document.addEventListener('keyup', e => { keys[e.code] = false; });

  document.addEventListener('wheel', e => { if (locked) select(selected + (e.deltaY > 0 ? 1 : -1)); }, { passive: true });

  // ---------------------------------------------------------------
  // Main loop
  // ---------------------------------------------------------------
  generate();
  respawn();
  rebuild();

  let last = performance.now();
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    if (locked) updatePlayer(dt);
    updateCamera();
    updateTarget();
    if (dirty) rebuild();

    clouds.forEach(c => {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 150) c.position.x = -150;
    });

    renderer.render(scene, camera);
  }
  requestAnimationFrame(loop);
})();
