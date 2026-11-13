/* ==========================================================================
   SISTEMA SONNO — rete neurale del sonno (sfondo a tutta pagina).
   Fasi del sonno guidate dallo scroll: window.SleepNet.setPhase(nome).
   Senza WebGL o con prefers-reduced-motion: html.net-static (SVG statico).
   ========================================================================== */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';

const root = document.documentElement;
const mode = document.body.dataset.net === 'full' ? 'full' : 'lite';
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* parametri per fase: speed (tempo), jitter (agitazione), pulseRate (impulsi),
   wave (onde lente), order (rete ricomposta in sfera), glow (luminosità),
   hueMix (quota di nodi ottone) */
const PHASES = {
  veglia: { speed: 1.0, jitter: 1.0, pulseRate: 1.0, wave: 0.0, order: 0.0, glow: 1.0, hueMix: 0.55 },
  caos:   { speed: 0.8, jitter: 1.7, pulseRate: 0.7, wave: 0.0, order: 0.0, glow: 0.85, hueMix: 0.4 },
  ordine: { speed: 0.5, jitter: 0.2, pulseRate: 0.6, wave: 0.0, order: 1.0, glow: 0.9, hueMix: 0.5 },
  n2:     { speed: 0.35, jitter: 0.3, pulseRate: 0.25, wave: 0.2, order: 0.35, glow: 0.65, hueMix: 0.2 },
  n3:     { speed: 0.15, jitter: 0.1, pulseRate: 0.05, wave: 1.0, order: 0.2, glow: 0.5, hueMix: 0.05 },
  rem:    { speed: 0.3, jitter: 0.15, pulseRate: 2.2, wave: 0.1, order: 0.6, glow: 0.95, hueMix: 0.35 },
  quiete: { speed: 0.05, jitter: 0.0, pulseRate: 0.0, wave: 0.05, order: 0.1, glow: 0.18, hueMix: 0.1 }
};
/* intro della home: la rete nasce raccolta e luminosa, poi si apre nella fase corrente */
const INTRO = { speed: 0.6, jitter: 0.05, pulseRate: 1.8, wave: 0.0, order: 1.0, glow: 1.4, hueMix: 0.75 };

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch (e) { return false; }
}

