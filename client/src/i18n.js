// Tiny translation layer: English text is the key, Arabic lives in ar.js.
// The language is saved in the browser and the page reloads when it changes, so every
// screen (and every number/date format) always matches the chosen language.
import { createElement } from 'react';
import ar, { PATTERNS } from './ar.js';

const KEY = 'gn_lang';
const stored = () => { try { const l = localStorage.getItem(KEY); return l === 'ar' || l === 'en' ? l : null; } catch { return null; } };
// Staff screens stay English until someone chooses Arabic. Guests who scan a QR menu get their phone's language.
const guestAuto = typeof location !== 'undefined' && location.pathname.startsWith('/m/') && /^ar/i.test(navigator.language || '') ? 'ar' : 'en';

export const lang = stored() || guestAuto;
export const isAr = lang === 'ar';
export const dir = isAr ? 'rtl' : 'ltr';
/** Locale for dates and times. Latin digits are kept on purpose so they match the numbers typed in forms and printed on Excel files. */
export const locale = isAr ? 'ar-EG-u-nu-latn' : 'en-GB';
/** Arrow that points "from → to" in the reading direction. */
export const ARROW = isAr ? '←' : '→';

if (typeof document !== 'undefined') { document.documentElement.lang = lang; document.documentElement.dir = dir; }

export function setLang(l) { try { localStorage.setItem(KEY, l); } catch { /* private mode */ } location.reload(); }

// A key may carry a context after @@ (e.g. "From@@source") when the same English word needs a different Arabic word.
const plain = (k) => (k.indexOf('@@') < 0 ? k : k.replace(/@@.*$/, ''));
const fill = (s, vars) => (vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)) : s);

/** Translate a fixed phrase. Unknown text (names typed by users, etc.) is returned as it is. */
export function tr(key, vars) {
  if (key === null || key === undefined) return key;
  const s = isAr && Object.prototype.hasOwnProperty.call(ar, key) ? ar[key] : plain(String(key));
  return fill(s, vars);
}

/** Translate a sentence the server wrote in English (errors, journal memos, activity log). */
export function tm(msg) {
  if (!isAr || !msg || typeof msg !== 'string') return msg;
  if (Object.prototype.hasOwnProperty.call(ar, msg)) return ar[msg];
  for (const [re, out] of PATTERNS) {
    const m = re.exec(msg);
    if (m) return out.replace(/\$(\d)/g, (_, i) => tm(m[i] ?? ''));
  }
  return msg;
}

/** Like tr(), but the text may contain <b>…</b>, <i>…</i>, <code>…</code> and <br/>. Returns React nodes. */
export function rich(key, vars) {
  const s = tr(key, vars); const out = []; const re = /<(b|i|code)>([\s\S]*?)<\/\1>|<br\s*\/?>/g; let last = 0, m, n = 0;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    out.push(m[0].startsWith('<br') ? createElement('br', { key: n++ }) : createElement(m[1], { key: n++ }, m[2]));
    last = re.lastIndex;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}
