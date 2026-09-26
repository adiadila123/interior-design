(function () {
  'use strict';

  var html = document.documentElement;
  var nav = document.getElementById('siteNav');
  var fill = document.getElementById('scrollFill');
  var burger = document.getElementById('navBurger');
  var mobileMenu = document.getElementById('mobileMenu');
  var preloader = document.getElementById('preloader');
  var preloaderFill = document.getElementById('preloaderFill');
  var toTop = document.getElementById('toTop');
  var heroTrack = document.getElementById('heroTrack');
  var heroVideo = document.getElementById('heroVideo');
  var heroContent = document.getElementById('heroContent');
  var heroScrollCue = document.getElementById('heroScrollCue');

  var reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  var lenis = null;

  // ================= one lightweight scroll clock =================
  // Nav chrome + the progress rail never need GSAP; keep them on a plain
  // rAF-throttled listener so they work even if the CDN libraries fail.
  html.classList.add('js-ready');

  var ticking = false;
  function tick() {
    ticking = false;
    var y = window.scrollY || html.scrollTop;
    nav.classList.toggle('is-scrolled', y > 40);
    var max = html.scrollHeight - html.clientHeight;
    var pct = max > 0 ? (y / max) * 100 : 0;
    fill.style.width = pct + '%';
    if (toTop) toTop.classList.toggle('is-visible', y > window.innerHeight * 0.6);
  }
  function onScroll() {
    if (!ticking) { ticking = true; requestAnimationFrame(tick); }
  }
  document.addEventListener('scroll', onScroll, { passive: true });
  tick();

  // ================= mobile menu =================
  function closeMenu() {
    mobileMenu.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
    nav.classList.remove('menu-open');
    if (lenis) lenis.start();
    tick();
  }
  burger.addEventListener('click', function () {
    var open = mobileMenu.classList.toggle('is-open');
    burger.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('menu-open', open);
    if (lenis) { if (open) lenis.stop(); else lenis.start(); }
    if (!open) tick();
  });
  mobileMenu.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', closeMenu);
  });

  // ================= reduced-motion video fallback =================
  // Applies regardless of whether GSAP loads at all — every ambient
  // background video (hero + the four project panels) just holds its
  // poster frame instead of looping.
  if (reduceQuery.matches) {
    document.querySelectorAll('#heroVideo, .project-video').forEach(function (v) {
      v.removeAttribute('autoplay');
      v.pause();
    });
  }

  // ================= smooth-scroll anchor links =================
  // Compensates for the fixed nav covering a target's top edge; falls back
  // to native anchor jump/scrollIntoView if Lenis never initialises.
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      if (!id || id.length < 2) return;
      var target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      if (lenis) {
        lenis.scrollTo(target, { offset: -72 });
      } else {
        target.scrollIntoView({ behavior: reduceQuery.matches ? 'auto' : 'smooth', block: 'start' });
      }
    });
  });

  // ================= capability check =================
  var gsapAvailable =
    !reduceQuery.matches &&
    typeof window.gsap !== 'undefined' &&
    typeof window.ScrollTrigger !== 'undefined';

  if (!gsapAvailable) {
    // No library, or motion refused: every .reveal/.project-track/.hero
    // element is already fully visible and usable from its base CSS.
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  // ================= Lenis smooth scroll =================
  if (typeof window.Lenis !== 'undefined') {
    lenis = new Lenis({ lerp: 0.11, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  // ================= immersive preloader =================
  function runPreloader() {
    return new Promise(function (resolve) {
      if (!preloader) { resolve(); return; }
      html.classList.add('no-scroll');
      if (lenis) lenis.stop();
      preloader.classList.add('is-active');

      var barTween = gsap.to(preloaderFill, { width: '88%', duration: 1.4, ease: 'power1.out' });

      var fontsReady = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();

      // No image on the page uses loading="lazy", so window's 'load' event
      // genuinely waits for every image (plus CSS) to finish fetching.
      var pageReady = new Promise(function (res) {
        if (document.readyState === 'complete') { res(); return; }
        window.addEventListener('load', res, { once: true });
      });

      // HAVE_ENOUGH_DATA (4): the hero video can play through without
      // stalling, not just that its dimensions are known.
      var videoReady = new Promise(function (res) {
        if (!heroVideo || heroVideo.readyState >= 4) { res(); return; }
        heroVideo.addEventListener('canplaythrough', res, { once: true });
        heroVideo.addEventListener('error', res, { once: true });
      });

      var minDelay = new Promise(function (res) { setTimeout(res, 550); });
      // Safety net only: if a resource genuinely stalls (dropped connection,
      // dead asset), don't leave the site inaccessible forever.
      var hardTimeout = new Promise(function (res) { setTimeout(res, 8000); });

      Promise.race([Promise.all([fontsReady, pageReady, videoReady, minDelay]), hardTimeout]).then(function () {
        barTween.kill();
        gsap.timeline({
          onComplete: function () {
            preloader.classList.remove('is-active');
            html.classList.remove('no-scroll');
            if (lenis) lenis.start();
            resolve();
          },
        })
          .to(preloaderFill, { width: '100%', duration: 0.3, ease: 'power2.out' })
          .to(preloader, { opacity: 0, duration: 0.5, ease: 'power2.inOut' }, 0.08);
      });
    });
  }

  // ================= staggered, scaled reveals =================
  function initReveals() {
    html.classList.add('gsap-ready');
    var groups = gsap.utils.toArray('.reveal');
    if (!groups.length) return;
    gsap.set(groups, { opacity: 0, y: 26, scale: 0.97 });
    ScrollTrigger.batch(groups, {
      start: 'top 88%',
      once: true,
      onEnter: function (batch) {
        batch.forEach(function (el) { el.classList.add('is-visible'); });
        gsap.to(batch, {
          opacity: 1, y: 0, scale: 1,
          duration: 0.9, ease: 'power3.out', stagger: 0.1,
        });
      },
    });
  }

  // ================= scroll-scrubbed video tracks =================
  // Shared by the hero and every project panel: a tall track, a video
  // pinned via sticky inside it, and GSAP driving the video's own
  // currentTime from scroll position — the film literally IS the scrollbar.
  //
  // Runs on touch too: a muted <video> is exempt from autoplay-gesture
  // restrictions, but a video that has never played won't repaint on a
  // programmatic currentTime seek on iOS/touch — armTimeline() below wakes
  // the decoder with a silent play()+pause() before the scrub timeline
  // starts driving currentTime. Reduced-motion still keeps the ambient
  // autoplay loop (base CSS), since the whole cinematics setup is skipped
  // for it upstream (see gsapAvailable).
  //
  // A <video src> streamed straight from an HTTP server only seeks reliably
  // if that server answers Range requests with 206 Partial Content; plenty
  // of static hosts (and simple dev servers) just return 200 and leave
  // video.seekable pinned at [0,0], which freezes every scrub at frame 0.
  // Fetching the file as a Blob and playing it from an in-memory object URL
  // sidesteps that entirely — blobs are always fully seekable.
  //
  // The Bankside project panel reuses the hero's own footage, so its track
  // and the hero track would otherwise both fetch the same multi-MB file at
  // once — wasted bandwidth, and enough load on a single-threaded dev server
  // to stall one of the two requests entirely. Caching the blob promise per
  // URL means every track referencing the same file shares one fetch.
  var blobCache = {};
  function loadAsBlob(url) {
    if (!blobCache[url]) {
      blobCache[url] = fetch(url)
        .then(function (res) { if (!res.ok) throw new Error('scrub video fetch failed: ' + url); return res.blob(); })
        .then(function (blob) { return URL.createObjectURL(blob); });
    }
    return blobCache[url];
  }

  function createScrubTrack(track, video, opts) {
    if (!track || !video) return null;
    opts = opts || {};
    var active = false;

    function activate() {
      active = true;
      track.classList.add('is-scrubbed');

      // The <video autoplay> attribute starts its OWN native buffering
      // connection the instant the page loads — with 5 such videos on the
      // page, those long-lived streaming connections can exhaust the
      // browser's per-origin connection limit and starve the blob fetch
      // below indefinitely. Abort it immediately: clearing src + load()
      // cancels any in-flight network activity for this element.
      var srcEl = video.querySelector('source');
      var videoUrl = srcEl ? srcEl.src : video.currentSrc;
      video.removeAttribute('autoplay');
      video.pause();
      video.src = ''; // the source is a <source> child, not a src attribute — clear the property directly
      video.load();

      loadAsBlob(videoUrl).then(function (objectUrl) {
        if (!active) return; // capability changed mid-fetch
        video.removeAttribute('autoplay');
        video.src = objectUrl;
        video.load();

        var proxy = { t: 0 };
        var duration = 0;

        function armTimeline() {
          duration = video.duration || 0;
          video.currentTime = 0;
          track.setAttribute('data-video-ready', '');

          // Wake the decoder: a muted video is allowed to play() without a
          // user gesture, and a video that has played at least once keeps
          // repainting on later currentTime seeks even while paused.
          var wake = video.play();
          if (wake && typeof wake.then === 'function') {
            wake.then(function () { video.pause(); video.currentTime = 0; }).catch(function () {});
          } else {
            video.pause();
          }

          var tl = gsap.timeline({
            scrollTrigger: {
              trigger: track,
              start: 'top top',
              end: 'bottom bottom',
              scrub: 0.25,
            },
          });
          tl.fromTo(proxy, { t: 0 }, {
            t: 1, duration: 1, ease: 'none',
            onUpdate: function () { if (duration) video.currentTime = proxy.t * duration; },
          }, 0);
          if (opts.scrollCue) tl.to(opts.scrollCue, { opacity: 0, duration: 0.12, ease: 'none' }, 0);
          if (opts.content) tl.to(opts.content, { opacity: 0, y: -36, duration: opts.contentFadeDuration || 0.28, ease: 'none' }, opts.contentFadeStart || 0.72);
          ScrollTrigger.refresh();
        }

        if (video.readyState >= 1) armTimeline();
        else video.addEventListener('loadedmetadata', armTimeline, { once: true });
      }).catch(function () {
        // Offline/CORS/blocked fetch: a scrub that can't seek is worse than
        // no scrub — fall back to the ambient autoplay loop instead.
        deactivate();
      });
    }

    function deactivate() {
      active = false;
      track.classList.remove('is-scrubbed');
      track.removeAttribute('data-video-ready');
      if (!reduceQuery.matches) {
        video.setAttribute('autoplay', '');
        video.play().catch(function () {});
      }
      ScrollTrigger.getAll().forEach(function (st) {
        if (st.trigger === track) st.kill();
      });
    }

    return { activate: activate };
  }

  function initScrubTracks() {
    // Every one of these <video autoplay> elements starts its OWN native
    // buffering connection the instant the page loads, regardless of when
    // (or whether) this script later activates scrubbing for it. With five
    // such videos on the page, those long-lived streaming connections can
    // exhaust the browser's per-origin connection pool and starve every
    // fetch() below indefinitely — including the hero's, even though it
    // activates first. Abort all of them up front, synchronously, before
    // any blob fetch begins: clearing src + load() cancels in-flight
    // network activity for that element. Each video's own native poster
    // attribute keeps showing a frame in the meantime, so nothing blanks.
    document.querySelectorAll('#heroVideo, .project-video').forEach(function (v) {
      v.removeAttribute('autoplay');
      v.pause();
      v.src = '';
      v.load();
    });

    // The hero is always the first thing seen, so it loads immediately.
    var heroInstance = createScrubTrack(heroTrack, heroVideo, {
      content: heroContent,
      scrollCue: heroScrollCue,
      contentFadeStart: 0.72,
    });
    if (heroInstance) heroInstance.activate();

    // Each project's video is 10-15MB. Fetching all four the instant the
    // page loads — on top of the hero's own fetch — means 5 concurrent
    // multi-MB requests fighting for the browser's per-origin connection
    // pool, which can starve every one of them indefinitely. Lazily
    // activate each project track only once it's about to be scrolled
    // into view, so at most one or two of these are ever in flight.
    var lazy = [];
    document.querySelectorAll('.project-track').forEach(function (track) {
      var video = track.querySelector('.project-video');
      var content = track.querySelector('.project-copy');
      var instance = createScrubTrack(track, video, { content: content, contentFadeStart: 0.86, contentFadeDuration: 0.12 });
      if (instance) lazy.push({ track: track, instance: instance });
    });

    if (lazy.length) {
      if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            var match = lazy.filter(function (l) { return l.track === entry.target; })[0];
            if (match) { match.instance.activate(); io.unobserve(entry.target); }
          });
        }, { rootMargin: '100% 0px 100% 0px' });
        lazy.forEach(function (l) { io.observe(l.track); });
      } else {
        lazy.forEach(function (l) { l.instance.activate(); });
      }
    }
  }

  // ================= decorative parallax layers =================
  function initParallax() {
    gsap.utils.toArray('.parallax-num').forEach(function (el) {
      var section = el.closest('.section');
      if (!section) return;
      gsap.to(el, {
        yPercent: -16,
        ease: 'none',
        scrollTrigger: { trigger: section, start: 'top bottom', end: 'bottom top', scrub: true },
      });
    });
    var lines = document.querySelector('.stats__lines');
    if (lines) {
      gsap.to(lines, {
        yPercent: -12,
        ease: 'none',
        scrollTrigger: { trigger: '.stats', start: 'top bottom', end: 'bottom top', scrub: true },
      });
    }
  }

  function initCinematics() {
    initReveals();
    initScrubTracks();
    initParallax();
    ScrollTrigger.refresh();
    window.addEventListener('load', function () { ScrollTrigger.refresh(); });
  }

  runPreloader().then(initCinematics);
})();
