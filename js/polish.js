/* ==========================================================================
   SISTEMA SONNO — Polish: micro-interazioni (vedi css/polish.css).
   Header che si addensa/ritira, spotlight sulle card, foto a tendina,
   riga di luce nei titoli, barra di lettura sugli articoli, "torna su".
   Nessuna dipendenza; rispetta prefers-reduced-motion.
   ========================================================================== */
(function () {
  'use strict';
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  document.addEventListener('DOMContentLoaded', function () {
    var root = document.documentElement;
    var header = document.querySelector('.site-header');
    var mobileMenu = document.querySelector('.mobile-menu');

    /* ---- Barra di lettura (solo articoli del blog) ---------------------- */
    var article = document.querySelector('.article-body');
    var bar = null;
    if (article) {
      bar = document.createElement('div');
      bar.className = 'ss-read';
      bar.setAttribute('aria-hidden', 'true');
      document.body.appendChild(bar);
    }

    /* ---- Torna su ------------------------------------------------------- */
    var top = document.createElement('button');
    top.type = 'button';
    top.className = 'ss-top';
    top.setAttribute('aria-label', 'Torna su');
    top.innerHTML =
      '<svg class="ss-ring" viewBox="0 0 48 48" aria-hidden="true"><circle class="ring" cx="24" cy="24" r="23" pathLength="1"/></svg>' +
      '<svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>';
    top.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
      var skip = document.querySelector('.brand');
      if (skip) skip.focus({ preventScroll: true });
    });
    document.body.appendChild(top);

    /* ---- Scroll: un solo listener, lavoro in rAF ------------------------ */
    var lastY = window.scrollY, ticking = false;
    function onFrame() {
      ticking = false;
      var y = window.scrollY;
      var vh = window.innerHeight;
      var max = root.scrollHeight - vh;

      if (header) {
        header.classList.toggle('is-scrolled', y > 24);
        var menuOpen = mobileMenu && mobileMenu.classList.contains('open');
        if (!reduced && !menuOpen && y > 320 && y > lastY + 4) header.classList.add('is-hidden');
        else if (y < lastY - 4 || y <= 320) header.classList.remove('is-hidden');
      }

      top.classList.toggle('show', y > vh * 1.2);
      top.style.setProperty('--o', String(1 - (max > 0 ? y / max : 0)));

      if (bar) {
        var r = article.getBoundingClientRect();
        var total = r.height - vh * 0.6;
        var p = total > 0 ? Math.min(1, Math.max(0, (-r.top + vh * 0.2) / total)) : 0;
        bar.style.setProperty('--p', p.toFixed(4));
      }
      lastY = y;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(onFrame); }
    }, { passive: true });
    window.addEventListener('resize', onFrame, { passive: true });
    onFrame();

    /* ---- Spotlight lunare sulle card in vetro --------------------------- */
    if (finePointer) {
      var cards = document.querySelectorAll('.blog-card, .div-card, .book-panel, .pr-detail .box, .article-callout');
      Array.prototype.forEach.call(cards, function (card) {
        card.classList.add('ss-spot');
        card.addEventListener('pointermove', function (e) {
          var r = card.getBoundingClientRect();
          card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
          card.style.setProperty('--my', (e.clientY - r.top) + 'px');
        });
      });
    }

    if (reduced || !('IntersectionObserver' in window)) {
      document.querySelectorAll('h1, h2').forEach(function (h) { h.classList.add('ss-lit'); });
      return;
    }

    root.classList.add('js-polish');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var t = en.target;
        if (t.matches('h1, h2')) t.classList.add('ss-lit', 'ss-words-in');
        else t.classList.add('ss-in');
        io.unobserve(t);
      });
    }, { threshold: 0.2, rootMargin: '0px 0px -6% 0px' });

    /* ---- Foto a tendina (fuori dall'hero) ------------------------------- */
    document.querySelectorAll('.photo, .split-media').forEach(function (el) {
      if (el.closest('.hero')) return;
      el.classList.add('ss-veil');
      io.observe(el);
    });

    /* ---- Titoli di sezione: parole che salgono + riga di luce ----------- */
    function splitWords(el, wrapCls, wordCls) {
      var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      var nodes = [], i = 0;
      while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach(function (tn) {
        var frag = document.createDocumentFragment();
        tn.textContent.split(/(\s+)/).forEach(function (part) {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
          var w = document.createElement('span');
          w.className = wordCls;
          w.textContent = part;
          w.style.setProperty('--i', i++);
          if (wrapCls) {
            var wl = document.createElement('span');
            wl.className = wrapCls;
            wl.appendChild(w);
            frag.appendChild(wl);
          } else frag.appendChild(w);
        });
        tn.parentNode.replaceChild(frag, tn);
      });
      return el.querySelectorAll('.' + wordCls);
    }
    document.querySelectorAll('main h2').forEach(function (h) {
      if (h.closest('.hero, .map3d-stage, #siteNet, .net-panel')) return;
      h.classList.add('ss-split');
      splitWords(h, 'wl', 'w');
      io.observe(h);
    });
    document.querySelectorAll('h1').forEach(function (h) {
      if (h.querySelector('em') && !h.closest('.hero')) io.observe(h);
    });

    /* ---- Blog: card a cascata ------------------------------------------- */
    document.querySelectorAll('.blog-grid').forEach(function (grid) {
      grid.classList.add('ss-cascade');
      Array.prototype.forEach.call(grid.children, function (c, k) {
        c.style.transitionDelay = ((k % 3) * 90) + 'ms';
        io.observe(c);
      });
    });

    /* ---- Frase manifesto: parole che si accendono con lo scroll --------- */
    var scrubs = [];
    document.querySelectorAll('.statement p').forEach(function (p) {
      p.classList.add('ss-scrub');
      scrubs.push({ el: p, words: splitWords(p, null, 'sw') });
    });
    if (scrubs.length) {
      var scrubTick = false;
      var scrubFrame = function () {
        scrubTick = false;
        var vh = window.innerHeight;
        scrubs.forEach(function (s) {
          var r = s.el.getBoundingClientRect();
          var start = vh * 0.88, end = vh * 0.42;
          var prog = Math.min(1, Math.max(0, (start - r.top) / (start - end + r.height * 0.5)));
          var n = Math.round(prog * s.words.length);
          for (var k = 0; k < s.words.length; k++) s.words[k].classList.toggle('on', k < n);
        });
      };
      window.addEventListener('scroll', function () {
        if (!scrubTick) { scrubTick = true; requestAnimationFrame(scrubFrame); }
      }, { passive: true });
      scrubFrame();
    }

    /* ---- Alone che respira dietro il ritratto --------------------------- */
    var heroPhoto = document.querySelector('.hero .photo');
    if (heroPhoto) {
      var halo = document.createElement('span');
      halo.className = 'ss-halo';
      halo.setAttribute('aria-hidden', 'true');
      heroPhoto.insertBefore(halo, heroPhoto.firstChild);
    }

    /* ---- Stelle cadenti sulle bande scure e nell'hero ------------------- */
    var skies = [];
    document.querySelectorAll('.band, .hero').forEach(function (sec) {
      var sky = document.createElement('div');
      sky.className = 'ss-sky';
      sky.setAttribute('aria-hidden', 'true');
      if (getComputedStyle(sec).position === 'static') sec.style.position = 'relative';
      sec.insertBefore(sky, sec.firstChild);
      var entry = { sky: sky, visible: false };
      skies.push(entry);
      new IntersectionObserver(function (es) { entry.visible = es[0].isIntersecting; }).observe(sec);
    });
    function shoot() {
      if (!document.hidden) {
        var vis = skies.filter(function (s) { return s.visible; });
        if (vis.length) {
          var s = vis[Math.floor(Math.random() * vis.length)];
          var star = document.createElement('span');
          star.className = 'ss-star';
          star.style.left = (35 + Math.random() * 60) + '%';
          star.style.top = (5 + Math.random() * 45) + '%';
          s.sky.appendChild(star);
          setTimeout(function () { star.remove(); }, 1600);
        }
      }
      setTimeout(shoot, 5000 + Math.random() * 9000);
    }
    if (skies.length) setTimeout(shoot, 2500);

    /* ---- Luce lunare che segue il puntatore (desktop) ------------------- */
    if (finePointer) {
      var glow = document.createElement('div');
      glow.className = 'ss-glow';
      glow.setAttribute('aria-hidden', 'true');
      document.body.appendChild(glow);
      var gx = -999, gy = -999, tx = -999, ty = -999, running = false;
      var follow = function () {
        gx += (tx - gx) * 0.12; gy += (ty - gy) * 0.12;
        glow.style.setProperty('--gx', gx.toFixed(1) + 'px');
        glow.style.setProperty('--gy', gy.toFixed(1) + 'px');
        if (Math.abs(tx - gx) > 0.5 || Math.abs(ty - gy) > 0.5) requestAnimationFrame(follow); else running = false;
      };
      window.addEventListener('pointermove', function (e) {
        tx = e.clientX; ty = e.clientY;
        if (gx === -999) { gx = tx; gy = ty; }
        glow.classList.add('on');
        if (!running) { running = true; requestAnimationFrame(follow); }
      }, { passive: true });
      document.documentElement.addEventListener('pointerleave', function () { glow.classList.remove('on'); });
    }
  });
})();
