/* Inkline CV maker. Two ways in: the AI interview (or guided questions when the AI is off), or filling
   in a form yourself. Both edit the same CV, shown live in any design, with an optional photo. */
(function () {
  'use strict';
  const { TEMPLATES, ACCENTS, FONTS, LANGS, readableAccent, accentValue, isHex, SECTION_KEYS, EXTRA_PRESETS, SAMPLE, ICONS, fontById, fontHref, langById, sectionTitle, dateWord, translateCV, emptyCV, render, normalize, setPath, plainText, templateById, esc } = window.InklineCV;
  const $ = s => document.querySelector(s);
  const app = $('.app'), log = $('#log'), quick = $('#quick'), answer = $('#answer'), sendBtn = $('#send');
  const sheet = $('#sheet'), frame = $('#frame'), desk = $('#desk'), formEl = $('#form');
  const STORE = 'inkline:v1';
  const API = 'api/ai.php';
  const STAGES = ['basics', 'target', 'contact', 'experience', 'education', 'skills', 'extras', 'review'];
  const mobile = () => matchMedia('(max-width:980px)').matches;
  // Interface text in English or Dutch (assets/i18n.js). Most text is translated as it appears on screen;
  // t() is for words that never reach the page, like pop-up questions and suggestions that become CV text.
  const UI_LANG = window.I18N ? window.I18N.lang : 'en';
  const t = (s, v) => (window.I18N ? window.I18N.t(s, v) : (v ? s.replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m)) : s));
  const cvDutch = () => state.sections.lang === 'nl';

  // A photo is only ever a picture we drew ourselves (a JPEG data URL). Anything else is refused,
  // so nothing unexpected can ever be put into the page.
  const safePhoto = p => typeof p === 'string' && p.length < 3000000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(p);

  // ---------- state ----------
  const params = new URLSearchParams(location.search);
  let state = load() || fresh();

  function fresh() {
    return {
      v: 1, cv: emptyCV(), template: 'atlas', accent: 'navy', paper: 'a4', photo: '',
      photoSrc: '',          // the whole photo (made smaller), kept so it can be cropped again
      photoCrop: null,       // where the crop sits in it: centre x, centre y (0 to 1) and zoom
      font: 'default', sizes: { name: 1, head: 1, text: 1 },
      sections: cleanSections({ lang: UI_LANG }),   // heading language, renamed or hidden sections, the word between dates
      badges: [],            // icons with text placed anywhere on the page
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
        if (!isHex(s.accent) && !ACCENTS.some(a => a.id === s.accent)) s.accent = templateById(s.template).accent;
        if (!safePhoto(s.photo)) s.photo = '';
        if (!safePhoto(s.photoSrc) || !s.photo) s.photoSrc = '';
        s.photoCrop = cleanCrop(s.photoCrop);
        s.sections = cleanSections(s.sections);
        s.badges = cleanBadges(s.badges);
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
  // Settings read back from storage are checked, so nothing odd can reach the page.
  function cleanSections(x) {
    x = x && typeof x === 'object' ? x : {};
    const str = (v, n) => typeof v === 'string' ? v.slice(0, n) : '';
    const titles = {}, hidden = {};
    SECTION_KEYS.forEach(k => {
      if (x.titles && str(x.titles[k], 60).trim()) titles[k] = str(x.titles[k], 60);
      if (x.hidden && x.hidden[k] === true) hidden[k] = true;
    });
    return { lang: langById(x.lang).id, titles, hidden, to: str(x.to, 20) };
  }
  function cleanBadges(list) {
    const n = (v, hi) => Math.max(0, Math.min(hi, Number(v) || 0));
    return (Array.isArray(list) ? list : []).slice(0, 24).map(b => b && typeof b === 'object' && window.InklineIcons.byId(b.icon) ? {
      icon: b.icon, text: typeof b.text === 'string' ? b.text.slice(0, 120) : '', x: n(b.x, 600), y: n(b.y, 6000),
      tone: ['dark', 'light', 'accent'].includes(b.tone) ? b.tone : 'dark', size: ['s', 'm', 'l'].includes(b.size) ? b.size : 'm', auto: b.auto !== false
    } : null).filter(Boolean);
  }
  function cleanCrop(c) {
    if (!c || typeof c !== 'object') return null;
    const n = (v, lo, hi) => Math.min(hi, Math.max(lo, Number(v) || 0));
    return { x: n(c.x, 0, 1), y: n(c.y, 0, 1), z: n(c.z, 1, 6) };
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
    return Object.assign({ template: state.template, accent: state.accent, paper: state.paper, photo: state.photo, font: state.font, sizes: state.sizes, sections: state.sections, badges: state.badges }, extra || {});
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
  // Scroll the CV area (not the whole page) so an element sits in the middle of it.
  function revealOnCV(el) {
    const d = desk.getBoundingClientRect(), r = el.getBoundingClientRect();
    desk.scrollTo({ top: desk.scrollTop + r.top - d.top - d.height / 2 + r.height / 2, behavior: 'smooth' });
  }
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
    const bt = e.target.closest('[data-badge-text]');
    if (bt) {
      const b = state.badges[+bt.dataset.badgeText];
      if (b) b.text = bt.textContent.replace(/\s+/g, ' ').trim().slice(0, 120);
      document.querySelectorAll(`[data-badge-input="${bt.dataset.badgeText}"]`).forEach(x => { x.value = b ? b.text : ''; });
      save();
      return;
    }
    const hd = e.target.closest('[data-heading]'), word = e.target.closest('[data-word]');
    if (hd || word) {
      const text = (hd || word).textContent.replace(/\s+/g, ' ').trim();
      if (hd) {
        const key = hd.dataset.heading;
        // typing the language's own word again simply goes back to it
        if (!text || text === langById(state.sections.lang).t[key]) delete state.sections.titles[key];
        else state.sections.titles[key] = text.slice(0, 60);
        document.querySelectorAll(`[data-sec-title="${key}"]`).forEach(x => { x.value = state.sections.titles[key] || ''; });
      } else {
        state.sections.to = text === langById(state.sections.lang).t.to ? '' : text.slice(0, 20);
        // every entry uses the same word, so the others change as you type
        sheet.querySelectorAll('[data-word="to"]').forEach(x => { if (x !== word) x.textContent = dateWord(state.sections); });
        document.querySelectorAll('[data-sec-to]').forEach(x => { x.value = state.sections.to; });
        document.querySelectorAll('[data-sec-example]').forEach(x => { x.textContent = dateExample(); });
      }
      save();
      return;
    }
    const el = e.target.closest('[data-path]');
    if (!el) return;
    setPath(state.cv, el.dataset.path, el.textContent.replace(/\s+/g, ' ').trim());
    state.edited = true;
    save();
    countPages();
  });
  // Empty lines are tidied away only once the visitor leaves the CV, so the lines still being edited keep their places.
  let addingLine = false;
  sheet.addEventListener('focusout', e => {
    if (addingLine || !e.target.closest('[data-path],[data-heading],[data-word],[data-badge-text]')) return;
    setTimeout(() => {
      if (sheet.contains(document.activeElement)) return;
      state.cv = normalize(state.cv);
      save();
      renderCV(false);
      if (state.pane === 'form') buildForm();
      if (!sectionsPanel.hidden) refreshSectionsPanel();
      refreshIconsPanel();
    }, 0);
  });
  sheet.addEventListener('keydown', e => {
    // Enter in a list (bullet points, or the lines of an added section) starts a new line below
    const li = e.target.closest('[data-path]');
    const m = li && e.key === 'Enter' && !e.shiftKey && li.dataset.path.match(/^((?:experience|extras)\.\d+\.(?:bullets|items))\.(\d+)$/);
    if (m && li.textContent.trim()) {
      e.preventDefault();
      const list = m[1].split('.').reduce((o, k) => o[k], state.cv), at = +m[2] + 1;
      setPath(state.cv, li.dataset.path, li.textContent.replace(/\s+/g, ' ').trim());
      list.splice(at, 0, '');
      addingLine = true;
      renderedHTML = '';
      renderCV(false);
      const next = sheet.querySelector(`[data-path="${m[1]}.${at}"]`);
      if (next) next.focus();
      addingLine = false;
      save();
      return;
    }
    if (e.key === 'Enter' && e.target.closest('[data-path],[data-heading],[data-word],[data-badge-text]')) { e.preventDefault(); e.target.blur(); }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('[data-action="photo"]')) { e.preventDefault(); photoClicked(); }
  });
  sheet.addEventListener('click', e => { if (e.target.closest('[data-action="photo"]')) photoClicked(); });
  sheet.addEventListener('paste', e => {
    if (!e.target.closest('[data-path],[data-heading],[data-word],[data-badge-text]')) return;
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text');
    document.execCommand('insertText', false, text.replace(/\s+/g, ' '));
  });

  // ---------- photo ----------
  // A new photo opens the crop window; clicking the photo on the CV opens it again to move or zoom.
  const photoInput = $('#photo-input');
  function pickPhoto() { photoInput.value = ''; photoInput.click(); }
  function photoClicked() { if (state.photo) openCropper(state.photoSrc || state.photo, state.photoSrc ? state.photoCrop : null, false); else pickPhoto(); }
  photoInput.addEventListener('change', () => { if (photoInput.files && photoInput.files[0]) usePhoto(photoInput.files[0]); });
  function usePhoto(file) {
    if (!/^image\//.test(file.type)) { toast('Please choose a photo, like a JPG or PNG.'); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      // kept at a sensible size, so it can be cropped again later without filling up the browser's storage
      const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      const ctx = c.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      const src = c.toDataURL('image/jpeg', 0.88);
      if (!safePhoto(src)) { toast("That photo couldn't be used. Try another one."); return; }
      openCropper(src, null, true);
    };
    img.onerror = () => { URL.revokeObjectURL(url); toast("That photo couldn't be opened. Try a JPG or PNG."); };
    img.src = url;
  }
  function removePhoto() {
    state.photo = ''; state.photoSrc = ''; state.photoCrop = null;
    save(); renderCV(false); syncPhotoUI();
    if (state.pane === 'form') buildForm();
  }
  function syncPhotoUI() {
    $('#photo-mini').innerHTML = safePhoto(state.photo) ? `<img src="${state.photo}" alt="">` : ICONS.camera;
    $('#photo-label').textContent = state.photo ? 'Edit photo' : 'Add photo';
  }
  $('#photo-btn').addEventListener('click', photoClicked);

  // ---------- cropping the photo ----------
  const cropper = $('#cropper'), cropStage = $('#crop-stage'), cropImg = $('#crop-img'), cropZoom = $('#crop-zoom');
  const crop = { img: null, src: '', w: 0, h: 0, S: 0, base: 1, z: 1, ox: 0, oy: 0, isNew: false, pointers: new Map(), pinch: null, back: null };
  function openCropper(src, start, isNew) {
    const img = new Image();
    img.onload = () => {
      Object.assign(crop, { img, src, w: img.naturalWidth, h: img.naturalHeight, isNew });
      crop.back = document.activeElement;
      cropImg.src = src;
      // the frame matches the design: a portrait rectangle for Noir, a circle for the others
      $('#crop-mask').className = 'crop-mask ' + (state.template === 'noir' ? 'rect' : 'round');
      $('#crop-remove').hidden = isNew;
      cropper.hidden = false;
      placeCrop(start || startingCrop());
      cropStage.focus({ preventScroll: true });
    };
    img.onerror = () => toast("That photo couldn't be opened. Try a JPG or PNG.");
    img.src = src;
  }
  // where a new photo starts: the middle, and the upper part of a tall photo, where the face usually is
  function startingCrop() {
    const s = Math.min(crop.w, crop.h), sy = crop.h > crop.w ? Math.min((crop.h - s) * 0.18, crop.h - s) : 0;
    return { x: 0.5, y: (sy + s / 2) / crop.h, z: 1 };
  }
  function placeCrop(c) {
    crop.S = cropStage.clientWidth;
    crop.base = Math.max(crop.S / crop.w, crop.S / crop.h);
    crop.z = c.z;
    const k = crop.base * crop.z;
    crop.ox = crop.S / 2 - c.x * crop.w * k;
    crop.oy = crop.S / 2 - c.y * crop.h * k;
    drawCrop();
  }
  function drawCrop() {
    const k = crop.base * crop.z;
    crop.ox = Math.min(0, Math.max(crop.S - crop.w * k, crop.ox));
    crop.oy = Math.min(0, Math.max(crop.S - crop.h * k, crop.oy));
    cropImg.style.width = crop.w * k + 'px';
    cropImg.style.height = crop.h * k + 'px';
    cropImg.style.transform = `translate(${crop.ox}px,${crop.oy}px)`;
    cropZoom.value = crop.z;
  }
  function zoomCropAt(z, px, py) {
    z = Math.min(4, Math.max(1, z));
    const r = z / crop.z;
    crop.ox = px - (px - crop.ox) * r;
    crop.oy = py - (py - crop.oy) * r;
    crop.z = z;
    drawCrop();
  }
  function currentCrop() {
    const k = crop.base * crop.z;
    return { x: (crop.S / 2 - crop.ox) / (crop.w * k), y: (crop.S / 2 - crop.oy) / (crop.h * k), z: crop.z };
  }
  function pinchInfo() {
    const [a, b] = [...crop.pointers.values()], r = cropStage.getBoundingClientRect();
    return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2 - r.left, my: (a.y + b.y) / 2 - r.top, z: crop.z };
  }
  cropStage.addEventListener('pointerdown', e => {
    e.preventDefault();
    cropStage.setPointerCapture(e.pointerId);
    crop.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    crop.pinch = crop.pointers.size === 2 ? pinchInfo() : null;
  });
  cropStage.addEventListener('pointermove', e => {
    const p = crop.pointers.get(e.pointerId);
    if (!p) return;
    if (crop.pointers.size === 1) { crop.ox += e.clientX - p.x; crop.oy += e.clientY - p.y; drawCrop(); }
    p.x = e.clientX; p.y = e.clientY;
    if (crop.pointers.size === 2 && crop.pinch) { const now = pinchInfo(); zoomCropAt(crop.pinch.z * now.d / crop.pinch.d, now.mx, now.my); }
  });
  const endPointer = e => { crop.pointers.delete(e.pointerId); crop.pinch = crop.pointers.size === 2 ? pinchInfo() : null; };
  cropStage.addEventListener('pointerup', endPointer);
  cropStage.addEventListener('pointercancel', endPointer);
  cropStage.addEventListener('wheel', e => {
    e.preventDefault();
    const r = cropStage.getBoundingClientRect();
    zoomCropAt(crop.z * Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });
  cropStage.addEventListener('keydown', e => {
    const step = e.shiftKey ? 30 : 8, mid = crop.S / 2;
    if (e.key === 'ArrowLeft') crop.ox += step; else if (e.key === 'ArrowRight') crop.ox -= step;
    else if (e.key === 'ArrowUp') crop.oy += step; else if (e.key === 'ArrowDown') crop.oy -= step;
    else if (e.key === '+' || e.key === '=') return zoomCropAt(crop.z * 1.1, mid, mid);
    else if (e.key === '-' || e.key === '_') return zoomCropAt(crop.z / 1.1, mid, mid);
    else return;
    e.preventDefault();
    drawCrop();
  });
  cropZoom.addEventListener('input', () => zoomCropAt(+cropZoom.value, crop.S / 2, crop.S / 2));
  addEventListener('resize', () => { if (!cropper.hidden) placeCrop(currentCrop()); });
  function closeCropper() {
    cropper.hidden = true;
    crop.pointers.clear();
    if (crop.back && crop.back.focus) crop.back.focus({ preventScroll: true });
  }
  $('#crop-cancel').addEventListener('click', closeCropper);
  $('#crop-change').addEventListener('click', () => { closeCropper(); pickPhoto(); });
  $('#crop-remove').addEventListener('click', () => { closeCropper(); removePhoto(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !cropper.hidden) closeCropper(); });
  $('#crop-done').addEventListener('click', () => {
    // the visible square becomes the photo (up to 720 pixels), drawn by us, so it is always a plain JPEG
    const c = currentCrop(), side = crop.S / (crop.base * crop.z);
    const out = Math.round(Math.max(240, Math.min(720, side)));
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = out;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(crop.img, c.x * crop.w - side / 2, c.y * crop.h - side / 2, side, side, 0, 0, out, out);
    const photo = canvas.toDataURL('image/jpeg', 0.86);
    if (!safePhoto(photo)) { toast("That photo couldn't be used. Try another one."); return; }
    const wasNew = crop.isNew;
    state.photo = photo;
    state.photoSrc = safePhoto(crop.src) ? crop.src : '';
    state.photoCrop = c;
    save();
    closeCropper();
    renderCV(true);
    syncPhotoUI();
    if (state.pane === 'form') buildForm();
    if (!templateById(state.template).photo) toast('Photo added. It shows in designs with a photo spot, like Atlas, Vertex or Bloom.');
    else toast(wasNew ? 'Photo added. Click it on your CV any time to move or zoom it.' : 'Photo updated.');
  });

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
    $('#accent-custom').addEventListener('input', e => {
      if (!isHex(e.target.value)) return;
      state.accent = e.target.value.toLowerCase();
      save(); syncToolbar(); renderSoon();
    });
    document.querySelectorAll('#paper button').forEach(b => b.addEventListener('click', () => {
      state.paper = b.dataset.paper; save(); syncToolbar(); renderCV(false);
    }));
  }
  function syncToolbar() {
    document.querySelectorAll('#accents button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.id === state.accent)));
    const shown = accentValue(state.accent || templateById(state.template).accent);
    $('#colour-dot').style.background = shown;
    $('#accent-custom').value = isHex(state.accent) ? state.accent : shown;
    $('#custom-note').textContent = isHex(state.accent) && readableAccent(state.accent) !== state.accent.toLowerCase()
      ? 'That colour was darkened a little, so white text on it stays easy to read.'
      : 'Very light colours are darkened a little, so white text on them stays easy to read.';
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
          <span class="t-mini" aria-hidden="true">${render(cv, { template: t.id, accent: t.accent, paper: state.paper, photo: previewPhoto(), font: state.font, sizes: state.sizes, sections: state.sections })}</span>
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
    try { await navigator.clipboard.writeText(plainText(state.cv, opts())); b.textContent = 'Copied'; }
    catch (e) { b.textContent = 'Copy failed'; }
    setTimeout(() => { b.textContent = 'Copy as text'; }, 1800);
  });
  $('#restart').addEventListener('click', () => {
    if (!confirm(t('Start a new CV? This deletes your CV, photo and chat from this browser, and the chat from our server.'))) return;
    if (state.conversation) api({ action: 'end', conversation: state.conversation });
    try { localStorage.removeItem(STORE); } catch (e) { /* nothing stored */ }
    const keep = { template: state.template, accent: state.accent, paper: state.paper, font: state.font, sizes: state.sizes, sections: state.sections };
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
    PANELS.forEach(closePanel);
    if (typeof closeSectionsPanel === 'function' && !sectionsPanel.hidden) closeSectionsPanel();
    FONTS.forEach(f => ensureFont(f.id));   // so every option previews in its own font
    $('#text-panel-body').innerHTML = textControls('tp');
    textPanel.hidden = false;
    $('#text-btn').setAttribute('aria-expanded', 'true');
  }
  // Toolbar panels (fonts, colour, icons, sections): one open at a time, closed by Done, Escape or a click outside.
  const PANELS = [];
  function togglePanel(btn, el, onOpen) {
    const p = { btn, el, onOpen };
    PANELS.push(p);
    btn.addEventListener('click', () => { if (el.hidden) openPanel(p); else closePanel(p); });
    return p;
  }
  function openPanel(p) {
    PANELS.forEach(q => { if (q !== p) closePanel(q); });
    closeTextPanel();
    if (!sectionsPanel.hidden) closeSectionsPanel();
    if (p.onOpen) p.onOpen();
    p.el.hidden = false;
    p.btn.setAttribute('aria-expanded', 'true');
  }
  function closePanel(p) {
    if (p.el.hidden) return;
    p.el.hidden = true;
    p.btn.setAttribute('aria-expanded', 'false');
  }
  addEventListener('keydown', e => { if (e.key === 'Escape') PANELS.forEach(closePanel); });
  document.addEventListener('pointerdown', e => {
    PANELS.forEach(p => { if (!p.el.hidden && !p.el.contains(e.target) && !p.btn.contains(e.target)) closePanel(p); });
  });
  const colourPanelP = togglePanel($('#colour-btn'), $('#colour-panel'), syncToolbar);
  $('#colour-close').addEventListener('click', () => closePanel(colourPanelP));
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

  // ---------- sections and headings ----------
  // Every design keeps its layout; visitors choose which sections show, what they are called
  // (in any language), the word between dates, and add sections of their own.
  const SECTION_NAMES = { contact: 'Contact details', profile: 'Profile', experience: 'Experience', education: 'Education', skills: 'Skills', languages: 'Languages' };
  const dateExample = () => `2021 ${dateWord(state.sections)} ${langById(state.sections.lang).t.present}`;
  function sectionControls(prefix, withExtras) {
    const S = state.sections, L = langById(S.lang), c = state.cv;
    return `
      <div class="sc-lang"><label for="${prefix}-lang">Heading language</label>
        <select class="f-in sc-select" id="${prefix}-lang" data-sec-lang>${LANGS.map(l => `<option value="${l.id}"${l.id === S.lang ? ' selected' : ''}>${esc(l.name)}</option>`).join('')}</select></div>
      <p class="sc-hint">Untick a section to hide it. To rename one, type a new name here or click its heading on your CV.</p>
      <ul class="sc-list">${SECTION_KEYS.map(k => `
        <li class="${S.hidden[k] ? 'off' : ''}">
          <input type="checkbox" class="sc-check" id="${prefix}-show-${k}" data-sec-show="${k}"${S.hidden[k] ? '' : ' checked'}>
          <label class="sr-only" for="${prefix}-show-${k}">Show ${SECTION_NAMES[k]}</label>
          <input class="f-in" data-sec-title="${k}" value="${esc(S.titles[k] || '')}" placeholder="${esc(L.t[k])}" aria-label="Heading for ${SECTION_NAMES[k]}" dir="auto" maxlength="60">
        </li>`).join('')}
      </ul>
      <div class="sc-to"><label for="${prefix}-to">Word between dates</label>
        <input class="f-in" id="${prefix}-to" data-sec-to value="${esc(S.to)}" placeholder="${esc(L.t.to)}" dir="auto" maxlength="20">
        <span class="sc-example" data-sec-example>${esc(dateExample())}</span></div>
      ${withExtras ? `
      <h3 class="sc-sub">Sections you added</h3>
      ${c.extras.length ? `<ul class="sc-list">${c.extras.map((g, i) => `
        <li><span class="sc-dot" aria-hidden="true"></span>
          <input class="f-in" data-extra-title="${i}" value="${esc(g.heading)}" placeholder="${esc(L.t.more)}" aria-label="Name of added section ${i + 1}" dir="auto" maxlength="80">
          <button type="button" class="small-btn" data-extra-del="${i}">Remove</button></li>`).join('')}</ul>` : '<p class="sc-hint">None yet. Add one below.</p>'}
      ${extraChips('data-extra-add')}` : ''}`;
  }
  // Ready-made sections, named in the CV's language, that aren't on the CV yet.
  function extraChips(attr) {
    if (state.cv.extras.length >= 8) return '<p class="sc-hint">You can have up to 8 added sections.</p>';
    const lang = state.sections.lang, have = state.cv.extras.map(g => g.heading.trim().toLowerCase());
    return `<div class="suggest">${Object.values(EXTRA_PRESETS).map(p => p[lang] || p.en).filter(h => !have.includes(h.toLowerCase()))
      .map(h => `<button type="button" class="chip" ${attr}="${esc(h)}">+ ${esc(h)}</button>`).join('')}<button type="button" class="chip" ${attr}="">+ Your own section</button></div>`;
  }
  const sectionsPanel = $('#sections-panel');
  function refreshSectionsPanel() { $('#sections-panel-body').innerHTML = sectionControls('sp', true); }
  function openSectionsPanel() {
    closeTextPanel();
    PANELS.forEach(closePanel);
    refreshSectionsPanel();
    sectionsPanel.hidden = false;
    $('#sections-btn').setAttribute('aria-expanded', 'true');
  }
  function closeSectionsPanel() {
    sectionsPanel.hidden = true;
    $('#sections-btn').setAttribute('aria-expanded', 'false');
  }
  $('#sections-btn').addEventListener('click', () => { if (sectionsPanel.hidden) openSectionsPanel(); else closeSectionsPanel(); });
  $('#sections-close').addEventListener('click', closeSectionsPanel);
  addEventListener('keydown', e => { if (e.key === 'Escape' && !sectionsPanel.hidden) closeSectionsPanel(); });
  document.addEventListener('pointerdown', e => {
    if (!sectionsPanel.hidden && !sectionsPanel.contains(e.target) && !e.target.closest('#sections-btn')) closeSectionsPanel();
  });
  function afterSectionChange(rebuild) {
    save();
    renderCV(false);
    if (rebuild) {
      if (state.pane === 'form') buildForm();
      if (!sectionsPanel.hidden) refreshSectionsPanel();
    }
  }
  // the same box can be open in the toolbar panel and the form at once: keep them in step
  function syncSectionInputs(src) {
    const attr = ['data-sec-title', 'data-sec-to', 'data-extra-title'].find(a => src.hasAttribute(a));
    document.querySelectorAll(`[${attr}="${src.getAttribute(attr)}"]`).forEach(x => { if (x !== src) x.value = src.value; });
    document.querySelectorAll('[data-sec-example]').forEach(x => { x.textContent = dateExample(); });
  }
  document.addEventListener('change', e => {
    const t = e.target;
    if (t.matches('[data-sec-lang]')) {
      const lang = langById(t.value).id;
      // a new language replaces typed headings; ready-made section names and "Present" are translated
      state.sections = { lang, titles: {}, hidden: state.sections.hidden, to: '' };
      translateCV(state.cv, lang);
      afterSectionChange(true);
      toast(`Headings are now in ${langById(lang).name}. You can still rename any of them.`);
    } else if (t.matches('[data-sec-show]')) {
      const k = t.dataset.secShow;
      if (t.checked) delete state.sections.hidden[k]; else state.sections.hidden[k] = true;
      document.querySelectorAll(`[data-sec-show="${k}"]`).forEach(x => { x.checked = t.checked; x.closest('li').classList.toggle('off', !t.checked); });
      afterSectionChange(false);
    }
  });
  document.addEventListener('input', e => {
    const t = e.target;
    if (t.matches('[data-sec-title]')) {
      const k = t.dataset.secTitle;
      if (t.value.trim()) state.sections.titles[k] = t.value.slice(0, 60); else delete state.sections.titles[k];
    } else if (t.matches('[data-sec-to]')) {
      state.sections.to = t.value.slice(0, 20);
    } else if (t.matches('[data-extra-title]')) {
      const g = state.cv.extras[+t.dataset.extraTitle];
      if (!g) return;
      g.heading = t.value.slice(0, 80);
      state.edited = true;
    } else return;
    syncSectionInputs(t);
    save();
    renderSoon();
  });
  document.addEventListener('click', e => {
    const add = e.target.closest('[data-extra-add]'), del = e.target.closest('[data-extra-del]');
    if (add) {
      if (state.cv.extras.length >= 8) return;
      const heading = add.dataset.extraAdd;
      state.cv.extras.push({ heading, items: [] });
      state.edited = true;
      save();
      renderedHTML = '';
      renderCV(true);
      if (state.pane === 'form') buildForm();
      closeSectionsPanel();
      // go straight to the new section on the CV, ready to type
      if (mobile()) $('#tab-cv').click();
      const i = state.cv.extras.length - 1;
      const target = sheet.querySelector(`[data-path="extras.${i}.${heading ? 'items.0' : 'heading'}"]`);
      if (target) { revealOnCV(target); target.focus({ preventScroll: true }); }
      toast(heading ? 'Section added. Type the first line, then press Enter for the next one.' : 'Section added. Type its name, then its first line.');
    } else if (del) {
      const i = +del.dataset.extraDel, g = state.cv.extras[i];
      if (!g) return;
      if ((g.items || []).length && !confirm(t('Remove the "{name}" section from your CV?', { name: g.heading || t('untitled') }))) return;
      state.cv.extras.splice(i, 1);
      state.edited = true;
      afterSectionChange(true);
    }
  });

  // ---------- icons and links placed anywhere on the CV ----------
  const ICONSET = window.InklineIcons;
  function iconsControls() {
    const tile = ic => `<button type="button" class="ic-add" data-badge-add="${ic.id}">${ic.svg || '<span class="ic-txt" aria-hidden="true">Aa</span>'}<span>${esc(ic.name)}</span></button>`;
    const opt = (v, label, cur) => `<option value="${v}"${v === cur ? ' selected' : ''}>${label}</option>`;
    const placed = state.badges.map((b, i) => {
      const ic = ICONSET.byId(b.icon);
      return `<li>
        <span class="ic-mark" aria-hidden="true">${ic.svg || '<b>Aa</b>'}</span>
        <input class="f-in" data-badge-input="${i}" value="${esc(b.text)}" placeholder="${esc(ic.ph)}" aria-label="Text next to the ${esc(ic.name)} icon" dir="auto" maxlength="120">
        <button type="button" class="small-btn" data-badge-del="${i}">Remove</button>
        <div class="ic-opts">
          <select data-badge-tone="${i}" aria-label="Colour of the ${esc(ic.name)} icon">${opt('dark', 'Dark', b.tone)}${opt('light', 'White, for dark areas', b.tone)}${ic.brand ? '' : opt('accent', 'Design colour', b.tone)}</select>
          <select data-badge-size="${i}" aria-label="Size of the ${esc(ic.name)} icon">${opt('s', 'Small', b.size)}${opt('m', 'Medium', b.size)}${opt('l', 'Large', b.size)}</select>
        </div>
      </li>`;
    }).join('');
    return `<p class="ic-hint">Tap an icon to put it on your CV. Then drag it anywhere on the page and type your text next to it.</p>
      ${placed ? `<h3 class="ic-sub">On your CV</h3><ul class="ic-list">${placed}</ul>` : ''}
      <h3 class="ic-sub">Everyday</h3><div class="ic-grid">${ICONSET.GENERAL.map(tile).join('')}</div>
      <h3 class="ic-sub">Social media and sites</h3><div class="ic-grid">${ICONSET.BRANDS.map(tile).join('')}</div>
      <p class="ic-hint" style="margin-top:14px">Logos belong to their companies. They're shown unchanged, in dark or white, to point to your own profiles.</p>`;
  }
  const iconsPanelP = togglePanel($('#icons-btn'), $('#icons-panel'), () => { $('#icons-panel-body').innerHTML = iconsControls(); });
  $('#icons-close').addEventListener('click', () => closePanel(iconsPanelP));
  function refreshIconsPanel() { if (!iconsPanelP.el.hidden) $('#icons-panel-body').innerHTML = iconsControls(); }

  // Is the page dark under this point (a coloured sidebar or header)? Then an icon there is best in white.
  function darkUnder(x, y) {
    const rgb = str => {
      let m = str.match(/rgba?\(([^)]+)\)/);
      if (m) { const v = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return { c: v.slice(0, 3), a: v.length > 3 ? v[3] : 1 }; }
      m = str.match(/color\(srgb ([^)]+)\)/);
      if (m) { const v = m[1].split(/[\s/]+/).filter(Boolean).map(Number); return { c: v.slice(0, 3).map(n => n * 255), a: v.length > 3 ? v[3] : 1 }; }
      return null;
    };
    for (const el of document.elementsFromPoint(x, y)) {
      if (el.closest('.cv-badges')) continue;
      if (!sheet.contains(el)) break;
      const cs = getComputedStyle(el), bg = rgb(cs.backgroundColor);
      if (bg && bg.a > 0.5) return (0.2126 * bg.c[0] + 0.7152 * bg.c[1] + 0.0722 * bg.c[2]) / 255 < 0.45;
      if (/gradient/.test(cs.backgroundImage) && el.matches('.cv-side,.cv-top')) return true;
    }
    return false;
  }
  // Icons the visitor hasn't given a colour themselves turn white over dark areas, and dark again over light ones.
  function autoTone(i) {
    const b = state.badges[i], el = sheet.querySelector(`[data-badge="${i}"]`);
    if (!b || !b.auto || !el) return;
    const r = el.getBoundingClientRect();
    b.tone = darkUnder(r.left + r.width / 2, r.top + r.height / 2) ? 'light' : 'dark';
  }
  function addBadge(id) {
    const ic = ICONSET.byId(id);
    if (!ic) return;
    if (state.badges.length >= 24) { toast('You can place up to 24 icons on your CV.'); return; }
    closePanel(iconsPanelP);
    if (mobile()) $('#tab-cv').click();   // the CV must be showing to see what lies under the new icon
    // starts near the top right of the part of the CV in view, a little lower for each new one
    const cvEl = sheet.firstElementChild, scale = sheet.getBoundingClientRect().width / sheet.offsetWidth;
    const inView = Math.max(0, (desk.getBoundingClientRect().top - sheet.getBoundingClientRect().top) / scale) * 0.75;
    const n = state.badges.length;
    state.badges.push({ icon: id, text: '', x: Math.max(16, cvEl.offsetWidth * 0.75 - 200), y: inView + 34 + (n % 8) * 22, tone: 'dark', size: 'm', auto: true });
    const i = state.badges.length - 1;
    renderedHTML = '';
    renderCV(false);
    autoTone(i);
    renderedHTML = '';
    renderCV(false);
    save();
    const text = sheet.querySelector(`[data-badge-text="${i}"]`);
    if (text) { revealOnCV(text); text.focus({ preventScroll: true }); }
    toast(`${ic.name} added. Drag the ${ic.svg ? 'icon' : 'dots'} to move it, and type your text next to it.`);
  }
  document.addEventListener('click', e => {
    const add = e.target.closest('[data-badge-add]'), del = e.target.closest('[data-badge-del]');
    if (add) addBadge(add.dataset.badgeAdd);
    else if (del) { state.badges.splice(+del.dataset.badgeDel, 1); save(); renderedHTML = ''; renderCV(false); refreshIconsPanel(); }
  });
  document.addEventListener('input', e => {
    const t = e.target.closest('[data-badge-input]');
    if (!t) return;
    const b = state.badges[+t.dataset.badgeInput];
    if (!b) return;
    b.text = t.value.slice(0, 120);
    save(); renderSoon();
  });
  document.addEventListener('change', e => {
    const tone = e.target.closest('[data-badge-tone]'), size = e.target.closest('[data-badge-size]');
    if (tone) { const b = state.badges[+tone.dataset.badgeTone]; if (b) { b.tone = tone.value; b.auto = false; } }
    else if (size) { const b = state.badges[+size.dataset.badgeSize]; if (b) b.size = size.value; }
    else return;
    save(); renderCV(false);
  });
  // dragging an icon around the page (mouse, finger or pen)
  let drag = null;
  sheet.addEventListener('pointerdown', e => {
    const h = e.target.closest('[data-badge-drag]');
    if (!h || e.button > 0) return;
    e.preventDefault();
    const i = +h.dataset.badgeDrag, b = state.badges[i], el = h.closest('.cv-badge'), cvEl = sheet.firstElementChild;
    if (!b) return;
    const scale = sheet.getBoundingClientRect().width / sheet.offsetWidth;
    drag = { i, el, h, x: e.clientX, y: e.clientY, bx: b.x, by: b.y, k: 0.75 / scale, moved: false,
      maxX: Math.max(0, (cvEl.offsetWidth - el.offsetWidth) * 0.75), maxY: Math.max(0, (cvEl.offsetHeight - el.offsetHeight) * 0.75) };
    el.classList.add('dragging');
    try { h.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ }
  });
  sheet.addEventListener('pointermove', e => {
    if (!drag) return;
    const b = state.badges[drag.i];
    const dx = (e.clientX - drag.x) * drag.k, dy = (e.clientY - drag.y) * drag.k;
    if (Math.abs(dx) + Math.abs(dy) > 1.5) drag.moved = true;
    b.x = Math.min(drag.maxX, Math.max(0, drag.bx + dx));
    b.y = Math.min(drag.maxY, Math.max(0, drag.by + dy));
    drag.el.style.left = b.x.toFixed(1) + 'pt';
    drag.el.style.top = b.y.toFixed(1) + 'pt';
  });
  const endDrag = () => {
    if (!drag) return;
    const { i, el, moved } = drag;
    drag = null;
    el.classList.remove('dragging');
    if (moved) { autoTone(i); save(); renderCV(false); }
    else { const t = sheet.querySelector(`[data-badge-text="${i}"]`); if (t) t.focus(); }
  };
  sheet.addEventListener('pointerup', endDrag);
  sheet.addEventListener('pointercancel', endDrag);
  // keyboard: arrow keys move a focused icon, Delete removes it
  sheet.addEventListener('keydown', e => {
    const h = e.target.closest('[data-badge-drag]');
    if (!h) return;
    const i = +h.dataset.badgeDrag, b = state.badges[i];
    if (!b) return;
    const step = e.shiftKey ? 10 : 2;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key]) {
      e.preventDefault();
      b.x = Math.max(0, Math.min(600, b.x + moves[e.key][0]));
      b.y = Math.max(0, Math.min(6000, b.y + moves[e.key][1]));
      const el = h.closest('.cv-badge');
      el.style.left = b.x.toFixed(1) + 'pt'; el.style.top = b.y.toFixed(1) + 'pt';
      save();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      state.badges.splice(i, 1);
      save(); renderedHTML = ''; renderCV(false); refreshIconsPanel();
    }
  }, true);

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
    <div class="chips-in">${state.cv[list].map((s, i) => `<span class="tagchip">${esc(s)}<button type="button" data-act="chip-del" data-list="${list}" data-i="${i}" aria-label="${esc(t('Remove {item}', { item: s }))}">${I.x}</button></span>`).join('')}</div>
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
        <p class="sub">${state.mode !== 'ai' ? 'Upload a Word file, a PDF or a photo of it. It is read right here in your browser, never sent anywhere, and fills in your new CV.' : 'Upload a PDF, Word file or a photo of it. The AI reads it and fills in your new CV, then asks what has changed.'}</p>
        <button type="button" class="ghost" data-act="import-cv">Upload my old CV</button>
      </div>

      <div class="card">
        <h2>Photo</h2>
        <p class="sub">Shows in designs with a photo spot. It stays in your browser and is never sent to the AI.</p>
        <div class="photo-row">
          <div class="avatar">${safePhoto(state.photo) ? `<img src="${state.photo}" alt="Your photo">` : ICONS.camera}</div>
          <div class="photo-btns">
            ${state.photo ? '<button type="button" class="ghost" data-act="photo-crop">Move or zoom</button>' : ''}
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
        <h2>Sections and headings</h2>
        <p class="sub">Keep your design, but choose which sections show and what they are called, in any language.</p>
        ${sectionControls('fm', false)}
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
        ${chips('skills', 'Add a skill', 'e.g. Customer service', ['Communication', 'Teamwork', 'Microsoft Excel', 'Customer service', 'Problem solving', 'Leadership'].map(x => t(x)))}
      </div>

      <div class="card">
        <h2>Languages</h2>
        <p class="sub">Add how well you speak each one.</p>
        ${chips('languages', 'Add a language', 'e.g. Arabic (native)', ['English (fluent)', 'Arabic (native)', 'French (basic)'].map(x => t(x)))}
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
        ${extraChips('data-act="add-extra" data-val')}
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
      case 'photo-crop': return photoClicked();
      case 'photo-remove': return removePhoto();
      case 'import-cv': return pickCV();
      case 'add-exp':
        c.experience.push({ role: '', company: '', location: '', start: '', end: '', bullets: [] });
        return changed(`[data-bind="experience.${c.experience.length - 1}.role"]`);
      case 'add-edu':
        c.education.push({ qualification: '', school: '', location: '', start: '', end: '', details: '' });
        return changed(`[data-bind="education.${c.education.length - 1}.qualification"]`);
      case 'add-extra':
        if (c.extras.length >= 8) return;
        c.extras.push({ heading: b.dataset.val, items: [] });
        return changed(b.dataset.val ? `[data-lines="extras.${c.extras.length - 1}.items"]` : `[data-bind="extras.${c.extras.length - 1}.heading"]`);
      case 'del':
        if (!isBlank(c[list][i]) && !confirm(t('Remove this from your CV?'))) return;
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
        body: JSON.stringify(Object.assign({ lang: UI_LANG }, body)),
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
    state.guided = { step: firstMissingStep(), expIndex: state.cv.experience.length - 1, eduIndex: state.cv.education.length - 1, gaps: true, done: [] };
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
  const isSkip = s => /^(skip|no|none|nope|n\/a|not yet|no photo|that'?s all|i don'?t (know|have)|-|overslaan|nee|geen|niks|niets|nog niet|geen foto|dat is alles|weet ik niet|heb ik niet|klaar)$/i.test(String(s).trim().replace(/[.!]$/, ''));
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
    const m = t.split(/\s+(?:to|until|till|tot|t\/m|-|–|—)\s+|\s*[-–—]\s*/i);
    const fix = x => /^(now|present|current|today|still here|ongoing|nu|heden|huidig|momenteel|vandaag)$/i.test(String(x || '').trim()) ? langById(state.sections.lang).t.present : titleCase(x || '');
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
    expRole:  { stage: 'experience', ask: g => g.updating && !g.addJob ? "What's the job title of your new job?" : g.expIndex < 0 ? "Let's start with your most recent job. What was your job title?" : 'What was the job title?' },
    expOrg:   { stage: 'experience', ask: () => "Where did you work? The company name and city, like 'Greenway Stores, Leeds'." },
    expDates: { stage: 'experience', ask: () => "When did you start and finish? For example '2021 to now' or 'Mar 2019 to Jun 2021'." },
    expWhat:  { stage: 'experience', ask: () => 'What did you do there? Tell me two or three things, each on a new line. Numbers help, like how many customers you served or how much sales grew.' },
    oldEnd:   { stage: 'experience', ask: g => { const j = state.cv.experience[g.oldIndex] || {}; return `Your old CV says you still work${j.company ? ' at ' + j.company : ' in your last job'}. When did that job end? For example 'Dec 2024'.`; }, quick: ['I still work there'] },
    expMore:  { stage: 'experience', ask: () => 'Do you want to add another job?', quick: ['Add another job', "That's all"] },
    eduQual:  { stage: 'education', ask: g => g.updating ? "What's the new qualification? For example 'BA Marketing' or 'First aid certificate'." : "What's your highest qualification? For example 'BA Marketing' or 'High school diploma'.", quick: ['Skip'] },
    eduSchool:{ stage: 'education', ask: () => 'Where did you study? The school name and city.' },
    eduDates: { stage: 'education', ask: () => "When did you study there? For example '2014 to 2017'." },
    eduMore:  { stage: 'education', ask: () => 'Add another qualification?', quick: ['Add another', "That's all"] },
    skills:   { stage: 'skills', ask: () => "What are your top skills? List them with commas, like 'Excel, customer service, cooking'." },
    languages:{ stage: 'skills', ask: () => 'Which languages do you speak, and how well?', quick: ['Just English', 'Skip'] },
    extras:   { stage: 'extras', ask: () => 'Anything else worth adding? Certifications, volunteering, projects or awards. Put each on a new line.', quick: ['Skip'] },
    summary:  { stage: 'extras', ask: () => 'Last one. In a sentence or two, what makes you good at this kind of work?', quick: ['Write one for me'] },
    whatsNew: { stage: 'review', ask: g => g.addJob || g.addEdu ? 'Anything else that has changed?' : 'What has changed since you wrote it? I can add a new job or qualification for you. For anything else, click the text on your CV and type.', quick: ['Add a new job', 'Add a qualification', 'Nothing else'] },
    review:   { stage: 'review', ask: () => 'Your CV is ready. Here it is in a few designs. Tap the one you like, and you can still change anything afterwards.', quick: [{ label: `See all ${TEMPLATES.length} designs`, act: 'picker' }, { label: 'Edit it myself', act: 'form' }, 'Start a new CV'], after: () => designsBubble(suggestedFor()) }
  };

  const MISSING = {
    name: c => !c.name, title: c => !c.title, email: c => !c.email && !c.phone, expHas: c => !c.experience.length,
    eduQual: c => !c.education.length, skills: c => !c.skills.length, summary: c => !c.summary
  };
  const MAIN_STEPS = ['name', 'title', 'email', 'phone', 'location', 'link', 'photo', 'expHas', 'eduQual', 'skills', 'languages', 'extras', 'summary', 'review'];
  function firstMissingStep(done) {
    return Object.keys(MISSING).find(k => !(done || []).includes(k) && MISSING[k](state.cv)) || 'review';
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
    const go = step => {
      if (g.gaps && MAIN_STEPS.includes(step)) {
        g.done = g.done || [];
        if (MAIN_STEPS.includes(g.step) && !g.done.includes(g.step)) g.done.push(g.step);
        step = firstMissingStep(g.done);
      }
      g.step = step; state.edited = true; renderCV(true); save(); askGuided();
    };
    switch (g.step) {
      case 'name': if (!skip) c.name = titleCase(text); return go('title');
      case 'title': if (!skip) c.title = titleCase(text); return go('email');
      case 'email': if (!skip) c.email = text.trim(); return go('phone');
      case 'phone': if (!skip) c.phone = text.trim(); return go('location');
      case 'location': if (!skip) c.location = titleCase(text); return go('link');
      case 'link': if (!skip) c.link = text.trim().replace(/^https?:\/\/(www\.)?/i, ''); return go(state.photo ? 'expHas' : 'photo');
      case 'photo': if (/add|toevoeg|^ja\b/i.test(text)) pickPhoto(); return go('expHas');
      case 'expHas': return go(skip || /^not|^nog niet|^nee/i.test(text) ? 'eduQual' : 'expRole');
      case 'expRole': {
        const job = { role: titleCase(text), company: '', location: '', start: '', end: '', bullets: [] };
        // New jobs since the old CV go at the top, newest first
        if (g.updating) { g.expIndex = g.addJob || 0; c.experience.splice(g.expIndex, 0, job); g.addJob = g.expIndex + 1; }
        else { c.experience.push(job); g.expIndex = c.experience.length - 1; }
        return go('expOrg');
      }
      case 'expOrg': { const [co, city] = placeAndCity(text); Object.assign(c.experience[g.expIndex], { company: co, location: titleCase(city) }); return go('expDates'); }
      case 'expDates': { const [a, b] = parseDates(text); Object.assign(c.experience[g.expIndex], { start: a, end: b }); return go('expWhat'); }
      case 'expWhat': {
        if (!skip) c.experience[g.expIndex].bullets = splitLines(text).map(tidy).filter(Boolean).slice(0, 6);
        // after a new job, an old one still marked "Present" has probably ended
        const older = g.updating ? c.experience.findIndex((x, i) => i >= (g.addJob || 0) && /^present$/i.test(x.end)) : -1;
        if (older >= 0 && !g.askedOld) { g.oldIndex = older; g.askedOld = true; return go('oldEnd'); }
        return go('expMore');
      }
      case 'oldEnd':
        if (!skip && !/still|yes|both|nog|^ja\b|allebei/i.test(text) && c.experience[g.oldIndex]) c.experience[g.oldIndex].end = parseDates(text)[0];
        return go('expMore');
      case 'expMore': return go(/another|yes|add|nog een|^ja\b|toevoeg/i.test(text) ? 'expRole' : g.updating ? 'whatsNew' : 'eduQual');
      case 'eduQual': {
        if (skip) return go(g.updating ? 'whatsNew' : 'skills');
        const study = { qualification: titleCase(text), school: '', location: '', start: '', end: '', details: '' };
        if (g.updating) { g.eduIndex = g.addEdu || 0; c.education.splice(g.eduIndex, 0, study); g.addEdu = g.eduIndex + 1; }
        else { c.education.push(study); g.eduIndex = c.education.length - 1; }
        return go('eduSchool');
      }
      case 'eduSchool': { const [s, city] = placeAndCity(text); Object.assign(c.education[g.eduIndex], { school: s, location: titleCase(city) }); return go('eduDates'); }
      case 'eduDates': { const [a, b] = parseDates(text); Object.assign(c.education[g.eduIndex], { start: a, end: b }); return go('eduMore'); }
      case 'eduMore': return go(/another|yes|add|nog een|^ja\b|toevoeg/i.test(text) ? 'eduQual' : g.updating ? 'whatsNew' : 'skills');
      case 'whatsNew':
        if (skip || /^(no|nope|nothing|none|same|done|nee|niets|niks|geen|klaar|hetzelfde)\b|that'?s all|show (me )?(the )?designs|verder niets|dat is alles|ontwerpen/i.test(text)) { g.updating = false; return go('review'); }
        if (/job|work|position|role|employ|promot|baan|werk|functie|promotie/i.test(text)) { g.updating = true; return go('expRole'); }
        if (/qualif|degree|diploma|course|certif|stud|school|educat|training|opleiding|cursus/i.test(text)) { g.updating = true; return go('eduQual'); }
        bubble('ai', "To add it, press Add a new job or Add a qualification and I'll ask for the details. For anything else, click the text on your CV and type.");
        setQuick(G.whatsNew.quick); save();
        return;
      case 'skills': if (!skip) c.skills = splitList(text).map(capFirst).slice(0, 20); return go('languages');
      case 'languages': if (/just english|alleen engels/i.test(text)) c.languages = [cvDutch() ? 'Engels' : 'English']; else if (!skip) c.languages = splitList(text).map(capFirst); return go('extras');
      case 'extras': if (!skip) c.extras = [{ heading: cvDutch() ? 'Hoogtepunten' : 'Highlights', items: splitLines(text).map(tidy).filter(Boolean) }]; return go('summary');
      case 'summary':
        if (/write one|schrijf/i.test(text) || skip) c.summary = autoSummary(c);
        else c.summary = tidy(text);
        return go('review');
      case 'review':
        if (/design|ontwerp/i.test(text)) { designsBubble(suggestedFor()); return; }
        if (/new cv|start|nieuw cv|opnieuw/i.test(text)) { $('#restart').click(); return; }
        bubble('ai', 'You can change anything by clicking the text on your CV, or switch to Fill in myself for a simple form. When it looks right, press Download PDF.');
        return;
    }
  }

  function autoSummary(c) {
    const role = c.title || (c.experience[0] && c.experience[0].role) || '';
    const places = c.experience.map(x => x.company).filter(Boolean).slice(0, 2);
    const skills = c.skills.slice(0, 3).map(s => s.toLowerCase());
    const parts = [], nl = cvDutch(), and = nl ? ' en ' : ' and ';
    const list = skills.length > 1 ? skills.slice(0, -1).join(', ') + and + skills[skills.length - 1] : skills[0];
    if (role && places.length) parts.push(nl ? `${role} met ervaring bij ${places.join(and)}.` : `${role} with experience at ${places.join(and)}.`);
    else if (role) parts.push(nl ? `Harde werker op zoek naar een functie als ${role.toLowerCase()}.` : `Hard-working candidate looking for a role as a ${role.toLowerCase()}.`);
    if (skills.length) parts.push(nl ? `Sterk in ${list}.` : `Strong in ${list}.`);
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
      <button type="button" class="d-all" data-act="picker">See all ${TEMPLATES.length} designs</button>`;
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
  // A file with an unusual name or no type: its first bytes say what it really is.
  const KINDS = new WeakMap();
  const kindOf = f => KINDS.get(f) || fileKind(f);
  async function sniffKind(file) {
    const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const sig = String.fromCharCode(...head);
    if (sig.startsWith('%PDF')) return 'pdf';
    if (sig.startsWith('{\\rtf')) return 'rtf';
    if ((head[0] === 0xFF && head[1] === 0xD8) || sig.startsWith('\x89PNG') || sig.startsWith('GIF8') || (sig.startsWith('RIFF') && sig.slice(8, 12) === 'WEBP')) return 'image';
    if (sig.slice(4, 8) === 'ftyp' && /heic|heix|hevc|mif1|avif/.test(sig.slice(8, 12))) return 'image';
    if (head[0] === 0xD0 && head[1] === 0xCF) return 'doc';
    if (sig.startsWith('PK')) {
      await loadScript('assets/vendor/jszip.min.js');
      const zip = await window.JSZip.loadAsync(await file.arrayBuffer());
      if (zip.file('word/document.xml')) return 'docx';
      if (zip.file('content.xml')) return 'odt';
      if (Object.keys(zip.files).some(n => /preview|Index\/Document\.iwa/i.test(n))) return 'pages';
      return null;
    }
    const sample = await file.slice(0, 4000).text();
    if (!sample.trim() || (sample.match(/[\x00-\x08\x0e-\x1f\ufffd]/g) || []).length > sample.length * 0.02) return null;
    return /<(html|body|p|div)[\s>]/i.test(sample) ? 'html' : 'text';
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
    // Accented letters are stored as code page bytes (\'e9); read them with the file's own code page
    let decoder;
    try { decoder = new TextDecoder('windows-' + ((raw.match(/\\ansicpg(\d+)/) || [])[1] || '1252')); } catch (e) { decoder = new TextDecoder('windows-1252'); }
    // A backslash at the end of a line is a paragraph break; other line breaks in the file mean nothing
    raw = raw.replace(/\\\r?\n/g, '\\par ').replace(/[\r\n]+/g, '');
    let out = '', depth = 0, skipDepth = -1;
    for (let k = 0; k < raw.length; k++) {
      const ch = raw[k];
      if (ch === '\\' && /[{}\\]/.test(raw[k + 1] || '')) { if (skipDepth < 0) out += ch + raw[k + 1]; k++; continue; }
      if (ch === '{') { depth++; if (skipDepth < 0 && skip.test(raw.slice(k + 1, k + 20))) skipDepth = depth; continue; }
      if (ch === '}') { if (depth === skipDepth) skipDepth = -1; depth--; continue; }
      if (skipDepth < 0) out += ch;
    }
    return out
      .replace(/\\(par|row)\b ?/g, '\n').replace(/\\line\b ?/g, '\n').replace(/\\(tab|cell)\b ?/g, '\t')
      .replace(/\\u(-?\d+) ?(?:\\'[0-9a-f]{2}|\?)?/gi, (m, n) => String.fromCharCode(n < 0 ? +n + 65536 : +n))
      .replace(/(?:\\'[0-9a-f]{2})+/gi, m => decoder.decode(new Uint8Array(m.match(/[0-9a-f]{2}/gi).map(h => parseInt(h, 16)))))
      .replace(/\\~/g, ' ').replace(/\\_/g, '-').replace(/\\-/g, '')
      .replace(/\\[a-z]+-?\d* ?/gi, '').replace(/\\([{}\\])/g, '$1')
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
  async function loadPdfjs() {
    // Served from this site (not a CDN), so no outside server can ever change the code that runs here.
    const base = new URL('assets/vendor/', location.href).href;
    const pdfjs = await import(base + 'pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = base + 'pdf.worker.min.mjs';
    return pdfjs;
  }
  async function pdfText(file) {
    const pdfjs = await loadPdfjs();
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
      if (!confirm(t('Replace your current CV with the details from this file?'))) return;
    }
    bubble('me', 'Uploaded my old CV: ' + files.map(f => f.name).join(', '));
    for (const f of files) if (!fileKind(f)) { const k = await sniffKind(f).catch(() => null); if (k) KINDS.set(f, k); }
    const unknown = files.find(f => !kindOf(f));
    if (unknown) {
      bubble('ai', `I can't read "${unknown.name}". Word, PDF, Pages, OpenDocument, RTF and text files all work, and so do photos and screenshots of a CV. If it's another kind, try saving it as a PDF.`);
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
        let kind = kindOf(file), blob = file;
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

  // ---------- reading photos and scans (OCR), right here in the browser ----------
  // The text recognition engine (Tesseract, open source) is served from this site and runs on the
  // visitor's own device, so the picture is never uploaded anywhere and nothing costs money.
  async function ocrWorker(onProgress) {
    await loadScript('assets/vendor/tesseract/tesseract.min.js');
    const base = new URL('assets/vendor/tesseract/', location.href).href;
    return window.Tesseract.createWorker('eng', 1, {
      workerPath: base + 'worker.min.js', corePath: base + 'core', langPath: base + 'lang', workerBlobURL: false,
      logger: m => { if (m.status === 'recognizing text' && onProgress) onProgress(m.progress); }
    });
  }
  // A photo drawn at a size the text reader likes: small screenshots are enlarged, huge photos shrunk.
  function imageCanvas(blob) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(blob), img = new Image();
      img.onload = () => {
        const long = Math.max(img.naturalWidth, img.naturalHeight);
        const k = long > 2600 ? 2600 / long : long < 1600 ? 1600 / long : 1;
        const c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        res(c);
      };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('image')); };
      img.src = url;
    });
  }
  // The pages of a scanned PDF (one with pictures of text instead of text) as pictures.
  async function pdfCanvases(blob, max) {
    const doc = await (await loadPdfjs()).getDocument({ data: await blob.arrayBuffer(), isEvalSupported: false }).promise;
    const out = [];
    for (let n = 1; n <= Math.min(doc.numPages, max); n++) {
      const page = await doc.getPage(n);
      const vp = page.getViewport({ scale: 2200 / page.getViewport({ scale: 1 }).width });
      const c = document.createElement('canvas');
      c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      out.push(c);
    }
    return out;
  }
  // Grey, with light-on-dark text (like a coloured sidebar) turned into dark-on-light, which reads far better.
  // The picture is measured in small squares: a square that is dark, in a dark neighbourhood, is flipped.
  function cleanForOcr(c) {
    const w = c.width, h = c.height, ctx = c.getContext('2d');
    const img = ctx.getImageData(0, 0, w, h), d = img.data;
    const B = 24, bw = Math.ceil(w / B), bh = Math.ceil(h / B);
    const sum = new Float64Array(bw * bh), count = new Uint32Array(bw * bh), lum = new Uint8ClampedArray(w * h);
    for (let y = 0, i = 0, p = 0; y < h; y++) {
      const row = Math.floor(y / B) * bw;
      for (let x = 0; x < w; x++, i += 4, p++) {
        const v = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114, k = row + Math.floor(x / B);
        lum[p] = v; sum[k] += v; count[k]++;
      }
    }
    const mean = k => sum[k] / count[k], flip = new Uint8Array(bw * bh);
    for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) {
      let s = 0, n = 0;
      for (let yy = Math.max(0, by - 1); yy <= Math.min(bh - 1, by + 1); yy++)
        for (let xx = Math.max(0, bx - 1); xx <= Math.min(bw - 1, bx + 1); xx++) { s += mean(yy * bw + xx); n++; }
      flip[by * bw + bx] = s / n < 100 && mean(by * bw + bx) < 128 ? 1 : 0;
    }
    for (let y = 0, i = 0, p = 0; y < h; y++) {
      const row = Math.floor(y / B) * bw;
      for (let x = 0; x < w; x++, i += 4, p++) d[i] = d[i + 1] = d[i + 2] = flip[row + Math.floor(x / B)] ? 255 - lum[p] : lum[p];
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }
  // A photo taken at a slight angle, turned straight (rotating it ourselves keeps big text like the name readable).
  function straighten(c, radians) {
    if (Math.abs(radians) < 0.005) return c;
    const r = document.createElement('canvas');
    r.width = c.width; r.height = c.height;
    const ctx = r.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, r.width, r.height);
    ctx.translate(r.width / 2, r.height / 2); ctx.rotate(radians); ctx.drawImage(c, -c.width / 2, -c.height / 2);
    return r;
  }
  async function readPictures(canvases) {
    const note = bubble('ai', 'Reading the text in your picture. This can take up to a minute…', false);
    const show = (i, p) => { note.textContent = `Reading the text in your picture${canvases.length > 1 ? ` (${i + 1} of ${canvases.length})` : ''}… ${Math.round(p * 100)}%`; };
    let worker = null;
    try {
      let current = 0;
      worker = await ocrWorker(p => show(current, p));
      const pages = [];
      for (; current < canvases.length; current++) {
        const clean = cleanForOcr(canvases[current]);
        // a quick first look only measures the angle; the real read happens on the straightened picture
        const angle = (await worker.recognize(clean, { rotateAuto: true }, { text: false })).data.rotateRadians || 0;
        const page = straighten(clean, angle);
        const { data } = await worker.recognize(page, {}, { blocks: true });
        pages.push({ blocks: data.blocks || [], width: page.width, height: page.height });
      }
      return window.InklineParser.linesFromOcr(pages);
    } finally {
      if (worker) worker.terminate();
      if (note.label) note.label.remove();
      note.remove();
    }
  }
  const textLength = lines => lines.reduce((n, l) => n + l.text.length, 0);

  // Without the AI: read the whole CV right here in the browser (assets/cv-parser.js). Nothing is sent anywhere.
  async function importBasic(files) {
    setBusy(true);
    let lines = [], pictures = [], pages = 0, unreadable = 0, ocrFailed = false, firstPageOnly = false;
    try {
      await loadScript('assets/cv-parser.js');
      const P = window.InklineParser;
      for (const file of files) {
        let kind = kindOf(file), blob = file;
        try {
          if (kind === 'pages') {
            const p = await pagesPreview(file);
            if (!p) { pages++; continue; }
            kind = p.kind; blob = p.blob; firstPageOnly = firstPageOnly || !!p.firstPageOnly;
          }
          if (kind === 'image') {
            try { pictures.push(await imageCanvas(blob)); } catch (e) { unreadable++; }
            continue;
          }
          if (kind === 'docx' || kind === 'odt') await loadScript('assets/vendor/jszip.min.js');
          const got = kind === 'pdf' ? await P.linesFromPdf(blob, await loadPdfjs())
            : kind === 'docx' ? await P.linesFromDocx(file)
            : kind === 'odt' ? await P.linesFromOdt(file)
            : kind === 'html' ? P.linesFromHtml(await file.text())
            : P.linesFromText(await textOf(file, kind));
          // a PDF with almost no text is a scan: read its pages as pictures
          if (kind === 'pdf' && textLength(got) < 80) pictures.push(...await pdfCanvases(blob, 3));
          else lines = lines.concat(got);
        } catch (e) { /* skip what can't be opened */ }
      }
      if (pictures.length) {
        try { lines = lines.concat(await readPictures(pictures.slice(0, 4))); } catch (e) { ocrFailed = true; }
      }
    } catch (e) { /* the reader itself failed to load */ }
    setBusy(false);

    let read = null;
    try { read = lines.length ? window.InklineParser.parse(lines).cv : null; } catch (e) { read = null; }
    const c = state.cv;
    if (read) {
      // Keep anything the file didn't have (the visitor already agreed to replace the rest)
      Object.keys(read).forEach(k => {
        const v = read[k];
        if (Array.isArray(v) ? v.length : String(v || '').trim()) c[k] = v;
      });
      state.cv = translateCV(normalize(c), state.sections.lang);
      renderCV(true); save();
    }
    const cv = state.cv, n = (k, one) => `${k} ${one}${k === 1 ? '' : 's'}`;
    const found = [];
    if (read) {
      if (read.name) found.push('your name');
      if (read.email || read.phone || read.location || read.link) found.push('your contact details');
      if (read.summary) found.push('your profile');
      if (read.experience.length) found.push(n(read.experience.length, 'job'));
      if (read.education.length) found.push(n(read.education.length, 'qualification'));
      if (read.skills.length) found.push(n(read.skills.length, 'skill'));
      if (read.languages.length) found.push(n(read.languages.length, 'language'));
      // the file's extra sections replaced the CV's, with their names already in the CV's language
      if (read.extras.length) state.cv.extras.forEach(x => found.push('your ' + x.heading.toLowerCase()));
    }
    const list = found.join(', ').replace(/, ([^,]*)$/, ' and $1');
    const fromPicture = pictures.length > 0 && !ocrFailed;
    if (found.length >= 2) {
      bubble('ai', `I read your old CV right here on your device, so it wasn't sent anywhere. I found ${list}. ` +
        (fromPicture ? 'Reading text from a picture is never perfect, so please check your new CV carefully and click any text to fix it.' : 'Please check your new CV and click any text to fix it.'));
      if (firstPageOnly) bubble('ai', 'Note: that Pages file only let me see its first page. If your CV is longer, export it from Pages as a PDF and upload that too.');
      state.guided = { step: 'whatsNew', expIndex: -1, eduIndex: -1, gaps: true, done: [] };
    } else {
      bubble('ai', ocrFailed
        ? "I couldn't start the picture reader in this browser. Try another browser, or upload your CV as a Word or PDF file. Or let's go through it together now."
        : unreadable && !lines.length && !pictures.length
          ? "This browser can't open that kind of photo (often an iPhone HEIC photo). Take a screenshot of it, or save it as a JPG, and upload that. Or let's go through it together now."
          : pages && !lines.length
            ? "That Pages file doesn't include a copy I can read. In Pages, choose File, then Export To, then PDF, and upload the PDF. Or let's go through it together now."
            : fromPicture
              ? `I couldn't read enough from that picture${found.length ? ` (only ${list})` : ''}. A sharp, straight photo in good light works best, or a screenshot of the CV. Or let's fill it in together now.`
              : found.length
                ? `I could only find ${list} in that file. If you have the original Word or PDF file, try that. Or let's fill in the rest together.`
                : "I couldn't find any text in that file. If you have the original Word or PDF file, try that. Or let's go through it together now.");
      state.guided = { step: firstMissingStep(), expIndex: cv.experience.length - 1, eduIndex: cv.education.length - 1, gaps: true, done: [] };
    }
    askGuided();
  }

  // ---------- answering common questions when the AI is off ----------
  const looksLikeQuestion = q => /\?\s*$/.test(q) || (/^(how|what|should|can|could|do|does|is|are|why|when|which|will|would|hoe|wat|moet|kan|kun|mag|waarom|wanneer|welke|wie|waar|zijn|heb|hoeveel|zou|wil)\b/i.test(q.trim()) && q.trim().split(/\s+/).length >= 4);
  const FAQ = [
    [/photo|picture|headshot|foto/i, 'It depends on where you apply. In the US and UK, CVs usually have no photo. In much of Europe, the Middle East and Asia, a friendly, professional photo is common. Many of the colourful designs have a photo spot.'],
    [/how long|length|how many pages|one page|two pages|1 page|2 pages|hoe lang|lengte|pagina/i, 'Keep it to one page if you have less than about ten years of experience, and two pages at most. Short, clear lines beat long paragraphs.'],
    [/reference|referentie/i, "You don't need to list references on your CV. Employers will ask for them later if they want them."],
    [/\bgaps?\b|career break|unemploy|time off|\bgat\b|tussenjaar|werkloos|onderbreking/i, "Be honest and keep it short. A line like 'Career break, caring for family' or 'Studying for a certificate' is fine. Gaps are very common."],
    [/gpa|grades?\b|marks|score|cijfer/i, "Add your grades if they're good and you finished studying in the last few years. Otherwise you can leave them out."],
    [/hobb|interests?|interesse/i, 'Only add hobbies if they show a useful skill, like team sports or volunteering. Otherwise they take space you need for experience.'],
    [/\bats\b|hiring software|robot|online application|applicant tracking|sollicitatiesoftware|online sollicit/i, "For online application forms, choose a Classic design. They're one clean column, which hiring software reads best."],
    [/salary|wage|salaris|loon/i, "Leave salary off your CV. It's usually discussed later, once they're interested."],
    [/\bage\b|birth|marital|married|nationality|religion|leeftijd|geboorte|getrouwd|nationaliteit|geloof|religie/i, "In many countries you shouldn't add your age, date of birth or marital status. In some places, like the Gulf, nationality is often expected. Add it only if it's normal where you apply."],
    [/cover letter|motivatiebrief|sollicitatiebrief/i, 'A short cover letter helps: three short paragraphs saying why this job, what you bring, and that you would love to talk.'],
    [/free|cost|price|pay for|charge|gratis|kost|prijs|betalen/i, 'Inkline is free. No card, no trial and no watermark on your PDF.'],
    [/font|text size|bigger|smaller|lettertype|groter|kleiner/i, 'Use the Fonts & size button above your CV to pick a font and make the name, headings or text bigger or smaller.'],
    [/design|template|layout|colou?r|style|ontwerp|sjabloon|opmaak|kleur|stijl/i, `Press the Design button above your CV to see all ${TEMPLATES.length} designs. The Colour button next to it has ${ACCENTS.length} colours, or pick any colour you like.`],
    [/download|pdf|save|print|opslaan|printen/i, 'When your CV is ready, press Download PDF above it and choose Save as PDF.'],
    [/upload|old cv|existing cv|import|oud cv|oude cv/i, 'You can upload your old CV with the paperclip button next to the message box.'],
    [/edit|change|fix|mistake|typo|bewerk|wijzig|aanpas|fout/i, 'Click any text on your CV and type to change it, or switch to Fill in myself to edit everything in a simple form.'],
    [/\blie\b|exaggerat|fake|liegen|overdrijv|nep/i, 'Always keep your CV honest. Employers check, and a strong, true line beats a big claim.']
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
        state.guided = { step: firstMissingStep(), expIndex: c.experience.length - 1, eduIndex: c.education.length - 1, gaps: true, done: [] };
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