function rng(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const GLSL_NODE = /* glsl */`
  uniform float uTime; uniform float uOrder; uniform float uJitter; uniform float uWave;
  vec3 nodePos(vec3 c, vec3 o, float s) {
    vec3 p = mix(c, o, uOrder);
    p += uJitter * 0.22 * vec3(sin(uTime * 1.7 + s * 40.0), cos(uTime * 1.3 + s * 23.0), sin(uTime * 1.1 + s * 17.0));
    p.y += uWave * 0.8 * sin(p.x * 0.45 + uTime * 0.9);
    return p;
  }
`;
const FRAG_POINT = /* glsl */`
  varying vec3 vColor; varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.05, d);
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor, a * vAlpha);
  }
`;

function startStatic() {
  root.classList.add('net-static');
  window.SleepNet = { phase: 'static', static: true, fps: 0, setPhase() {} };
}

function start() {
  const small = window.matchMedia('(max-width: 768px)').matches;
  const N = mode === 'full' ? (small ? 200 : 600) : (small ? 90 : 150);
  const R = rng(20261016);

  const canvas = document.createElement('canvas');
  canvas.className = 'sleepnet';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'low-power' });
  const PR = Math.min(window.devicePixelRatio || 1, 1.5);
  renderer.setPixelRatio(PR);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.set(0, 0, 14);
  const group = new THREE.Group();
  scene.add(group);

  /* posizioni: caos (scatola) e ordine (sfera di Fibonacci, "cervello") */
  const chaos = new Float32Array(N * 3), order = new Float32Array(N * 3), seed = new Float32Array(N);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    chaos[i * 3] = (R() - 0.5) * 24; chaos[i * 3 + 1] = (R() - 0.5) * 14; chaos[i * 3 + 2] = (R() - 0.5) * 10;
    const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = golden * i, rad = 6 * (0.85 + R() * 0.3);
    order[i * 3] = Math.cos(th) * r * rad * 1.35; order[i * 3 + 1] = y * rad * 0.8; order[i * 3 + 2] = Math.sin(th) * r * rad;
    seed[i] = R();
  }

  /* sinapsi: 3 vicini più prossimi nello spazio "caos" */
  const pairs = []; const seen = new Set();
  for (let i = 0; i < N; i++) {
    const near = [];
    for (let j = 0; j < N; j++) {
      if (i === j) continue;
      const dx = chaos[i * 3] - chaos[j * 3], dy = chaos[i * 3 + 1] - chaos[j * 3 + 1], dz = chaos[i * 3 + 2] - chaos[j * 3 + 2];
      near.push([dx * dx + dy * dy + dz * dz, j]);
    }
    near.sort((a, b) => a[0] - b[0]);
    for (let k = 0; k < 3; k++) {
      const j = near[k][1], key = i < j ? i + ':' + j : j + ':' + i;
      if (near[k][0] < 18 && !seen.has(key)) { seen.add(key); pairs.push([i, j]); }
    }
  }

  const colA = new THREE.Color('#7F9BD6'), colB = new THREE.Color('#C9A266');
  const uniforms = {
    uTime: { value: 0 }, uOrder: { value: 0 }, uJitter: { value: 1 }, uWave: { value: 0 },
    uGlow: { value: 1 }, uHueMix: { value: 0.5 }, uPulse: { value: 0 }, uPulseAmt: { value: 1 },
    uMouse: { value: new THREE.Vector2(9, 9) }, uPR: { value: PR },
    uColA: { value: colA }, uColB: { value: colB }, uLineAlpha: { value: 0.16 }
  };

  /* nodi */
  const gN = new THREE.BufferGeometry();
  gN.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  gN.setAttribute('aChaos', new THREE.BufferAttribute(chaos, 3));
  gN.setAttribute('aOrder', new THREE.BufferAttribute(order, 3));
  gN.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const nodes = new THREE.Points(gN, new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: GLSL_NODE + /* glsl */`
      attribute vec3 aChaos; attribute vec3 aOrder; attribute float aSeed;
      uniform float uPR; uniform float uGlow; uniform float uHueMix; uniform vec2 uMouse;
      uniform vec3 uColA; uniform vec3 uColB;
      varying vec3 vColor; varying float vAlpha;
      void main() {
        vec3 p = nodePos(aChaos, aOrder, aSeed);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        vec2 ndc = gl_Position.xy / gl_Position.w;
        float hover = smoothstep(0.25, 0.0, distance(ndc, uMouse));
        float twinkle = 0.75 + 0.25 * sin(uTime * 2.0 + aSeed * 60.0);
        vColor = mix(uColA, uColB, step(aSeed, uHueMix));
        vAlpha = clamp(uGlow * twinkle + hover * 0.8, 0.0, 1.0);
        gl_PointSize = (3.0 + aSeed * 5.0 + hover * 8.0) * uPR * (14.0 / -mv.z);
      }`,
    fragmentShader: FRAG_POINT
  }));
  nodes.frustumCulled = false;
  group.add(nodes);

  /* sinapsi */
  const L = pairs.length;
  const lc = new Float32Array(L * 6), lo = new Float32Array(L * 6), ls = new Float32Array(L * 2);
  pairs.forEach(([a, b], k) => {
    [a, b].forEach((n, e) => {
      for (let d = 0; d < 3; d++) { lc[k * 6 + e * 3 + d] = chaos[n * 3 + d]; lo[k * 6 + e * 3 + d] = order[n * 3 + d]; }
      ls[k * 2 + e] = seed[n];
    });
  });
  const gL = new THREE.BufferGeometry();
  gL.setAttribute('position', new THREE.BufferAttribute(new Float32Array(L * 6), 3));
  gL.setAttribute('aChaos', new THREE.BufferAttribute(lc, 3));
  gL.setAttribute('aOrder', new THREE.BufferAttribute(lo, 3));
  gL.setAttribute('aSeed', new THREE.BufferAttribute(ls, 1));
  const lines = new THREE.LineSegments(gL, new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: GLSL_NODE + /* glsl */`
      attribute vec3 aChaos; attribute vec3 aOrder; attribute float aSeed;
      void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(nodePos(aChaos, aOrder, aSeed), 1.0); }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColA; uniform float uLineAlpha; uniform float uGlow;
      void main() { gl_FragColor = vec4(uColA, uLineAlpha * uGlow); }`
  }));
  lines.frustumCulled = false;
  group.add(lines);

  /* impulsi lungo le sinapsi */
  const P = Math.min(L, mode === 'full' ? 160 : 50);
  const pa = new Float32Array(P * 3), pao = new Float32Array(P * 3), pb = new Float32Array(P * 3), pbo = new Float32Array(P * 3);
  const psa = new Float32Array(P), psb = new Float32Array(P), poff = new Float32Array(P);
  for (let k = 0; k < P; k++) {
    const [a, b] = pairs[Math.floor(R() * L)];
    for (let d = 0; d < 3; d++) { pa[k * 3 + d] = chaos[a * 3 + d]; pao[k * 3 + d] = order[a * 3 + d]; pb[k * 3 + d] = chaos[b * 3 + d]; pbo[k * 3 + d] = order[b * 3 + d]; }
    psa[k] = seed[a]; psb[k] = seed[b]; poff[k] = R();
  }
  const gP = new THREE.BufferGeometry();
  gP.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P * 3), 3));
  gP.setAttribute('aChaosA', new THREE.BufferAttribute(pa, 3));
  gP.setAttribute('aOrderA', new THREE.BufferAttribute(pao, 3));
  gP.setAttribute('aChaosB', new THREE.BufferAttribute(pb, 3));
  gP.setAttribute('aOrderB', new THREE.BufferAttribute(pbo, 3));
  gP.setAttribute('aSeedA', new THREE.BufferAttribute(psa, 1));
  gP.setAttribute('aSeedB', new THREE.BufferAttribute(psb, 1));
  gP.setAttribute('aOffset', new THREE.BufferAttribute(poff, 1));
  const pulses = new THREE.Points(gP, new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: GLSL_NODE + /* glsl */`
      attribute vec3 aChaosA; attribute vec3 aOrderA; attribute vec3 aChaosB; attribute vec3 aOrderB;
      attribute float aSeedA; attribute float aSeedB; attribute float aOffset;
      uniform float uPulse; uniform float uPulseAmt; uniform float uPR; uniform vec3 uColB;
      varying vec3 vColor; varying float vAlpha;
      void main() {
        vec3 a = nodePos(aChaosA, aOrderA, aSeedA), b = nodePos(aChaosB, aOrderB, aSeedB);
        float t = fract(uPulse * (0.6 + aOffset * 0.8) + aOffset);
        vec4 mv = modelViewMatrix * vec4(mix(a, b, t), 1.0);
        gl_Position = projectionMatrix * mv;
        vColor = uColB;
        vAlpha = uPulseAmt * sin(t * 3.14159);
        gl_PointSize = 5.0 * uPR * (14.0 / -mv.z);
      }`,
    fragmentShader: FRAG_POINT
  }));
  pulses.frustumCulled = false;
  group.add(pulses);

  /* stato e API */
  let phaseName = PHASES[window.__netPhase] ? window.__netPhase : 'veglia';
  let target = PHASES[phaseName];
  const intro = mode === 'full' && window.scrollY < 50;
  const cur = Object.assign({}, intro ? INTRO : target);
  root.dataset.netPhase = phaseName;
  let camZ = intro ? 8 : 14;
  if (intro) {
    root.dataset.netIntro = 'on';
    setTimeout(() => { root.dataset.netIntro = 'off'; }, 2800);
  }
  let fps = 0, frames = 0, fpsT = performance.now();
  window.SleepNet = {
    get phase() { return phaseName; },
    get fps() { return fps; },
    setPhase(name) {
      if (!PHASES[name] || mode !== 'full') return;
      phaseName = name; target = PHASES[name]; root.dataset.netPhase = name;
    }
  };

  /* input */
  let scrollP = 0;
  const onScroll = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    scrollP = max > 0 ? window.scrollY / max : 0;
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  window.addEventListener('pointermove', e => {
    uniforms.uMouse.value.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  }, { passive: true });
  document.addEventListener('pointerleave', () => uniforms.uMouse.value.set(9, 9));

  const resize = () => {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize);
  resize();

  let t = 0, pulse = 0, last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    if (document.hidden) { last = now; return; }
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const k = 1 - Math.exp(-dt * 1.6);
    for (const key in cur) cur[key] += (target[key] - cur[key]) * k;
    t += dt * cur.speed;
    pulse += dt * cur.pulseRate * 0.35;
    uniforms.uTime.value = t;
    uniforms.uOrder.value = cur.order;
    uniforms.uJitter.value = cur.jitter;
    uniforms.uWave.value = cur.wave;
    uniforms.uGlow.value = cur.glow;
    uniforms.uHueMix.value = cur.hueMix;
    uniforms.uPulse.value = pulse;
    uniforms.uPulseAmt.value = Math.min(cur.pulseRate, 1);
    group.rotation.y += dt * 0.03 * (0.3 + cur.speed);
    group.rotation.x = Math.sin(t * 0.1) * 0.08;
    camZ += ((14 - scrollP * 3) - camZ) * (1 - Math.exp(-dt * 1.2));
    camera.position.z = camZ;
    renderer.render(scene, camera);
    frames++;
    if (now - fpsT >= 1000) { fps = Math.round((frames * 1000) / (now - fpsT)); frames = 0; fpsT = now; }
  }
  requestAnimationFrame(frame);
  document.dispatchEvent(new Event('sleepnet:ready'));
}

if (reduced || window.__forceNoWebGL || !hasWebGL()) startStatic();
else {
  try { start(); } catch (e) { console.warn('[SleepNet]', e); startStatic(); }
}
