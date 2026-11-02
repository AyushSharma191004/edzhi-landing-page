/* ==========================================================================
   EDZHI HOME – edzhome.js  (navbar scroll + hero video behaviour)
   Load after Bootstrap bundle:  <script src="js/edzhome.js" defer></script>
   ========================================================================== */
(function () {
  'use strict';

  /* ---------- 1. Navbar: solid/blur state after 30px of scroll ---------- */
  var header = document.querySelector('[data-edzhome-header]');
  if (header) {
    var ticking = false;
    var update = function () {
      header.classList.toggle('edzhome-is-scrolled', window.scrollY > 30);
      ticking = false;
    };
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
    }, { passive: true });
    update(); // correct state on load / refresh mid-page
  }

  /* ---------- 2. Mobile menu: close after a link is tapped ---------- */
  var menu = document.getElementById('edzhomeNav');
  if (menu && window.bootstrap) {
    menu.addEventListener('click', function (e) {
      if (e.target.closest('a') && menu.classList.contains('show')) {
        window.bootstrap.Collapse.getOrCreateInstance(menu).hide();
      }
    });
  }

  /* ---------- 3. Hero video (runs only when the <video> is uncommented) ---------- */
  var stage = document.querySelector('[data-edzhome-stage]');
  var video = stage && stage.querySelector('video');
  if (!video) { return; }

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isFs = function () { return document.fullscreenElement || document.webkitFullscreenElement; };
  stage.classList.add('edzhome-has-video');

  // Graceful fallback if the URL is missing or fails to load
  var fail = function () {
    stage.classList.add('edzhome-is-fallback');
    stage.classList.remove('edzhome-has-video');
    video.pause();
  };
  video.addEventListener('error', fail, true); // capture = also catches <source> errors
  if (!video.getAttribute('src') && !(video.querySelector('source') || {}).src) { fail(); }

  // Reduced motion: no autoplay. Otherwise play only while visible (saves CPU/battery)
  if (reduce) { video.removeAttribute('autoplay'); video.pause(); }
  else if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (stage.classList.contains('edzhome-is-fallback')) { return; }
        if (en.isIntersecting) {
          var p = video.play();
          if (p && p.catch) { p.catch(function () {}); }
        } else { video.pause(); }
      });
    }, { threshold: 0.25 }).observe(video);
  }

  // Click anywhere on the frame (or the expand button) → full screen
  stage.addEventListener('click', function () {
    if (stage.classList.contains('edzhome-is-fallback') || isFs()) { return; }
    var req = video.requestFullscreen || video.webkitRequestFullscreen;
    if (req) { req.call(video); }
    else if (video.webkitEnterFullscreen) { video.webkitEnterFullscreen(); } // iOS Safari
  });

  // Full screen: show controls + sound. Exit: back to silent looping preview
  var onFsChange = function () {
    var on = isFs() === video;
    video.controls = on;
    video.muted = !on;
    if (!on && !reduce) { var p = video.play(); if (p && p.catch) { p.catch(function () {}); } }
  };
  document.addEventListener('fullscreenchange', onFsChange);
  document.addEventListener('webkitfullscreenchange', onFsChange);
})();

/* ==========================================================================
   EDZHI HOME – PRODUCT FEATURES (edzhome-features.js)
   Tab switching is 100% Bootstrap. This file only powers the Previous / Next
   arrows of the swipeable nav on small screens:
     • scroll the nav left / right
     • disable an arrow at the start / end
     • hide both arrows when every tab already fits
     • keep the selected tab centred
   Load after the Bootstrap bundle:  <script src="js/edzhome-features.js" defer></script>
   ========================================================================== */
(function () {
  'use strict';

  var wrap = document.querySelector('[data-edzhome-fnav]');
  if (!wrap) { return; }

  var nav = wrap.querySelector('.nav');
  var prev = wrap.querySelector('[data-dir="-1"]');
  var next = wrap.querySelector('[data-dir="1"]');
  var smooth = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';

  function update() {
    var max = nav.scrollWidth - nav.clientWidth;
    prev.disabled = nav.scrollLeft <= 1;
    next.disabled = nav.scrollLeft >= max - 1;
    wrap.classList.toggle('edzhome-no-overflow', max <= 1);
  }

  [prev, next].forEach(function (btn) {
    btn.addEventListener('click', function () {
      nav.scrollBy({ left: Number(btn.getAttribute('data-dir')) * nav.clientWidth * 0.7, behavior: smooth });
    });
  });

  // When a tab is selected, centre it inside the scrollable nav (no page jump)
  nav.addEventListener('shown.bs.tab', function (e) {
    var t = e.target;
    nav.scrollTo({ left: t.offsetLeft - (nav.clientWidth - t.offsetWidth) / 2, behavior: smooth });
  });

  nav.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
})();

/* ==========================================================================
   EDZHI HOME – TESTIMONIAL CAROUSEL (edzhome-testimonials.js)
   • Continuous auto-scroll on a native scroll container (touch/trackpad swipe works)
   • Seamless loop: the card group is cloned twice, position wraps by one group width
   • Pauses on hover, focus, touch and wheel; resumes shortly after
   • Marks the card crossing the centre (.edzhome-is-center)
   Load after Bootstrap:  <script src="js/edzhome-testimonials.js" defer></script>
   ========================================================================== */
