/* Inkline CV reader: turns an old CV into Inkline's CV format right in the visitor's browser.
   No AI, no server: the file never leaves the device. Works best on normal, cleanly laid-out CVs;
   the visitor can fix anything afterwards by clicking the CV or using the form.

   Step 1 pulls lines of text out of the file together with layout clues (heading, bold, bullet, size,
   indent). Step 2 reads those lines like a person skimming a CV: find the sections, then the jobs and
   studies inside them by their dates, then the details. */
(function (global) {
  'use strict';

  // ---------- words that start each section, in several languages ----------
  const SECTIONS = {
    summary: ['summary', 'profile', 'professional summary', 'professional profile', 'personal profile', 'career summary', 'about me', 'about', 'objective', 'career objective', 'personal statement', 'overview',
      'profiel', 'over mij', 'samenvatting', 'persoonlijk profiel', 'profil', 'à propos', 'résumé', 'perfil', 'sobre mí', 'resumen', 'kurzprofil', 'über mich', 'profil professionnel',
      'نبذة', 'الملخص', 'ملخص', 'نبذة عني', 'الهدف الوظيفي'],
    experience: ['experience', 'work experience', 'professional experience', 'employment', 'employment history', 'work history', 'career history', 'relevant experience', 'career', 'jobs', 'positions',
      'internships', 'internship', 'work placements', 'werkervaring', 'ervaring', 'loopbaan', 'stages', 'expérience', 'expérience professionnelle', 'expériences professionnelles',
      'experiencia', 'experiencia laboral', 'experiencia profesional', 'berufserfahrung', 'erfahrung', 'الخبرة', 'الخبرات', 'الخبرة العملية', 'الخبرات العملية'],
    education: ['education', 'education and training', 'academic background', 'academic', 'qualifications', 'studies', 'schooling', 'academic qualifications',
      'opleiding', 'opleidingen', 'onderwijs', 'formation', 'études', 'educación', 'formación', 'formación académica', 'ausbildung', 'bildung',
      'التعليم', 'المؤهلات', 'المؤهلات العلمية', 'التعليم والمؤهلات'],
    skills: ['skills', 'key skills', 'technical skills', 'core skills', 'skills and abilities', 'competencies', 'core competencies', 'expertise', 'areas of expertise', 'abilities', 'strengths', 'software', 'tools',
      'vaardigheden', 'competenties', 'kennis', 'compétences', 'habilidades', 'competencias', 'kenntnisse', 'fähigkeiten', 'kompetenzen', 'المهارات', 'مهارات'],
    languages: ['languages', 'language skills', 'language', 'talen', 'taalvaardigheid', 'langues', 'idiomas', 'sprachen', 'اللغات', 'لغات'],
    extras_certifications: ['certifications', 'certificates', 'certification', 'licenses', 'licences', 'licenses and certifications', 'courses', 'training', 'trainings', 'professional development',
      'certificaten', 'cursussen', 'certifications et formations', 'certificaciones', 'cursos', 'zertifikate', 'weiterbildung', 'الشهادات', 'الدورات', 'الدورات التدريبية'],
    extras_projects: ['projects', 'key projects', 'projecten', 'projets', 'proyectos', 'projekte', 'المشاريع'],
    extras_volunteering: ['volunteering', 'volunteer experience', 'volunteer work', 'voluntary work', 'vrijwilligerswerk', 'bénévolat', 'voluntariado', 'ehrenamt', 'العمل التطوعي'],
    extras_awards: ['awards', 'achievements', 'honors', 'honours', 'awards and achievements', 'prijzen', 'prestaties', 'prix', 'logros', 'premios', 'auszeichnungen', 'الجوائز', 'الإنجازات'],
    extras_interests: ['interests', 'hobbies', 'hobbies and interests', 'interesses', 'hobby', "centres d'intérêt", 'intereses', 'interessen', 'الهوايات', 'الاهتمامات'],
    extras_other: ['publications', 'memberships', 'affiliations', 'professional memberships', 'activities', 'extracurricular activities', 'leadership', 'nevenactiviteiten', 'publicaties'],
    contact: ['contact', 'contact details', 'contact information', 'contact info', 'personal details', 'personal information', 'personal info', 'personalia', 'contactgegevens',
      'coordonnées', 'datos personales', 'persönliche daten', 'kontakt', 'معلومات الاتصال', 'البيانات الشخصية'],
    skip: ['references', 'referees', 'referenties', 'références', 'referencias', 'referenzen', 'المراجع']
  };
  const EXTRA_TITLES = { extras_certifications: 'Certifications', extras_projects: 'Projects', extras_volunteering: 'Volunteering', extras_awards: 'Awards', extras_interests: 'Interests', extras_other: 'More' };
  const fold = s => s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[:\uff1a•|·\-–—_*#&]+/g, ' ').replace(/\band\b/g, ' ').replace(/\s+/g, ' ').trim();
  const HEADING_INDEX = new Map();
  Object.entries(SECTIONS).forEach(([key, words]) => words.forEach(w => HEADING_INDEX.set(fold(w), key)));

  function sectionOf(line) {
    if (line.bullet) return null;
    const t = fold(line.text);
    if (!t || t.length > 40 || t.split(' ').length > 5) return null;
    if (HEADING_INDEX.has(t)) return HEADING_INDEX.get(t);
    // "WORK EXPERIENCE:" or "Experience & Internships" style headings
    if (line.heading || line.bold || line.caps) {
      for (const [w, key] of HEADING_INDEX) if (w.length > 4 && (t.startsWith(w + ' ') || t.endsWith(' ' + w))) return key;
    }
    return null;
  }

  // ---------- dates ----------
  const MONTHS = 'jan(?:uary|vier|v)?|feb(?:ruary|ruari|r)?|mar(?:ch|s)?|mrt|maart|apr(?:il)?|avr(?:il)?|may|mei|mai|jun(?:e|i|io)?|juin|jul(?:y|i|io)?|juil(?:let)?|aug(?:ust|ustus)?|ao[uû]t|sep(?:t|tember|tembre)?|oct(?:ober|obre)?|okt(?:ober)?|nov(?:ember|embre)?|dec(?:ember)?|d[ée]c(?:embre)?|dez(?:ember)?|ene(?:ro)?|abr(?:il)?|ago(?:sto)?|dic(?:iembre)?|m[äa]rz';
  const NOW = "present|current|currently|now|today|ongoing|to date|heden|huidig|nu|aujourd'?hui|actuel(?:lement)?|presente|actual(?:idad)?|heute|bis heute|jetzt|الآن|حتى الآن|حاليا";
  const DATE = `(?:\\b(?:${MONTHS})\\.?,?\\s*'?(?:\\d{4}|\\d{2})\\b|\\b\\d{1,2}[/.\\-](?:19|20)\\d{2}\\b|\\b(?:19|20)\\d{2}\\b)`;
  const RANGE = new RegExp(`(${DATE})\\s*(?:-|–|—|to|until|till|tot|bis|à|au|->|→|~|a)\\s*(${DATE}|${NOW})`, 'i');
  const SINCE = new RegExp(`\\b(?:since|sinds|depuis|desde|seit|from)\\s+(${DATE})`, 'i');
  const SINGLE_END = new RegExp(`(${DATE})\\s*(?:-|–|—)?\\s*$`, 'i');
  const SINGLE_START = new RegExp(`^(${DATE})\\s*(?:-|–|—|:)?\\s+(?=\\p{L})`, 'iu');
  const NOW_ONLY = new RegExp(`^(?:${NOW})$`, 'i');
  const nice = d => {
    d = d.trim();
    if (NOW_ONLY.test(d)) return 'Present';
    return d.replace(/^([a-zà-ÿ]+)\.?,?\s*/i, (m, mo) => mo.charAt(0).toUpperCase() + mo.slice(1, 3).toLowerCase() + ' ').replace(/\s+/g, ' ').trim();
  };
  const cut = (text, m) => (text.slice(0, m.index) + ' ' + text.slice(m.index + m[0].length)).trim();
  function findDates(text) {
    let m = text.match(RANGE);
    if (m) return { start: nice(m[1]), end: nice(m[2]), rest: cut(text, m) };
    m = text.match(SINCE);
    if (m) return { start: nice(m[1]), end: 'Present', rest: cut(text, m) };
    m = text.match(SINGLE_END) || text.match(SINGLE_START);
    if (m) return { start: '', end: nice(m[1]), rest: cut(text, m), single: true };
    return null;
  }
  const tidyRest = s => s.replace(/^[\s,|·•\-–—():]+|[\s,|·•\-–—(:]+$/g, '').replace(/\(\s*\)/g, '').replace(/\s{2,}/g, ' ').trim();

  // ---------- contact details ----------
  const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/;
  const EMAILS = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
  const PHONE = /(?:\+|00)?\d[\d\s().\-]{7,}\d/;
  const LINK = /(?:https?:\/\/)?(?:www\.)?(?:linkedin\.com\/in\/[\w\-%]+\/?|github\.com\/[\w-]+|behance\.net\/[\w-]+|[\w-]+\.(?:com|net|org|io|me|dev|nl|ae|co\.uk)(?:\/[\w\-./]*)?)/i;
  // Bullet marks, including the ones Word's Symbol and Wingdings fonts put in PDFs
  const BULLET = /^\s*(?:[•●○◦▪▫■□‣⁃∙➢➤►▸✓✔\-–—*\uf0b7\uf0a7\uf076\uf0d8\uf0fc\uf0a8\uf0e0]\s*|\d{1,2}[.)]\s+)(?=\S)/;
  const digits = t => (t.match(/\d/g) || []).length;
  const isContact = t => EMAIL.test(t) || (PHONE.test(t) && digits(t) >= 8 && !RANGE.test(t)) || LINK.test(t.replace(EMAILS, ''));
  // "London · name@example.com | Phone: 0612345678" in separate pieces, labels removed
  const LABEL = '(?:e-?mail|phone|tel|telephone|mobile|mob|address|location|adres|adresse|telefoon|woonplaats|linkedin|website|web)';
  const contactParts = t => t.split(new RegExp(`\\s+[|·•]\\s+|\\s{2,}|\\s+(?=${LABEL}\\s*:)`, 'i'))
    .map(s => s.trim().replace(new RegExp(`^${LABEL}\\s*:\\s*`, 'i'), '')).filter(Boolean);

  // ---------- step 1: lines with layout clues ----------
  function cleanLine(text) {
    return String(text || '').replace(/\u00a0/g, ' ').replace(/[\u200b-\u200f\u202a-\u202e\ufeff]/g, '').replace(/\s+/g, ' ').trim();
  }
  function pushLine(out, text, flags) {
    text = cleanLine(text);
    if (!text) return;
    const caps = text.length > 2 && text === text.toUpperCase() && /\p{Lu}/u.test(text);
    out.push(Object.assign({ text, caps }, flags || {}));
  }

  // Word: paragraphs keep their style (Title, Heading), bold, size and list membership. Tables and text boxes too.
  async function linesFromDocx(file) {
    const zip = await global.JSZip.loadAsync(await file.arrayBuffer());
    const entry = zip.file('word/document.xml');
    if (!entry) return [];
    const xml = new DOMParser().parseFromString(await entry.async('string'), 'application/xml');
    const out = [];
    const ownerP = node => { let n = node.parentNode; while (n && n.nodeName !== 'w:p') n = n.parentNode; return n; };
    // Text boxes are stored twice (new and old format); read only the new one
    const inFallback = node => { for (let n = node.parentNode; n; n = n.parentNode) if (n.nodeName === 'mc:Fallback') return true; return false; };
    for (const p of Array.from(xml.getElementsByTagName('w:p'))) {
      if (inFallback(p)) continue;
      let text = '', boldChars = 0, chars = 0, size = 0;
      const runs = Array.from(p.getElementsByTagName('w:r')).filter(r => ownerP(r) === p);
      for (const r of runs) {
        let t = '';
        for (const c of Array.from(r.childNodes)) {
          if (c.nodeName === 'w:t') t += c.textContent;
          else if (c.nodeName === 'w:tab') t += ' ';
          else if (c.nodeName === 'w:br' || c.nodeName === 'w:cr') t += '\n';
        }
        if (!t) continue;
        const rPr = Array.from(r.childNodes).find(c => c.nodeName === 'w:rPr');
        const b = rPr && rPr.getElementsByTagName('w:b')[0];
        const isBold = !!b && b.getAttribute('w:val') !== '0' && b.getAttribute('w:val') !== 'false';
        const sz = rPr && rPr.getElementsByTagName('w:sz')[0];
        if (sz) size = Math.max(size, Number(sz.getAttribute('w:val')) / 2 || 0);
        chars += t.trim().length; if (isBold) boldChars += t.trim().length;
        text += t;
      }
      const pPr = Array.from(p.childNodes).find(c => c.nodeName === 'w:pPr');
      const styleEl = pPr && pPr.getElementsByTagName('w:pStyle')[0];
      const style = styleEl ? styleEl.getAttribute('w:val') || '' : '';
      const listed = !!(pPr && pPr.getElementsByTagName('w:numPr')[0]) || /list|lijst|bullet|aufz/i.test(style);
      const heading = /heading|kop|title|titel|titre|überschrift/i.test(style);
      const bold = chars > 0 && boldChars / chars > 0.6;
      text.split('\n').forEach(part => pushLine(out, part, { heading, bold, bullet: listed, size, title: /^(title|titel|titre)$/i.test(style), para: true }));
    }
    return out;
  }

  // OpenDocument: headings and list items are marked in the file.
  async function linesFromOdt(file) {
    const zip = await global.JSZip.loadAsync(await file.arrayBuffer());
    const xml = new DOMParser().parseFromString(await zip.file('content.xml').async('string'), 'application/xml');
    const out = [];
    const walk = (node, inList) => {
      for (const c of Array.from(node.childNodes)) {
        if (c.nodeName === 'text:h') pushLine(out, c.textContent, { heading: true, para: true });
        else if (c.nodeName === 'text:p') pushLine(out, c.textContent, { bullet: inList, para: true });
        else if (c.nodeType === 1) walk(c, inList || c.nodeName === 'text:list-item');
      }
    };
    walk(xml.documentElement, false);
    return out;
  }

  // A two-column layout has a clear vertical strip that almost no line of text crosses.
  // A strip of dates beside the text (a timeline) is not a second column, so those rows stay whole.
  function findGutter(rows, width) {
    const BINS = 100, cover = new Array(BINS).fill(0);
    rows.forEach(r => {
      const seen = new Set();
      r.items.forEach(it => {
        const a = Math.max(0, Math.floor(it.x / width * BINS)), b = Math.min(BINS - 1, Math.floor((it.x + it.w) / width * BINS));
        for (let i = a; i <= b; i++) seen.add(i);
      });
      seen.forEach(i => cover[i]++);
    });
    const limit = Math.max(1, rows.length * 0.06);
    let best = null, run = null;
    for (let i = 15; i <= 85; i++) {
      if (cover[i] <= limit) {
        run = run ? { from: run.from, to: i } : { from: i, to: i };
        if (!best || run.to - run.from > best.to - best.from) best = run;
      } else run = null;
    }
    if (!best || best.to - best.from < 1) return null;
    const gx = (best.from + best.to + 1) / 2 / BINS * width;
    const sideText = (r, left) => r.items.filter(it => left ? it.x + it.w <= gx : it.x >= gx).map(it => it.str).join(' ').trim();
    const leftRows = rows.map(r => sideText(r, true)).filter(Boolean), rightRows = rows.map(r => sideText(r, false)).filter(Boolean);
    if (leftRows.length < rows.length * 0.2 || rightRows.length < rows.length * 0.2) return null;
    const dateShare = list => list.filter(t => { const d = findDates(t); return d && tidyRest(d.rest).length < 6; }).length / list.length;
    if (dateShare(leftRows) > 0.4 || dateShare(rightRows) > 0.4) return null;
    return gx;
  }

  // PDF: text pieces are grouped into lines by position, columns are read one at a time,
  // and indents and wrapped lines are noted so bullet points come out whole.
  async function linesFromPdf(blob, pdfjs) {
    const doc = await pdfjs.getDocument({ data: await blob.arrayBuffer(), isEvalSupported: false }).promise;
    const out = [];
    for (let n = 1; n <= Math.min(doc.numPages, 6); n++) {
      const page = await doc.getPage(n);
      const width = page.getViewport({ scale: 1 }).width;
      const tc = await page.getTextContent();
      const items = tc.items.filter(it => it.str && it.str.trim()).map(it => ({
        str: it.str, x: it.transform[4], y: it.transform[5], w: it.width, h: Math.abs(it.transform[3]) || it.height || 10,
        bold: /bold|black|heavy|semibold/i.test(((tc.styles[it.fontName] || {}).fontFamily || '') + ' ' + (it.fontName || ''))
      }));
      if (!items.length) continue;
      items.sort((a, b) => b.y - a.y || a.x - b.x);
      const rows = [];
      for (const it of items) {
        const row = rows.find(r => Math.abs(r.y - it.y) <= Math.max(2, it.h * 0.35));
        if (row) row.items.push(it); else rows.push({ y: it.y, items: [it] });
      }
      rows.forEach(r => r.items.sort((a, b) => a.x - b.x));
      const gx = findGutter(rows, width);
      const cols = gx === null ? [rows] : [[], []];
      if (gx !== null) rows.forEach(r => {
        const crossing = r.items.some(it => it.x < gx && it.x + it.w > gx);
        if (crossing) { cols[r.items[0].x + r.items[0].w / 2 < gx ? 0 : 1].push(r); return; }
        const left = r.items.filter(it => it.x + it.w <= gx), right = r.items.filter(it => it.x >= gx);
        if (left.length) cols[0].push({ y: r.y, items: left });
        if (right.length) cols[1].push({ y: r.y, items: right });
      });
      const sizes = items.map(it => it.h).sort((a, b) => a - b);
      const body = sizes[Math.floor(sizes.length / 2)] || 10;
      cols.forEach((col, ci) => {
        if (!col.length) return;
        const minX = Math.min(...col.map(r => r.items[0].x));
        const maxR = Math.max(...col.map(r => { const l = r.items[r.items.length - 1]; return l.x + l.w; }));
        let prev = null;
        col.forEach((r, ri) => {
          let text = '', last = null, gap = 0;
          for (const it of r.items) {
            if (last) gap = Math.max(gap, it.x - (last.x + last.w));
            if (last && it.x - (last.x + last.w) > it.h * 0.2 && !/\s$/.test(text) && !/^\s/.test(it.str)) text += ' ';
            text += it.str; last = it;
          }
          const h = Math.max(...r.items.map(it => it.h)), right = last.x + last.w;
          // a row that starts with dates in a column of their own (a timeline): its text starts after them
          let x = r.items[0].x;
          for (let k = 1; k < r.items.length; k++) {
            if (r.items[k].x - (r.items[k - 1].x + r.items[k - 1].w) <= h) continue;
            const d = findDates(r.items.slice(0, k).map(it => it.str).join(' '));
            if (d && tidyRest(d.rest).length < 3) x = r.items[k].x;
            break;
          }
          const bold = r.items.every(it => it.bold);
          const info = {
            size: h, heading: h > body * 1.18, bold, x,
            // a line that runs to the margin may continue on the next; one with a date pushed to the right doesn't
            full: right > maxR - (maxR - minX) * 0.15 && gap < h * 1.5,
            cont: !!prev && prev.full && !/[.!?:;]$/.test(prev.text.trim()) && !BULLET.test(text) && x >= prev.x - 2 && x <= prev.x + 24 &&
              Math.abs(h - prev.size) < 1.5 && bold === prev.bold && prev.y - r.y < h * 2.2,
            colStart: ci > 0 && ri === 0
          };
          pushLine(out, text, info);
          prev = Object.assign({ text, y: r.y }, info);
        });
      });
    }
    return out;
  }

  function linesFromHtml(raw) {
    const doc = new DOMParser().parseFromString(raw, 'text/html');
    doc.querySelectorAll('script,style').forEach(n => n.remove());
    const out = [];
    if (doc.body) doc.body.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,td,div:not(:has(*))').forEach(el => {
      pushLine(out, el.textContent, { heading: /^H[1-6]$/.test(el.tagName), bullet: el.tagName === 'LI', bold: !!el.querySelector('b,strong') && el.textContent.length < 80, para: true });
    });
    return out;
  }

  function linesFromText(text) {
    const out = [];
    String(text).split(/\r?\n/).forEach(l => pushLine(out, l));
    return out;
  }

  // ---------- step 2: read the lines like a CV ----------

  // Lines broken by the page width are joined back together (Word and OpenDocument paragraphs are already whole).
  function mergeWrapped(lines) {
    const out = [];
    for (const l of lines) {
      const prev = out[out.length - 1];
      const joins = prev && !l.para && !prev.para && !sectionOf(prev) && !sectionOf(l) && !BULLET.test(l.text) && !isContact(l.text) &&
        (l.cont || (/^\p{Ll}/u.test(l.text) && prev.text.length >= 25 && !/[.!?:]$/.test(prev.text)));
      if (joins) {
        prev.text = /\p{L}-$/u.test(prev.text) ? prev.text.slice(0, -1) + l.text : prev.text + ' ' + l.text;
      } else out.push(Object.assign({}, l));
    }
    return out;
  }

  const ROLE = /\b(manager|engineer|developer|designer|assistant|specialist|officer|consultant|analyst|teacher|nurse|doctor|student|intern|director|coordinator|lead|head|executive|accountant|administrator|advisor|adviser|associate|supervisor|technician|representative|agent|clerk|cashier|chef|cook|driver|operator|architect|scientist|researcher|lecturer|professor|tutor|trainer|writer|editor|marketer|recruiter|owner|founder|president|partner|volunteer|receptionist|pharmacist|therapist|mechanic|electrician|waiter|waitress|barista|sales)\b/i;
  const COMPANY = /\b(ltd|limited|inc|llc|plc|gmbh|b\.?v\.?|s\.?a\.?|group|bank|hospital|clinic|company|co\.|corp|corporation|agency|studio|store|stores|restaurant|hotel|foods|retail|digital|solutions|services|technologies|consulting|partners|holdings|international)\b/i;

  function parse(input) {
    const cv = { name: '', title: '', email: '', phone: '', location: '', link: '', summary: '', experience: [], education: [], skills: [], languages: [], extras: [] };
    const lines = mergeWrapped(input.filter(l => l.text && !/^(page )?\d+( (of|\/) \d+)?$/i.test(l.text) && !/^(curriculum vitae|cv|resume|résumé|lebenslauf)$/i.test(l.text)));

    // contact details can be anywhere
    for (const l of lines) {
      if (!cv.email) { const m = l.text.match(EMAIL); if (m) cv.email = m[0]; }
      if (!cv.phone && !RANGE.test(l.text)) { const m = l.text.match(PHONE); if (m && digits(m[0]) >= 8 && digits(m[0]) <= 15) cv.phone = m[0].trim(); }
    }

    // the name is the most prominent name-like line near the start; the job title usually follows it
    const looksLikeName = l => /^[\p{L}][\p{L}'’.\-]*(\s+[\p{L}][\p{L}'’.\-]*){1,4}$/u.test(l.text) && l.text.length <= 40 &&
      !isContact(l.text) && !findDates(l.text) && !sectionOf(Object.assign({}, l, { heading: true })) && !l.bullet;
    const early = lines.slice(0, 40);
    const sizes = early.map(l => l.size).filter(Boolean).sort((a, b) => a - b);
    const median = sizes.length ? sizes[Math.floor(sizes.length / 2)] : 0;
    const candidates = early.filter(looksLikeName);
    const nameLine = candidates.find(l => l.title)
      || (median ? candidates.filter(l => l.size >= median * 1.3).sort((a, b) => b.size - a.size)[0] : null)
      || candidates.find(l => lines.indexOf(l) < 6);
    let titleLine = null;
    if (nameLine) {
      cv.name = nameLine.caps ? nameLine.text.toLowerCase().replace(/(^|[\s\-'’])\p{L}/gu, m => m.toUpperCase()) : nameLine.text;
      const next = lines[lines.indexOf(nameLine) + 1];
      if (next && next.text.length <= 70 && next.text.split(' ').length <= 8 && !isContact(next.text) && !findDates(next.text) && !sectionOf(next) &&
          !/^[\p{L}\s.'\-]+,\s*[\p{L}\s.'\-]+$/u.test(next.text) && !/[.!?]$/.test(next.text)) {
        titleLine = next;
        cv.title = next.text.split(/\s+[|·•]\s+/)[0].trim();
      } else if (next && isContact(next.text)) {
        // "Finance Analyst · London · name@example.com" puts the job title first on the contact line
        const first = contactParts(next.text)[0] || '';
        if (ROLE.test(first) && !isContact(first) && first.split(' ').length <= 6) cv.title = first;
      }
    }

    // split into sections at each heading; a new column starts a fresh untitled block
    const blocks = [{ key: 'top', heading: '', lines: [] }];
    for (const l of lines) {
      if (l === nameLine || l === titleLine) continue;
      const key = sectionOf(l);
      if (key) blocks.push({ key, heading: l.text.replace(/[:\uff1a]\s*$/, ''), lines: [] });
      else {
        if (l.colStart) blocks.push({ key: 'top', heading: '', lines: [] });
        blocks[blocks.length - 1].lines.push(l);
      }
    }

    // location: a short "City, Country" near the top or in the contact details,
    // or a lone place name on the line with the email and phone number
    const near = blocks.filter(b => b.key === 'top' || b.key === 'contact').flatMap(b => b.lines.slice(0, 12));
    const parts = near.flatMap(l => contactParts(l.text).map(text => ({ text, onContactLine: isContact(l.text) })));
    const place = parts.find(p => /^[\p{L}\s.'\-]+,\s*[\p{L}\s.'\-]+$/u.test(p.text) && p.text.length < 45 && p.text !== cv.name && p.text !== cv.title)
      || parts.find(p => p.onContactLine && /^\p{Lu}[\p{L}.'\-]*(\s+\p{Lu}[\p{L}.'\-]*){0,2}$/u.test(p.text) && p.text !== cv.name && p.text !== cv.title && !ROLE.test(p.text));
    if (place) cv.location = place.text;

    // a link: LinkedIn, GitHub and full web addresses anywhere; a bare domain only near the top
    // (so a company like Bol.com in the job list is not taken for the visitor's website)
    for (const l of lines) {
      const m = l.text.replace(EMAILS, ' ').match(LINK);
      if (m && (/linkedin|github|behance|https?:|www\./i.test(m[0]) || near.includes(l))) { cv.link = m[0].replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, ''); break; }
    }

    for (const b of blocks) {
      if (b.key === 'top') {
        // a paragraph before any heading is usually the profile
        const para = b.lines.filter(l => !isContact(l.text) && l.text.length > 60 && !findDates(l.text));
        if (para.length && !cv.summary) cv.summary = para.map(l => l.text).join(' ').slice(0, 1500);
      }
      else if (b.key === 'summary') cv.summary = b.lines.map(l => l.text.replace(BULLET, '')).join(' ').slice(0, 1500);
      else if (b.key === 'experience') cv.experience.push(...entries(b.lines, 'job'));
      else if (b.key === 'education') cv.education.push(...entries(b.lines, 'study'));
      else if (b.key === 'skills') cv.skills.push(...listItems(b.lines));
      else if (b.key === 'languages') cv.languages.push(...listItems(b.lines));
      else if (b.key.startsWith('extras_')) {
        const items = b.lines.map(l => l.text.replace(BULLET, '').trim()).filter(t => t.length > 1).slice(0, 15);
        if (items.length) cv.extras.push({ heading: titleCase(b.heading) || EXTRA_TITLES[b.key], items });
      }
    }
    cv.skills = unique(cv.skills).slice(0, 30);
    cv.languages = unique(cv.languages).slice(0, 12);
    cv.experience = cv.experience.slice(0, 15);
    cv.education = cv.education.slice(0, 10);
    cv.extras = cv.extras.slice(0, 8);
    return { cv };
  }

  const unique = list => [...new Map(list.map(s => [s.toLowerCase(), s])).values()];
  const titleCase = s => s && s === s.toUpperCase() ? s.toLowerCase().replace(/(^|\s)\p{L}/gu, m => m.toUpperCase()) : s;

  // Split on commas and the like, but not inside brackets: "Office (Word, Excel)" stays one skill.
  function splitList(text) {
    const parts = [];
    let depth = 0, cur = '';
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '(' || ch === '[') depth++;
      if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
      if (!depth && (/[,;|•·●▪\uf0b7]/.test(ch) || (ch === ' ' && text[i + 1] === ' '))) { parts.push(cur); cur = ''; continue; }
      cur += ch;
    }
    parts.push(cur);
    return parts.map(s => s.trim()).filter(Boolean);
  }

  function listItems(lines) {
    const items = [];
    for (const l of lines) {
      const parts = splitList(l.text.replace(BULLET, ''));
      // "Software: Excel, SAP, Python" drops the label; "Excel: advanced" and "Arabic: native; English: good" stay whole
      if (parts.length > 1 && /^[^:]{2,30}:\s*\S/.test(parts[0]) && !parts.slice(1).some(p => p.includes(':'))) parts[0] = parts[0].replace(/^[^:]+:\s*/, '');
      for (const p of parts) {
        const s = p.replace(/^(and|en|et|y|und)\s+/i, '').replace(/\.$/, '').trim();
        if (s.length > 1 && s.length <= 60) items.push(s);
      }
    }
    return items;
  }

  // Jobs and studies: a new entry starts at a header line (not a bullet) once the previous entry
  // has its details, or whenever a second set of dates appears.
  const DEGREE = /\b(bachelor|bachelor's|bsc|b\.sc|ba|b\.a|bcom|beng|master|master's|msc|m\.sc|ma|mba|meng|phd|ph\.d|doctorate|diploma|degree|certificate|associate|high school|secondary|a-levels?|gcse|igcse|hbo|mbo|vwo|havo|propedeuse|licence|licenciatura|baccalauréat|bac|grado|título|abitur|بكالوريوس|ماجستير|دبلوم|ثانوية)\b/i;
  const SCHOOL = /\b(university|universiteit|université|universidad|universität|universita|college|school|institute|institut|instituto|academy|academie|akademie|hogeschool|polytechnic|lyceum|gymnasium|جامعة|كلية|معهد|مدرسة)\b/i;

  function entries(lines, kind) {
    const list = [];
    let cur = null;
    const start = l => { cur = { header: [], details: [], start: '', end: '', x: null, strong: !!(l && (l.bold || l.heading || l.caps)) }; list.push(cur); };
    for (const l of lines) {
      const d0 = findDates(l.text);
      const dateOnly = d0 && tidyRest(d0.rest).length < 3;
      // In PDFs, a line set in further than its job's first line is a bullet point even without a mark
      const indented = l.x != null && cur && cur.x != null && l.x > cur.x + 6 && !l.bold && !dateOnly;
      const isBullet = l.bullet || BULLET.test(l.text) || indented;
      const d = isBullet ? null : d0;
      const headerish = !isBullet && (l.text.length <= 90 || !!d);
      if (!cur) start(l);
      const dated = !!(cur.start || cur.end);
      if (headerish && d && dated) start(l);
      else if (headerish && cur.details.length) start(l);
      if (d && !cur.start && !cur.end) {
        cur.start = d.start; cur.end = d.end;
        const rest = tidyRest(d.rest);
        if (rest) { cur.header.push(rest); if (cur.x == null) cur.x = l.x; }
        continue;
      }
      if (headerish && cur.header.length < (cur.start || cur.end ? 2 : 3)) { cur.header.push(l.text); if (cur.x == null) cur.x = l.x; }
      else cur.details.push(l.text);
    }
    // a stray plain line with no dates after an entry belongs to that entry
    const merged = [];
    for (const e of list) {
      const prev = merged[merged.length - 1];
      if (prev && (prev.start || prev.end) && !e.start && !e.end && !e.strong && e.header.length <= 1) prev.details.push(...e.header, ...e.details);
      else merged.push(e);
    }
    return merged.filter(e => e.header.length || e.details.length).map(e => kind === 'job' ? toJob(e) : toStudy(e));
  }

  function splitPlace(text) {
    // "Company, City" or "Company | City" or "Company – City"
    const m = text.match(/^(.*?)\s*(?:,|\||·|–|—| - )\s*([\p{L}\s.'\-]{2,40})$/u);
    return m && m[1] && !DEGREE.test(m[2]) && !COMPANY.test(m[2]) ? [m[1].trim(), m[2].trim()] : [text.trim(), ''];
  }

  function toJob(e) {
    const job = { role: '', company: '', location: '', start: e.start, end: e.end, bullets: [] };
    let header = e.header.map(h => h.replace(/\s*[|·,]\s*$/, '').trim()).filter(Boolean);
    // "Company" on the first line and the job title on the second: swap them
    if (header.length >= 2 && ROLE.test(header[1]) && !ROLE.test(header[0])) header = [header[1], header[0], ...header.slice(2)];
    const first = header[0] || '';
    const at = first.match(/^(.+?)\s+(?:at|@|bij|chez|bei|في|لدى)\s+(.+)$/i);
    if (at) { job.role = at[1]; [job.company, job.location] = splitPlace(at[2]); }
    else if (header.length >= 2) { job.role = first; [job.company, job.location] = splitPlace(header[1]); }
    else {
      const parts = first.split(/\s*(?:\||·|–|—| - |,)\s*/).filter(Boolean);
      if (parts.length >= 2 && ROLE.test(parts[1]) && !ROLE.test(parts[0])) parts.splice(0, 2, parts[1], parts[0]);
      job.role = parts[0] || ''; job.company = parts[1] || ''; job.location = parts.slice(2).join(', ');
    }
    if (header[2] && !job.location && header[2].length < 40) job.location = header[2];
    job.bullets = e.details.map(t => t.replace(BULLET, '').trim()).filter(t => t.length > 1).slice(0, 8);
    return job;
  }

  function toStudy(e) {
    const st = { qualification: '', school: '', location: '', start: e.start, end: e.end, details: '' };
    const header = e.header.filter(Boolean), used = new Set();
    // "BSc Economics, University of Manchester, Manchester" on one line
    const both = header.find(h => DEGREE.test(h) && SCHOOL.test(h) && /,|\||·|–|—| - /.test(h));
    if (both) {
      const parts = both.split(/\s*(?:,|\||·|–|—| - )\s*/).filter(Boolean);
      if (parts.length > 1 && SCHOOL.test(parts[0]) && !DEGREE.test(parts[0])) parts.splice(0, 2, parts[1], parts[0]);
      st.qualification = parts[0];
      st.school = parts[1] || '';
      st.location = parts.slice(2).join(', ');
      used.add(both);
    } else {
      const q = header.find(h => DEGREE.test(h) && !SCHOOL.test(h)) || header.find(h => !SCHOOL.test(h)) || header[0] || '';
      const s = header.find(h => h !== q && SCHOOL.test(h)) || header.find(h => h !== q) || '';
      st.qualification = q; used.add(q);
      if (s) { [st.school, st.location] = splitPlace(s); used.add(s); }
    }
    // what's left (like "First-class honours") is a detail
    const rest = header.filter(h => !used.has(h));
    if (!st.location && rest[0] && /^\p{Lu}[\p{L}.'\-]*(,?\s+\p{Lu}[\p{L}.'\-]*){0,3}$/u.test(rest[0]) && !DEGREE.test(rest[0])) st.location = rest.shift();
    st.details = rest.concat(e.details).map(t => t.replace(BULLET, '').trim()).filter(Boolean).join(' ').slice(0, 600);
    return st;
  }

  global.InklineParser = { linesFromDocx, linesFromOdt, linesFromPdf, linesFromHtml, linesFromText, parse };
})(window);
