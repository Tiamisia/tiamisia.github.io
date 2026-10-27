/* Tiamisia — nave industrial 3D que se construye en orden de obra (Three.js + GSAP).
   Unidades en metros. Claro 20 m, 5 crujías de 6 m, altura a alero 7 m, cumbrera 9 m.
   ?t=N congela la secuencia en el segundo N. Con movimiento reducido se muestra terminada y sin cámara en movimiento. */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const host = document.querySelector('.hero-3d');
if (host && window.gsap) init();

function init() {
  const q = new URLSearchParams(location.search);
  const animate = document.documentElement.classList.contains('anim');

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) { host.classList.add('no-gl'); return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0e2338, 55, 130);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 400);

  // ── Luces ──
  scene.add(new THREE.HemisphereLight(0xdfe7ef, 0x0e2338, 0.55));
  const sun = new THREE.DirectionalLight(0xfff0dc, 2.6);
  sun.position.set(-28, 42, -12); sun.target.position.set(0, 0, 15);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 1, far: 140 });
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  const rim = new THREE.DirectionalLight(0xe8641b, 0.6); rim.position.set(35, 12, 45); scene.add(rim);

  // ── Materiales ──
  const tex = (w, h, draw, rx, ry) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  };
  const speckle = (x, w, h, base, n) => {
    x.fillStyle = base; x.fillRect(0, 0, w, h);
    for (let i = 0; i < n; i++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '40,45,50'},${Math.random() * 0.08})`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  };
  const slabTex = tex(256, 256, (x, w, h) => { speckle(x, w, h, '#b7bbbf', 3000); x.strokeStyle = 'rgba(55,62,70,.6)'; x.lineWidth = 3; x.strokeRect(0, 0, w, h); }, 19.4 / 6, 30 / 6);
  const concTex = tex(128, 128, (x, w, h) => speckle(x, w, h, '#a3a8ad', 1500), 1, 1);
  const ribTex = tex(8, 64, (x, w, h) => { x.fillStyle = '#eef1f3'; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(30,40,50,.18)'; for (let y = 0; y < h; y += 16) x.fillRect(0, y, w, 2); x.fillStyle = 'rgba(255,255,255,.6)'; for (let y = 3; y < h; y += 16) x.fillRect(0, y, w, 1); }, 1, 7);

  const M = {
    concrete: new THREE.MeshStandardMaterial({ color: 0xc4c8cc, map: concTex, roughness: 0.95 }),
    slab: new THREE.MeshStandardMaterial({ color: 0xc9cdd1, map: slabTex, roughness: 0.9 }),
    steel: new THREE.MeshStandardMaterial({ color: 0xc2551c, roughness: 0.5, metalness: 0.4 }),   // estructura con primario
    galv: new THREE.MeshStandardMaterial({ color: 0xc3cad1, roughness: 0.32, metalness: 0.85 }),  // montenes galvanizados
    plate: new THREE.MeshStandardMaterial({ color: 0x59636e, roughness: 0.45, metalness: 0.8 }),
    bolt: new THREE.MeshStandardMaterial({ color: 0x2f363d, roughness: 0.35, metalness: 0.9 }),
    sheet: new THREE.MeshStandardMaterial({ color: 0xdfe4e8, roughness: 0.28, metalness: 0.8, side: THREE.DoubleSide }),
    panel: new THREE.MeshStandardMaterial({ color: 0xffffff, map: ribTex, roughness: 0.5, metalness: 0.15 }),
    panelPlain: new THREE.MeshStandardMaterial({ color: 0xe9ecef, roughness: 0.5, metalness: 0.15, side: THREE.DoubleSide }),
    rod: new THREE.MeshStandardMaterial({ color: 0x8b96a1, roughness: 0.4, metalness: 0.85 }),
  };

  // ── Constructores de elementos ──
  const mesh = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; return m; };
  const boxB = (w, h, d, mat) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(0, h / 2, 0); return mesh(g, mat); }; // origen en la base
  // Perfil I a lo largo de +X desde x=0 (peralte en Y, patín en Z)
  function iBeam(L, d, bf, tf, tw, mat) {
    const g = new THREE.Group();
    const web = mesh(new THREE.BoxGeometry(L, d - 2 * tf, tw), mat); web.position.x = L / 2; g.add(web);
    for (const s of [-1, 1]) { const f = mesh(new THREE.BoxGeometry(L, tf, bf), mat); f.position.set(L / 2, s * (d - tf) / 2, 0); g.add(f); }
    return g;
  }
  // Montén (perfil C) a lo largo de +Z desde z=0
  function cSection(L, h, b, t, mat) {
    const g = new THREE.Group();
    const web = mesh(new THREE.BoxGeometry(t, h, L), mat); web.position.z = L / 2; g.add(web);
    for (const s of [-1, 1]) {
      const f = mesh(new THREE.BoxGeometry(b, t, L), mat); f.position.set(b / 2 - t / 2, s * (h - t) / 2, L / 2); g.add(f);
      const lip = mesh(new THREE.BoxGeometry(t, h * 0.18, L), mat); lip.position.set(b - t, s * (h / 2 - h * 0.09 - t), L / 2); g.add(lip);
    }
    return g;
  }
  function rod(a, b, r, mat) {
    const v = new THREE.Vector3().subVectors(b, a);
    const m = mesh(new THREE.CylinderGeometry(r, r, v.length(), 8), mat);
    m.position.copy(a).addScaledVector(v, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize());
    return m;
  }
  // Lámina acanalada: ancho W sobre la pendiente (X), largo L a lo largo de la nave (Z); costillas paralelas a X
  function corrugated(W, L) {
    const seg = Math.round(L / 0.025);
    const g = new THREE.PlaneGeometry(W, L, 1, seg); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, pitch = 0.55;   // paso de costilla exagerado para que no haga moiré a distancia
    for (let i = 0; i < p.count; i++) {
      const u = (((p.getZ(i) + L / 2) / pitch) % 1 + 1) % 1;
      const rib = u < 0.15 ? 1 : u < 0.3 ? 1 - (u - 0.15) / 0.15 : u < 0.85 ? 0 : (u - 0.85) / 0.15;
      p.setY(i, rib * 0.055);
    }
    g.translate(W / 2, 0, L / 2); g.computeVertexNormals();
    return mesh(g, M.sheet);
  }
  // Tornillería instanciada: tuerca hexagonal + vástago, orientados según su eje
  const UP = new THREE.Vector3(0, 1, 0);
  const nutGeo = new THREE.CylinderGeometry(0.036, 0.036, 0.03, 6), rodGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.11, 8);
  function bolts(list) {
    const nut = new THREE.InstancedMesh(nutGeo, M.bolt, list.length), stem = new THREE.InstancedMesh(rodGeo, M.bolt, list.length);
    nut.castShadow = stem.castShadow = true;
    const m = new THREE.Matrix4(), qt = new THREE.Quaternion(), sc = new THREE.Vector3(), p2 = new THREE.Vector3();
    const v = { s: 1 };
    const set = () => {
      sc.setScalar(Math.max(v.s, 0.001));
      list.forEach((b, i) => {
        qt.setFromUnitVectors(UP, b.axis);
        nut.setMatrixAt(i, m.compose(b.p, qt, sc));
        stem.setMatrixAt(i, m.compose(p2.copy(b.p).addScaledVector(b.axis, 0.04 * v.s), qt, sc));
      });
      nut.instanceMatrix.needsUpdate = stem.instanceMatrix.needsUpdate = true;
    };
    set(); scene.add(nut, stem);
    return { v, set };
  }

  // ── Geometría de la nave ──
  const SPAN = 20, H = 7, RIDGE = 9, BAY = 6, NB = 5, LEN = NB * BAY;
  const a = Math.atan2(RIDGE - H, SPAN / 2), Ls = Math.hypot(SPAN / 2, RIDGE - H);
  const D = 0.5, BF = 0.25, TF = 0.025, TW = 0.014;
  const frames = [...Array(NB + 1)].map((_, i) => i * BAY);
  const X = new THREE.Vector3(1, 0, 0);

  const tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } });
  // Aparece un objeto: oculto hasta que inicia su tween, luego interpola desde `from` hasta su valor final
  const items = [];
  const syncVis = () => items.forEach((i) => { i.o.visible = tl.time() >= i.at; });  // seek() no dispara onStart
  function add(o, prop, from, at, dur = 0.8, ease = 'power3.out') {
    o.visible = false; items.push({ o, at });
    const tgt = o[prop], to = {};
    for (const k in from) to[k] = tgt[k];
    tl.fromTo(tgt, { ...from }, { ...to, duration: dur, ease, immediateRender: false, onStart: () => { o.visible = true; } }, at);
  }

  // Terreno: sombra + retícula
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.ShadowMaterial({ opacity: 0.32 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const grid = new THREE.GridHelper(160, 80, 0x31557a, 0x1d3a5a);
  grid.material.transparent = true; grid.material.opacity = 0.55; grid.position.y = 0.003; scene.add(grid);

  // Cimentación: zapata + dado + placa base + anclas
  const order = [];
  frames.forEach((z) => [-1, 1].forEach((s) => order.push({ x: s * SPAN / 2, z, s })));
  const anchors = [], knees = [], ridges = [];
  order.forEach((c, i) => {
    const zap = boxB(1.8, 0.5, 1.8, M.concrete); zap.position.set(c.x, -1.3, c.z); scene.add(zap);
    const ped = boxB(0.7, 1.05, 0.7, M.concrete); ped.position.set(c.x, -0.8, c.z); scene.add(ped);
    const pl = boxB(0.62, 0.032, 0.46, M.plate); pl.position.set(c.x, 0.25, c.z); scene.add(pl);
    add(zap, 'scale', { y: 0.001 }, 0.15 + i * 0.045, 0.55);
    add(ped, 'scale', { y: 0.001 }, 0.45 + i * 0.045, 0.6);
    add(pl, 'position', { y: 0.9 }, 1.05 + i * 0.03, 0.45, 'power2.out');
    for (const dx of [-0.21, 0.21]) for (const dz of [-0.15, 0.15]) anchors.push({ p: new THREE.Vector3(c.x + dx, 0.297, c.z + dz), axis: UP });
    // Tornillos de la conexión columna-viga (patín exterior)
    for (let k = 0; k < 4; k++) for (const dz of [-0.07, 0.07]) knees.push({ p: new THREE.Vector3(c.x + c.s * (D / 2 + 0.03), H - 0.05 - k * 0.13, c.z + dz), axis: X.clone().multiplyScalar(c.s) });
  });

  // Columnas (perfil I), montadas como con grúa: bajan a su placa
  order.forEach((c, i) => {
    const col = iBeam(H + 0.2 - 0.28, D, BF, TF, TW, M.steel);
    col.rotation.z = Math.PI / 2; col.position.set(c.x, 0.282, c.z); scene.add(col);
    add(col, 'position', { y: 9 }, 1.65 + i * 0.075, 1.0);
  });

  // Faldones: grupo local con X sobre la pendiente (alero→cumbrera), Y normal al techo, Z a lo largo de la nave
  const slopes = [-1, 1].map((s) => {
    const g = new THREE.Group(); g.position.set(s * SPAN / 2, H, 0);
    g.rotation.z = -s * a; if (s > 0) g.scale.x = -1;
    scene.add(g); return g;
  });
  frames.forEach((z, i) => slopes.forEach((g, si) => {
    const r = iBeam(Ls, D, BF, TF, TW, M.steel); r.position.z = z; g.add(r);
    add(r, 'position', { y: 7 }, 2.45 + i * 0.1 + si * 0.04, 1.0);
  }));
  // Placas de empalme en cumbrera
  frames.forEach((z, i) => {
    for (const s of [-1, 1]) { const p = mesh(new THREE.BoxGeometry(0.025, 0.72, 0.3), M.plate); p.position.set(s * 0.015, RIDGE - 0.02, z); scene.add(p); add(p, 'scale', { y: 0.001 }, 3.45 + i * 0.05, 0.35); }
    for (let k = 0; k < 3; k++) for (const dz of [-0.08, 0.08]) for (const s of [-1, 1])
      ridges.push({ p: new THREE.Vector3(s * 0.04, RIDGE + 0.18 - k * 0.18, z + dz), axis: X.clone().multiplyScalar(s) });
  });

  const anchorB = bolts(anchors), kneeB = bolts(knees), ridgeB = bolts(ridges);
  [[anchorB, 1.35], [kneeB, 2.95], [ridgeB, 3.6]].forEach(([b, at]) => {
    b.v.s = 0.001; b.set();
    tl.to(b.v, { s: 1, duration: 0.45, ease: 'back.out(2)', onUpdate: b.set }, at);
  });

  // Largueros (montenes) sobre las vigas: crecen de la crujía frontal al fondo
  const NP = 7;
  slopes.forEach((g, si) => {
    for (let k = 0; k < NP; k++) {
      const x = 0.35 + k * (Ls - 0.7) / (NP - 1);
      const p = cSection(LEN + 0.6, 0.2, 0.07, 0.01, M.galv); p.position.set(x, D / 2 + 0.1, -0.3); g.add(p);
      add(p, 'scale', { z: 0.001 }, 3.65 + k * 0.05 + si * 0.12, 1.1, 'power2.inOut');
    }
    // Contraventeo de techo en la segunda crujía
    for (const [z1, z2] of [[BAY, 2 * BAY], [2 * BAY, BAY]]) {
      const r = rod(new THREE.Vector3(0.4, D / 2 - 0.02, z1), new THREE.Vector3(Ls - 0.4, D / 2 - 0.02, z2), 0.016, M.rod); g.add(r);
      add(r, 'scale', { y: 0.001 }, 4.35 + si * 0.1, 0.6, 'power2.out');
    }
  });

  // Largueros de muro y contraventeo lateral
  [-1, 1].forEach((s, si) => {
    [1.6, 3.5, 5.4].forEach((y, k) => {
      const gt = cSection(LEN + 0.6, 0.2, 0.07, 0.01, M.galv);
      gt.rotation.z = s * Math.PI / 2; gt.position.set(s * (SPAN / 2 + D / 2 + 0.1), y, -0.3); scene.add(gt);
      add(gt, 'scale', { z: 0.001 }, 4.25 + k * 0.06 + si * 0.1, 1.0, 'power2.inOut');
    });
    for (const [z1, z2] of [[BAY, 2 * BAY], [2 * BAY, BAY]]) {
      const x = s * (SPAN / 2 + 0.05);
      const r = rod(new THREE.Vector3(x, 0.4, z1), new THREE.Vector3(x, H - 0.4, z2), 0.016, M.rod); scene.add(r);
      add(r, 'scale', { y: 0.001 }, 4.5 + si * 0.08, 0.6, 'power2.out');
    }
  });

  // Losa de piso: colado de la crujía frontal al fondo
  const slabG = new THREE.BoxGeometry(SPAN - 0.6, 0.15, LEN); slabG.translate(0, 0.075, LEN / 2);
  const slab = mesh(slabG, M.slab); scene.add(slab);
  add(slab, 'scale', { z: 0.001 }, 4.7, 1.7, 'power2.inOut');

  // Panel de muro (lado derecho, por crujía) y muro de fondo; el lado izquierdo y el frente quedan abiertos para ver la estructura
  for (let j = 0; j < NB; j++) {
    const p = boxB(0.06, H - 0.1, BAY, M.panel); p.position.set(SPAN / 2 + D / 2 + 0.24, 0.15, j * BAY + BAY / 2); scene.add(p);
    add(p, 'scale', { y: 0.001 }, 5.25 + j * 0.13, 0.8, 'power2.out');
  }
  const gable = new THREE.Shape([[-10.6, 0.15], [10.6, 0.15], [10.6, H + 0.1], [0, RIDGE + 0.3], [-10.6, H + 0.1]].map(([x, y]) => new THREE.Vector2(x, y)));
  const back = mesh(new THREE.ExtrudeGeometry(gable, { depth: 0.06, bevelEnabled: false }), M.panelPlain);
  back.position.z = LEN + 0.38; scene.add(back);
  add(back, 'scale', { y: 0.001 }, 5.7, 0.9, 'power2.out');

  // Lámina de techo por crujía (la primera crujía queda descubierta, como corte)
  for (let j = 1; j < NB; j++) slopes.forEach((g, si) => {
    const sh = corrugated(Ls + 0.45, BAY + 0.04); sh.position.set(-0.45, D / 2 + 0.2 + 0.012, j * BAY - 0.02); g.add(sh);
    add(sh, 'position', { y: 3.5 }, 5.85 + (j - 1) * 0.16 + si * 0.08, 0.8, 'power2.out');
  });
  // Caballete
  const cap = mesh(new THREE.BoxGeometry(0.7, 0.04, LEN - BAY + 0.1), M.sheet); cap.position.set(0, RIDGE + 0.36, BAY + (LEN - BAY) / 2); scene.add(cap);
  add(cap, 'position', { y: RIDGE + 3 }, 6.75, 0.6, 'power2.out');

  // ── Cámara: acercamiento a una zapata → se aleja y sube mientras se monta la nave ──
  const cam = { px: -15.2, py: 1.5, pz: -5.2, tx: -10, ty: -0.2, tz: 1.2 };
  const FINAL = { px: -49, py: 24, pz: -36, tx: 1.5, ty: 3, tz: 14 };
  tl.to(cam, { keyframes: [
    { px: -24, py: 6.5, pz: -14, tx: -6, ty: 1.8, tz: 4, duration: 2.6, ease: 'power1.inOut' },
    { ...FINAL, duration: 4.9, ease: 'power2.inOut' },
  ] }, 0.1);

  // ── Render ──
  const look = new THREE.Vector3();
  const sway = { x: 0, y: 0 };
  let idleStart = null, running = false, visible = true, narrow = false;
  function place(now) {
    let { px, py, pz, tx, ty, tz } = cam;
    if (animate && tl.progress() === 1) {   // vaivén muy lento al terminar
      if (idleStart === null) idleStart = now;
      const th = Math.sin((now - idleStart) / 6000) * 0.05 + sway.x * 0.04;
      const dx = px - tx, dz = pz - tz;
      px = tx + dx * Math.cos(th) - dz * Math.sin(th); pz = tz + dx * Math.sin(th) + dz * Math.cos(th);
      py += sway.y * 0.8;
    }
    if (narrow) { px = tx + (px - tx) * 0.74; py = ty + (py - ty) * 0.74; pz = tz + (pz - tz) * 0.74; }  // en celular, más cerca
    camera.position.set(px, py, pz); camera.lookAt(look.set(tx, ty, tz));
  }
  function resize() {
    const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; narrow = w <= 900;
    if (w > 900) camera.setViewOffset(w, h, -w * 0.2, h * 0.04, w, h); else camera.clearViewOffset();
    camera.updateProjectionMatrix(); render(performance.now());
  }
  function render(now) { place(now); renderer.render(scene, camera); }
  function loop(now) { if (!running) return; render(now); requestAnimationFrame(loop); }
  function start() { if (!running && visible && animate) { running = true; requestAnimationFrame(loop); } }
  function stop() { running = false; }

  new ResizeObserver(resize).observe(host);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop(); }).observe(host);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));

  const t = q.get('t');
  if (t !== null) { tl.seek(parseFloat(t)); syncVis(); render(performance.now()); }
  else if (!animate) { tl.progress(1); syncVis(); Object.assign(cam, FINAL); }
  else { tl.play(); start(); }

  if (animate && matchMedia('(pointer: fine) and (min-width: 901px)').matches) {
    const xTo = gsap.quickTo(sway, 'x', { duration: 1.2, ease: 'power3' }), yTo = gsap.quickTo(sway, 'y', { duration: 1.2, ease: 'power3' });
    document.querySelector('.hero').addEventListener('pointermove', (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      xTo((e.clientX - r.left) / r.width - 0.5); yTo((e.clientY - r.top) / r.height - 0.5);
    });
  }
  resize();
  host.classList.add('ready');
  window.__nave = { tl, render };
}
