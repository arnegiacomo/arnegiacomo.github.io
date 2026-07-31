const LANGS = Object.keys(TRANSLATIONS);
// Tried in order; the PNG is only fetched if WebP fails to decode.
const PORTRAITS = ['assets/portrait.webp', 'assets/portrait.png', 'assets/portrait.jpg'];

function setLang(lang) {
  if (!LANGS.includes(lang)) lang = 'en';
  const dict = TRANSLATIONS[lang];

  document.documentElement.lang = lang;
  localStorage.setItem('lang', lang);

  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = dict[el.dataset.i18n] ?? el.textContent;
  });

  document.querySelectorAll('[data-i18n-attr]').forEach(el => {
    for (const pair of el.dataset.i18nAttr.split(',')) {
      const [attr, key] = pair.split(':');
      if (dict[key]) el.setAttribute(attr, dict[key]);
    }
  });

  document.querySelectorAll('[data-lang]').forEach(btn => {
    btn.setAttribute('aria-pressed', btn.dataset.lang === lang);
  });
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('theme', theme);
}

// PNG first so a background-removed cutout can sit on the coloured panel.
function loadPortrait(box, sources) {
  if (!sources.length) return box.classList.add('empty');

  const [src, ...rest] = sources;
  const img = new Image();
  img.src = src;
  img.alt = 'Arne Giacomo Munthe-Kaas';
  img.onload = () => box.replaceChildren(img);
  img.onerror = () => loadPortrait(box, rest);
}

document.querySelectorAll('[data-lang]').forEach(btn => {
  btn.addEventListener('click', () => setLang(btn.dataset.lang));
});

// Guarded so 404.html can reuse this file without carrying every element.
document.getElementById('theme')?.addEventListener('click', () => {
  const dark = matchMedia('(prefers-color-scheme: dark)').matches;
  const current = document.documentElement.dataset.theme || (dark ? 'dark' : 'light');
  setTheme(current === 'dark' ? 'light' : 'dark');
});

const year = document.getElementById('year');
if (year) year.textContent = new Date().getFullYear();

const portrait = document.getElementById('portrait');
if (portrait) loadPortrait(portrait, PORTRAITS);

setLang(document.documentElement.lang);
