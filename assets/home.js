/* Inkline home page: the scroll animation, reveals, the ink line, and the hold-to-rewrite demo. */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const smoothstep = (p, e0, e1) => { const t = clamp((p - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
  const reduceMQ = matchMedia('(prefers-reduced-motion: reduce)');

  // ---------- split headline text once, with seeded offsets so every load looks the same ----------
  function rng(seed) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
  document.querySelectorAll('.split').forEach((el, n) => {
    const text = el.textContent.trim();
    const rand = rng(97 + n * 31);
    const chars = el.classList.contains('chars');
    const spread = parseFloat(el.closest('.band') && el.closest('.band').dataset.spread) || 0.55;
    const words = text.split(' ');
    const total = text.replace(/ /g, '').length;
    let ci = 0;
    const vis = document.createElement('span');
    vis.setAttribute('aria-hidden', 'true');
    words.forEach((word, wi) => {
      const w = document.createElement('span');
      w.className = 'w';
      w.style.setProperty('--th', (wi / Math.max(1, words.length) * 0.5).toFixed(3));
      if (chars) {
        [...word].forEach(ch => {
          const c = document.createElement('span');
          c.className = 'c'; c.textContent = ch;
          c.style.setProperty('--th', (rand() * spread).toFixed(3));
          c.style.setProperty('--jx', ((rand() - .5) * 90).toFixed(1) + 'px');
          c.style.setProperty('--jy', ((rand() - .5) * 70).toFixed(1) + 'px');
          c.style.setProperty('--jr', ((rand() - .5) * 40).toFixed(1) + 'deg');
          w.appendChild(c); ci++;
        });
      } else w.textContent = word;
      vis.appendChild(w);
      if (wi < words.length - 1) vis.appendChild(document.createTextNode(' '));
    });
    const sr = document.createElement('span');
    sr.className = 'sr-only'; sr.textContent = text;
    el.textContent = '';
    el.append(sr, vis);
  });

  // ---------- the scrub hero ----------
  const hero = $('#top'), stage = $('#stage'), canvas = $('#hero'), posterLayer = $('#poster'), ring = $('#ring'), cue = $('#cue');
  // The footage plays as a sequence of still frames drawn to a canvas. Unlike seeking a video,
  // this runs the same in every browser, forwards and backwards, including Safari.
  const FRAME_COUNT = 96;
  // Upright phones and narrow windows get a tall crop of the footage (smaller, and framed for portrait).
  const FRAME_SETS = { wide: 'assets/frames/', tall: 'assets/frames-m/' };
  const TALL = matchMedia('(max-aspect-ratio: 4/5)');
  let frameSet = TALL.matches ? 'tall' : 'wide', frameGen = 0;
  const frameSrc = i => `${FRAME_SETS[frameSet]}f${String(i + 1).padStart(3, '0')}.jpg`;
  const ctx = canvas.getContext('2d');
  const bands = [...document.querySelectorAll('.band')].map((el, i, all) => ({
    el, a: parseFloat(el.dataset.a), b: parseFloat(el.dataset.b),
    ramp: parseFloat(el.dataset.ramp) || 0, first: i === 0, last: i === all.length - 1, op: -1, k: -1, off: null
  }));

  function heroProgress() {
    const range = hero.offsetHeight - innerHeight;
    if (range <= 0) return 0;
    return clamp(-hero.getBoundingClientRect().top / range, 0, 1);
  }

  let loadK = 0, loadStart = 0, lastDeep = -1;
  const deepEl = $('#deep');
  function updateCaptions(p) {
    bands.forEach(bd => {
      const { a, b } = bd;
      const f = Math.min(0.02, (b - a) / 3);
      const op = (bd.first ? 1 : smoothstep(p, a, a + f)) * (bd.last ? 1 : 1 - smoothstep(p, b - f, b));
      let k = clamp((p - a) / (bd.ramp || Math.min(0.025, (b - a) * 0.35)), 0, 1);
      if (bd.first) k = Math.max(k, loadK);
      if (Math.abs(op - bd.op) > 0.004 || (op === 0) !== (bd.op === 0) || op === 1 && bd.op !== 1) { bd.el.style.opacity = op.toFixed(3); bd.op = op; }
      if (Math.abs(k - bd.k) > 0.008 || (k === 1 && bd.k !== 1) || (k === 0 && bd.k !== 0)) { bd.el.style.setProperty('--k', k.toFixed(3)); bd.k = k; }
      const off = op < 0.02;
      if (off !== bd.off) { bd.el.classList.toggle('off', off); bd.off = off; }
    });
    const deep = smoothstep(p, 0.72, 1);
    if (Math.abs(deep - lastDeep) > 0.004 || (deep === 1 && lastDeep !== 1) || (deep === 0 && lastDeep !== 0)) { deepEl.style.setProperty('--deep', deep.toFixed(3)); lastDeep = deep; }
    const gone = p > 0.03;
    if (gone !== cue.classList.contains('gone')) cue.classList.toggle('gone', gone);
  }

  // Band one assembles by itself on load, then hands over to scroll.
  function loadRamp(now) {
    if (!loadStart) loadStart = now;
    loadK = clamp((now - loadStart - 250) / 1100, 0, 1);
    loadK = 1 - Math.pow(1 - loadK, 3);
    updateCaptions(scrubOn ? shown : heroProgress());
    if (loadK < 1) requestAnimationFrame(loadRamp);
  }

  // drawing: show the frame for a progress value, or the nearest frame loaded so far
  const frames = new Array(FRAME_COUNT);
  let loadedCount = 0, lastDrawn = -1;
  function nearestLoaded(i) {
    if (frames[i]) return i;
    for (let d = 1; d < FRAME_COUNT; d++) {
      if (i - d >= 0 && frames[i - d]) return i - d;
      if (i + d < FRAME_COUNT && frames[i + d]) return i + d;
    }
    return -1;
  }
  function drawFrame(p) {
    const i = nearestLoaded(Math.round(clamp(p, 0, 1) * (FRAME_COUNT - 1)));
    if (i < 0 || i === lastDrawn || !canvas.width) return;
    const img = frames[i], cw = canvas.width, ch = canvas.height;
    const s = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);   // cover, like object-fit
    const w = img.naturalWidth * s, h = img.naturalHeight * s;
    ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
    lastDrawn = i;
  }
  function sizeCanvas() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(stage.clientWidth * dpr), h = Math.round(stage.clientHeight * dpr);
    if (canvas.width === w && canvas.height === h) return;
    canvas.width = w; canvas.height = h;
    ctx.imageSmoothingQuality = 'high';
    lastDrawn = -1;
    drawFrame(scrubOn ? shown : heroProgress());
  }
  let sizeT = null;
  addEventListener('resize', () => { clearTimeout(sizeT); sizeT = setTimeout(() => { if (scrubOn) sizeCanvas(); }, 100); });
  // Turning a phone or tablet swaps to the frame set that fits the new shape.
  TALL.addEventListener('change', () => {
    const want = TALL.matches ? 'tall' : 'wide';
    if (want === frameSet || !heroInit) { frameSet = want; return; }
    frameSet = want;
    frames.fill(undefined);
    loadedCount = 0; lastDrawn = -1;
    stage.classList.remove('loaded');
    loadFrames();
  });

  // eased display time, a loop that rests when it arrives
  let target = 0, shown = 0, rafId = null, lastTick = 0, heroOnScreen = true;
  function tick(now) {
    const dt = Math.min(100, now - (lastTick || now));
    lastTick = now;
    const k = 0.16;
    shown += (target - shown) * (1 - Math.pow(1 - k, dt / 16.667));
    if (Math.abs(target - shown) < 0.0005) { shown = target; rafId = null; lastTick = 0; }
    else rafId = requestAnimationFrame(tick);
    drawFrame(shown);
    updateCaptions(shown);
  }
  function onScroll() {
    target = heroProgress();
    if (rafId === null && heroOnScreen) rafId = requestAnimationFrame(tick);
  }
  new IntersectionObserver(es => { heroOnScreen = es[0].isIntersecting; if (heroOnScreen && scrubOn) onScroll(); }).observe(hero);

  // loading: the poster paints first, then frames arrive coarse to fine (every 32nd, 16th, 8th...),
  // so scrubbing works early and gets smoother as the rest land, behind an honest ring
  let heroInit = false;
  function initHeroOnce() {
    if (heroInit) return; heroInit = true;
    posterLayer.style.backgroundImage = "url('assets/hero-poster.jpg')";
    sizeCanvas();
    loadFrames();
  }
  function loadOrder() {
    const seen = new Set(), order = [];
    const add = i => { if (!seen.has(i)) { seen.add(i); order.push(i); } };
    add(0); add(FRAME_COUNT - 1);
    [32, 16, 8, 4, 2, 1].forEach(step => { for (let i = 0; i < FRAME_COUNT; i += step) add(i); });
    return order;
  }
  async function loadFrames() {
    const order = loadOrder(), gen = ++frameGen;
    let next = 0, lastRing = 0;
    const worker = async () => {
      while (next < order.length && gen === frameGen) {
        const i = order[next++];
        const img = new Image();
        img.decoding = 'async';
        img.src = frameSrc(i);
        try { await img.decode(); } catch (e) { continue; }
        if (gen !== frameGen) return;   // the screen was turned and a new set is loading
        frames[i] = img;
        loadedCount++;
        if (!stage.classList.contains('ready')) { stage.classList.add('ready'); sizeCanvas(); }
        lastDrawn = -1;
        drawFrame(scrubOn ? shown : heroProgress());
        const now = performance.now();
        if (now - lastRing > 100 || loadedCount === FRAME_COUNT) {
          lastRing = now;
          ring.style.setProperty('--ld', Math.round(126 * (1 - loadedCount / FRAME_COUNT)));
        }
      }
    };
    await Promise.all([0, 1, 2, 3, 4, 5].map(worker));
    if (gen !== frameGen) return;
    if (!loadedCount) failFrames();
    else stage.classList.add('loaded');
  }
  function failFrames() {
    stage.classList.add('frames-failed');
    ring.style.display = 'none';
  }

  // The still opening is only for visitors who ask their device for reduced motion. Phones get the
  // animation too: the frames are small, and the ink's journey runs down the middle, so it reads upright.
  const GATES = [
    '(prefers-reduced-motion: reduce)'
  ];
  let scrubOn = false;
  function enableScrub() {
    if (scrubOn) return; scrubOn = true;
    initHeroOnce();
    addEventListener('scroll', onScroll, { passive: true });
    bands.forEach(b => { b.op = -1; b.k = -1; b.off = null; });
    unpinFinalStates();
    shown = target = heroProgress();
    updateCaptions(shown);
    onScroll();
  }
  function disableScrub() {
    if (!scrubOn) return; scrubOn = false;
    removeEventListener('scroll', onScroll);
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
  }
  function applyHeroMode() {
    if (GATES.some(q => matchMedia(q).matches)) disableScrub(); else enableScrub();
  }
  const MQLS = GATES.map(q => matchMedia(q));
  MQLS.forEach(m => m.addEventListener('change', applyHeroMode));

  // ---------- reveals and living elements ----------
  const revealIO = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('in');
      setTimeout(() => e.target.classList.add('settled'), 1400);
      revealIO.unobserve(e.target);
    }
  }), { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('[data-reveal]').forEach(el => revealIO.observe(el));
  const liveIO = new IntersectionObserver(es => es.forEach(e => {
    e.target.classList.toggle('live', e.isIntersecting);
    e.target.querySelectorAll('.price-grid').forEach(g => g.classList.toggle('live', e.isIntersecting));
  }));
  document.querySelectorAll('[data-live]').forEach(el => liveIO.observe(el));
  document.addEventListener('visibilitychange', () => document.body.classList.toggle('paused', document.hidden));

  // ---------- the inkline: one ink line drawn down the page as you scroll ----------
  const wrapEl = $('#after-hero'), trail = $('#trail'), path = $('#trail-path'), tip = $('#trail-tip');
  let pathLen = 0, lut = [], lastDraw = -1, trailOn = false;
  function buildTrail() {
    trailOn = innerWidth > 1100;
    if (!trailOn) return;
    const W = wrapEl.offsetWidth, H = wrapEl.offsetHeight;
    trail.setAttribute('width', W); trail.setAttribute('height', H);
    trail.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const container = Math.min(1180, W);
    const gutterX = Math.max(26, (W - container) / 2 * 0.5);
    const L = gutterX, R = W - gutterX, C = W / 2;
    const base = wrapEl.getBoundingClientRect();
    const rect = el => { const r = el.getBoundingClientRect(); return { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height }; };
    const sec = id => rect(document.getElementById(id));
    const how = sec('how'), tryS = sec('try'), des = sec('designs'), pri = sec('pricing'), faq = sec('questions');
    const btn = rect($('#final-cta'));
    const btnY = btn.y + btn.h / 2;
    // The line continues the ink thread from the video, swoops into the gutter inside the
    // section padding, crosses sides only in the gaps between sections, and ends at the button.
    const pts = [
      [C, 0], [L, 110],
      [L, how.y + how.h - 120],
      [R, tryS.y + 120], [R, des.y + des.h - 90],
      [L, pri.y + 130], [L, btnY - 140],
      [btn.x - 14, btnY]
    ];
    // smooth curve through the points (vertical tangents keep it flowing downward)
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      if (i === pts.length - 1) {
        // the last stroke turns and arrives level with the button, under the text above it
        d += ` C${x0},${y1 - 10} ${x1 - 160},${y1} ${x1},${y1}`;
        continue;
      }
      const dy = (y1 - y0) * 0.5;
      d += ` C${x0},${y0 + dy} ${x1},${y1 - dy} ${x1},${y1}`;
    }
    path.setAttribute('d', d);
    pathLen = path.getTotalLength();
    path.style.strokeDasharray = pathLen;
    lut = [];
    const N = 400;
    for (let i = 0; i <= N; i++) { const l = pathLen * i / N; lut.push([l, path.getPointAtLength(l).y]); }
    lastDraw = -1;
    drawTrail();
  }
  function lengthAtY(y) {
    if (y <= lut[0][1]) return 0;
    let lo = 0, hi = lut.length - 1;
    if (y >= lut[hi][1]) return pathLen;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (lut[m][1] < y) lo = m; else hi = m; }
    const [l0, y0] = lut[lo], [l1, y1] = lut[hi];
    return l0 + (l1 - l0) * ((y - y0) / Math.max(1, y1 - y0));
  }
  let trailRaf = null;
  function drawTrail() {
    trailRaf = null;
    if (!trailOn || !pathLen) return;
    const full = reduceMQ.matches;
    // the drawing head leads at 72% of the screen, and reaches past the end as the page bottoms out
    const remaining = document.documentElement.scrollHeight - scrollY - innerHeight;
    const nearEnd = clamp(1 - remaining / 500, 0, 1);
    const headY = scrollY + innerHeight * (0.72 + 0.5 * nearEnd) - (wrapEl.getBoundingClientRect().top + scrollY);
    const l = full ? pathLen : lengthAtY(headY);
    if (Math.abs(l - lastDraw) < 0.5) return;
    lastDraw = l;
    path.style.strokeDashoffset = (pathLen - l).toFixed(1);
    const pt = path.getPointAtLength(Math.max(0.01, l));
    tip.setAttribute('cx', pt.x.toFixed(1)); tip.setAttribute('cy', pt.y.toFixed(1));
    tip.style.opacity = l <= 1 || l >= pathLen - 1 ? 0 : 1;
    const lit = l >= pathLen - 1;
    if (lit !== $('#start').classList.contains('lit')) $('#start').classList.toggle('lit', lit);
  }
  addEventListener('scroll', () => { if (trailRaf === null) trailRaf = requestAnimationFrame(drawTrail); }, { passive: true });
  let rT = null;
  addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(buildTrail, 150); });
  new ResizeObserver(() => { clearTimeout(rT); rT = setTimeout(buildTrail, 150); }).observe(wrapEl);

  // ---------- try it: press and hold to rewrite ----------
  const EXAMPLES = [
    { ctx: 'Social media assistant · Bloom Florists', before: 'Responsible for social media.', after: 'Grew our Instagram from 2,000 to 18,000 followers in one year.' },
    { ctx: 'Barista · Corner Café', before: 'Worked on the coffee machine and the till.', after: 'Served 250 customers a day and trained four new baristas.' },
    { ctx: 'Retail assistant · City Books', before: 'Helped with customer complaints.', after: 'Solved about 30 customer problems a week, so fewer people asked for refunds.' }
  ];
  const paper = $('#paper'), holdBtn = $('#hold'), afterEl = $('#after');
  let ex = 0, prog = 0, holding = false, holdRaf = null, holdLast = 0, complete = false, lastP = -1;
  function setExample(i) {
    const e = EXAMPLES[i];
    $('#ctx').textContent = e.ctx;
    $('#before').textContent = e.before;
    $('#after-sr').textContent = '';
    afterEl.textContent = '';
    const chars = [...e.after];
    chars.forEach((ch, n) => {
      const c = document.createElement('span');
      c.className = 'c'; c.textContent = ch === ' ' ? ' ' : ch;
      c.style.setProperty('--th', (0.3 + n / Math.max(1, chars.length - 1) * 0.5).toFixed(3));   // the last letter lands exactly at full hold
      afterEl.appendChild(c);
    });
    complete = false; prog = 0; lastP = -1;
    paper.classList.remove('done');
    $('#hold-label').textContent = 'Hold to rewrite';
    writeP(reduceMQ.matches ? 1 : 0);
    if (reduceMQ.matches) finish();
  }
  function writeP(p) {
    if (Math.abs(p - lastP) < 0.004 && p !== 1 && p !== 0) return;
    lastP = p;
    paper.style.setProperty('--p', p.toFixed(3));
    holdBtn.style.setProperty('--p', p.toFixed(3));
  }
  function finish() {
    complete = true;
    paper.classList.add('done');
    $('#after-sr').textContent = 'Rewritten: ' + EXAMPLES[ex].after;
    $('#hold-label').textContent = 'Rewritten';
  }
  function holdTick(now) {
    const dt = Math.min(64, now - (holdLast || now)); holdLast = now;
    if (holding && !complete) prog = Math.min(1, prog + dt / 1500);
    else if (!complete) prog = Math.max(0, prog - dt / 700 * (0.4 + prog));
    writeP(prog);
    if (prog >= 1 && !complete) finish();
    if ((holding && !complete) || (!complete && prog > 0)) holdRaf = requestAnimationFrame(holdTick);
    else { holdRaf = null; holdLast = 0; }
  }
  function startHold(e) {
    if (e) e.preventDefault();
    if (complete) return;
    if (reduceMQ.matches) { writeP(1); finish(); return; }
    holding = true;
    if (!holdRaf) holdRaf = requestAnimationFrame(holdTick);
  }
  function endHold() {
    holding = false;
    if (!holdRaf && !complete && prog > 0) holdRaf = requestAnimationFrame(holdTick);
  }
  holdBtn.addEventListener('pointerdown', e => { holdBtn.setPointerCapture && holdBtn.setPointerCapture(e.pointerId); startHold(e); });
  holdBtn.addEventListener('pointerup', endHold);
  holdBtn.addEventListener('pointercancel', endHold);
  holdBtn.addEventListener('lostpointercapture', endHold);
  holdBtn.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) startHold(e); });
  holdBtn.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') endHold(); });
  holdBtn.addEventListener('contextmenu', e => e.preventDefault());
  $('#next').addEventListener('click', () => { ex = (ex + 1) % EXAMPLES.length; setExample(ex); holdBtn.focus(); });
  setExample(0);

  // ---------- in-page links: jump by script so they work in every browser and preview ----------
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return;
    const id = a.getAttribute('href').slice(1);
    const t = id && document.getElementById(id);
    if (!t) return;
    e.preventDefault();
    const y = id === 'top' || id === 'main' ? 0 : t.getBoundingClientRect().top + scrollY - 84;
    window.scrollTo(0, Math.max(0, y));
    if (!t.hasAttribute('tabindex')) t.setAttribute('tabindex', '-1');
    t.focus({ preventScroll: true });
    try { history.replaceState(null, '', '#' + id); } catch (err) { /* some previews block this */ }
  });

  // ---------- reduced motion, honoured live in both directions ----------
  function pinToFinalStates() {
    lastDraw = -1; drawTrail();
    if (!complete) { writeP(1); finish(); }
    document.querySelectorAll('[data-reveal]').forEach(el => el.classList.add('in', 'settled'));
  }
  function unpinFinalStates() {
    lastDraw = -1; drawTrail();
  }
  reduceMQ.addEventListener('change', e => {
    if (e.matches) pinToFinalStates();
    else { applyHeroMode(); setExample(ex); }
  });

  // ---------- go ----------
  applyHeroMode();
  if (!scrubOn) updateCaptions(0);
  requestAnimationFrame(loadRamp);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(buildTrail); else buildTrail();
  addEventListener('load', buildTrail);
  if (reduceMQ.matches) pinToFinalStates();
})();
