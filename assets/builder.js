/* Inkline CV maker. Two ways in: the AI interview (or guided questions when the AI is off), or filling
   in a form yourself. Both edit the same CV, shown live in any design, with an optional photo. */
(function () {
  'use strict';
  const { TEMPLATES, ACCENTS, FONTS, SAMPLE, ICONS, fontById, fontHref, emptyCV, render, normalize, setPath, plainText, templateById, esc } = window.InklineCV;
  const $ = s => document.querySelector(s);
  const app = $('.app'), log = $('#log'), quick = $('#quick'), answer = $('#answer'), sendBtn = $('#send');
  const sheet = $('#sheet'), frame = $('#frame'), desk = $('#desk'), formEl = $('#form');
  const STORE = 'inkline:v1';
  const API = 'api/ai.php';
  const STAGES = ['basics', 'target', 'contact', 'experience', 'education', 'skills', 'extras', 'review'];
  const mobile = () => matchMedia('(max-width:980px)').matches;

  // A photo is only ever a picture we drew ourselves (a JPEG data URL). Anything else is refused,
  // so nothing unexpected can ever be put into the page.
  const safePhoto = p => typeof p === 'string' && p.length < 3000000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(p);

  // ---------- state ----------
  const params = new URLSearchParams(location.search);
  let state = load() || fresh();

  function fresh() {
    return {
      v: 1, cv: emptyCV(), template: 'atlas', accent: 'navy', paper: 'a4', photo: '',
      font: 'default', sizes: { name: 1, head: 1, text: 1 },
      started: false,
      pane: 'chat',          // 'chat' or 'form'
      mode: null,            // in the chat: 'ai' or 'guided'
      conversation: null,    // id of this visitor's chat on the server (the history itself stays there)
      chat: [],              // what the visitor sees: {who, text}
      quick: [],
      stage: 'basics',
      guided: { step: 'name', expIndex: -1, eduIndex: -1 },
      edited: false          // CV changed outside the AI since the AI last saw it
    };
  }
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE) || 'null');
      if (s && s.v === 1) {
        s.cv = normalize(s.cv);
        if (templateById(s.template).id !== s.template) s.template = 'atlas';
        if (!ACCENTS.some(a => a.id === s.accent)) s.accent = templateById(s.template).accent;
        if (!safePhoto(s.photo)) s.photo = '';
        delete s.history;   // older versions kept the chat history in the browser
        if (typeof s.conversation !== 'string') s.conversation = null;
        if (s.started === undefined) s.started = !!(s.chat && s.chat.length);
        if (!s.pane) s.pane = 'chat';
        if (fontById(s.font).id !== s.font) s.font = 'default';
        s.sizes = Object.assign({ name: 1, head: 1, text: 1 }, s.sizes || {});
        return s;
      }
    } catch (e) { /* storage unavailable: start fresh */ }
    return null;
  }
  let warnedStorage = false;
  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(state)); return true; }
    catch (e) {
      if (!warnedStorage) { warnedStorage = true; toast("This browser couldn't save your CV, so keep this page open until you download it."); }
      return false;
    }
  }

  let toastT = null;
  function toast(text) {
    const t = $('#toast');
    t.textContent = text;
    t.classList.add('on');
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove('on'), 4200);
  }

  // ---------- preview ----------
  let renderedHTML = '';
  function opts(extra) {
    return Object.assign({ template: state.template, accent: state.accent, paper: state.paper, photo: state.photo, font: state.font, sizes: state.sizes }, extra || {});
  }
  function renderCV(flash) {
    const html = render(state.cv, opts({ editable: true }));
    if (html !== renderedHTML) {
      renderedHTML = html;
      sheet.innerHTML = html;
      if (flash) { sheet.classList.remove('flash'); void sheet.offsetWidth; sheet.classList.add('flash'); }
      if (flash && app.dataset.tab === 'edit' && mobile()) $('#badge').classList.add('on');
    }
    fit();
    countPages();
    syncDesignButton();
  }
  let renderT = null;
  function renderSoon() { clearTimeout(renderT); renderT = setTimeout(() => renderCV(false), 120); }
  function fit() {
    const cv = sheet.firstElementChild;
    if (!cv) return;
    const w = cv.offsetWidth, h = cv.offsetHeight;
    const avail = desk.clientWidth - (mobile() ? 24 : 48);
    const s = Math.min(1, avail / w);
    sheet.style.width = w + 'px';
    sheet.style.transform = `scale(${s})`;
    frame.style.width = (w * s) + 'px';
    frame.style.height = (h * s) + 'px';
  }
  function countPages() {
    const cv = sheet.firstElementChild;
    if (!cv) return;
    const pagePx = (state.paper === 'letter' ? 792 : 842) * 96 / 72;
    const n = Math.max(1, Math.ceil((cv.offsetHeight - 4) / pagePx));
    $('#pages').textContent = n === 1 ? 'Fits on 1 page' : `About ${n} pages`;
  }
  addEventListener('resize', () => { fit(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { fit(); countPages(); });

  // Inline editing on the CV itself.
  sheet.addEventListener('focusin', e => {
    const el = e.target.closest('[data-path]');
    if (el && el.classList.contains('cv-empty')) { el.textContent = ''; el.classList.remove('cv-empty'); }
  });
  sheet.addEventListener('input', e => {
    const el = e.target.closest('[data-path]');
    if (!el) return;
    setPath(state.cv, el.dataset.path, el.textContent.replace(/\s+/g, ' ').trim());
    state.edited = true;
    save();
    countPages();
  });
  sheet.addEventListener('focusout', e => {
    if (!e.target.closest('[data-path]')) return;
    state.cv = normalize(state.cv);
    save();
    setTimeout(() => {
      if (sheet.contains(document.activeElement)) return;
      renderCV(false);
      if (state.pane === 'form') buildForm();
    }, 0);
  });
  sheet.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.closest('[data-path]')) { e.preventDefault(); e.target.blur(); }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('[data-action="photo"]')) { e.preventDefault(); pickPhoto(); }
  });
  sheet.addEventListener('click', e => { if (e.target.closest('[data-action="photo"]')) pickPhoto(); });
  sheet.addEventListener('paste', e => {
    if (!e.target.closest('[data-path]')) return;
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text');
    document.execCommand('insertText', false, text.replace(/\s+/g, ' '));
  });

  // ---------- photo ----------
  const photoInput = $('#photo-input');
  function pickPhoto() { photoInput.value = ''; photoInput.click(); }
  photoInput.addEventListener('change', () => { if (photoInput.files && photoInput.files[0]) usePhoto(photoInput.files[0]); });
  function usePhoto(file) {
    if (!/^image\//.test(file.type)) { toast('Please choose a photo, like a JPG or PNG.'); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      // Square crop. For portrait photos keep the upper part, where the face usually is.
      const w = img.naturalWidth, h = img.naturalHeight, s = Math.min(w, h);
      const sx = (w - s) / 2;
      const sy = h > w ? Math.min((h - s) * 0.18, h - s) : 0;
      const size = Math.min(720, s);
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, sx, sy, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url);
      const url = c.toDataURL('image/jpeg', 0.86);
      if (!safePhoto(url)) { toast("That photo couldn't be used. Try another one."); return; }
      state.photo = url;
      save();
      renderCV(true);
      syncPhotoUI();
      if (state.pane === 'form') buildForm();
      if (!templateById(state.template).photo) toast('Photo added. It shows in designs with a photo spot, like Atlas, Vertex or Bloom.');
      else toast('Photo added. It stays in your browser and is never sent to the AI.');
    };
    img.onerror = () => { URL.revokeObjectURL(url); toast("That photo couldn't be opened. Try a JPG or PNG."); };
    img.src = url;
  }
  function removePhoto() {
    state.photo = '';
    save(); renderCV(false); syncPhotoUI();
    if (state.pane === 'form') buildForm();
  }
  function syncPhotoUI() {
    $('#photo-mini').innerHTML = safePhoto(state.photo) ? `<img src="${state.photo}" alt="">` : ICONS.camera;
    $('#photo-label').textContent = state.photo ? 'Change photo' : 'Add photo';
  }
  $('#photo-btn').addEventListener('click', pickPhoto);

  // ---------- toolbar ----------
  function buildToolbar() {
    const ag = $('#accents');
    ACCENTS.forEach(a => {
      const b = document.createElement('button');
      b.type = 'button'; b.style.background = a.value; b.dataset.id = a.id;
      b.setAttribute('aria-label', a.name); b.title = a.name;
      b.addEventListener('click', () => { state.accent = a.id; save(); syncToolbar(); renderCV(false); });
      ag.appendChild(b);
    });
    document.querySelectorAll('#paper button').forEach(b => b.addEventListener('click', () => {
      state.paper = b.dataset.paper; save(); syncToolbar(); renderCV(false);
    }));
  }
  function syncToolbar() {
    document.querySelectorAll('#accents button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.id === state.accent)));
    document.querySelectorAll('#paper button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.paper === state.paper)));
    // Colourful two-column designs print edge to edge so the sidebar reaches the bottom of the page.
    // Classic designs keep a margin on later pages so long CVs read well.
    const letter = state.paper === 'letter';
    $('#page-size').textContent = templateById(state.template).layout === 'two'
      ? `@page{size:${letter ? 'letter' : 'A4'};margin:0}#print-root .cv.two{min-height:${letter ? 'calc(11in - 1mm)' : 'calc(297mm - 1mm)'}}`
      : `@page{size:${letter ? 'letter' : 'A4'};margin:16mm 0}@page:first{margin-top:0}`;
  }
  function syncDesignButton() {
    const t = templateById(state.template);
    $('#design-name').textContent = 'Design: ' + t.name;
    $('#design-thumb').innerHTML = render(previewCV(), opts({ editable: false, photo: previewPhoto() }));
  }
  // Thumbnails show the visitor's own CV once it has something in it, otherwise the sample person.
  function previewCV() {
    const c = state.cv;
    return (c.name || c.experience.length) ? c : SAMPLE;
  }
  function previewPhoto() {
    return state.photo || (previewCV() === SAMPLE ? SAMPLE.photo : '');
  }

  // design picker
  const picker = $('#picker');
  function openPicker() {
    const body = $('#picker-body');
    const cv = previewCV();
    const group = (key, title, text) => `
      <section class="picker-group"><h3>${title}</h3><p>${text}</p><div class="tgrid">${TEMPLATES.filter(t => t.group === key).map(t => `
        <button type="button" class="tpick" data-tpl="${t.id}" aria-pressed="${t.id === state.template}">
          <span class="t-mini" aria-hidden="true">${render(cv, { template: t.id, accent: t.accent, paper: state.paper, photo: previewPhoto(), font: state.font, sizes: state.sizes })}</span>
          <b>${esc(t.name)}</b><span>${esc(t.note)}</span>
        </button>`).join('')}</div></section>`;
    body.innerHTML =
      group('photo', 'Colourful, with your photo', 'Eye-catching designs for emailing or handing in your CV, where a person reads it first.') +
      group('classic', 'Classic, best for online applications', 'One clean column of text. The safest choice when you apply through a website, because hiring software reads it perfectly.');
    picker.hidden = false;
    scaleThumbs();
    body.scrollTop = 0;
    const current = body.querySelector('[aria-pressed="true"]');
    if (current) current.focus({ preventScroll: true });
  }
  function scaleThumbs() {
    picker.querySelectorAll('.t-mini').forEach(box => {
      const cv = box.firstElementChild;
      if (cv) cv.style.transform = `scale(${box.clientWidth / cv.offsetWidth})`;
    });
  }
  function closePicker() { picker.hidden = true; $('#design-btn').focus({ preventScroll: true }); }
  $('#design-btn').addEventListener('click', openPicker);
  $('#picker-close').addEventListener('click', closePicker);
  picker.addEventListener('click', e => {
    const b = e.target.closest('[data-tpl]');
    if (!b) return;
    const t = templateById(b.dataset.tpl);
    state.template = t.id;
    state.accent = t.accent;   // each design comes with its own colours; change them any time
    save(); syncToolbar(); renderCV(true); closePicker();
  });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !picker.hidden) closePicker(); });
  addEventListener('resize', () => { if (!picker.hidden) scaleThumbs(); });

  $('#download').addEventListener('click', () => {
    if (document.activeElement && sheet.contains(document.activeElement)) document.activeElement.blur();
    const root = $('#print-root');
    root.innerHTML = render(state.cv, opts());
    const old = document.title;
    document.title = (state.cv.name ? state.cv.name + ' ' : '') + 'CV';
    const done = () => { document.title = old; removeEventListener('afterprint', done); };
    addEventListener('afterprint', done);
    const imgs = [...root.querySelectorAll('img')];
    const fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    Promise.all(imgs.map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })).concat(fonts)).then(() => {
      window.print();
      setTimeout(done, 1500);
    });
  });
  $('#copy').addEventListener('click', async () => {
    const b = $('#copy');
    try { await navigator.clipboard.writeText(plainText(state.cv)); b.textContent = 'Copied'; }
    catch (e) { b.textContent = 'Copy failed'; }
    setTimeout(() => { b.textContent = 'Copy as text'; }, 1800);
  });
  $('#restart').addEventListener('click', () => {
    if (!confirm('Start a new CV? This deletes your CV, photo and chat from this browser, and the chat from our server.')) return;
    if (state.conversation) api({ action: 'end', conversation: state.conversation });
    try { localStorage.removeItem(STORE); } catch (e) { /* nothing stored */ }
    const keep = { template: state.template, accent: state.accent, paper: state.paper, font: state.font, sizes: state.sizes };
    state = Object.assign(fresh(), keep);
    log.innerHTML = ''; renderedHTML = ''; chatPromise = null;
    setQuick([]);
    renderCV(false); syncPhotoUI(); syncToolbar();
    showChooser();
  });

  // mobile tabs
  document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => {
    app.dataset.tab = b.dataset.tab;
    document.querySelectorAll('.tabs button').forEach(x => x.setAttribute('aria-selected', String(x === b)));
    if (b.dataset.tab === 'cv') { $('#badge').classList.remove('on'); requestAnimationFrame(fit); }
  }));

  // ---------- choosing how to make the CV ----------
  const chooser = $('#chooser');
  function showChooser() {
    chooser.hidden = false;
    chooser.querySelector('[data-choose]').focus({ preventScroll: true });
  }
  chooser.addEventListener('click', e => {
    const b = e.target.closest('[data-choose]');
    if (!b) return;
    chooser.hidden = true;
    state.started = true;
    if (b.dataset.choose === 'upload') { setPane('chat'); pickCV(); }
    else setPane(b.dataset.choose);
  });
  document.querySelectorAll('.switch button').forEach(b => b.addEventListener('click', () => setPane(b.dataset.pane)));

  function setPane(pane) {
    state.pane = pane;
    document.querySelectorAll('.switch button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.pane === pane)));
    $('#pane-chat').hidden = pane !== 'chat';
    $('#pane-form').hidden = pane !== 'form';
    $('#steps').hidden = pane !== 'chat';
    $('#mode').hidden = pane !== 'chat';
    $('#tab-edit').textContent = pane === 'chat' ? 'Chat' : 'Edit';
    save();
    if (pane === 'form') buildForm();
    else { startChat(); requestAnimationFrame(() => scaleMinis(log)); }
  }

  // ---------- fonts and text sizes ----------
  const loadedFonts = new Set();
  function ensureFont(id) {
    const href = fontHref(id);
    if (!href || loadedFonts.has(href)) return;
    loadedFonts.add(href);
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = href;
    l.onload = () => { fit(); countPages(); };
    document.head.appendChild(l);
  }
  const SIZE_ROWS = [['name', 'Name'], ['head', 'Section headings'], ['text', 'Main text']];
  function textControls(prefix) {
    return `
      <div class="tc-fonts" role="group" aria-label="Font">${FONTS.map(f => `
        <button type="button" class="tc-font" data-font="${f.id}" aria-pressed="${f.id === state.font}"${f.id !== 'default' ? ` style="font-family:${esc(f.head)}"` : ''}>
          <b>${esc(f.name)}</b><span${f.id !== 'default' ? ` style="font-family:${esc(f.body)}"` : ''}>${f.id === 'default' ? "Each design's own fonts" : 'Aa Bb Cc 123'}</span>
        </button>`).join('')}</div>
      <div class="tc-sizes">${SIZE_ROWS.map(([k, label]) => `
        <div class="tc-size">
          <label for="${prefix}-size-${k}">${label}</label>
          <input type="range" id="${prefix}-size-${k}" data-size="${k}" min="0.8" max="1.3" step="0.05" value="${state.sizes[k]}">
          <output data-size-out="${k}">${Math.round(state.sizes[k] * 100)}%</output>
        </div>`).join('')}
        <button type="button" class="tc-reset" data-size-reset>Reset sizes</button>
      </div>`;
  }
  function syncTextControls() {
    document.querySelectorAll('[data-font]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.font === state.font)));
    document.querySelectorAll('[data-size]').forEach(r => { r.value = state.sizes[r.dataset.size]; });
    document.querySelectorAll('[data-size-out]').forEach(o => { o.textContent = Math.round(state.sizes[o.dataset.sizeOut] * 100) + '%'; });
    const f = fontById(state.font);
    $('#text-label').textContent = f.id === 'default' ? 'Fonts & size' : f.name;
  }
  // one set of listeners serves both the toolbar panel and the form card
  document.addEventListener('click', e => {
    const fb = e.target.closest('[data-font]');
    if (fb) {
      state.font = fb.dataset.font;
      ensureFont(state.font);
      save(); syncTextControls(); renderCV(false);
      return;
    }
    if (e.target.closest('[data-size-reset]')) {
      state.sizes = { name: 1, head: 1, text: 1 };
      save(); syncTextControls(); renderCV(false);
    }
  });
  document.addEventListener('input', e => {
    const r = e.target.closest('[data-size]');
    if (!r) return;
    state.sizes[r.dataset.size] = +r.value;
    document.querySelectorAll(`[data-size-out="${r.dataset.size}"]`).forEach(o => { o.textContent = Math.round(r.value * 100) + '%'; });
    document.querySelectorAll(`[data-size="${r.dataset.size}"]`).forEach(x => { if (x !== r) x.value = r.value; });
    save(); renderSoon();
  });
  const textPanel = $('#text-panel');
  function openTextPanel() {
    FONTS.forEach(f => ensureFont(f.id));   // so every option previews in its own font
    $('#text-panel-body').innerHTML = textControls('tp');
    textPanel.hidden = false;
    $('#text-btn').setAttribute('aria-expanded', 'true');
  }
  function closeTextPanel() {
    textPanel.hidden = true;
    $('#text-btn').setAttribute('aria-expanded', 'false');
  }
  $('#text-btn').addEventListener('click', () => { if (textPanel.hidden) openTextPanel(); else closeTextPanel(); });
  $('#text-close').addEventListener('click', closeTextPanel);
  addEventListener('keydown', e => { if (e.key === 'Escape' && !textPanel.hidden) closeTextPanel(); });
  document.addEventListener('pointerdown', e => {
    if (!textPanel.hidden && !textPanel.contains(e.target) && !e.target.closest('#text-btn')) closeTextPanel();
  });

  // ---------- the form editor ----------
  const I = {
    up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>',
    down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
    del: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>'
  };
  let uid = 0;
  const inp = (path, label, value, ph, cls, type) => {
    const id = 'f' + (++uid);
    return `<div class="f ${cls || ''}"><label for="${id}">${label}</label><input class="f-in" id="${id}" type="${type || 'text'}" data-bind="${path}" value="${esc(value)}" placeholder="${esc(ph || '')}"></div>`;
  };
  const area = (path, label, value, ph, lines) => {
    const id = 'f' + (++uid);
    return `<div class="f full"><label for="${id}">${label}</label><textarea class="f-in" id="${id}" ${lines ? 'data-lines' : 'data-bind'}="${path}" rows="4" placeholder="${esc(ph || '')}">${esc(value)}</textarea></div>`;
  };
  const tools = (list, i, n) => `<div class="tools">
      <button type="button" class="icon-btn" data-act="up" data-list="${list}" data-i="${i}" aria-label="Move up" ${i === 0 ? 'disabled' : ''}>${I.up}</button>
      <button type="button" class="icon-btn" data-act="down" data-list="${list}" data-i="${i}" aria-label="Move down" ${i === n - 1 ? 'disabled' : ''}>${I.down}</button>
      <button type="button" class="icon-btn danger" data-act="del" data-list="${list}" data-i="${i}" aria-label="Remove">${I.del}</button>
    </div>`;
  const chips = (list, label, ph, suggestions) => `
    <div class="chips-in">${state.cv[list].map((s, i) => `<span class="tagchip">${esc(s)}<button type="button" data-act="chip-del" data-list="${list}" data-i="${i}" aria-label="Remove ${esc(s)}">${I.x}</button></span>`).join('')}</div>
    <div class="chip-add"><label class="sr-only" for="add-${list}">${label}</label><input class="f-in" id="add-${list}" data-chipinput="${list}" placeholder="${esc(ph)}"><button type="button" class="small-btn" data-act="chip-add" data-list="${list}">Add</button></div>
    ${suggestions ? `<div class="suggest">${suggestions.filter(s => !state.cv[list].includes(s)).map(s => `<button type="button" class="chip" data-act="chip-suggest" data-list="${list}" data-val="${esc(s)}">+ ${esc(s)}</button>`).join('')}</div>` : ''}`;

  function buildForm(focusSel) {
    const c = state.cv;
    FONTS.forEach(f => ensureFont(f.id));
    const scroll = formEl.scrollTop;
    uid = 0;
    formEl.innerHTML = `
      <div class="card">
        <h2>Start from your old CV</h2>
        <p class="sub">Upload a PDF, Word file or a photo of it. ${state.mode === 'guided' ? 'Without the AI switched on, only your contact details can be read.' : 'The AI reads it and fills in your new CV, then asks what has changed.'}</p>
        <button type="button" class="ghost" data-act="import-cv">Upload my old CV</button>
      </div>

      <div class="card">
        <h2>Photo</h2>
        <p class="sub">Shows in designs with a photo spot. It stays in your browser and is never sent to the AI.</p>
        <div class="photo-row">
          <div class="avatar">${safePhoto(state.photo) ? `<img src="${state.photo}" alt="Your photo">` : ICONS.camera}</div>
          <div class="photo-btns">
            <button type="button" class="ghost" data-act="photo">${state.photo ? 'Change photo' : 'Upload a photo'}</button>
            ${state.photo ? '<button type="button" class="ghost" data-act="photo-remove">Remove</button>' : ''}
          </div>
        </div>
        <p class="hint" style="margin-top:12px">Tip: in the US and UK, CVs usually have no photo. In much of Europe, the Middle East and Asia, employers often expect one.</p>
      </div>

      <div class="card">
        <h2>Fonts and text size</h2>
        <p class="sub">Pick a font and make the name, headings or text bigger or smaller.</p>
        ${textControls('fm')}
      </div>

      <div class="card">
        <h2>Your details</h2>
        <p class="sub">The basics at the top of your CV.</p>
        <div class="grid2">
          ${inp('name', 'Full name', c.name, 'e.g. Sara Ahmed')}
          ${inp('title', 'Job title', c.title, 'e.g. Customer Service Manager')}
          ${inp('email', 'Email', c.email, 'you@email.com', '', 'email')}
          ${inp('phone', 'Phone', c.phone, 'e.g. +971 50 123 4567', '', 'tel')}
          ${inp('location', 'City', c.location, 'e.g. Dubai, UAE')}
          ${inp('link', 'LinkedIn or website', c.link, 'linkedin.com/in/yourname')}
        </div>
      </div>

      <div class="card">
        <h2>Profile</h2>
        <p class="sub">Two or three sentences about you and the job you want.</p>
        <div class="grid2">${area('summary', 'Profile', c.summary, 'e.g. Customer service manager with five years in busy cafés and shops. I keep teams calm and customers happy.')}</div>
      </div>

      <div class="card">
        <h2>Experience</h2>
        <p class="sub">Most recent job first. Part-time and volunteer work count too.</p>
        ${c.experience.map((x, i) => `
          <div class="item" data-item="experience.${i}">
            <div class="item-head"><b>${esc(x.role || 'New job')}${x.company ? ' · ' + esc(x.company) : ''}</b>${tools('experience', i, c.experience.length)}</div>
            <div class="grid2">
              ${inp(`experience.${i}.role`, 'Job title', x.role, 'e.g. Shift supervisor')}
              ${inp(`experience.${i}.company`, 'Company', x.company, 'e.g. Marina Café')}
              ${inp(`experience.${i}.location`, 'City', x.location, 'e.g. Dubai', 'full')}
              ${inp(`experience.${i}.start`, 'Start', x.start, 'e.g. Mar 2021')}
              ${inp(`experience.${i}.end`, 'End', x.end, 'e.g. Present')}
              ${area(`experience.${i}.bullets`, 'What you did', (x.bullets || []).join('\n'), 'One point per line, e.g.\nLed a team of 6\nServed 300 customers a day', true)}
            </div>
          </div>`).join('')}
        <button type="button" class="add" data-act="add-exp">${I.plus}Add a job</button>
      </div>

      <div class="card">
        <h2>Education</h2>
        <p class="sub">Your highest qualification first.</p>
        ${c.education.map((x, i) => `
          <div class="item" data-item="education.${i}">
            <div class="item-head"><b>${esc(x.qualification || 'New qualification')}${x.school ? ' · ' + esc(x.school) : ''}</b>${tools('education', i, c.education.length)}</div>
            <div class="grid2">
              ${inp(`education.${i}.qualification`, 'Qualification', x.qualification, 'e.g. BA Marketing')}
              ${inp(`education.${i}.school`, 'School', x.school, 'e.g. University of Leeds')}
              ${inp(`education.${i}.location`, 'City', x.location, 'e.g. Leeds', 'full')}
              ${inp(`education.${i}.start`, 'Start', x.start, 'e.g. 2016')}
              ${inp(`education.${i}.end`, 'End', x.end, 'e.g. 2019')}
              ${area(`education.${i}.details`, 'Details (optional)', x.details, 'e.g. First-class honours')}
            </div>
          </div>`).join('')}
        <button type="button" class="add" data-act="add-edu">${I.plus}Add education</button>
      </div>

      <div class="card">
        <h2>Skills</h2>
        <p class="sub">Type a skill and press Enter.</p>
        ${chips('skills', 'Add a skill', 'e.g. Customer service', ['Communication', 'Teamwork', 'Microsoft Excel', 'Customer service', 'Problem solving', 'Leadership'])}
      </div>

      <div class="card">
        <h2>Languages</h2>
        <p class="sub">Add how well you speak each one.</p>
        ${chips('languages', 'Add a language', 'e.g. Arabic (native)', ['English (fluent)', 'Arabic (native)', 'French (basic)'])}
      </div>

      <div class="card">
        <h2>More sections</h2>
        <p class="sub">Certifications, volunteering, projects or awards.</p>
        ${c.extras.map((g, i) => `
          <div class="item" data-item="extras.${i}">
            <div class="item-head"><b>${esc(g.heading || 'New section')}</b>${tools('extras', i, c.extras.length)}</div>
            <div class="grid2">
              ${inp(`extras.${i}.heading`, 'Section title', g.heading, 'e.g. Certifications', 'full')}
              ${area(`extras.${i}.items`, 'Items', (g.items || []).join('\n'), 'One per line, e.g.\nFirst aid certificate, 2022', true)}
            </div>
          </div>`).join('')}
        <div class="suggest">${['Certifications', 'Volunteering', 'Projects', 'Awards'].filter(h => !c.extras.some(g => g.heading === h)).map(h => `<button type="button" class="chip" data-act="add-extra" data-val="${h}">+ ${h}</button>`).join('')}<button type="button" class="chip" data-act="add-extra" data-val="">+ Another section</button></div>
      </div>`;
    formEl.scrollTop = scroll;
    if (focusSel) {
      const f = formEl.querySelector(focusSel);
      if (f) { f.focus({ preventScroll: true }); f.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    }
  }

  formEl.addEventListener('input', e => {
    const t = e.target;
    if (t.dataset.bind) {
      setPath(state.cv, t.dataset.bind, t.value);
      // keep the card title in step with what is typed
      const item = t.closest('.item');
      if (item) {
        const [list, i] = item.dataset.item.split('.');
        const x = state.cv[list][+i];
        const b = item.querySelector('.item-head b');
        b.textContent = list === 'experience' ? (x.role || 'New job') + (x.company ? ' · ' + x.company : '')
          : list === 'education' ? (x.qualification || 'New qualification') + (x.school ? ' · ' + x.school : '')
          : (x.heading || 'New section');
      }
    } else if (t.dataset.lines) {
      setPath(state.cv, t.dataset.lines, t.value.split('\n').map(s => s.trim().replace(/^[-•*]\s*/, '')).filter(Boolean));
    } else return;
    state.edited = true;
    save();
    renderSoon();
  });
  formEl.addEventListener('keydown', e => {
    const t = e.target;
    if (t.dataset.chipinput && (e.key === 'Enter' || e.key === ',')) { e.preventDefault(); addChip(t.dataset.chipinput, t.value); }
  });
  function addChip(list, value) {
    const vals = String(value).split(',').map(s => s.trim()).filter(Boolean);
    if (!vals.length) return;
    vals.forEach(v => { const nice = v.charAt(0).toUpperCase() + v.slice(1); if (!state.cv[list].includes(nice)) state.cv[list].push(nice); });
    changed(`[data-chipinput="${list}"]`);
  }
  function changed(focusSel) {
    state.edited = true;
    save();
    buildForm(focusSel);
    renderCV(false);
  }
  const isBlank = x => !Object.values(x || {}).some(v => Array.isArray(v) ? v.length : String(v || '').trim());
  formEl.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const c = state.cv, list = b.dataset.list, i = +b.dataset.i;
    switch (b.dataset.act) {
      case 'photo': return pickPhoto();
      case 'photo-remove': return removePhoto();
      case 'import-cv': return pickCV();
      case 'add-exp':
        c.experience.push({ role: '', company: '', location: '', start: '', end: '', bullets: [] });
        return changed(`[data-bind="experience.${c.experience.length - 1}.role"]`);
      case 'add-edu':
        c.education.push({ qualification: '', school: '', location: '', start: '', end: '', details: '' });
        return changed(`[data-bind="education.${c.education.length - 1}.qualification"]`);
      case 'add-extra':
        c.extras.push({ heading: b.dataset.val, items: [] });
        return changed(b.dataset.val ? `[data-lines="extras.${c.extras.length - 1}.items"]` : `[data-bind="extras.${c.extras.length - 1}.heading"]`);
      case 'del':
        if (!isBlank(c[list][i]) && !confirm('Remove this from your CV?')) return;
        c[list].splice(i, 1);
        return changed();
      case 'up': if (i > 0) { [c[list][i - 1], c[list][i]] = [c[list][i], c[list][i - 1]]; changed(); } return;
      case 'down': if (i < c[list].length - 1) { [c[list][i + 1], c[list][i]] = [c[list][i], c[list][i + 1]]; changed(); } return;
      case 'chip-del': c[list].splice(i, 1); return changed();
      case 'chip-add': { const f = formEl.querySelector(`[data-chipinput="${list}"]`); return addChip(list, f ? f.value : ''); }
      case 'chip-suggest': return addChip(list, b.dataset.val);
    }
  });

  // ---------- chat display ----------
  const dropIcon = '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 6C32 6 14 28 14 40a18 18 0 0 0 36 0C50 28 32 6 32 6z" fill="#4C51B8"/></svg>';
  function bubble(who, text, record) {
    const el = document.createElement('div');
    el.className = 'msg ' + who;
    el.textContent = text;
    if (who === 'ai') {
      const prev = log.lastElementChild;
      if (!prev || !prev.classList.contains('ai')) {
        const label = document.createElement('div');
        label.className = 'who';
        label.innerHTML = dropIcon + (state.mode === 'ai' ? 'Inkline AI' : 'Inkline');
        log.appendChild(label);
        el.label = label;
      }
    }
    log.appendChild(el);
    if (record !== false) { state.chat.push({ who, text }); save(); }
    log.scrollTop = log.scrollHeight;
    return el;
  }
  function typing(on) {
    const t = log.querySelector('.typing');
    if (on && !t) {
      const el = document.createElement('div');
      el.className = 'msg ai typing';
      el.setAttribute('aria-label', 'Writing');
      el.innerHTML = '<i></i><i></i><i></i>';
      log.appendChild(el);
      log.scrollTop = log.scrollHeight;
    } else if (!on && t) t.remove();
  }
  function setQuick(list) {
    state.quick = (list || []).slice(0, 4);
    quick.innerHTML = '';
    state.quick.forEach(q => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.textContent = typeof q === 'string' ? q : q.label;
      b.addEventListener('click', () => typeof q === 'string' ? submit(q) : quickAction(q.act));
      quick.appendChild(b);
    });
  }
  function quickAction(act) {
    if (act === 'form') setPane('form');
    else if (act === 'download') $('#download').click();
    else if (act === 'picker') openPicker();
    else if (act === 'upload') pickCV();
    else if (act === 'designs') designsBubble(suggestedFor());
    if (mobile() && (act === 'designs')) requestAnimationFrame(() => scaleMinis(log));
  }
  function setStage(stage) {
    if (!stage) return;
    state.stage = stage === 'done' ? 'review' : stage;
    const idx = STAGES.indexOf(state.stage);
    document.querySelectorAll('#steps li').forEach((li, i) => {
      li.classList.toggle('done', i < idx);
      li.classList.toggle('now', i === idx);
    });
  }
  function setMode(mode) {
    state.mode = mode;
    const m = $('#mode');
    m.textContent = mode === 'ai' ? 'AI interviewer' : 'Guided mode';
    m.classList.toggle('guided', mode !== 'ai');
    $('#privacy').textContent = mode === 'ai'
      ? 'Your CV is saved in this browser. Your answers go to the AI only to write your CV.'
      : 'Your CV is saved in this browser only.';
  }

  // ---------- composer ----------
  let busy = false;
  answer.addEventListener('input', () => {
    answer.style.height = 'auto';
    answer.style.height = Math.min(160, answer.scrollHeight) + 'px';
  });
  answer.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $('#composer').requestSubmit(); }
  });
  $('#composer').addEventListener('submit', e => {
    e.preventDefault();
    const text = answer.value.trim();
    if (text) submit(text);
  });
  function submit(text) {
    if (busy) return;
    answer.value = ''; answer.style.height = '';
    setQuick([]);
    bubble('me', text);
    if (state.mode === 'ai') aiTurn(text); else guidedTurn(text);
  }
  function setBusy(on) { busy = on; sendBtn.disabled = on; typing(on); }

  // ---------- AI interviewer ----------
  // Every request goes to our own server (never straight to an AI company), with a header that
  // the server requires. The server's messages are plain text and shown as text, never as HTML.
  async function api(body) {
    try {
      const r = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Inkline-Client': '1' },
        body: JSON.stringify(body),
        credentials: 'same-origin'
      });
      const j = await r.json().catch(() => null);
      return j && typeof j === 'object' ? Object.assign({ status: r.status }, j) : { ok: false, status: r.status, error: 'network' };
    } catch (e) { return { ok: false, status: 0, error: 'network' }; }
  }
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function startConversation() {
    const begun = !!(state.cv.name || state.cv.experience.length);
    const res = await api({ action: 'start', cv: begun ? state.cv : undefined });
    if (res.ok) { state.conversation = res.conversation; state.edited = false; save(); }
    return res;
  }
  async function aiAvailable() {
    try {
      const r = await fetch(API + '?status', { cache: 'no-store' });
      if (!r.ok) return false;
      const j = await r.json();
      return j && j.ai === true;
    } catch (e) { return false; }
  }

  let failures = 0;
  async function aiTurn(text) {
    setBusy(true);
    const body = { action: 'chat', conversation: state.conversation, input: text };
    if (state.edited) body.cv = state.cv;   // the CV is sent only when the visitor changed it by hand
    let res = await api(body);
    if (!res.ok && res.error === 'conversation_expired') {
      // Chats are deleted from the server after a while. Start a fresh one that knows the CV, then retry.
      const st = await startConversation();
      if (st.ok) { await sleep(1300); res = await api({ action: 'chat', conversation: state.conversation, input: text, cv: state.cv }); }
      else res = st;
    }
    setBusy(false);

    if (res.ok && res.data) {
      failures = 0;
      state.edited = false;
      const d = res.data;
      state.cv = normalize(d.cv);
      renderCV(true);
      bubble('ai', String(d.reply || '').trim() || 'Got it. What else should we add?');
      if (d.show_designs && Array.isArray(d.suggested_templates) && d.suggested_templates.length) designsBubble(d.suggested_templates);
      setQuick(Array.isArray(d.quick_replies) ? d.quick_replies : []);
      setStage(d.stage);
      save();
      return;
    }
    failures++;
    const limited = res.error === 'daily_limit' || res.error === 'turn_limit';
    const msg = res.message || "Sorry, I couldn't reach the AI just now.";
    const el = bubble('ai', limited ? msg : msg + ' Your answers are safe.', false);
    const row = document.createElement('div');
    row.className = 'retry';
    if (!limited) {
      const again = document.createElement('button');
      again.type = 'button'; again.className = 'chip'; again.textContent = 'Try again';
      const wait = Math.min(60, Number(res.retry_after) || 0);
      if (wait > 0) { again.disabled = true; setTimeout(() => { again.disabled = false; }, wait * 1000); }
      again.addEventListener('click', () => {
        if (el.label) el.label.remove();
        el.remove();
        const mine = log.querySelectorAll('.msg.me');
        if (mine.length) mine[mine.length - 1].remove();
        state.chat.pop();
        submit(text);
      });
      row.appendChild(again);
    }
    if (limited || failures >= 2) {
      const guided = document.createElement('button');
      guided.type = 'button'; guided.className = 'chip'; guided.textContent = 'Continue without AI';
      guided.addEventListener('click', () => { row.remove(); switchToGuided(); });
      row.appendChild(guided);
      const form = document.createElement('button');
      form.type = 'button'; form.className = 'chip'; form.textContent = 'Edit it myself';
      form.addEventListener('click', () => setPane('form'));
      row.appendChild(form);
    }
    el.appendChild(row);
  }

  function switchToGuided() {
    setMode('guided');
    state.guided = { step: firstMissingStep(), expIndex: state.cv.experience.length - 1, eduIndex: state.cv.education.length - 1 };
    save();
    askGuided();
  }

  // ---------- guided interviewer (works with no AI at all) ----------
  const tidy = s => {
    s = String(s || '').trim().replace(/\s+/g, ' ').replace(/^[-•*]\s*/, '');
    s = s.replace(/^(i was |i am |i've been |i have been |i )/i, '');
    s = s.replace(/^was responsible for /i, 'Responsible for ');
    if (!s) return '';
    s = s.charAt(0).toUpperCase() + s.slice(1);
    if (!/[.!?]$/.test(s)) s += '.';
    return s;
  };
  const SMALL = /^(a|an|and|at|by|for|in|of|on|or|the|to|with|de|la|le|van|von|al|bin|el)$/i;
  const titleCase = s => String(s || '').trim().replace(/\s+/g, ' ')
    .split(' ').map((w, i) => (i > 0 && SMALL.test(w)) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  const capFirst = s => { s = String(s || '').trim(); return s.charAt(0).toUpperCase() + s.slice(1); };
  const isSkip = s => /^(skip|no|none|nope|n\/a|not yet|no photo|that'?s all|i don'?t (know|have)|-)$/i.test(String(s).trim().replace(/[.!]$/, ''));
  const splitList = s => String(s).split(/\n|,|;/).map(x => x.trim().replace(/^[-•*]\s*/, '')).filter(Boolean);
  // Split answers into points: by line, or else by sentence (works in every browser, no lookbehind needed).
  const splitLines = s => {
    const parts = String(s).split(/\n+/).map(x => x.trim()).filter(Boolean);
    if (parts.length > 1) return parts;
    const bits = String(s).split(/([.!?])\s+(?=[A-Z0-9])/), out = [];
    for (let i = 0; i < bits.length; i += 2) out.push(bits[i] + (bits[i + 1] || ''));
    return out.map(x => x.trim()).filter(Boolean);
  };
  function parseDates(s) {
    const t = String(s).trim();
    const m = t.split(/\s+(?:to|until|till|-|–|—)\s+|\s*[-–—]\s*/i);
    const fix = x => /^(now|present|current|today|still here|ongoing)$/i.test(String(x || '').trim()) ? 'Present' : titleCase(x || '');
    if (m.length >= 2) return [fix(m[0]), fix(m[1])];
    return [fix(t), ''];
  }
  function placeAndCity(s) {
    const t = String(s).trim();
    const i = t.lastIndexOf(',');
    if (i > 0) return [t.slice(0, i).trim(), t.slice(i + 1).trim()];
    const at = t.split(/\s+in\s+/i);
    if (at.length === 2) return [at[0].trim(), at[1].trim()];
    return [t, ''];
  }

  const G = {
    name:     { stage: 'basics', ask: () => "What's your full name?" },
    title:    { stage: 'target', ask: c => `Nice to meet you${c.name ? ', ' + c.name.split(' ')[0] : ''}. What job are you going for?` },
    email:    { stage: 'contact', ask: () => 'What email address should employers use?', quick: ['Skip'] },
    phone:    { stage: 'contact', ask: () => 'And a phone number?', quick: ['Skip'] },
    location: { stage: 'contact', ask: () => 'Which city or town do you live in?', quick: ['Skip'] },
    link:     { stage: 'contact', ask: () => 'Do you have a LinkedIn page or website to add?', quick: ['No'] },
    photo:    { stage: 'contact', ask: () => 'Would you like a photo on your CV? Many of the colourful designs have a photo spot.', quick: ['Add a photo', 'No photo'] },
    expHas:   { stage: 'experience', ask: () => 'Have you had any jobs? Part-time, summer and volunteer work all count.', quick: ['Yes', 'Not yet'] },
    expRole:  { stage: 'experience', ask: g => g.expIndex < 0 ? "Let's start with your most recent job. What was your job title?" : 'What was the job title?' },
    expOrg:   { stage: 'experience', ask: () => "Where did you work? The company name and city, like 'Greenway Stores, Leeds'." },
    expDates: { stage: 'experience', ask: () => "When did you start and finish? For example '2021 to now' or 'Mar 2019 to Jun 2021'." },
    expWhat:  { stage: 'experience', ask: () => 'What did you do there? Tell me two or three things, each on a new line. Numbers help, like how many customers you served or how much sales grew.' },
    expMore:  { stage: 'experience', ask: () => 'Do you want to add another job?', quick: ['Add another job', "That's all"] },
    eduQual:  { stage: 'education', ask: () => "What's your highest qualification? For example 'BA Marketing' or 'High school diploma'.", quick: ['Skip'] },
    eduSchool:{ stage: 'education', ask: () => 'Where did you study? The school name and city.' },
    eduDates: { stage: 'education', ask: () => "When did you study there? For example '2014 to 2017'." },
    eduMore:  { stage: 'education', ask: () => 'Add another qualification?', quick: ['Add another', "That's all"] },
    skills:   { stage: 'skills', ask: () => "What are your top skills? List them with commas, like 'Excel, customer service, cooking'." },
    languages:{ stage: 'skills', ask: () => 'Which languages do you speak, and how well?', quick: ['Just English', 'Skip'] },
    extras:   { stage: 'extras', ask: () => 'Anything else worth adding? Certifications, volunteering, projects or awards. Put each on a new line.', quick: ['Skip'] },
    summary:  { stage: 'extras', ask: () => 'Last one. In a sentence or two, what makes you good at this kind of work?', quick: ['Write one for me'] },
    review:   { stage: 'review', ask: () => 'Your CV is ready. Here it is in a few designs. Tap the one you like, and you can still change anything afterwards.', quick: [{ label: 'See all 11 designs', act: 'picker' }, { label: 'Edit it myself', act: 'form' }, 'Start a new CV'], after: () => designsBubble(suggestedFor()) }
  };

  function firstMissingStep() {
    const c = state.cv;
    if (!c.name) return 'name';
    if (!c.title) return 'title';
    if (!c.email && !c.phone) return 'email';
    if (!c.experience.length) return 'expHas';
    if (!c.education.length) return 'eduQual';
    if (!c.skills.length) return 'skills';
    if (!c.summary) return 'summary';
    return 'review';
  }

  function askGuided() {
    const g = state.guided, step = G[g.step];
    setStage(step.stage);
    setBusy(true);
    setTimeout(() => {   // a short beat so it reads as a reply, not a form
      setBusy(false);
      bubble('ai', step.ask(g.step === 'title' ? state.cv : g));
      if (step.after) step.after();
      setQuick(step.quick || []);
      save();
    }, 450);
  }

  function guidedTurn(text) {
    if (looksLikeQuestion(text)) {
      const hit = FAQ.find(([re]) => re.test(text));
      bubble('ai', hit ? hit[1] : "I can help with questions about your CV, like how long it should be or how to explain a gap. Let's keep building your CV.");
      if (state.guided.step !== 'review') askGuided();
      return;
    }
    const g = state.guided, c = state.cv, skip = isSkip(text);
    const go = step => { g.step = step; state.edited = true; renderCV(true); save(); askGuided(); };
    switch (g.step) {
      case 'name': if (!skip) c.name = titleCase(text); return go('title');
      case 'title': if (!skip) c.title = titleCase(text); return go('email');
      case 'email': if (!skip) c.email = text.trim(); return go('phone');
      case 'phone': if (!skip) c.phone = text.trim(); return go('location');
      case 'location': if (!skip) c.location = titleCase(text); return go('link');
      case 'link': if (!skip) c.link = text.trim().replace(/^https?:\/\/(www\.)?/i, ''); return go(state.photo ? 'expHas' : 'photo');
      case 'photo': if (/add/i.test(text)) pickPhoto(); return go('expHas');
      case 'expHas': return go(skip || /^not/i.test(text) ? 'eduQual' : 'expRole');
      case 'expRole':
        c.experience.push({ role: titleCase(text), company: '', location: '', start: '', end: '', bullets: [] });
        g.expIndex = c.experience.length - 1;
        return go('expOrg');
      case 'expOrg': { const [co, city] = placeAndCity(text); Object.assign(c.experience[g.expIndex], { company: co, location: titleCase(city) }); return go('expDates'); }
      case 'expDates': { const [a, b] = parseDates(text); Object.assign(c.experience[g.expIndex], { start: a, end: b }); return go('expWhat'); }
      case 'expWhat': if (!skip) c.experience[g.expIndex].bullets = splitLines(text).map(tidy).filter(Boolean).slice(0, 6); return go('expMore');
      case 'expMore': return go(/another|yes|add/i.test(text) ? 'expRole' : 'eduQual');
      case 'eduQual':
        if (skip) return go('skills');
        c.education.push({ qualification: titleCase(text), school: '', location: '', start: '', end: '', details: '' });
        g.eduIndex = c.education.length - 1;
        return go('eduSchool');
      case 'eduSchool': { const [s, city] = placeAndCity(text); Object.assign(c.education[g.eduIndex], { school: s, location: titleCase(city) }); return go('eduDates'); }
      case 'eduDates': { const [a, b] = parseDates(text); Object.assign(c.education[g.eduIndex], { start: a, end: b }); return go('eduMore'); }
      case 'eduMore': return go(/another|yes|add/i.test(text) ? 'eduQual' : 'skills');
      case 'skills': if (!skip) c.skills = splitList(text).map(capFirst).slice(0, 20); return go('languages');
      case 'languages': if (/just english/i.test(text)) c.languages = ['English']; else if (!skip) c.languages = splitList(text).map(capFirst); return go('extras');
      case 'extras': if (!skip) c.extras = [{ heading: 'Highlights', items: splitLines(text).map(tidy).filter(Boolean) }]; return go('summary');
      case 'summary':
        if (/write one/i.test(text) || skip) c.summary = autoSummary(c);
        else c.summary = tidy(text);
        return go('review');
      case 'review':
        if (/design/i.test(text)) { designsBubble(suggestedFor()); return; }
        if (/new cv|start/i.test(text)) { $('#restart').click(); return; }
        bubble('ai', 'You can change anything by clicking the text on your CV, or switch to Fill in myself for a simple form. When it looks right, press Download PDF.');
        return;
    }
  }

  function autoSummary(c) {
    const role = c.title || (c.experience[0] && c.experience[0].role) || '';
    const places = c.experience.map(x => x.company).filter(Boolean).slice(0, 2);
    const skills = c.skills.slice(0, 3).map(s => s.toLowerCase());
    const parts = [];
    if (role && places.length) parts.push(`${role} with experience at ${places.join(' and ')}.`);
    else if (role) parts.push(`Hard-working candidate looking for a role as a ${role.toLowerCase()}.`);
    if (skills.length) parts.push(`Strong in ${skills.length > 1 ? skills.slice(0, -1).join(', ') + ' and ' + skills[skills.length - 1] : skills[0]}.`);
    return parts.join(' ');
  }

  // ---------- your CV in a few designs, right in the chat ----------
  function suggestedFor() {
    return state.photo ? ['atlas', 'vertex', 'bloom', 'indigo'] : ['indigo', 'atlas', 'harbor', 'sage'];
  }
  function scaleMinis(root) {
    root.querySelectorAll('.d-mini').forEach(box => {
      const cv = box.firstElementChild;
      if (cv && box.clientWidth) cv.style.transform = `scale(${box.clientWidth / cv.offsetWidth})`;
    });
  }
  addEventListener('resize', () => scaleMinis(log));
  function designsBubble(ids, record) {
    ids = [...new Set(ids || [])].filter(id => templateById(id).id === id).slice(0, 4);
    if (!ids.length) return;
    const el = document.createElement('div');
    el.className = 'msg ai designs';
    el.innerHTML = `<p>Your CV in ${ids.length} designs. Tap one to use it.</p>
      <div class="dgrid">${ids.map(id => {
        const t = templateById(id);
        return `<button type="button" class="dpick" data-pick="${id}" aria-pressed="${id === state.template}">
          <span class="d-mini" aria-hidden="true">${render(state.cv, opts({ template: id, accent: t.accent, editable: false }))}</span>
          <b>${esc(t.name)}</b></button>`;
      }).join('')}</div>
      <button type="button" class="d-all" data-act="picker">See all 11 designs</button>`;
    const prev = log.lastElementChild;
    if (!prev || !prev.classList.contains('ai')) {
      const label = document.createElement('div');
      label.className = 'who';
      label.innerHTML = dropIcon + (state.mode === 'ai' ? 'Inkline AI' : 'Inkline');
      log.appendChild(label);
    }
    log.appendChild(el);
    requestAnimationFrame(() => { scaleMinis(el); log.scrollTop = log.scrollHeight; });
    if (record !== false) { state.chat.push({ who: 'ai', kind: 'designs', ids }); save(); }
  }
  log.addEventListener('click', e => {
    const pick = e.target.closest('[data-pick]');
    if (pick) {
      const t = templateById(pick.dataset.pick);
      state.template = t.id;
      state.accent = t.accent;
      save(); syncToolbar(); renderCV(true);
      log.querySelectorAll('[data-pick]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.pick === t.id)));
      bubble('ai', `${t.name} it is. Click any text on your CV to change it, or edit everything in the form. You can also try other colours and fonts above your CV.`);
      setQuick([{ label: 'Edit it myself', act: 'form' }, { label: 'Download PDF', act: 'download' }, { label: 'See all designs', act: 'picker' }]);
      return;
    }
    const act = e.target.closest('[data-act]');
    if (act) quickAction(act.dataset.act);
  });

  // ---------- uploading an old CV ----------
  const cvInput = $('#cv-file');
  function pickCV() { cvInput.value = ''; cvInput.click(); }
  cvInput.addEventListener('change', () => { if (cvInput.files && cvInput.files.length) importCV([...cvInput.files]); });
  $('#attach').addEventListener('click', pickCV);

  function fileKind(file) {
    const name = (file.name || '').toLowerCase(), type = file.type || '';
    if (type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
    if (name.endsWith('.docx') || type.includes('wordprocessingml')) return 'docx';
    if (name.endsWith('.pages')) return 'pages';
    if (name.endsWith('.odt') || type.includes('opendocument.text')) return 'odt';
    if (name.endsWith('.rtf') || type.includes('rtf')) return 'rtf';
    if (name.endsWith('.doc') || type === 'application/msword') return 'doc';
    if (/\.(html?|xhtml)$/.test(name) || type === 'text/html') return 'html';
    if (type.startsWith('image/') || /\.(jpe?g|png|webp|gif|heic|heif|bmp|tiff?|avif)$/.test(name)) return 'image';
    if (type.startsWith('text/') || /\.(txt|md|csv|json|xml)$/.test(name)) return 'text';
    return null;
  }
  // Text from the many document formats people keep CVs in.
  async function odtText(file) {
    await loadScript('assets/vendor/jszip.min.js');
    const zip = await window.JSZip.loadAsync(await file.arrayBuffer());
    const xml = await zip.file('content.xml').async('string');
    return decodeXmlText(xml.replace(/<\/text:(p|h)>/g, '\n').replace(/<text:tab\/>/g, '\t').replace(/<text:line-break\/>/g, '\n'));
  }
  function decodeXmlText(t) {
    const d = document.createElement('textarea');
    d.innerHTML = t.replace(/<[^>]+>/g, '');   // decodes &amp; and friends without running anything
    return d.value.replace(/\n{3,}/g, '\n\n').trim();
  }
  function rtfText(raw) {
    // Drop header groups (fonts, colours, styles, document info and \* destinations), keep the body text.
    const skip = /^\\(\*|fonttbl|colortbl|stylesheet|info|listtable|listoverridetable|generator|themedata|datastore|latentstyles|rsidtbl|xmlnstbl|pict)/;
    let out = '', depth = 0, skipDepth = -1;
    for (let k = 0; k < raw.length; k++) {
      const ch = raw[k];
      if (ch === '{') { depth++; if (skipDepth < 0 && skip.test(raw.slice(k + 1, k + 20))) skipDepth = depth; continue; }
      if (ch === '}') { if (depth === skipDepth) skipDepth = -1; depth--; continue; }
      if (skipDepth < 0) out += ch;
    }
    return out
      .replace(/\\par[d]?\b/g, '\n').replace(/\\line\b/g, '\n').replace(/\\tab\b/g, '\t')
      .replace(/\\'([0-9a-f]{2})/gi, (m, h) => String.fromCharCode(parseInt(h, 16)))
      .replace(/\\u(-?\d+)\??/g, (m, n) => String.fromCharCode(n < 0 ? +n + 65536 : +n))
      .replace(/\\[a-z]+-?\d* ?/gi, '').replace(/\\[{}\\]/g, '')
      .replace(/[ \t]+\n/g, '\n').replace(/\n[ \t]+/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  function htmlText(raw) {
    const doc = new DOMParser().parseFromString(raw, 'text/html');
    doc.querySelectorAll('script,style').forEach(n => n.remove());
    return (doc.body ? doc.body.innerText || doc.body.textContent : '').replace(/\n{3,}/g, '\n\n').trim();
  }
  // Old binary Word files: pull out the readable runs of text. Messy, but the AI copes well with it.
  async function docText(file) {
    const buf = new Uint8Array(await file.arrayBuffer());
    // Characters a CV is likely to use: Latin, Greek, Cyrillic, Hebrew, Arabic and common punctuation.
    const ok = c => (c >= 32 && c < 0x250) || (c >= 0x370 && c < 0x530) || (c >= 0x590 && c < 0x700) || (c >= 0x2000 && c < 0x2070) || (c >= 0x20A0 && c < 0x20D0) || c === 9 || c === 10 || c === 13;
    const plain = c => (c >= 32 && c < 127) || (c >= 0x370 && c < 0x530) || (c >= 0x590 && c < 0x700) || c === 9 || c === 10 || c === 13;
    const keep = run => run.trim().length >= 4 && [...run].filter(ch => plain(ch.charCodeAt(0))).length / run.length >= 0.7;
    const runs = [];
    let cur = '';
    for (let i = 0; i + 1 < buf.length; i += 2) {   // .doc stores most text as UTF-16
      const code = buf[i] | (buf[i + 1] << 8);
      if (ok(code)) cur += String.fromCharCode(code);
      else { if (keep(cur)) runs.push(cur); cur = ''; }
    }
    if (keep(cur)) runs.push(cur);
    let text = runs.join('\n');
    if (text.replace(/[^A-Za-z]/g, '').length < 50) {   // some files use single-byte text instead
      text = (new TextDecoder('latin1').decode(buf).match(/[\x20-\x7E\xA0-\xFF\r\n\t]{4,}/g) || []).filter(keep).join('\n');
    }
    return text.replace(/\r/g, '\n').replace(/\n{3,}/g, '\n\n').slice(0, 60000).trim();
  }

  // Apple Pages files are zip packages with a preview of the document inside.
  async function pagesPreview(file) {
    await loadScript('assets/vendor/jszip.min.js');
    const zip = await window.JSZip.loadAsync(await file.arrayBuffer());
    const names = Object.keys(zip.files);
    const pdf = names.find(n => /preview\.pdf$/i.test(n));
    if (pdf) return { kind: 'pdf', blob: new Blob([await zip.file(pdf).async('uint8array')], { type: 'application/pdf' }) };
    const jpgs = names.filter(n => /\.(jpe?g|png)$/i.test(n) && /preview/i.test(n) && !/micro|web|thumb/i.test(n));
    const pick = jpgs[0] || names.find(n => /preview.*\.(jpe?g|png)$/i.test(n));
    if (pick) return { kind: 'image', blob: new Blob([await zip.file(pick).async('uint8array')], { type: /png$/i.test(pick) ? 'image/png' : 'image/jpeg' }), firstPageOnly: true };
    return null;
  }
  async function textOf(file, kind) {
    if (kind === 'docx') return docxText(file);
    if (kind === 'odt') return odtText(file);
    if (kind === 'rtf') return rtfText(await file.text());
    if (kind === 'html') return htmlText(await file.text());
    if (kind === 'doc') return docText(file);
    return file.text();
  }
  const readAsDataURL = file => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
  async function fileBase64(file) { return String(await readAsDataURL(file)).split(',')[1]; }
  // Photos of a CV are shrunk to a sensible size before sending: faster, cheaper, and HEIC becomes JPEG.
  function imageBase64(file, max) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        res(c.toDataURL('image/jpeg', 0.85).split(',')[1]);
      };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('image')); };
      img.src = url;
    });
  }
  function loadScript(src) {
    return new Promise((res, rej) => {
      if (document.querySelector(`script[src="${src}"]`)) return res();
      const sc = document.createElement('script');
      sc.src = src; sc.onload = res; sc.onerror = rej;
      document.head.appendChild(sc);
    });
  }
  async function docxText(file) {
    await loadScript('assets/vendor/jszip.min.js');
    const zip = await window.JSZip.loadAsync(await file.arrayBuffer());
    const xml = await zip.file('word/document.xml').async('string');
    const t = xml.replace(/<\/w:p>/g, '\n').replace(/<w:tab\/>/g, '\t').replace(/<w:br\/>/g, '\n').replace(/<[^>]+>/g, '');
    const d = document.createElement('textarea');
    d.innerHTML = t;   // decodes &amp; and friends without running anything
    return d.value.replace(/\n{3,}/g, '\n\n').trim();
  }
  async function pdfText(file) {
    // Served from this site (not a CDN), so no outside server can ever change the code that runs here.
    const base = new URL('assets/vendor/', location.href).href;
    const pdfjs = await import(base + 'pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = base + 'pdf.worker.min.mjs';
    const doc = await pdfjs.getDocument({ data: await file.arrayBuffer(), isEvalSupported: false }).promise;
    let out = '';
    for (let n = 1; n <= Math.min(doc.numPages, 6); n++) {
      const tc = await (await doc.getPage(n)).getTextContent();
      out += tc.items.map(it => it.str + (it.hasEOL ? '\n' : ' ')).join('') + '\n';
    }
    return out.trim();
  }

  async function importCV(files) {
    files = (Array.isArray(files) ? files : [files]).slice(0, 6);
    const big = files.find(f => f.size > 15 * 1024 * 1024);
    if (big) { toast('That file is too big. Please use one under 15 MB.'); return; }
    if (state.pane !== 'chat') setPane('chat');
    await startChat();
    if (state.cv.name || state.cv.experience.length) {
      if (!confirm('Replace your current CV with the details from this file?')) return;
    }
    bubble('me', 'Uploaded my old CV: ' + files.map(f => f.name).join(', '));
    const unknown = files.find(f => !fileKind(f));
    if (unknown) {
      bubble('ai', `I can't open "${unknown.name}" yet. PDF, Word, Pages, OpenDocument, RTF, text files and photos of a CV all work. If it's another kind, try saving it as a PDF.`);
      return;
    }
    if (state.mode === 'ai') await importWithAI(files);
    else await importBasic(files);
  }

  async function importWithAI(files) {
    setBusy(true);
    const payload = { files: [], text: '' };
    let firstPageOnly = false;
    try {
      for (const file of files) {
        let kind = fileKind(file), blob = file;
        if (kind === 'pages') {
          const p = await pagesPreview(file);
          if (!p) throw new Error('pages');
          kind = p.kind; blob = p.blob; firstPageOnly = firstPageOnly || !!p.firstPageOnly;
        }
        if (kind === 'pdf') payload.files.push({ media_type: 'application/pdf', data: await fileBase64(blob) });
        else if (kind === 'image') payload.files.push({ media_type: 'image/jpeg', data: await imageBase64(blob, 2000) });
        else payload.text += (payload.text ? '\n\n' : '') + await textOf(file, kind);
      }
      if (!payload.files.length) delete payload.files;
      if (!payload.text.trim()) delete payload.text;
      if (!payload.files && !payload.text) throw new Error('empty');
      // The server enforces these limits; checking here too just saves a wasted upload.
      const bytes = (payload.files || []).reduce((n, f) => n + f.data.length * 0.75, 0);
      if ((payload.files || []).some(f => f.data.length * 0.75 > 8 * 1048576)) throw new Error('size');
      if (bytes > 10 * 1048576) throw new Error('size');
    } catch (e) {
      setBusy(false);
      bubble('ai', /pages/.test(e && e.message)
        ? "I couldn't find anything readable inside that Pages file. In Pages, choose File, then Export To, then PDF, and upload the PDF."
        : /size/.test(e && e.message)
          ? 'That file is too big. Each file can be up to 8 MB, and 10 MB together.'
          : "I couldn't open that file. If it's a photo, try a JPG or PNG. If it's a document, try saving it as a PDF and uploading that.");
      return;
    }
    const res = await api(Object.assign({ action: 'import', conversation: state.conversation || undefined }, payload));
    setBusy(false);
    if (!res.ok || !res.data) {
      bubble('ai', res.message || "Sorry, I couldn't read that file just now. You can try again, or just tell me about your experience instead.");
      if (res.error !== 'daily_limit') setQuick([{ label: 'Try the upload again', act: 'upload' }]);
      return;
    }
    // The server keeps the interview going from what it read; the file itself is never stored.
    if (res.conversation) state.conversation = res.conversation;
    const d = res.data;
    state.cv = normalize(d.cv);
    renderCV(true);
    state.edited = false;
    bubble('ai', String(d.reply || '').trim() || "I've read your old CV and filled in your new one. What has changed since you wrote it?");
    if (firstPageOnly) bubble('ai', 'Note: that Pages file only let me see its first page. If your CV is longer, export it from Pages as a PDF and upload that too.');
    setQuick(Array.isArray(d.quick_replies) ? d.quick_replies : []);
    setStage(G[firstMissingStep()].stage);
    save();
  }

  // Without the AI: pick out what can be found reliably (contact details and the name), then ask the rest.
  async function importBasic(files) {
    setBusy(true);
    let text = '', images = 0;
    for (const file of files) {
      let kind = fileKind(file), blob = file;
      try {
        if (kind === 'pages') { const p = await pagesPreview(file); if (p && p.kind === 'pdf') { kind = 'pdf'; blob = p.blob; } else kind = 'image'; }
        if (kind === 'image') { images++; continue; }
        text += '\n' + (kind === 'pdf' ? await pdfText(blob) : await textOf(file, kind));
      } catch (e) { /* skip what can't be opened */ }
    }
    setBusy(false);
    if (images && !text.trim()) {
      bubble('ai', "Reading photos and scans needs the AI, which isn't switched on yet. Once it is, I can read any photo of a CV. For now, I'll ask you a few questions instead.");
      state.guided = { step: firstMissingStep(), expIndex: state.cv.experience.length - 1, eduIndex: state.cv.education.length - 1 };
      askGuided();
      return;
    }
    const c = state.cv, found = [];
    if (text.trim()) {
      const email = (text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/) || [])[0];
      const phone = (text.match(/\+?\d[\d\s().-]{7,}\d/) || [])[0];
      const link = (text.match(/(?:https?:\/\/)?(?:www\.)?(?:linkedin\.com\/in\/[\w-]+|[\w-]+\.(?:com|net|org|io|me|dev)\/[\w\/-]*)/i) || [])[0];
      const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean);
      const nameLine = lines.find(l => /^[A-Za-zÀ-ÿ'’.-]+(\s+[A-Za-zÀ-ÿ'’.-]+){1,3}$/.test(l) && !/curriculum|resume|résumé|\bcv\b|profile|summary/i.test(l));
      if (email && !c.email) { c.email = email; found.push('email'); }
      if (phone && !c.phone) { c.phone = phone.trim(); found.push('phone number'); }
      if (link && !c.link) { c.link = link.replace(/^https?:\/\/(www\.)?/i, ''); found.push('link'); }
      if (nameLine && !c.name) { c.name = titleCase(nameLine.toLowerCase()); found.push('name'); }
    }
    renderCV(true); save();
    bubble('ai', found.length
      ? `I picked up your ${found.join(', ').replace(/, ([^,]*)$/, ' and $1')} from your old CV. Without the AI switched on I can't read the rest reliably, so I'll ask you about the other parts.`
      : "I couldn't read much from that file. It may be a scanned picture, which needs the AI. Let's go through it together instead.");
    state.guided = { step: firstMissingStep(), expIndex: c.experience.length - 1, eduIndex: c.education.length - 1 };
    askGuided();
  }

  // ---------- answering common questions when the AI is off ----------
  const looksLikeQuestion = t => /\?\s*$/.test(t) || (/^(how|what|should|can|could|do|does|is|are|why|when|which|will|would)\b/i.test(t.trim()) && t.trim().split(/\s+/).length >= 4);
  const FAQ = [
    [/photo|picture|headshot/i, 'It depends on where you apply. In the US and UK, CVs usually have no photo. In much of Europe, the Middle East and Asia, a friendly, professional photo is common. Many of the colourful designs have a photo spot.'],
    [/how long|length|how many pages|one page|two pages|1 page|2 pages/i, 'Keep it to one page if you have less than about ten years of experience, and two pages at most. Short, clear lines beat long paragraphs.'],
    [/reference/i, "You don't need to list references on your CV. Employers will ask for them later if they want them."],
    [/\bgaps?\b|career break|unemploy|time off/i, "Be honest and keep it short. A line like 'Career break, caring for family' or 'Studying for a certificate' is fine. Gaps are very common."],
    [/gpa|grades?\b|marks|score/i, "Add your grades if they're good and you finished studying in the last few years. Otherwise you can leave them out."],
    [/hobb|interests?/i, 'Only add hobbies if they show a useful skill, like team sports or volunteering. Otherwise they take space you need for experience.'],
    [/\bats\b|hiring software|robot|online application|applicant tracking/i, "For online application forms, choose a Classic design. They're one clean column, which hiring software reads best."],
    [/salary|wage/i, "Leave salary off your CV. It's usually discussed later, once they're interested."],
    [/\bage\b|birth|marital|married|nationality|religion/i, "In many countries you shouldn't add your age, date of birth or marital status. In some places, like the Gulf, nationality is often expected. Add it only if it's normal where you apply."],
    [/cover letter/i, 'A short cover letter helps: three short paragraphs saying why this job, what you bring, and that you would love to talk.'],
    [/free|cost|price|pay for|charge/i, 'Inkline is free. No card, no trial and no watermark on your PDF.'],
    [/font|text size|bigger|smaller/i, 'Use the Fonts & size button above your CV to pick a font and make the name, headings or text bigger or smaller.'],
    [/design|template|layout|colou?r|style/i, 'Press the Design button above your CV to see all 11 designs. You can change the colour there too.'],
    [/download|pdf|save|print/i, 'When your CV is ready, press Download PDF above it and choose Save as PDF.'],
    [/upload|old cv|existing cv|import/i, 'You can upload your old CV with the paperclip button next to the message box.'],
    [/edit|change|fix|mistake|typo/i, 'Click any text on your CV and type to change it, or switch to Fill in myself to edit everything in a simple form.'],
    [/\blie\b|exaggerat|fake/i, 'Always keep your CV honest. Employers check, and a strong, true line beats a big claim.']
  ];

  // ---------- starting the chat ----------
  let chatPromise = null;
  function startChat() {
    if (chatPromise) { requestAnimationFrame(() => { log.scrollTop = log.scrollHeight; }); return chatPromise; }
    chatPromise = beginChat();
    return chatPromise;
  }
  async function beginChat() {
    if (state.chat.length) {
      // Welcome back: replay the conversation as it was.
      setMode(state.mode || 'guided');
      log.innerHTML = '';
      state.chat.forEach(m => m.kind === 'designs' ? designsBubble(m.ids, false) : bubble(m.who, m.text, false));
      setQuick(state.quick);
      setStage(state.stage);
      if (state.mode === 'ai' && !(await aiAvailable())) {
        bubble('ai', "The AI isn't available right now, so I'll keep going with the guided questions.", false);
        switchToGuided();
      }
      return;
    }
    const ai = await aiAvailable();
    setMode(ai ? 'ai' : 'guided');
    const c = state.cv, first = c.name ? c.name.split(' ')[0] : '';
    const begun = !!(c.name || c.experience.length);
    const greeting = begun
      ? `Hi ${first || 'there'}. I can see you've started your CV. I'll ask about anything that's missing, and you can skip whatever you like.`
      : "Hi, I'm your Inkline interviewer. I'll ask a few easy questions and write your CV as we go. You can skip anything, ask me questions any time, or upload your old CV with the paperclip.\n\nFirst, what's your full name?";
    if (ai) {
      const res = await startConversation();
      if (res.ok) {
        setStage('basics');
        bubble('ai', res.greeting || greeting);
        setQuick(Array.isArray(res.quick_replies) ? res.quick_replies : []);
        save();
        if (!mobile()) answer.focus({ preventScroll: true });
        return;
      }
      // Could not open an AI chat (for example the daily limit): carry on with the guided questions.
      setMode('guided');
      if (res.message) bubble('ai', res.message);
    }
    if (state.mode === 'guided') {
      bubble('ai', greeting);
      if (begun) {
        state.guided = { step: firstMissingStep(), expIndex: c.experience.length - 1, eduIndex: c.education.length - 1 };
        askGuided();
      } else {
        state.guided = { step: 'name', expIndex: -1, eduIndex: -1 };
        setStage('basics');
        setQuick([]);
      }
    }
    save();
    if (!mobile()) answer.focus({ preventScroll: true });
  }

  // ---------- go ----------
  if (params.get('template')) {
    const t = templateById(params.get('template'));
    if (t.id === params.get('template')) { state.template = t.id; state.accent = t.accent; }
  }
  buildToolbar();
  syncToolbar();
  syncPhotoUI();
  ensureFont(state.font);
  syncTextControls();
  renderCV(false);
  const wanted = params.get('mode');
  if (wanted === 'ai' || wanted === 'form') { state.started = true; setPane(wanted === 'ai' ? 'chat' : 'form'); }
  else if (state.started) setPane(state.pane);
  else showChooser();
  save();
})();
