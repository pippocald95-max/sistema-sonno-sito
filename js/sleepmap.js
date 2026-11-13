/* ==========================================================================
   SISTEMA SONNO — Mappa del sistema sonno in 3D (/metodo).
   Potenzia la mappa SVG di network.js (che resta il fallback): stessi dati
   (window.SLEEP_MAP), stesso pannello, in più lista di pulsanti accessibile.

   Sequenza "Big Bang" guidata dallo scroll (scena sticky, si riavvolge):
     buio e battito di SONNO → onda d'urto, i 6 fattori schizzano fuori →
     crescono le connessioni verso i fattori minori → cascata di impulsi →
     la camera arretra e rivela la profondità.
   Poi: selezione = volo dentro il fattore; inattività = tour automatico.
   ========================================================================== */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const D = window.SLEEP_MAP;
const mount = document.getElementById('siteNet');
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* finestre della sequenza (frazioni dello scroll fissato) */
const SEQ = { ring: [0.08, 0.4], majors: 0.12, majorStep: 0.025, majorDur: 0.14, minors: 0.36, minorDur: 0.12, burst: [0.56, 0.8], reveal: [0.72, 1], dust: [0.7, 0.98] };

function hasWebGL() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); }
  catch (e) { return false; }
}
function rng(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp01 = x => Math.max(0, Math.min(1, x));
const ease = x => 1 - Math.pow(1 - clamp01(x), 3);
const win = (p, a, b) => clamp01((p - a) / (b - a));

/* il pannello SVG viene costruito su DOMContentLoaded da network.js */
function whenBuilt(cb) {
  if (mount.querySelector('.net-panel')) return cb();
  const mo = new MutationObserver(() => { if (mount.querySelector('.net-panel')) { mo.disconnect(); cb(); } });
  mo.observe(mount, { childList: true, subtree: true });
}

const GLSL_COMMON = /* glsl */`
  uniform float uP; uniform float uTime; uniform float uActive; uniform float uPR; uniform float uBurst;
  float easeOut(float x) { return 1.0 - pow(1.0 - x, 3.0); }
  float kOf(vec2 w) { return clamp((uP - w.x) / max(w.y - w.x, 0.0001), 0.0, 1.0); }
`;
const FRAG_POINT = /* glsl */`
  varying vec3 vColor; varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float core = smoothstep(0.2, 0.0, d);
    float halo = smoothstep(0.5, 0.08, d) * 0.5;
    float a = (core + halo) * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor, a);
  }
`;

function init() {
  const SC = 1 / 42;
  const R = rng(7);
  const to3 = (n, z) => new THREE.Vector3((n.x - D.core.x) * SC, -(n.y - D.core.y) * SC, z);
  const majorIndex = {};
  D.majors.forEach((m, i) => { majorIndex[m.id] = i; });
  const minorGroup = {};
  D.edges.forEach(([a, b]) => { if (b in majorIndex && !(a in majorIndex) && a !== 'core') minorGroup[a] = majorIndex[b]; });

  /* ---- nodi: gruppi 0–5 maggiori e loro minori, 6 core, 7 polvere ---- */
  const corePos = to3(D.core, 0);
  const nodes = [{ id: 'core', group: 6, kind: 'core', pos: corePos, start: corePos.clone(), win: [0, 0.0001], size: 30 }];
  D.majors.forEach((m, i) => {
    const t0 = SEQ.majors + i * SEQ.majorStep;
    nodes.push({ id: m.id, group: i, kind: 'major', pos: to3(m, Math.sin((i / 6) * Math.PI * 2) * 1.8), start: corePos.clone(), win: [t0, t0 + SEQ.majorDur], size: 20, data: m });
  });
  const byId = {};
  nodes.forEach(n => { byId[n.id] = n; });
  D.minors.forEach(n => {
    const g = n.id in minorGroup ? minorGroup[n.id] : 0;
    const maj = byId[D.majors[g].id];
    const t0 = SEQ.minors + g * 0.02 + R() * 0.06;
    const node = { id: n.id, group: g, kind: 'minor', pos: to3(n, maj.pos.z + (R() - 0.5) * 2.4), start: maj.pos.clone(), win: [t0, t0 + SEQ.minorDur], size: 10, data: n };
    nodes.push(node); byId[n.id] = node;
  });
  for (let i = 0; i < 260; i++) {
    const pos = new THREE.Vector3((R() - 0.5) * 18, (R() - 0.5) * 12, (R() - 0.5) * 10);
    const t0 = SEQ.dust[0] + R() * 0.15;
    nodes.push({ id: 'd' + i, group: 7, kind: 'dust', pos, start: pos.clone().multiplyScalar(2.5), win: [t0, Math.min(t0 + 0.2, SEQ.dust[1])], size: 2 + R() * 2.5 });
  }
  nodes.forEach(n => { n.seed = R(); });

  /* ---- DOM: scroller (sticky), stage, etichette, lista, pannello ---- */
  const scroller = document.createElement('div');
  scroller.className = 'map3d-scroller';
  const stage = document.createElement('div');
  stage.className = 'map3d-stage';
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  const labels = document.createElement('div');
  labels.className = 'map3d-labels';
  labels.setAttribute('aria-hidden', 'true');
  stage.append(canvas, labels);
  scroller.appendChild(stage);
  const list = document.createElement('ol');
  list.className = 'map3d-list';
  list.setAttribute('aria-label', 'Fattori del sistema sonno');
  const panel = mount.querySelector('.net-panel');
  mount.insertBefore(scroller, panel);
  mount.insertBefore(list, panel);

  const pIdx = panel.querySelector('.net-panel-idx'), pTitle = panel.querySelector('.net-panel-title'), pDesc = panel.querySelector('.net-panel-desc');
  const def = { idx: pIdx.textContent, title: pTitle.textContent, desc: pDesc.textContent };

  const lblEls = [];
  const addLabel = (node, cls) => {
    const el = document.createElement('div');
    el.className = 'map3d-lbl ' + cls;
    labels.appendChild(el);
    lblEls.push({ el, node });
    node.lbl = el;
    return el;
  };
  addLabel(byId.core, 'map3d-lbl--core').textContent = D.core.lbl;
  D.majors.forEach(m => {
    const el = addLabel(byId[m.id], 'map3d-lbl--major');
    el.innerHTML = '<span class="i"></span><span class="t"></span>';
    byId[m.id].full = m.lbl.join(' ');
    byId[m.id].typed = -1;
  });
  D.minors.forEach(n => { addLabel(byId[n.id], 'map3d-lbl--minor').textContent = Array.isArray(n.lbl) ? n.lbl.join(' ') : n.lbl; });

  const buttons = D.majors.map((m, i) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.i = String(i); b.setAttribute('aria-pressed', 'false');
    b.innerHTML = '<span>' + m.idx + '</span>' + m.key;
    b.addEventListener('click', () => select(locked === i ? -1 : i));
    b.addEventListener('focus', () => { forceComplete(); if (locked < 0) setActive(i); });
    b.addEventListener('blur', () => { if (locked < 0) setActive(-1); });
    li.appendChild(b); list.appendChild(li);
    return b;
  });

  /* ---- Three.js + bloom ---- */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  const PR = Math.min(window.devicePixelRatio || 1, 1.5);
  renderer.setPixelRatio(PR);
  /* con il composer lo sfondo passa da un render target lineare e viene ricodificato da OutputPass:
     si compensa una conversione per ottenere esattamente #0B1220 sullo schermo */
  const clearCol = new THREE.Color('#0B1220');
  renderer.setClearColor(clearCol, 1);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
  camera.position.set(0, 0, 9);
  const world = new THREE.Group();
  scene.add(world);

  let composer = null, bloomPass = null;
  try {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloomPass = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.85, 0.42, 0.42);
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());
  } catch (e) { console.warn('[SleepMap] bloom non disponibile', e); composer = null; }
  if (composer) renderer.setClearColor(clearCol.clone().convertSRGBToLinear(), 1);

  const uniforms = {
    uP: { value: 0 }, uTime: { value: 0 }, uActive: { value: -1 }, uPR: { value: PR }, uBurst: { value: 0 },
    uHeart: { value: 0 }, uFlash: { value: 0 }, uPulse: { value: 0 },
    uLunar: { value: new THREE.Color('#7F9BD6') }, uBrass: { value: new THREE.Color('#C9A266') }, uBone: { value: new THREE.Color('#ECE4D2') }
  };

  /* nodi */
  const NN = nodes.length;
  const pos = new Float32Array(NN * 3), st = new Float32Array(NN * 3), wn = new Float32Array(NN * 2);
  const size = new Float32Array(NN), grp = new Float32Array(NN), sd = new Float32Array(NN);
  nodes.forEach((n, i) => {
    n.pos.toArray(pos, i * 3); n.start.toArray(st, i * 3);
    wn[i * 2] = n.win[0]; wn[i * 2 + 1] = n.win[1];
    size[i] = n.size; grp[i] = n.group; sd[i] = n.seed;
  });
  const gN = new THREE.BufferGeometry();
  gN.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  gN.setAttribute('aStart', new THREE.BufferAttribute(st, 3));
  gN.setAttribute('aWin', new THREE.BufferAttribute(wn, 2));
  gN.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  gN.setAttribute('aGroup', new THREE.BufferAttribute(grp, 1));
  gN.setAttribute('aSeed', new THREE.BufferAttribute(sd, 1));
  const pts = new THREE.Points(gN, new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: GLSL_COMMON + /* glsl */`
      attribute vec3 aStart; attribute vec2 aWin; attribute float aSize; attribute float aGroup; attribute float aSeed;
      uniform vec3 uLunar; uniform vec3 uBrass; uniform vec3 uBone; uniform float uHeart; uniform float uFlash;
      varying vec3 vColor; varying float vAlpha;
      void main() {
        float k = kOf(aWin);
        float e = easeOut(k);
        vec3 p = mix(aStart, position, e);
        p += 0.05 * e * vec3(sin(uTime * 0.7 + aSeed * 50.0), cos(uTime * 0.6 + aSeed * 31.0), 0.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        bool isCore = aGroup > 5.5 && aGroup < 6.5;
        bool isDust = aGroup > 6.5;
        bool isMajor = aSize > 15.0 && !isCore;
        bool mine = abs(aGroup - uActive) < 0.5;
        float on = uActive < -0.5 ? 1.0 : ((mine || isCore) ? 1.0 : 0.12);
        vColor = isCore ? uBrass : (isMajor ? uBone : uLunar);
        if (mine && isMajor) vColor = uBrass;
        float vis = isCore ? 1.0 : smoothstep(0.0, 0.2, k);
        vAlpha = (isDust ? 0.45 : 1.0) * on * vis * (1.0 + uBurst * 0.6);
        float s = aSize;
        if (isCore) s *= 1.0 + 0.45 * uHeart + 1.4 * uFlash;
        if (isMajor) s *= 1.0 + (1.0 - e) * 0.9 * step(0.001, k);   /* testa di cometa in volo */
        if (mine) s *= 1.35;
        gl_PointSize = s * uPR * (20.0 / -mv.z);
      }`,
    fragmentShader: FRAG_POINT
  }));
  pts.frustumCulled = false;
  world.add(pts);

  /* archi che crescono: l'estremità "lontana" parte dall'ancora e la raggiunge */
  const edgeSpecs = [];
  D.edges.forEach(([a, b]) => {
    const A = byId[a], B = byId[b];
    if (!A || !B) return;
    if (A.kind === 'minor' || B.kind === 'minor') {
      const minor = A.kind === 'minor' ? A : B, major = A.kind === 'minor' ? B : A;
      edgeSpecs.push({ anchor: major, far: minor, win: minor.win, kind: 0 });
    } else if (A.kind === 'core' || B.kind === 'core') {
      const major = A.kind === 'core' ? B : A;
      edgeSpecs.push({ anchor: byId.core, far: major, win: major.win, kind: 1 });
    } else {
      const w0 = Math.max(A.win[1], B.win[1]);
      edgeSpecs.push({ anchor: A, far: B, win: [w0, w0 + 0.1], kind: 1 });
    }
  });
  /* scie dei fattori in volo dal centro (svaniscono dopo l'atterraggio) */
  D.majors.forEach(m => { const M = byId[m.id]; edgeSpecs.push({ anchor: byId.core, far: M, win: M.win, kind: 2 }); });

  const E = edgeSpecs.length;
  const lp = new Float32Array(E * 6), ls = new Float32Array(E * 6), lw = new Float32Array(E * 4);
  const lga = new Float32Array(E * 2), lgb = new Float32Array(E * 2), lk = new Float32Array(E * 2);
  edgeSpecs.forEach((s, k) => {
    s.anchor.pos.toArray(lp, k * 6); s.far.pos.toArray(lp, k * 6 + 3);
    s.anchor.pos.toArray(ls, k * 6); s.anchor.pos.toArray(ls, k * 6 + 3);
    lw[k * 4] = lw[k * 4 + 2] = s.win[0]; lw[k * 4 + 1] = lw[k * 4 + 3] = s.win[1];
    lga[k * 2] = lga[k * 2 + 1] = s.anchor.group; lgb[k * 2] = lgb[k * 2 + 1] = s.far.group;
    lk[k * 2] = lk[k * 2 + 1] = s.kind;
  });
  const gL = new THREE.BufferGeometry();
  gL.setAttribute('position', new THREE.BufferAttribute(lp, 3));
  gL.setAttribute('aStart', new THREE.BufferAttribute(ls, 3));
  gL.setAttribute('aWin', new THREE.BufferAttribute(lw, 2));
  gL.setAttribute('aGA', new THREE.BufferAttribute(lga, 1));
  gL.setAttribute('aGB', new THREE.BufferAttribute(lgb, 1));
  gL.setAttribute('aKind', new THREE.BufferAttribute(lk, 1));
  const lines = new THREE.LineSegments(gL, new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: GLSL_COMMON + /* glsl */`
      attribute vec3 aStart; attribute vec2 aWin; attribute float aGA; attribute float aGB; attribute float aKind;
      uniform vec3 uLunar; uniform vec3 uBrass;
      varying float vAlpha; varying vec3 vColor;
      void main() {
        float k = kOf(aWin);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(mix(aStart, position, easeOut(k)), 1.0);
        bool hit = abs(aGA - uActive) < 0.5 || abs(aGB - uActive) < 0.5;
        float on = uActive < -0.5 ? 1.0 : (hit ? 2.4 : 0.15);
        float base = aKind < 0.5 ? 0.22 : 0.38;
        float a = base * smoothstep(0.0, 0.25, k) * on * (1.0 + uBurst * 1.4);
        if (aKind > 1.5) a = 0.9 * smoothstep(0.0, 0.1, k) * (1.0 - smoothstep(aWin.y, aWin.y + 0.16, uP));
        vAlpha = a;
        vColor = aKind > 1.5 ? uBrass : uLunar;
      }`,
    fragmentShader: /* glsl */`
      varying float vAlpha; varying vec3 vColor;
      void main() { gl_FragColor = vec4(vColor, vAlpha); }`
  }));
  lines.frustumCulled = false;
  world.add(lines);

  /* impulsi: minore → maggiore, maggiore → SONNO */
  const flows = edgeSpecs.filter(s => s.kind !== 2).map(s => (s.anchor.kind === 'core' || (s.anchor.kind === 'major' && s.far.kind === 'minor')) ? { a: s.far, b: s.anchor, win: s.win } : { a: s.anchor, b: s.far, win: s.win });
  const FP = flows.length * 2;
  const fa = new Float32Array(FP * 3), fb = new Float32Array(FP * 3), fo = new Float32Array(FP), fg = new Float32Array(FP), fw = new Float32Array(FP * 2);
  for (let k = 0; k < FP; k++) {
    const f = flows[k % flows.length];
    f.a.pos.toArray(fa, k * 3); f.b.pos.toArray(fb, k * 3);
    fo[k] = R(); fg[k] = f.a.group < 6 ? f.a.group : f.b.group;
    fw[k * 2] = f.win[1]; fw[k * 2 + 1] = f.win[1] + 0.05;
  }
  const gP = new THREE.BufferGeometry();
  gP.setAttribute('position', new THREE.BufferAttribute(new Float32Array(FP * 3), 3));
  gP.setAttribute('aA', new THREE.BufferAttribute(fa, 3));
  gP.setAttribute('aB', new THREE.BufferAttribute(fb, 3));
  gP.setAttribute('aOff', new THREE.BufferAttribute(fo, 1));
  gP.setAttribute('aG', new THREE.BufferAttribute(fg, 1));
  gP.setAttribute('aWin', new THREE.BufferAttribute(fw, 2));
  const pulses = new THREE.Points(gP, new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: GLSL_COMMON + /* glsl */`
      attribute vec3 aA; attribute vec3 aB; attribute float aOff; attribute float aG; attribute vec2 aWin;
      uniform vec3 uBrass; uniform float uPulse;
      varying vec3 vColor; varying float vAlpha;
      void main() {
        float t = fract(uPulse * (0.7 + aOff) + aOff);
        vec4 mv = modelViewMatrix * vec4(mix(aA, aB, t), 1.0);
        gl_Position = projectionMatrix * mv;
        float on = uActive < -0.5 ? 1.0 : (abs(aG - uActive) < 0.5 ? 1.8 : 0.15);
        vColor = uBrass;
        vAlpha = sin(t * 3.14159) * kOf(aWin) * on * (0.55 + uBurst * 1.6);
        gl_PointSize = (7.0 + uBurst * 5.0) * uPR * (20.0 / -mv.z);
      }`,
    fragmentShader: FRAG_POINT
  }));
  pulses.frustumCulled = false;
  world.add(pulses);

  /* onde d'urto */
  const ringMat = () => new THREE.MeshBasicMaterial({ color: new THREE.Color('#C9A266'), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const rings = [0, 0.06].map(delay => {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.97, 1, 128), ringMat());
    m.userData.delay = delay;
    world.add(m);
    return m;
  });

  /* ---- stato della sequenza ---- */
  let target = 0, seqP = 0, forced = false;
  const forceComplete = () => { forced = true; target = 1; };
  const stickyTop = () => parseFloat(getComputedStyle(stage).top) || 0;
  const readScroll = () => {
    if (forced) return;
    const r = scroller.getBoundingClientRect();
    const run = scroller.offsetHeight - stage.offsetHeight;
    target = run > 0 ? clamp01((stickyTop() - r.top) / run) : 1;
  };
  window.addEventListener('scroll', readScroll, { passive: true });
  readScroll();

  /* ---- selezione ---- */
  let active = -1, locked = -1;
  function setActive(i) {
    if (i === active) return;
    active = i;
    uniforms.uActive.value = i;
    const m = i >= 0 ? D.majors[i] : null;
    pIdx.textContent = m ? 'NODO ' + m.idx : def.idx;
    pTitle.textContent = m ? m.key : def.title;
    pDesc.textContent = m ? m.desc : def.desc;
    panel.classList.remove('is-swap'); void panel.offsetWidth; panel.classList.add('is-swap');
    lblEls.forEach(({ el, node }) => {
      const mine = i >= 0 && node.group === i;
      el.classList.toggle('is-on', mine && node.kind === 'minor');
      el.classList.toggle('is-hot', mine && node.kind === 'major');
      el.classList.toggle('is-dim', i >= 0 && !mine && node.kind !== 'core');
    });
  }
  function select(i) {
    forceComplete();
    locked = i;
    hoverI = -1;
    buttons.forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)));
    setActive(i);
  }

  /* tour automatico dopo un po' di inattività */
  const TOUR_DELAY = window.__mapTourDelay || 6000, TOUR_STEP = window.__mapTourStep || 3800;
  let lastInput = performance.now(), touring = false, tourI = -1, tourT = 0;
  const touched = () => {
    lastInput = performance.now();
    if (touring) { touring = false; if (locked < 0) setActive(-1); }
  };
  ['pointermove', 'pointerdown', 'keydown', 'focusin', 'wheel'].forEach(ev => mount.addEventListener(ev, touched, { passive: true }));
  window.addEventListener('scroll', touched, { passive: true });

  /* ---- hover: aree di reazione FISSE, calcolate sulla vista d'insieme ----
     non seguono lo zoom (altrimenti il nodo scappa dal cursore e la camera oscilla);
     comprendono nodo (raggio ampio) ed etichetta (con margine), con isteresi in uscita */
  const rest = D.majors.map(() => ({ nx: -1e4, ny: -1e4, l: 0, t: 0, r: 0, b: 0 }));
  const restCam = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
  const HIT_R = 95, HIT_KEEP = 170, LABEL_PAD = 28, LEAVE_MS = 260;
  const hitTest = (x, y, current) => {
    let best = -1, bs = Infinity;
    rest.forEach((b, i) => {
      const pad = i === current ? LABEL_PAD * 2 : LABEL_PAD;
      const inLabel = x >= b.l - pad && x <= b.r + pad && y >= b.t - pad && y <= b.b + pad;
      const d = Math.hypot(b.nx - x, b.ny - y);
      if (!inLabel && d > (i === current ? HIT_KEEP : HIT_R)) return;
      const score = inLabel ? d * 0.5 : d;
      if (score < bs) { bs = score; best = i; }
    });
    return best;
  };
  let pointer = { x: 0, y: 0 }, mouse = null, hoverI = -1, leaveAt = 0;
  stage.addEventListener('pointermove', e => {
    const r = stage.getBoundingClientRect();
    pointer = { x: (e.clientX - r.left) / r.width - 0.5, y: (e.clientY - r.top) / r.height - 0.5 };
    mouse = e.pointerType === 'mouse' ? { x: e.clientX - r.left, y: e.clientY - r.top } : null;
  });
  stage.addEventListener('pointerleave', () => { pointer = { x: 0, y: 0 }; mouse = null; });
  stage.addEventListener('click', e => {
    if (seqP < 0.98) return;
    const r = stage.getBoundingClientRect();
    const i = hitTest(e.clientX - r.left, e.clientY - r.top, locked);
    select(i === locked ? -1 : i);
  });

  /* box dell'etichetta: ancorata lontano dal centro, i maggiori sotto il centro hanno l'etichetta sotto */
  const labelBox = (node, x, y, w) => {
    const side = node.kind === 'core' ? 0 : (node.pos.x < -0.4 ? -1 : node.pos.x > 0.4 ? 1 : 0);
    const dy = node.kind === 'core' ? 34 : node.kind === 'major' ? (node.pos.y < -0.5 ? 32 : -32) : 20;
    const lw = node.lw || 0;
    let left = side < 0 ? x - lw + 6 : side > 0 ? x - 6 : x - lw / 2;
    if (lw + 16 < w) left = Math.min(Math.max(left, 8), w - lw - 8);
    return { left, cy: y + dy };
  };

  /* ---- dimensioni ---- */
  const portrait = () => camera.aspect < 1.05;
  const resize = () => {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    if (composer) { composer.setPixelRatio(PR); composer.setSize(w, h); }
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(stage);
  resize();

  /* ---- contesto WebGL perso: si torna alla mappa SVG ---- */
  canvas.addEventListener('webglcontextlost', e => {
    e.preventDefault();
    mount.classList.remove('is-3d');
    mount.dataset.map = 'svg';
    scroller.hidden = true;
    list.hidden = true;
    setActive(-1);
  });

  /* ---- ciclo: disegna solo quando visibile ---- */
  let visible = false, t = 0, last = performance.now(), pulseT = 0, fps = 0, frames = 0, fpsT = performance.now();
  new IntersectionObserver(es => { visible = es[0].isIntersecting; }, { threshold: 0 }).observe(scroller);

  const camPos = new THREE.Vector3(0, 0, 9), camLook = new THREE.Vector3(), tmp = new THREE.Vector3(), want = new THREE.Vector3(), lookWant = new THREE.Vector3();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (!visible || document.hidden || mount.dataset.map !== '3d') return;
    t += dt;
    seqP += (target - seqP) * (1 - Math.exp(-dt * 6));
    if (Math.abs(target - seqP) < 0.0005) seqP = target;
    const p = seqP;
    const complete = p > 0.995;

    /* tour */
    if (complete && locked < 0 && !touring && now - lastInput > TOUR_DELAY) { touring = true; tourT = 0; }
    if (touring) {
      tourT -= dt * 1000;
      if (tourT <= 0) { tourI = (tourI + 1) % D.majors.length; setActive(tourI); tourT = TOUR_STEP; }
    }

    const burst = Math.sin(Math.PI * win(p, SEQ.burst[0], SEQ.burst[1]));
    const reveal = ease(win(p, SEQ.reveal[0], SEQ.reveal[1]));
    pulseT += dt * (0.25 + burst * 1.4);
    uniforms.uP.value = p;
    uniforms.uTime.value = t;
    uniforms.uBurst.value = burst;
    uniforms.uPulse.value = pulseT;
    uniforms.uHeart.value = Math.pow(Math.max(0, Math.sin(t * 2.4)), 10) * (1 - reveal * 0.6);
    uniforms.uFlash.value = Math.max(0, 1 - Math.abs(p - 0.78) / 0.06);

    rings.forEach(r => {
      const k = win(p, SEQ.ring[0] + r.userData.delay, SEQ.ring[1] + r.userData.delay);
      const s = 0.3 + ease(k) * 15;
      r.scale.set(s, s, s);
      r.material.opacity = k > 0 && k < 1 ? (1 - k) * 0.85 : 0;
      r.visible = r.material.opacity > 0.01;
    });

    /* camera: vicina nel buio → arretra e ruota nella rivelazione; volo dentro il fattore selezionato */
    const baseZ = portrait() ? 27 : 12.5;
    const par = active < 0 ? 1 : 0;   /* niente parallasse col cursore durante lo zoom */
    world.rotation.y += ((reveal * 0.32 + (complete ? Math.sin(t * 0.12) * 0.18 : 0) + pointer.x * 0.12 * par) - world.rotation.y) * 0.05;
    world.rotation.x += ((-reveal * 0.12 + pointer.y * 0.08 * par) - world.rotation.x) * 0.05;
    world.updateMatrixWorld();
    if (active >= 0 && complete) {
      tmp.copy(byId[D.majors[active].id].pos).applyMatrix4(world.matrixWorld);
      lookWant.copy(tmp);
      want.set(tmp.x * 0.85, tmp.y * 0.85, tmp.z + (portrait() ? 13 : 8.5));
    } else {
      lookWant.set(0, 0, 0);
      /* vicina nel buio, si allarga mentre i fattori escono, ultimo respiro nella rivelazione */
      const spread = ease(win(p, 0.08, 0.5));
      want.set(0, 0, 9 + (baseZ + 2.5 - 9) * spread - 2.5 * reveal);
    }
    const kc = 1 - Math.exp(-dt * 2.6);
    camPos.lerp(want, kc);
    camLook.lerp(lookWant, kc);
    camera.position.copy(camPos);
    camera.lookAt(camLook);

    /* etichette */
    const w = stage.clientWidth, h = stage.clientHeight;
    lblEls.forEach(({ el, node }) => {
      let k = 1;
      if (node.kind !== 'core') k = win(p, node.win[0], node.win[1]);
      tmp.copy(node.start).lerp(node.pos, ease(k)).applyMatrix4(world.matrixWorld).project(camera);
      const x = (tmp.x * 0.5 + 0.5) * w, y = (-tmp.y * 0.5 + 0.5) * h;
      if (node.lw === undefined || node.kind === 'major' && node.lwTyped !== node.typed) { node.lw = el.offsetWidth; node.lh = el.offsetHeight; node.lwTyped = node.typed; }
      const box = labelBox(node, x, y, w);
      el.style.transform = 'translate(' + box.left.toFixed(1) + 'px,' + box.cy.toFixed(1) + 'px) translateY(-50%)';
      if (node.kind === 'major') {
        el.style.visibility = k > 0.2 ? 'visible' : 'hidden';
        const n = Math.round(node.full.length * win(p, node.win[0] + 0.04, node.win[1] + 0.1));
        if (n !== node.typed) {
          node.typed = n;
          el.firstChild.textContent = n > 0 ? node.data.idx : '';
          el.lastChild.textContent = node.full.slice(0, n);
        }
      } else if (node.kind === 'minor') {
        el.style.visibility = complete ? 'visible' : 'hidden';
      }
    });

    /* aree di reazione sulla vista d'insieme + hover */
    if (complete) {
      restCam.aspect = camera.aspect;
      restCam.position.set(0, 0, baseZ);
      restCam.lookAt(0, 0, 0);
      restCam.updateProjectionMatrix();
      restCam.updateMatrixWorld();
      D.majors.forEach((m, i) => {
        const node = byId[m.id];
        tmp.copy(node.pos).applyMatrix4(world.matrixWorld).project(restCam);
        const x = (tmp.x * 0.5 + 0.5) * w, y = (-tmp.y * 0.5 + 0.5) * h;
        const bx = labelBox(node, x, y, w);
        const R = rest[i];
        R.nx = x; R.ny = y; R.l = bx.left; R.r = bx.left + (node.lw || 0); R.t = bx.cy - (node.lh || 0) / 2; R.b = bx.cy + (node.lh || 0) / 2;
      });
      if (locked < 0 && !touring) {
        const cand = mouse ? hitTest(mouse.x, mouse.y, hoverI) : -1;
        if (cand >= 0) { leaveAt = 0; if (cand !== hoverI) { hoverI = cand; setActive(cand); } }
        else if (hoverI >= 0) {
          if (!leaveAt) leaveAt = now;
          else if (now - leaveAt > LEAVE_MS) { hoverI = -1; leaveAt = 0; setActive(-1); }
        }
      }
    }

    if (composer) composer.render(dt); else renderer.render(scene, camera);
    frames++;
    if (now - fpsT >= 1000) { fps = Math.round((frames * 1000) / (now - fpsT)); frames = 0; fpsT = now; }
  }
  requestAnimationFrame(frame);

  window.SleepMap = {
    get progress() { return seqP; },
    get complete() { return forced ? true : seqP > 0.995; },
    get cameraZ() { return camera.position.z; },
    get active() { return active; },
    get fps() { return fps; },
    restBox(i) {
      const r = stage.getBoundingClientRect(), b = rest[i];
      return { nx: r.left + b.nx, ny: r.top + b.ny, lx: r.left + (b.l + b.r) / 2, ly: r.top + (b.t + b.b) / 2 };
    },
    bloom: !!composer
  };
  mount.classList.add('is-3d');
  mount.dataset.map = '3d';
}

if (mount && D && !reduced && !window.__forceNoWebGL && hasWebGL()) {
  whenBuilt(() => {
    try { init(); } catch (e) { console.warn('[SleepMap]', e); mount.classList.remove('is-3d'); }
  });
}
