/* Inkline CV model and renderer, shared by the home page gallery and the CV maker. */
(function (global) {
  'use strict';

  // Two families: colourful designs with a photo spot, and one-column classics that hiring software reads best.
  // Two-column designs list their blocks per area. The main column always comes first in the page source,
  // so a PDF's text reads name, profile and experience before the sidebar.
  const TEMPLATES = [
    { id: 'atlas',   name: 'Atlas',   note: 'Colour sidebar with photo', group: 'photo', photo: true, accent: 'navy',  layout: 'two',
      top: [], main: ['head', 'profile', 'experience', 'education'], side: ['photo', 'contact', 'skills', 'languages', 'extras'] },
    { id: 'vertex',  name: 'Vertex',  note: 'Bold colour header',        group: 'photo', photo: true, accent: 'teal',  layout: 'two',
      top: ['head', 'photo'], main: ['profile', 'experience', 'extras'], side: ['contact', 'education', 'skills', 'languages'] },
    { id: 'sage',    name: 'Sage',    note: 'Soft and minimal',          group: 'photo', photo: true, accent: 'sage',  layout: 'two',
      top: ['photo', 'head'], main: ['profile', 'experience', 'extras'], side: ['contact', 'skills', 'languages', 'education'] },
    { id: 'bloom',   name: 'Bloom',   note: 'Warm and creative',         group: 'photo', photo: true, accent: 'rose',  layout: 'two',
      top: [], main: ['head', 'profile', 'experience', 'education', 'extras'], side: ['photo', 'contact', 'skills', 'languages'] },
    { id: 'noir',    name: 'Noir',    note: 'Elegant dark sidebar',      group: 'photo', photo: true, accent: 'ink',   layout: 'two',
      top: [], main: ['head', 'profile', 'experience', 'education'], side: ['photo', 'contact', 'skills', 'languages', 'extras'] },
    { id: 'horizon', name: 'Horizon', note: 'Timeline layout',           group: 'photo', photo: true, accent: 'ochre', layout: 'two',
      top: ['photo', 'head', 'contactInline'], main: ['profile', 'experience', 'extras'], side: ['education', 'skills', 'languages'] },
    { id: 'indigo',   name: 'Indigo',   note: 'Ink serif, quiet rules',       group: 'classic', photo: false, accent: 'indigo', layout: 'one' },
    { id: 'harbor',   name: 'Harbor',   note: 'Clean and modern',             group: 'classic', photo: false, accent: 'navy',   layout: 'one' },
    { id: 'folio',    name: 'Folio',    note: 'Classic, centred',             group: 'classic', photo: false, accent: 'ink',    layout: 'one' },
    { id: 'meridian', name: 'Meridian', note: 'Colour header, photo if you like', group: 'classic', photo: true, accent: 'plum', layout: 'one' },
    { id: 'ledger',   name: 'Ledger',   note: 'Compact, fits more',           group: 'classic', photo: false, accent: 'seal',   layout: 'one' }
  ];

  // Every colour is dark enough for white text on top of it.
  const ACCENTS = [
    { id: 'indigo', name: 'Indigo',     value: '#2B2F8F' },
    { id: 'navy',   name: 'Navy',       value: '#1E3A5F' },
    { id: 'teal',   name: 'Teal',       value: '#145E63' },
    { id: 'sage',   name: 'Sage',       value: '#4A6656' },
    { id: 'ochre',  name: 'Ochre',      value: '#7F5C10' },
    { id: 'seal',   name: 'Terracotta', value: '#A2412A' },
    { id: 'rose',   name: 'Rose',       value: '#94455E' },
    { id: 'plum',   name: 'Plum',       value: '#6B2A5E' },
    { id: 'ink',    name: 'Charcoal',   value: '#25272F' }
  ];

  // Font pairs visitors can choose. 'default' keeps each design's own fonts.
  // `css` is the Google Fonts family query, loaded only when someone picks that pair.
  const FONTS = [
    { id: 'default',      name: 'Design default', head: '', body: '', css: '' },
    { id: 'modern',       name: 'Modern',       head: "'Hanken Grotesk',Arial,sans-serif", body: "'Hanken Grotesk',Arial,sans-serif", css: 'Hanken+Grotesk:wght@400;500;600;700' },
    { id: 'classic',      name: 'Classic serif', head: "'Newsreader',Georgia,serif", body: "'Newsreader',Georgia,serif", css: 'Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600' },
    { id: 'elegant',      name: 'Elegant',      head: "'Playfair Display',Georgia,serif", body: "'Lato',Arial,sans-serif", css: 'Playfair+Display:wght@500;600;700&family=Lato:wght@400;700' },
    { id: 'bold',         name: 'Bold',         head: "'Montserrat',Arial,sans-serif", body: "'Open Sans',Arial,sans-serif", css: 'Montserrat:wght@500;600;700&family=Open+Sans:wght@400;600' },
    { id: 'friendly',     name: 'Friendly',     head: "'Nunito',Arial,sans-serif", body: "'Nunito',Arial,sans-serif", css: 'Nunito:wght@400;600;700' },
    { id: 'professional', name: 'Professional', head: "'Merriweather',Georgia,serif", body: "'Source Sans 3',Arial,sans-serif", css: 'Merriweather:wght@400;700&family=Source+Sans+3:wght@400;600' },
    { id: 'minimal',      name: 'Minimal',      head: "'DM Sans',Arial,sans-serif", body: "'DM Sans',Arial,sans-serif", css: 'DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700' }
  ];
  function fontById(id) { return FONTS.find(f => f.id === id) || FONTS[0]; }
  function fontHref(id) {
    const f = fontById(id);
    return f.css ? `https://fonts.googleapis.com/css2?family=${f.css}&display=swap` : '';
  }

  function emptyCV() {
    return {
      name: '', title: '', email: '', phone: '', location: '', link: '',
      summary: '',
      experience: [],
      education: [],
      skills: [],
      languages: [],
      extras: []
    };
  }

  // A clearly fictional sample person, used for the template gallery and previews.
  const SAMPLE = {
    name: 'Maya Okafor',
    title: 'Marketing Manager',
    photo: 'assets/sample-photo.jpg',   // a made-up person, generated for the samples
    email: 'maya.okafor@email.com',
    phone: '+44 7700 900123',
    location: 'Manchester, UK',
    link: 'linkedin.com/in/mayaokafor',
    summary: 'Marketing manager with seven years in retail and food brands. I plan campaigns that people actually talk about, and I measure what works so the next one does better.',
    experience: [
      {
        role: 'Marketing Manager', company: 'Northfield Coffee Co.', location: 'Manchester',
        start: '2021', end: 'Present',
        bullets: [
          'Grew Instagram from 2,000 to 18,000 followers in one year with a weekly behind-the-counter series.',
          'Led the launch of three seasonal drinks, each selling out in its first month.',
          'Manage a team of four and a yearly budget of £120,000.'
        ]
      },
      {
        role: 'Marketing Coordinator', company: 'Greenway Stores', location: 'Leeds',
        start: '2018', end: '2021',
        bullets: [
          'Ran email campaigns for 40,000 customers, lifting repeat orders by 12%.',
          'Organised 25 in-store events with local suppliers.'
        ]
      }
    ],
    education: [
      { qualification: 'BA Marketing', school: 'University of Leeds', location: 'Leeds', start: '2014', end: '2017', details: 'First-class honours. Final project on local brand loyalty.' }
    ],
    skills: ['Campaign planning', 'Social media', 'Email marketing', 'Google Analytics', 'Budgeting', 'Team leadership'],
    languages: ['English (native)', 'Yoruba (conversational)'],
    extras: [
      { heading: 'Certifications', items: ['Google Analytics Certification, 2023', 'Meta Social Media Marketing, 2022'] }
    ]
  };

  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const svg = d => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const ICONS = {
    email: svg('<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="M4 7l8 6 8-6"/>'),
    phone: svg('<path d="M7 3.5h3l1.5 4.5-2.2 1.4a12 12 0 0 0 5.3 5.3l1.4-2.2 4.5 1.5v3a2 2 0 0 1-2 2A16.5 16.5 0 0 1 5 5.5a2 2 0 0 1 2-2z"/>'),
    location: svg('<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>'),
    link: svg('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
    camera: svg('<path d="M4 8.5h3l1.6-2.5h6.8L17 8.5h3v10H4z"/><circle cx="12" cy="13" r="3.4"/>')
  };
  const LABELS = { email: 'Email', phone: 'Phone', location: 'City', link: 'Website or LinkedIn' };

  // field(): one editable text span bound to a path in the CV object.
  function field(tag, path, value, cls, placeholder, editable) {
    const empty = !String(value || '').trim();
    if (empty && !editable) return '';
    const attrs = editable
      ? ` data-path="${path}" contenteditable="true" spellcheck="true" data-ph="${esc(placeholder || '')}"`
      : '';
    const klass = (cls || '') + (empty ? ' cv-empty' : '');
    return `<${tag}${klass.trim() ? ` class="${klass.trim()}"` : ''}${attrs}>${empty ? esc(placeholder || '') : esc(value)}</${tag}>`;
  }

  function range(start, end) {
    const a = String(start || '').trim(), b = String(end || '').trim();
    if (a && b) return `${esc(a)} to ${esc(b)}`;
    return esc(a || b);
  }
  function org(a, b) {
    const parts = [a, b].filter(Boolean);
    return parts.length ? `<p class="cv-org">${parts.join(', ')}</p>` : '';
  }
  function initials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'CV';
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  }

  // The building blocks every template is assembled from.
  function blocks(c, opts, t) {
    const ed = !!opts.editable;
    const contactSpans = () => ['email', 'phone', 'location', 'link']
      .map(k => (c[k] || ed) ? field('span', k, c[k], '', ed ? LABELS[k] : '', ed) : '')
      .filter(Boolean).join('');
    const nameTitle = () =>
      (field('h1', 'name', c.name, 'cv-name', 'Your name', ed) || '<h1 class="cv-name cv-empty">Your name</h1>') +
      field('p', 'title', c.title, 'cv-title', 'The job you want', ed);
    const dates = (base, x) => ed
      ? `${field('span', `${base}.start`, x.start, '', 'Start', ed)} to ${field('span', `${base}.end`, x.end, '', 'End', ed)}`
      : range(x.start, x.end);

    const B = {
      head() {
        if (t.layout === 'two') return `<header class="cv-head">${nameTitle()}</header>`;
        const cs = contactSpans();
        return `<header class="cv-head"><div class="cv-head-text">${nameTitle()}${cs ? `<p class="cv-contact">${cs}</p>` : ''}</div>${t.photo ? B.photo() : ''}</header>`;
      },
      photo() {
        const act = ed ? ' data-action="photo" role="button" tabindex="0"' : '';
        if (opts.photo) return `<div class="cv-photo"${act}${ed ? ' aria-label="Change your photo" title="Click to change your photo"' : ''}><img src="${esc(opts.photo)}" alt=""></div>`;
        if (ed) return `<div class="cv-photo cv-addphoto"${act} aria-label="Add your photo"><span>${ICONS.camera}Add photo</span></div>`;
        if (t.group === 'photo') return `<div class="cv-photo cv-mono" aria-hidden="true"><span>${esc(initials(c.name))}</span></div>`;
        return '';
      },
      contact() {
        const items = ['email', 'phone', 'location', 'link']
          .map(k => (c[k] || ed) ? `<li>${ICONS[k]}${field('span', k, c[k], '', LABELS[k], ed)}</li>` : '')
          .filter(Boolean).join('');
        return items ? `<section class="cv-section cv-contact-sec"><h2>Contact</h2><ul class="cv-contact-list">${items}</ul></section>` : '';
      },
      contactInline() {
        const cs = contactSpans();
        return cs ? `<p class="cv-contact">${cs}</p>` : '';
      },
      profile() {
        return (c.summary || ed)
          ? `<section class="cv-section"><h2>Profile</h2>${field('p', 'summary', c.summary, 'cv-summary', 'A short profile will appear here.', ed)}</section>`
          : '';
      },
      experience() {
        if (!c.experience.length) return '';
        return `<section class="cv-section cv-exp"><h2>Experience</h2>${c.experience.map((x, i) => `
          <article class="cv-entry">
            <div class="cv-entry-top">${field('h3', `experience.${i}.role`, x.role, 'cv-role', 'Job title', ed)}<span class="cv-dates">${dates(`experience.${i}`, x)}</span></div>
            ${org(field('span', `experience.${i}.company`, x.company, '', 'Company', ed), field('span', `experience.${i}.location`, x.location, '', 'City', ed))}
            ${(x.bullets || []).length ? `<ul class="cv-bullets">${x.bullets.map((b, j) => field('li', `experience.${i}.bullets.${j}`, b, '', 'What you did', ed)).join('')}</ul>` : ''}
          </article>`).join('')}</section>`;
      },
      education() {
        if (!c.education.length) return '';
        return `<section class="cv-section cv-edu"><h2>Education</h2>${c.education.map((x, i) => `
          <article class="cv-entry">
            <div class="cv-entry-top">${field('h3', `education.${i}.qualification`, x.qualification, 'cv-role', 'Qualification', ed)}<span class="cv-dates">${dates(`education.${i}`, x)}</span></div>
            ${org(field('span', `education.${i}.school`, x.school, '', 'School', ed), field('span', `education.${i}.location`, x.location, '', 'City', ed))}
            ${(x.details || ed) ? field('p', `education.${i}.details`, x.details, 'cv-details', 'Details (optional)', ed) : ''}
          </article>`).join('')}</section>`;
      },
      skills() {
        return c.skills.length
          ? `<section class="cv-section"><h2>Skills</h2><ul class="cv-tags">${c.skills.map((s, i) => field('li', `skills.${i}`, s, '', 'Skill', ed)).join('')}</ul></section>`
          : '';
      },
      languages() {
        return c.languages.length
          ? `<section class="cv-section"><h2>Languages</h2><ul class="cv-tags">${c.languages.map((s, i) => field('li', `languages.${i}`, s, '', 'Language', ed)).join('')}</ul></section>`
          : '';
      },
      extras() {
        return (c.extras || []).map((g, i) => (g && (g.items || []).length)
          ? `<section class="cv-section">${field('h2', `extras.${i}.heading`, g.heading, '', 'Section', ed) || '<h2>More</h2>'}<ul class="cv-bullets">${g.items.map((s, j) => field('li', `extras.${i}.items.${j}`, s, '', 'Item', ed)).join('')}</ul></section>`
          : '').join('');
      }
    };
    return B;
  }

  function templateById(id) {
    return TEMPLATES.find(t => t.id === id) || TEMPLATES.find(t => t.id === 'indigo');
  }

  function render(cv, opts) {
    opts = opts || {};
    const c = Object.assign(emptyCV(), cv || {});
    const t = templateById(opts.template);
    const B = blocks(c, opts, t);
    const pick = list => list.map(k => B[k]()).join('');
    const inner = t.layout === 'two'
      ? `${t.top.length ? `<div class="cv-top">${pick(t.top)}</div>` : ''}<div class="cv-grid"><div class="cv-main">${pick(t.main)}</div><aside class="cv-side">${pick(t.side)}</aside></div>`
      : pick(['head', 'profile', 'experience', 'education', 'skills', 'languages', 'extras']);
    const accent = (ACCENTS.find(a => a.id === (opts.accent || t.accent)) || ACCENTS[0]).value;
    const f = fontById(opts.font);
    const sz = opts.sizes || {};
    const scale = (v) => Math.min(1.4, Math.max(0.7, Number(v) || 1)).toFixed(2);
    let style = `--cv-accent:${accent}`;
    if (f.id !== 'default') style += `;--cv-head-font:${f.head};--cv-body-font:${f.body}`;
    if (sz.name && +sz.name !== 1) style += `;--cv-name-scale:${scale(sz.name)}`;
    if (sz.head && +sz.head !== 1) style += `;--cv-head-scale:${scale(sz.head)}`;
    if (sz.text && +sz.text !== 1) style += `;--cv-text-scale:${scale(sz.text)}`;
    const cls = ['cv', 'tpl-' + t.id, t.layout, opts.paper === 'letter' ? 'letter' : '', opts.editable ? 'editable' : '', opts.photo ? 'has-photo' : '', f.id !== 'default' ? 'custom-font' : '']
      .filter(Boolean).join(' ');
    return `<div class="${cls}" style="${esc(style)}" lang="${esc(opts.lang || 'en')}">${inner}</div>`;
  }

  // Read and write nested values by a dotted path like "experience.0.bullets.2".
  function getPath(obj, path) {
    return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
  }
  function setPath(obj, path, value) {
    const keys = path.split('.');
    let o = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      if (o[keys[i]] == null) o[keys[i]] = /^\d+$/.test(keys[i + 1]) ? [] : {};
      o = o[keys[i]];
    }
    o[keys[keys.length - 1]] = value;
  }

  // Make sure an object from storage or the AI has the right shape.
  function normalize(raw) {
    const c = emptyCV();
    if (!raw || typeof raw !== 'object') return c;
    const str = v => (typeof v === 'string' ? v : v == null ? '' : String(v)).slice(0, 2000);
    const list = v => (Array.isArray(v) ? v : []).map(str).filter(s => s.trim()).slice(0, 40);
    ['name', 'title', 'email', 'phone', 'location', 'link', 'summary'].forEach(k => { c[k] = str(raw[k]); });
    c.experience = (Array.isArray(raw.experience) ? raw.experience : []).slice(0, 15).map(x => ({
      role: str(x && x.role), company: str(x && x.company), location: str(x && x.location),
      start: str(x && x.start), end: str(x && x.end), bullets: list(x && x.bullets)
    }));
    c.education = (Array.isArray(raw.education) ? raw.education : []).slice(0, 10).map(x => ({
      qualification: str(x && x.qualification), school: str(x && x.school), location: str(x && x.location),
      start: str(x && x.start), end: str(x && x.end), details: str(x && x.details)
    }));
    c.skills = list(raw.skills);
    c.languages = list(raw.languages);
    c.extras = (Array.isArray(raw.extras) ? raw.extras : []).slice(0, 8).map(g => ({
      heading: str(g && g.heading), items: list(g && g.items)
    })).filter(g => g.items.length || g.heading.trim());
    return c;
  }

  function plainText(cv) {
    const c = normalize(cv);
    const lines = [c.name, c.title, [c.email, c.phone, c.location, c.link].filter(Boolean).join(' | '), ''];
    if (c.summary) lines.push('PROFILE', c.summary, '');
    if (c.experience.length) {
      lines.push('EXPERIENCE');
      c.experience.forEach(x => {
        lines.push(`${x.role}, ${x.company}${x.location ? ', ' + x.location : ''} (${[x.start, x.end].filter(Boolean).join(' to ')})`);
        x.bullets.forEach(b => lines.push('- ' + b));
        lines.push('');
      });
    }
    if (c.education.length) {
      lines.push('EDUCATION');
      c.education.forEach(x => {
        lines.push(`${x.qualification}, ${x.school}${x.location ? ', ' + x.location : ''} (${[x.start, x.end].filter(Boolean).join(' to ')})`);
        if (x.details) lines.push(x.details);
      });
      lines.push('');
    }
    if (c.skills.length) lines.push('SKILLS', c.skills.join(', '), '');
    if (c.languages.length) lines.push('LANGUAGES', c.languages.join(', '), '');
    c.extras.forEach(g => { if (!g.items.length) return; lines.push(g.heading.toUpperCase()); g.items.forEach(i => lines.push('- ' + i)); lines.push(''); });
    return lines.join('\n').trim();
  }

  global.InklineCV = { TEMPLATES, ACCENTS, FONTS, SAMPLE, ICONS, fontById, fontHref, emptyCV, render, normalize, getPath, setPath, plainText, templateById, esc };
})(typeof window !== 'undefined' ? window : globalThis);
