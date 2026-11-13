/* ==========================================================================
   SISTEMA SONNO — motion di contorno.
   Fasi della rete (IntersectionObserver, funziona anche senza GSAP), luna
   d'avanzamento, ipnogramma; con GSAP: titolo hero, foto, parallax.
   prefers-reduced-motion: niente animazioni, tutto visibile.
   ========================================================================== */
(function () {
  'use strict';
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function setPhase(p) {
    window.__netPhase = p;
    if (window.SleepNet && window.SleepNet.setPhase) window.SleepNet.setPhase(p);
  }

  function depth(el) { var d = 0; while ((el = el.parentElement)) d++; return d; }

  /* avvolge ogni parola in .wl > .w senza alterare textContent */
  function splitWords(el) {
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (tn) {
      var frag = document.createDocumentFragment();
      tn.textContent.split(/(\s+)/).forEach(function (part) {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
        var wl = document.createElement('span'); wl.className = 'wl';
        wl.style.display = 'inline-block'; wl.style.overflow = 'hidden'; wl.style.verticalAlign = 'top';
        var w = document.createElement('span'); w.className = 'w'; w.style.display = 'inline-block';
        w.textContent = part;
        wl.appendChild(w); frag.appendChild(wl);
      });
      tn.parentNode.replaceChild(frag, tn);
    });
    return el.querySelectorAll('.w');
  }

  document.addEventListener('DOMContentLoaded', function () {
    /* ---- Fasi: vince la sezione più interna al centro del viewport ---- */
    var phased = document.querySelectorAll('[data-phase]');
    if (phased.length && 'IntersectionObserver' in window) {
      var active = new Set();
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) active.add(e.target); else active.delete(e.target); });
        var best = null;
        active.forEach(function (el) { if (!best || depth(el) > depth(best)) best = el; });
        if (best) setPhase(best.getAttribute('data-phase'));
      }, { rootMargin: '-48% 0px -48% 0px' });
      phased.forEach(function (el) { io.observe(el); });
    }

    /* ---- Luna dell'header: si riempie con lo scroll ---- */
    var moon = document.querySelector('.site-header .brand svg');
    if (moon) {
      var c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('class', 'moon-progress');
      c.setAttribute('cx', '16'); c.setAttribute('cy', '16'); c.setAttribute('r', '14.5');
      c.setAttribute('pathLength', '1');
      moon.appendChild(c);
      var onScroll = function () {
        var max = document.documentElement.scrollHeight - window.innerHeight;
        c.style.strokeDashoffset = String(1 - (max > 0 ? window.scrollY / max : 0));
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }

    /* ---- Ipnogramma + step del metodo ---- */
    var hyp = document.querySelector('.hypno-path');
    var cols = Array.prototype.slice.call(document.querySelectorAll('#metodo .step-col'));
    var gsap = window.gsap, ST = window.ScrollTrigger;
    if (hyp && (reduced || !gsap || !ST)) cols.forEach(function (col) { col.classList.add('is-lit'); });

    if (reduced || !gsap || !ST) return;
    document.documentElement.classList.add('js-motion');
    gsap.registerPlugin(ST);

    if (hyp) {
      var L = hyp.getTotalLength();
      hyp.style.strokeDasharray = L;
      hyp.style.strokeDashoffset = L;
      var marks = [0.15, 0.5, 0.85];
      ST.create({
        trigger: '#metodo .steps-row', start: 'top 95%', end: 'top 55%', scrub: 0.4,
        onUpdate: function (s) {
          hyp.style.strokeDashoffset = L * (1 - s.progress);
          cols.forEach(function (col, i) { col.classList.toggle('is-lit', s.progress >= marks[i]); });
        }
      });
    }

    /* ---- Hero: titolo parola per parola, foto che emerge dal buio ---- */
    var h1 = document.querySelector('.hero h1');
    if (h1) gsap.from(splitWords(h1), { yPercent: 110, opacity: 0, duration: 1.1, ease: 'power3.out', stagger: 0.06, delay: 0.15 });
    if (document.querySelector('.hero .photo')) {
      gsap.from('.hero .photo', { opacity: 0, scale: 1.06, filter: 'blur(12px)', duration: 1.6, ease: 'power2.out', delay: 0.3, clearProps: 'filter,transform' });
    }

    /* ---- Parallax foto Chi sono ---- */
    if (document.querySelector('#chi-e-cosimo .split-media img')) {
      gsap.to('#chi-e-cosimo .split-media img', {
        yPercent: -8, ease: 'none',
        scrollTrigger: { trigger: '#chi-e-cosimo', start: 'top bottom', end: 'bottom top', scrub: true }
      });
    }

    /* ---- CTA magnetiche e card video in tilt (solo puntatore fine) ---- */
    if (!window.matchMedia('(pointer: fine)').matches) return;
    document.querySelectorAll('.btn-primary').forEach(function (b) {
      b.addEventListener('pointermove', function (e) {
        var r = b.getBoundingClientRect();
        b.style.transform = 'translate(' + ((e.clientX - r.left - r.width / 2) * 0.18).toFixed(1) + 'px,' +
          ((e.clientY - r.top - r.height / 2) * 0.25).toFixed(1) + 'px)';
      });
      b.addEventListener('pointerleave', function () { b.style.transform = ''; });
    });
    document.querySelectorAll('.video-card').forEach(function (card) {
      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform = 'perspective(900px) rotateY(' + (x * 8).toFixed(2) + 'deg) rotateX(' + (-y * 8).toFixed(2) + 'deg)';
      });
      card.addEventListener('pointerleave', function () { card.style.transform = ''; });
    });
  });
})();
