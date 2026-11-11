// Arabic for Excel downloads. English text is the key; ar.js is a copy of client/src/ar.js (keep both in sync).
import ar, { PATTERNS } from './ar.js';

const plain = (k) => (k.indexOf('@@') < 0 ? k : k.replace(/@@.*$/, ''));
const fill = (s, vars) => (vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)) : s);

/** Returns { tr, tm, isAr } for the language sent by the browser ("ar" or anything else = English). */
export function translator(lang) {
  const isAr = lang === 'ar';
  const tr = (key, vars) => {
    if (key === null || key === undefined) return key;
    const s = isAr && Object.prototype.hasOwnProperty.call(ar, key) ? ar[key] : plain(String(key));
    return fill(String(s), vars);
  };
  const tm = (msg) => {
    if (!isAr || !msg || typeof msg !== 'string') return msg;
    if (Object.prototype.hasOwnProperty.call(ar, msg)) return ar[msg];
    for (const [re, out] of PATTERNS) { const m = re.exec(msg); if (m) return out.replace(/\$(\d)/g, (_, i) => tm(m[i] ?? '')); }
    return msg;
  };
  return { tr, tm, isAr };
}