(function () {
  'use strict';

  var sc = document.querySelector('[data-edzhome-carousel]');
  if (!sc) { return; }

  var track = sc.querySelector('.edzhome-ttrack');
  var group = track.firstElementChild;
  var SPEED = 40;                                   // px per second (raise = faster)
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Two clones (hidden from assistive tech) → 3 identical groups
  for (var i = 0; i < 2; i++) {
    var clone = group.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    track.appendChild(clone);
  }

  var w = 0, pos = 0, last = 0, paused = false, visible = true, timer = 0;

  function measure() { w = group.getBoundingClientRect().width; }
  function start() { measure(); pos = w; sc.scrollLeft = w; }          // begin in the middle copy

  // Keep the position inside the middle copy so the loop never shows an edge
  function wrap() {
    var sl = sc.scrollLeft;
    if (sl >= 2 * w) { sc.scrollLeft = sl - w; pos = sc.scrollLeft; }
    else if (sl <= 1) { sc.scrollLeft = sl + w; pos = sc.scrollLeft; }
  }

  function tick(t) {
    var dt = Math.min(t - (last || t), 50);
    last = t;
    if (!paused && visible && !reduce) {
      pos += SPEED * dt / 1000;
      if (pos >= 2 * w) { pos -= w; }
      sc.scrollLeft = pos;
    }
    window.requestAnimationFrame(tick);
  }

  function pause() { paused = true; window.clearTimeout(timer); }
  function resume(delay) {
    window.clearTimeout(timer);
    timer = window.setTimeout(function () { pos = sc.scrollLeft; paused = false; }, delay || 0);
  }

  sc.addEventListener('scroll', function () { if (paused) { pos = sc.scrollLeft; } wrap(); }, { passive: true });
  sc.addEventListener('mouseenter', pause);
  sc.addEventListener('mouseleave', function () { resume(0); });
  sc.addEventListener('focusin', pause);
  sc.addEventListener('focusout', function () { resume(0); });
  sc.addEventListener('touchstart', pause, { passive: true });
  sc.addEventListener('touchend', function () { resume(2000); }, { passive: true });
  sc.addEventListener('wheel', function () { pause(); resume(1500); }, { passive: true });
  window.addEventListener('resize', function () { var r = sc.scrollLeft / (w || 1); measure(); sc.scrollLeft = r * w; pos = sc.scrollLeft; });

  if ('IntersectionObserver' in window) {
    // Only animate while the carousel is on screen
    new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }).observe(sc);
    // Highlight the card crossing the centre line
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { e.target.classList.toggle('edzhome-is-center', e.isIntersecting); });
    }, { root: sc, rootMargin: '0px -49% 0px -49%' });
    Array.prototype.forEach.call(sc.querySelectorAll('.edzhome-tcard'), function (c) { io.observe(c); });
  }

  start();
  window.requestAnimationFrame(tick);
})();

/* ==========================================================================
   EDZHI – SCROLL REVEAL (append to edzhi.js, or load as its own file)
   One shared IntersectionObserver. Each element reveals once, then the helper
   classes are removed so the element goes back to its normal CSS (hover etc.).
   Add or remove selectors in SEL to change what animates.
   ========================================================================== */
(function () {
  'use strict';

  if (!('IntersectionObserver' in window) ||
      (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) { return; }

  var SEL = [
    /* hero (staggered on load) */
    '.edzhome-hero__title', '.edzhome-hero__text', '.edzhome-hero .edzhome-btn--primary', '.edzhome-proof', '.edzhome-demo',
    /* section headings */
    '.edzhome-head', '.edzhome-eyebrow', '.edzhome-title', '.edzhome-trust__title',
    /* rows, cards, lists */
    '.edzhome-marquee', '.edzhome-steps > li', '.edzhome-funnel > li',
    '.edzhome-section .row > [class*="col"]', '.edzhome-footer .row > [class*="col"]',
    /* single blocks */
    '.edzhome-int__cta', '.edzhome-benefits', '.edzhome-price__note', '.edzhome-cmp',
    '.edzhome-tscroll', '.edzhome-rating', '.edzhome-footer__bar'
  ].join(',');

  var items = [], seen = new Map();

  Array.prototype.forEach.call(document.querySelectorAll(SEL), function (el) {
    // skip tab-pane content (Bootstrap already fades it) and anything inside an element that is revealed itself
    if (el.closest('.tab-pane') || (el.parentElement && el.parentElement.closest('.edzhome-rv'))) { return; }
    var p = el.parentElement, i = seen.get(p) || 0;
    seen.set(p, i + 1);
    el.style.setProperty('--edzhome-rv-d', (i % 4) * 90 + 'ms');    // left-to-right stagger
    el.classList.add('edzhome-rv');
    items.push(el);
  });

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) { return; }
      var el = e.target;
      io.unobserve(el);
      el.classList.add('edzhome-in');
      var d = parseInt(el.style.getPropertyValue('--edzhome-rv-d'), 10) || 0;
      window.setTimeout(function () {                                   // hand the element back to its own CSS
        el.classList.remove('edzhome-rv', 'edzhome-in');
        el.style.removeProperty('--edzhome-rv-d');
      }, 700 + d + 150);
    });
  }, { threshold: 0, rootMargin: '0px 0px -8% 0px' });

  items.forEach(function (el) { io.observe(el); });
})();