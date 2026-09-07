/* =========================================================
   LUXURY GROUP — main.js
   Hero scroll-scrubbing por secuencia de frames + interacciones
   ========================================================= */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var coarse = window.matchMedia('(hover: none), (pointer: coarse)').matches;
  var isMobile = window.innerWidth < 900;

  /* -------------------------------------------------
     1. SECUENCIA DE FRAMES
     ------------------------------------------------- */
  var SET = isMobile
    ? { dir: 'assets/frames/', pre: 'm_', count: 120 }
    : { dir: 'assets/frames/', pre: 'd_', count: 240 };

  var frames = new Array(SET.count);
  var loadedCount = 0;
  var canvas = document.getElementById('heroCanvas');
  var ctx = canvas.getContext('2d', { alpha: false });
  var currentDrawn = -1;

  function src(i) {
    return SET.dir + SET.pre + String(i + 1).padStart(3, '0') + '.webp';
  }

  function loadFrame(i) {
    return new Promise(function (res) {
      if (frames[i]) return res();
      var img = new Image();
      img.decoding = 'async';
      img.onload = function () { frames[i] = img; loadedCount++; res(); };
      img.onerror = function () { loadedCount++; res(); };
      img.src = src(i);
    });
  }

  function nearest(i) {
    if (frames[i]) return frames[i];
    for (var d = 1; d < SET.count; d++) {
      if (frames[i - d]) return frames[i - d];
      if (frames[i + d]) return frames[i + d];
    }
    return null;
  }

  function sizeCanvas() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    currentDrawn = -1;
  }

  function draw(i) {
    var img = nearest(i);
    if (!img) return;
    var cw = canvas.width, ch = canvas.height;
    var ir = img.width / img.height, cr = cw / ch;
    var dw, dh, dx, dy;
    if (cr > ir) { dw = cw; dh = cw / ir; dx = 0; dy = (ch - dh) / 2; }
    else { dh = ch; dw = ch * ir; dy = 0; dx = (cw - dw) * (isMobile ? 0.42 : 0.5); }
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  /* -------------------------------------------------
     2. PRELOAD + LOADER
     ------------------------------------------------- */
  var loader = document.getElementById('loader');
  var bar = document.getElementById('loaderBar');
  var num = document.getElementById('loaderNum');

  function setProgress(p) {
    var v = Math.round(p * 100);
    bar.style.width = v + '%';
    num.textContent = v;
  }

  function boot() {
    // Pase 1: 1 de cada 6 frames -> permite entrar rápido
    var priority = [];
    for (var i = 0; i < SET.count; i += 6) priority.push(i);
    if (priority[priority.length - 1] !== SET.count - 1) priority.push(SET.count - 1);

    var done = 0;
    var jobs = priority.map(function (i) {
      return loadFrame(i).then(function () {
        done++;
        setProgress(done / priority.length);
      });
    });

    Promise.all(jobs).then(function () {
      sizeCanvas();
      draw(0);
      setProgress(1);
      setTimeout(reveal, 420);
      // Pase 2: el resto, en segundo plano, de a tandas
      rest();
    });
  }

  function rest() {
    var queue = [];
    for (var i = 0; i < SET.count; i++) if (!frames[i]) queue.push(i);
    var CHUNK = 8, idx = 0;
    function next() {
      if (idx >= queue.length) return;
      var batch = queue.slice(idx, idx + CHUNK).map(loadFrame);
      idx += CHUNK;
      Promise.all(batch).then(function () {
        currentDrawn = -1;
        onScroll();
        next();
      });
    }
    next();
  }

  function reveal() {
    loader.classList.add('is-done');
    document.body.classList.remove('is-loading');
    onScroll();
    document.querySelectorAll('#hero [data-split]').forEach(split);
    setTimeout(function () {
      var s1 = document.querySelector('.hero__stage[data-stage="1"]');
      if (s1) s1.classList.add('is-on');
    }, 120);
  }

  /* -------------------------------------------------
     3. SCROLL SUAVE (lerp, conserva position:sticky)
     ------------------------------------------------- */
  var smooth = !reduce && !coarse;
  var target = window.scrollY, current = window.scrollY, ticking = false;
  var loop = function () {
    current += (target - current) * 0.11;
    if (Math.abs(target - current) < 0.4) { current = target; ticking = false; }
    window.scrollTo(0, current);
    if (ticking) requestAnimationFrame(loop);
  };

  function maxScroll() {
    return document.documentElement.scrollHeight - window.innerHeight;
  }

  if (smooth) {
    window.addEventListener('wheel', function (e) {
      if (document.body.classList.contains('menu-open')) return;
      e.preventDefault();
      target = Math.max(0, Math.min(maxScroll(), target + e.deltaY));
      if (!ticking) { ticking = true; requestAnimationFrame(loop); }
    }, { passive: false });

    window.addEventListener('scroll', function () {
      if (!ticking) { target = current = window.scrollY; }
    }, { passive: true });
  }

  function scrollToEl(el) {
    var y = el.getBoundingClientRect().top + window.scrollY;
    if (smooth) {
      target = Math.max(0, Math.min(maxScroll(), y));
      if (!ticking) { ticking = true; requestAnimationFrame(loop); }
    } else {
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  }

  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      if (id === '#') return;
      var el = document.querySelector(id);
      if (!el) return;
      e.preventDefault();
      closeMenu();
      scrollToEl(el);
    });
  });

  /* -------------------------------------------------
     4. HERO: progreso, frames, etapas
     ------------------------------------------------- */
  var hero = document.getElementById('hero');
  var heroBar = document.getElementById('heroBar');
  var cue = document.getElementById('scrollCue');
  var stages = Array.prototype.slice.call(document.querySelectorAll('.hero__stage'));
  var RANGES = [[0, 0.22], [0.32, 0.58], [0.68, 1.01]];
  var wa = document.querySelector('.wa');
  var nav = document.getElementById('nav');
  var lastY = 0;

  function onScroll() {
    var y = window.scrollY;
    var range = hero.offsetHeight - window.innerHeight;
    var p = range > 0 ? Math.max(0, Math.min(1, y / range)) : 0;

    var idx = Math.min(SET.count - 1, Math.round(p * (SET.count - 1)));
    if (idx !== currentDrawn) { draw(idx); currentDrawn = idx; }

    heroBar.style.width = (p * 100).toFixed(2) + '%';
    if (cue) cue.classList.toggle('is-off', p > 0.04);

    stages.forEach(function (s, i) {
      var r = RANGES[i];
      s.classList.toggle('is-on', p >= r[0] && p < r[1]);
    });

    // nav
    nav.classList.toggle('is-stuck', y > window.innerHeight * 0.6);
    nav.classList.toggle('is-hidden', y > lastY + 4 && y > window.innerHeight && !document.body.classList.contains('menu-open'));
    lastY = y;

    // whatsapp flotante
    if (wa) wa.classList.toggle('is-on', y > window.innerHeight * 1.2);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', function () {
    isMobile = window.innerWidth < 900;
    sizeCanvas();
    onScroll();
  });

  /* -------------------------------------------------
     5. SPLIT TEXT + REVEALS
     ------------------------------------------------- */
  function split(el) {
    if (el.dataset.done === '1') return;
    var txt = el.textContent.trim();
    el.dataset.raw = txt;
    el.innerHTML = txt.split(/\s+/).map(function (w) {
      return '<span class="word"><i>' + w + '</i></span>';
    }).join(' ');
    el.dataset.done = '1';
  }

  document.querySelectorAll('[data-split-lines]').forEach(split);

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      var el = en.target;
      if (el.hasAttribute('data-split') || el.hasAttribute('data-split-lines')) split(el);
      el.classList.add('is-on');
      if (el.classList.contains('stat') || el.querySelector('[data-count]')) count(el);
      io.unobserve(el);
    });
  }, { threshold: 0.2, rootMargin: '0px 0px -8% 0px' });

  document.querySelectorAll('.reveal, [data-split-lines], main section:not(#hero) [data-split]')
    .forEach(function (el) { io.observe(el); });

  function count(scope) {
    scope.querySelectorAll('[data-count]').forEach(function (el) {
      var to = parseInt(el.dataset.count, 10), t0 = null;
      function step(t) {
        if (!t0) t0 = t;
        var k = Math.min(1, (t - t0) / 1400);
        el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3)));
        if (k < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }

  /* -------------------------------------------------
     6. CURSOR
     ------------------------------------------------- */
  if (!coarse) {
    var cur = document.querySelector('.cursor');
    var dot = cur.querySelector('.cursor__dot');
    var ring = cur.querySelector('.cursor__ring');
    var mx = window.innerWidth / 2, my = window.innerHeight / 2, rx = mx, ry = my;

    window.addEventListener('mousemove', function (e) {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = 'translate(' + mx + 'px,' + my + 'px) translate(-50%,-50%)';
    });
    (function ring_loop() {
      rx += (mx - rx) * 0.14; ry += (my - ry) * 0.14;
      ring.style.transform = 'translate(' + rx + 'px,' + ry + 'px) translate(-50%,-50%)';
      requestAnimationFrame(ring_loop);
    })();

    document.querySelectorAll('a, button, [data-cursor="link"], .exp__item').forEach(function (el) {
      el.addEventListener('mouseenter', function () { cur.classList.add('is-hover'); });
      el.addEventListener('mouseleave', function () { cur.classList.remove('is-hover'); });
    });
  }

  /* -------------------------------------------------
     7. MENÚ MOBILE
     ------------------------------------------------- */
  var burger = document.getElementById('burger');
  function closeMenu() { document.body.classList.remove('menu-open'); }
  if (burger) {
    burger.addEventListener('click', function () {
      document.body.classList.toggle('menu-open');
    });
  }

  /* -------------------------------------------------
     8. i18n  ES / EN
     ------------------------------------------------- */
  var DICT = {
    en: {
      'nav.exp': 'Experiences', 'nav.partners': 'Partners', 'nav.fleet': 'The Fleet',
      'nav.about': 'About', 'nav.cta': 'Book now',
      'hero.eyebrow': 'Mendoza · Argentina',
      'hero.t1': 'Creators of exclusive experiences',
      'hero.t2': 'Experience Mendoza like no one else',
      'hero.p2': 'A luxury van, a private driver and the Andes as a backdrop.',
      'hero.t3': 'The road to the vineyards starts here',
      'hero.cta': 'Design your experience',
      'hero.scroll': 'Scroll',
      'man.eyebrow': 'Who we are',
      'man.text': 'We are a benchmark in Mendoza tourism. Our deep connection with the region is what turns a trip into a memory: wineries that never make the guidebooks, tables held where there are no tables, and enough time never to rush a thing.',
      'stat.1': 'Years crafting itineraries', 'stat.2': 'Partner wineries', 'stat.3': '% tailor-made itineraries',
      'exp.eyebrow': 'Experiences', 'exp.title': 'Five ways to travel Mendoza',
      'exp.1.t': 'Wine Tours',
      'exp.1.p': 'We handpick the finest wineries in Luján de Cuyo, Maipú and the Uco Valley so every visit is memorable. Private tastings, barrel rooms and long afternoons among the vines.',
      'exp.2.t': 'Fine dining',
      'exp.2.p': 'Lunches facing the mountains or late dinners by acclaimed chefs. We work with Catena Zapata, Nieto Senetiner and Casa Naoki, among other hard-to-get tables.',
      'exp.3.t': 'Accommodation',
      'exp.3.p': 'First-class hotels matched to each trip: Park Hyatt, Huentala Wines, Diplomatic and Arena. We book, coordinate and drive you there.',
      'exp.4.t': 'Scenic flights',
      'exp.4.p': 'Enjoy a sunrise or a sunset flying over vineyards and olive groves, with the Andes rising behind you.',
      'exp.5.t': 'Bespoke experiences',
      'exp.5.p': 'We build the whole itinerary around what matters to you: anniversaries, corporate trips, small groups or a single perfect day.',
      'al.eyebrow': 'Partners', 'al.title': 'The doors we open',
      'fl.eyebrow': 'The fleet', 'fl.title': 'Mercedes-Benz Sprinter',
      'fl.p': 'A luxury van reserved exclusively for our guests. Facing leather captain seats, independent climate control, onboard wifi and a bilingual driver. The transfer stops being dead time between wineries and becomes part of the experience.',
      'fl.s1': 'Passengers', 'fl.s2': 'Bilingual driver', 'fl.s3': 'Availability',
      'cta.eyebrow': 'Bookings', 'cta.title': 'Tell us what you want to live',
      'cta.p': 'Write to us and we will build the itinerary with you. No endless forms — one message is enough.',
      'cta.btn': 'Message us on WhatsApp',
      'man.cap': 'On board · Uco Valley',
      'foot.tag': 'Creators of exclusive experiences · Mendoza, Argentina'
    }
  };

  var ES = {};
  document.querySelectorAll('[data-i18n]').forEach(function (el) {
    ES[el.dataset.i18n] = el.dataset.raw || el.textContent.trim();
  });

  var langBtn = document.getElementById('lang');
  var lang = 'es';
  try { lang = localStorage.getItem('lg-lang') || 'es'; } catch (e) {}

  function apply(l) {
    lang = l;
    var d = l === 'en' ? DICT.en : ES;
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var v = d[el.dataset.i18n];
      if (!v) return;
      if (el.hasAttribute('data-split') || el.hasAttribute('data-split-lines')) {
        el.dataset.done = '0';
        el.textContent = v;
        if (el.classList.contains('is-on') || el.closest('.hero')) split(el);
      } else {
        el.textContent = v;
      }
    });
    document.documentElement.lang = l;
    langBtn.querySelector('.lang__on').textContent = l.toUpperCase();
    langBtn.querySelector('.lang__off').textContent = l === 'es' ? 'EN' : 'ES';
    try { localStorage.setItem('lg-lang', l); } catch (e) {}
  }

  langBtn.addEventListener('click', function () { apply(lang === 'es' ? 'en' : 'es'); });
  if (lang === 'en') setTimeout(function () { apply('en'); }, 60);

  /* -------------------------------------------------
     8b. PARALLAX SUAVE
     ------------------------------------------------- */
  var px = Array.prototype.slice.call(document.querySelectorAll('[data-parallax]'));
  if (px.length && !reduce) {
    (function ploop() {
      px.forEach(function (el) {
        var r = el.parentElement.getBoundingClientRect();
        if (r.bottom < -200 || r.top > window.innerHeight + 200) return;
        var k = (r.top + r.height / 2 - window.innerHeight / 2) / window.innerHeight;
        el.style.transform = 'translateY(' + (k * -6).toFixed(2) + '%)';
      });
      requestAnimationFrame(ploop);
    })();
  }

  /* -------------------------------------------------
     9. INIT
     ------------------------------------------------- */
  document.getElementById('yr').textContent = new Date().getFullYear();
  sizeCanvas();
  boot();
})();
