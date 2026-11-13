/* SISTEMA SONNO · mappa relazionale interattiva del sistema sonno.
   Estetica tecnica/sistemica (niente oroscopo/costellazioni): campo di nodi
   di peso diverso, molte connessioni sottili, sei nodi maggiori interattivi
   con pannello informativo. Layout deterministico (seed fisso) per non
   "saltare" al cambio palette. Rispetta prefers-reduced-motion.

   Gli stili (.net-*) vivono in css/site.css, non più iniettati qui via
   innerHTML: cascata unica, cacheable e minificabile col resto del foglio.
   Unico simbolo esposto globalmente: window.buildNetwork(mountId). */
(function () {
  'use strict';

function ssRng(seed) {
  var t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    var r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/* selezione bloccata: conservata tra le ricostruzioni (es. cambio palette) */
var ssLocked = null;

function buildNetwork(mountId) {
  var mount = document.getElementById(mountId);
  if (!mount) return;

  var reduced = false;
  try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  var S = 600, H = 430;

  /* ---- Nodi maggiori (interattivi) --------------------------------------- */
  /* ax = ancoraggio etichetta; dx/dy = offset etichetta; dix/diy = offset indice
     (indice posto sul lato opposto all'etichetta per evitare sovrapposizioni) */
  var majors = window.SLEEP_MAP.majors;

  var core = window.SLEEP_MAP.core;

  /* ---- Nodi secondari (etichettati) -------------------------------------- */
  /* la = ancoraggio etichetta: 'a' sopra, 'b' sotto, 's' start (a destra), 'e' end (a sinistra)
     Ogni nodo secondario rappresenta una voce della "mappa del sistema" e si collega
     a un solo nodo maggiore (vedi sezione archi più sotto), replicando 1:1 le
     sotto-voci di ciascuna delle sei categorie. */
  var minors = window.SLEEP_MAP.minors;

  /* mappa posizioni per lookup */
  var pos = {};
  majors.forEach(function (n) { pos[n.id] = n; });
  minors.forEach(function (n) { pos[n.id] = n; });
  pos[core.id] = core;

  /* ---- Nodi terziari (fini, non etichettati) — seed fisso ---------------- */
  var rng = ssRng(20260717);
  var fine = [];
  var placed = majors.concat(minors, [core]).map(function (n) { return { x: n.x, y: n.y }; });
  var tries = 0;
  while (fine.length < 11 && tries < 500) {
    tries++;
    var fx = 40 + rng() * (S - 80);
    var fy = 40 + rng() * (H - 78);         /* entro lo stage compatto */
    var ok = true;
    for (var q = 0; q < placed.length; q++) {
      var dxx = placed[q].x - fx, dyy = placed[q].y - fy;
      if (dxx * dxx + dyy * dyy < 40 * 40) { ok = false; break; }
    }
    if (!ok) continue;
    var fid = 'f' + fine.length;
    var r = 1.6 + rng() * 1.8;
    fine.push({ id: fid, x: fx, y: fy, r: r });
    placed.push({ x: fx, y: fy });
    pos[fid] = { x: fx, y: fy };
  }

  /* ---- Archi (connessioni) ---------------------------------------------- */
  var edges = window.SLEEP_MAP.edges.slice();

  /* collega ogni nodo fine al vicino più prossimo (tra maggiori/secondari) */
  var anchorPool = majors.concat(minors);
  fine.forEach(function (f) {
    var best = null, bd = 1e9;
    anchorPool.forEach(function (a) {
      var d = (a.x - f.x) * (a.x - f.x) + (a.y - f.y) * (a.y - f.y);
      if (d < bd) { bd = d; best = a; }
    });
    if (best) edges.push([f.id, best.id]);
  });

  /* archi con pulsazioni continue (attività di sistema) */
  var pulseEdges = window.SLEEP_MAP.pulseEdges;

  /* ---- Costruzione SVG --------------------------------------------------- */
  var svg = '<svg class="net-svg" viewBox="0 0 ' + S + ' ' + H + '" width="100%" role="img" ' +
    'aria-label="Mappa interattiva del sistema sonno: sei fattori principali e molti fattori minori interconnessi" ' +
    'style="overflow:hidden"><g class="net-root">';

  /* griglia tecnica di fondo, molto tenue */
  var grid = '';
  for (var px = 0; px <= S; px += 40) {
    grid += '<line x1="' + px + '" y1="0" x2="' + px + '" y2="' + H + '" class="net-grid"/>';
  }
  for (var py = 0; py <= H; py += 40) {
    grid += '<line x1="0" y1="' + py + '" x2="' + S + '" y2="' + py + '" class="net-grid"/>';
  }
  svg += '<g class="net-grid-g">' + grid + '</g>';

  /* anelli guida sottili attorno al core */
  [66, 120].forEach(function (rr) {
    svg += '<circle cx="' + core.x + '" cy="' + core.y + '" r="' + rr + '" class="net-guide"/>';
  });

  /* archi */
  var edgeMK = '';
  edges.forEach(function (e, i) {
    var A = pos[e[0]], B = pos[e[1]];
    if (!A || !B) return;
    var backbone = (e[0].charAt(0) === 'm' && e[1].charAt(0) === 'm') || e[0] === 'core' || e[1] === 'core';
    var cls = 'net-edge ' + (backbone ? 'net-edge-backbone' : 'net-edge-minor');
    edgeMK += '<line class="' + cls + '" data-a="' + e[0] + '" data-b="' + e[1] + '" ' +
      'x1="' + A.x.toFixed(1) + '" y1="' + A.y.toFixed(1) + '" x2="' + B.x.toFixed(1) + '" y2="' + B.y.toFixed(1) + '"/>';
  });
  svg += '<g class="net-edges">' + edgeMK + '</g>';

  /* pulsazioni (solo se il movimento è consentito) */
  if (!reduced) {
    var pMK = '';
    var durs = ['4.2s', '5.1s', '3.8s', '4.7s'];
    var di = 0;
    Object.keys(pulseEdges).forEach(function (k) {
      var ab = k.split('|'), A = pos[ab[0]], B = pos[ab[1]];
      if (!A || !B) return;
      var d = durs[di % durs.length];
      pMK += '<circle r="2.6" class="net-pulse">' +
        '<animateMotion dur="' + d + '" repeatCount="indefinite" ' +
        'path="M' + A.x.toFixed(1) + ' ' + A.y.toFixed(1) + ' L' + B.x.toFixed(1) + ' ' + B.y.toFixed(1) + '"/>' +
        '</circle>';
      di++;
    });
    svg += '<g class="net-pulses">' + pMK + '</g>';
  }

  /* gruppo parallax: nodi fini (si muovono di più) */
  var fineMK = '';
  fine.forEach(function (f, i) {
    var breathe = (i % 3 === 0) ? ' net-breathe' : '';
    fineMK += '<circle class="net-fine' + breathe + '" data-id="' + f.id + '" ' +
      'cx="' + f.x.toFixed(1) + '" cy="' + f.y.toFixed(1) + '" r="' + f.r.toFixed(1) + '"/>';
  });
  svg += '<g class="net-layer net-layer-fine">' + fineMK + '</g>';

  /* gruppo parallax: nodi secondari (si muovono poco) */
  var minMK = '';
  minors.forEach(function (n) {
    minMK += '<g class="net-node net-minor" data-id="' + n.id + '">';
    minMK += '<circle class="net-minor-dot" cx="' + n.x + '" cy="' + n.y + '" r="4.5"/>';
    minMK += labelMarkup(n, 11.5);
    minMK += '</g>';
  });
  svg += '<g class="net-layer net-layer-min">' + minMK + '</g>';

  /* core (decorativo) */
  var coreMK = '<g class="net-core" data-id="core">';
  coreMK += '<circle class="net-core-ring" cx="' + core.x + '" cy="' + core.y + '" r="15"/>';
  coreMK += '<circle class="net-core-ring2" cx="' + core.x + '" cy="' + core.y + '" r="9"/>';
  coreMK += '<circle class="net-core-dot' + (reduced ? '' : ' net-breathe') + '" cx="' + core.x + '" cy="' + core.y + '" r="3.4"/>';
  coreMK += '<text class="net-core-lbl" x="' + core.x + '" y="' + (core.y + 30) + '" text-anchor="middle">' + core.lbl + '</text>';
  coreMK += '</g>';
  svg += coreMK;

  /* nodi maggiori (interattivi) */
  var majMK = '';
  majors.forEach(function (n) {
    majMK += '<g class="net-node net-major" data-id="' + n.id + '" role="button" tabindex="0" ' +
      'aria-label="' + n.key + ': come incide sul sonno" aria-pressed="false">';
    majMK += '<circle class="net-hit" cx="' + n.x + '" cy="' + n.y + '" r="26"/>';
    majMK += '<circle class="net-major-ring" cx="' + n.x + '" cy="' + n.y + '" r="13"/>';
    majMK += '<circle class="net-major-dot" cx="' + n.x + '" cy="' + n.y + '" r="4.2"/>';
    /* indice: offset esplicito, sul lato opposto all'etichetta */
    var ixp = n.x + n.dix, iyp = n.y + n.diy;
    majMK += '<text class="net-idx" x="' + ixp.toFixed(1) + '" y="' + (iyp + 3).toFixed(1) + '" text-anchor="middle">' + n.idx + '</text>';
    majMK += majorLabel(n);
    majMK += '</g>';
  });
  svg += majMK;

  /* suggerimento tecnico in alto a sinistra */
  svg += '<text class="net-hint" x="14" y="20">ESPLORA IL SISTEMA · PASSA O TOCCA UN NODO</text>';

  svg += '</g></svg>';

  /* ---- Pannello informativo (blocco sotto il diagramma) ------------------ */
  var panel =
    '<div class="net-panel" aria-live="polite">' +
      '<div class="net-panel-tag"><span class="net-panel-idx">SYS·MAP</span>' +
        '<span class="net-panel-kicker">6 fattori principali · molti fattori minori</span></div>' +
      '<div class="net-panel-title">Il sonno come sistema</div>' +
      '<div class="net-panel-desc">Sei fattori principali e molti fattori minori si intrecciano e si influenzano. ' +
      'Passa, tocca o seleziona un nodo per vedere come agisce sul sonno.</div>' +
    '</div>';

  mount.innerHTML = '<div class="net-stage">' + svg + '</div>' + panel;

  /* ---- Interazione ------------------------------------------------------- */
  wireNetwork(mount, majors, reduced);
}

/* etichetta per nodo secondario in base all'ancoraggio (accetta lbl stringa o array di righe) */
function labelMarkup(n, fs) {
  var lines = Array.isArray(n.lbl) ? n.lbl : [n.lbl];
  var lh = fs + 3;
  var tx = n.x, ty = n.y, anchor = 'middle';
  if (n.la === 'a') { anchor = 'middle'; tx = n.x; ty = n.y - 10 - (lines.length - 1) * lh; }
  else if (n.la === 'b') { anchor = 'middle'; tx = n.x; ty = n.y + 15; }
  else if (n.la === 's') { anchor = 'start'; tx = n.x + 9; ty = n.y + 3 - ((lines.length - 1) * lh) / 2; }
  else if (n.la === 'e') { anchor = 'end'; tx = n.x - 9; ty = n.y + 3 - ((lines.length - 1) * lh) / 2; }
  var tsp = '';
  lines.forEach(function (ln, i) {
    tsp += '<tspan x="' + tx.toFixed(1) + '" dy="' + (i === 0 ? 0 : lh) + '">' + ln + '</tspan>';
  });
  return '<text class="net-minor-lbl" x="' + tx.toFixed(1) + '" y="' + ty.toFixed(1) + '" text-anchor="' + anchor + '" style="font-size:' + fs + 'px">' + tsp + '</text>';
}

/* etichetta (1-2 righe) per nodo maggiore, ancoraggio esplicito per non uscire dal campo */
function majorLabel(n) {
  var lx = n.x + n.dx, ly = n.y + n.dy;
  var lines = n.lbl, lh = 12.5;
  var startY = ly - ((lines.length - 1) * lh) / 2 + 3;
  var tsp = '';
  lines.forEach(function (ln, i) {
    tsp += '<tspan x="' + lx.toFixed(1) + '" dy="' + (i === 0 ? 0 : lh) + '">' + ln + '</tspan>';
  });
  return '<text class="net-major-lbl" x="' + lx.toFixed(1) + '" y="' + startY.toFixed(1) + '" text-anchor="' + n.ax + '">' + tsp + '</text>';
}

function wireNetwork(mount, majors, reduced) {
  var root = mount.querySelector('.net-root');
  var svg = mount.querySelector('.net-svg');
  var edgeEls = Array.prototype.slice.call(mount.querySelectorAll('.net-edge'));
  var majorById = {};
  majors.forEach(function (m) { majorById[m.id] = m; });

  var panelTitle = mount.querySelector('.net-panel-title');
  var panelDesc = mount.querySelector('.net-panel-desc');
  var panelIdx = mount.querySelector('.net-panel-idx');
  var defTitle = panelTitle.textContent;
  var defDesc = panelDesc.textContent;
  var defIdx = panelIdx.textContent;

  function clearHot() {
    mount.querySelectorAll('.is-hot').forEach(function (el) { el.classList.remove('is-hot'); });
    mount.querySelectorAll('.is-sel').forEach(function (el) { el.classList.remove('is-sel'); });
  }

  function setPanel(m) {
    if (m) {
      panelIdx.textContent = 'NODO ' + m.idx;
      panelTitle.textContent = m.key;
      panelDesc.textContent = m.desc;
    } else {
      panelIdx.textContent = defIdx;
      panelTitle.textContent = defTitle;
      panelDesc.textContent = defDesc;
    }
  }

  function apply(id) {
    var m = majorById[id];
    if (!m) return;
    root.classList.add('is-dim');
    clearHot();
    var sel = mount.querySelector('.net-node[data-id="' + id + '"]');
    if (sel) sel.classList.add('is-hot', 'is-sel');
    edgeEls.forEach(function (ln) {
      var a = ln.getAttribute('data-a'), b = ln.getAttribute('data-b');
      if (a === id || b === id) {
        ln.classList.add('is-hot');
        var other = (a === id) ? b : a;
        var oel = mount.querySelector('[data-id="' + other + '"]');
        if (oel) oel.classList.add('is-hot');
      }
    });
    setPanel(m);
  }

  function clearAll() {
    root.classList.remove('is-dim');
    clearHot();
    setPanel(null);
  }

  function refresh() {
    if (ssLocked && majorById[ssLocked]) apply(ssLocked);
    else clearAll();
  }

  majors.forEach(function (m) {
    var g = mount.querySelector('.net-node[data-id="' + m.id + '"]');
    if (!g) return;

    g.addEventListener('pointerenter', function () { apply(m.id); });
    g.addEventListener('focus', function () { apply(m.id); });
    g.addEventListener('pointerleave', function () { refresh(); });
    g.addEventListener('blur', function () { refresh(); });

    function toggle() {
      if (ssLocked === m.id) { ssLocked = null; g.setAttribute('aria-pressed', 'false'); refresh(); }
      else {
        majors.forEach(function (o) {
          var og = mount.querySelector('.net-node[data-id="' + o.id + '"]');
          if (og) og.setAttribute('aria-pressed', o.id === m.id ? 'true' : 'false');
        });
        ssLocked = m.id; apply(m.id);
      }
    }

    g.addEventListener('click', function (e) { e.preventDefault(); toggle(); });
    g.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); toggle(); }
    });
  });

  /* stato iniziale (ripristina eventuale selezione bloccata) */
  if (ssLocked && majorById[ssLocked]) {
    var lg = mount.querySelector('.net-node[data-id="' + ssLocked + '"]');
    if (lg) lg.setAttribute('aria-pressed', 'true');
    apply(ssLocked);
  }

  /* chiudi la selezione toccando lo sfondo */
  svg.addEventListener('click', function (e) {
    if (!e.target.closest('.net-major')) {
      if (ssLocked) {
        var pg = mount.querySelector('.net-node[data-id="' + ssLocked + '"]');
        if (pg) pg.setAttribute('aria-pressed', 'false');
      }
      ssLocked = null; clearAll();
    }
  });

  /* profondità immersiva: parallax multi-piano + lieve inclinazione prospettica
     (solo mouse, se il movimento è consentito) */
  if (!reduced) {
    var lf = mount.querySelector('.net-layer-fine');
    var lm = mount.querySelector('.net-layer-min');
    var raf = 0, tx = 0, ty = 0;
    svg.addEventListener('pointermove', function (e) {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      var r = svg.getBoundingClientRect();
      tx = (e.clientX - r.left) / r.width - 0.5;
      ty = (e.clientY - r.top) / r.height - 0.5;
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = 0;
        /* piano profondo (fini) si muove di più, piano medio (secondari) di meno */
        if (lf) lf.style.transform = 'translate(' + (tx * 12).toFixed(2) + 'px,' + (ty * 12).toFixed(2) + 'px)';
        if (lm) lm.style.transform = 'translate(' + (tx * 5).toFixed(2) + 'px,' + (ty * 5).toFixed(2) + 'px)';
        /* inclinazione 3D dell'intera scena, molto contenuta */
        svg.style.transform = 'rotateY(' + (tx * 4.5).toFixed(2) + 'deg) rotateX(' + (-ty * 4.5).toFixed(2) + 'deg)';
      });
    });
    svg.addEventListener('pointerleave', function () {
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      if (lf) lf.style.transform = '';
      if (lm) lm.style.transform = '';
      svg.style.transform = '';
    });
  }
}

  /* API pubblica: unico simbolo esposto su window, il resto resta privato
     alla IIFE (prima ssRng, buildNetwork, wireNetwork, labelMarkup,
     majorLabel, ssLocked erano tutte globali). */
  window.buildNetwork = buildNetwork;
})();
