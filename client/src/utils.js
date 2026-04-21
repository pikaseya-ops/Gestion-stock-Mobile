/* ============================================================
   UTILITAIRES TEMPS / DATES
   ============================================================ */

export const uuid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const timeToMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
export const minToTime = (m) => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;

export const generateSlots = (start, end, dur = 30) => {
  const out = []; let c = timeToMin(start); const e = timeToMin(end);
  while (c < e) { out.push(minToTime(c)); c += dur; }
  return out;
};

const pad = (n) => String(n).padStart(2, '0');
export const fmtDate   = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
export const fmtDateFR = (d) => `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`;
export const parseDate = (s) => { const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d); };
export const addDays   = (d, n) => { const x = new Date(d); x.setDate(x.getDate()+n); return x; };

export const getISOWeek = (date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
};

export const getMonday = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0,0,0,0);
  return d;
};

/** Compte les jours ouvrés (Lun-Ven) entre deux dates incluses */
export const countBusinessDays = (startStr, endStr) => {
  const start = parseDate(startStr);
  const end = parseDate(endStr);
  let n = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay();
    if (dow >= 1 && dow <= 5) n++;
  }
  return n;
};

export const formatRelativeTime = (timestamp) => {
  if (!timestamp) return '—';
  const ts = typeof timestamp === 'number' && timestamp < 1e12 ? timestamp * 1000 : timestamp;
  const date = new Date(ts);
  const now = Date.now();
  const diff = now - date.getTime();
  if (diff < 60_000) return "à l'instant";
  if (diff < 3_600_000) return `il y a ${Math.floor(diff/60_000)} min`;
  if (diff < 86_400_000) return `il y a ${Math.floor(diff/3_600_000)} h`;
  if (diff < 7 * 86_400_000) return `il y a ${Math.floor(diff/86_400_000)} j`;
  return fmtDateFR(date);
};
