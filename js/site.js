/* ==========================================================================
   SISTEMA SONNO — interazioni di pagina
   ========================================================================== */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {

    /* ---- Mobile menu ---------------------------------------------------- */
    var menuBtn = document.querySelector('.menu-btn');
    var mobileMenu = document.querySelector('.mobile-menu');
    if (menuBtn && mobileMenu) {
      menuBtn.addEventListener('click', function () {
        mobileMenu.classList.add('open');
      });
      mobileMenu.querySelector('.mobile-close').addEventListener('click', function () {
        mobileMenu.classList.remove('open');
      });
      mobileMenu.querySelectorAll('a').forEach(function (a) {
        a.addEventListener('click', function () { mobileMenu.classList.remove('open'); });
      });
    }

    /* ---- Reveal on scroll (+ stagger sui gruppi di card/colonne) -------- */
    var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    var STAGGER_GROUPS = ['.problem-list', '.steps-row', '.target-grid', '.team-grid', '.book-steps'];
    if (!reduceMotion) {
      STAGGER_GROUPS.forEach(function (sel) {
        document.querySelectorAll(sel).forEach(function (group) {
          var items = group.querySelectorAll(':scope > .reveal');
          items.forEach(function (item, i) {
            item.style.transitionDelay = (i * 120) + 'ms';
          });
        });
      });
    }

    var revealEls = document.querySelectorAll('.reveal');
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            en.target.classList.add('in');
            io.unobserve(en.target);
          }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
      revealEls.forEach(function (el) { io.observe(el); });
    } else {
      revealEls.forEach(function (el) { el.classList.add('in'); });
    }

    /* ---- Count-up sui numeri chiave (+5000, 270€, ...) ------------------- */
    function animateCountUp(el) {
      var raw = el.getAttribute('data-countup');
      var target = raw !== null ? parseFloat(raw) : parseFloat((el.textContent || '').replace(/[^\d.-]/g, ''));
      if (isNaN(target)) return;
      var prefix = el.getAttribute('data-prefix') || '';
      var suffix = el.getAttribute('data-suffix') || '';

      if (reduceMotion) {
        el.textContent = prefix + target + suffix;
        return;
      }

      var duration = 900;
      var startTs = null;
      function step(ts) {
        if (!startTs) startTs = ts;
        var progress = Math.min((ts - startTs) / duration, 1);
        var eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = prefix + Math.round(target * eased) + suffix;
        if (progress < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }

    var countEls = document.querySelectorAll('[data-countup]');
    if (countEls.length) {
      if ('IntersectionObserver' in window) {
        var countIo = new IntersectionObserver(function (entries) {
          entries.forEach(function (en) {
            if (en.isIntersecting) {
              animateCountUp(en.target);
              countIo.unobserve(en.target);
            }
          });
        }, { threshold: 0.4 });
        countEls.forEach(function (el) { countIo.observe(el); });
      } else {
        countEls.forEach(function (el) { animateCountUp(el); });
      }
    }

    /* ---- FAQ accordion ----------------------------------------------------- */
    document.querySelectorAll('.faq-item').forEach(function (item) {
      var q = item.querySelector('.faq-q');
      q.addEventListener('click', function () {
        var wasOpen = item.classList.contains('open');
        document.querySelectorAll('.faq-item.open').forEach(function (o) { o.classList.remove('open'); });
        if (!wasOpen) item.classList.add('open');
      });
    });

    /* ---- "Ti riconosci?": righe con dettaglio a comparsa (stesso pattern FAQ) -- */
    document.querySelectorAll('.problem-row').forEach(function (row) {
      var trigger = row.querySelector('.pr-trigger');
      var toggleLabel = row.querySelector('.pr-toggle-label');
      if (!trigger) return;
      trigger.addEventListener('click', function () {
        var wasOpen = row.classList.contains('open');
        document.querySelectorAll('.problem-row.open').forEach(function (r) {
          r.classList.remove('open');
          r.querySelector('.pr-trigger').setAttribute('aria-expanded', 'false');
          var lbl = r.querySelector('.pr-toggle-label');
          if (lbl) lbl.textContent = '+ Approfondisci';
        });
        if (!wasOpen) {
          row.classList.add('open');
          trigger.setAttribute('aria-expanded', 'true');
          if (toggleLabel) toggleLabel.textContent = '− Richiudi';
        }
      });
    });

    /* ---- Gli ambiti: dettaglio a comparsa (stesso pattern FAQ, apertura indipendente) -- */
    document.querySelectorAll('.ambito').forEach(function (item) {
      var trigger = item.querySelector('.ambito-trigger');
      var toggleLabel = item.querySelector('.a-toggle-label');
      if (!trigger) return;
      function toggleAmbito() {
        var wasOpen = item.classList.contains('open');
        item.classList.toggle('open', !wasOpen);
        trigger.setAttribute('aria-expanded', String(!wasOpen));
        if (toggleLabel) toggleLabel.textContent = !wasOpen ? '− Richiudi' : '+ Approfondisci';
      }
      trigger.addEventListener('click', toggleAmbito);
      trigger.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault();
          toggleAmbito();
        }
      });
    });

    /* ---- Video testimonianze: play inline ------------------------------------ */
    document.querySelectorAll('.video-frame[data-video]').forEach(function (frame) {
      var btn = frame.querySelector('.play-btn');
      if (!btn) return;
      btn.addEventListener('click', function () {
        var src = frame.getAttribute('data-video');
        var v = document.createElement('video');
        v.src = src;
        v.controls = true;
        v.autoplay = true;
        v.setAttribute('playsinline', '');
        frame.appendChild(v);
        btn.remove();
        var img = frame.querySelector('img');
        if (img) img.style.opacity = '0';
      });
    });

    /* ---- Anno footer ----------------------------------------------------------- */
    var y = document.querySelector('[data-year]');
    if (y) y.textContent = new Date().getFullYear();
  });
})();
