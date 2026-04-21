import {
  CalendarCheck, Truck, GraduationCap, AlertTriangle, Trophy, Tag,
  Flame, Layout, ClipboardList, CheckSquare, Package, Users
} from 'lucide-react';

/* Mapping nom (string envoyé par l'API) -> composant lucide */
export const TEMPLATE_ICONS = {
  CalendarCheck, Truck, GraduationCap, AlertTriangle, Trophy, Tag,
  Flame, Layout, ClipboardList, CheckSquare, Package, Users
};

/* Palette pour boards/colonnes/étiquettes — cohérente avec Tailwind */
export const COLORS = {
  slate:   { bg: 'bg-slate-100',   text: 'text-slate-700',   border: 'border-slate-200',   dot: 'bg-slate-400',   header: 'bg-slate-50' },
  emerald: { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-200', dot: 'bg-emerald-500', header: 'bg-emerald-50' },
  sky:     { bg: 'bg-sky-100',     text: 'text-sky-800',     border: 'border-sky-200',     dot: 'bg-sky-500',     header: 'bg-sky-50' },
  amber:   { bg: 'bg-amber-100',   text: 'text-amber-800',   border: 'border-amber-200',   dot: 'bg-amber-500',   header: 'bg-amber-50' },
  rose:    { bg: 'bg-rose-100',    text: 'text-rose-800',    border: 'border-rose-200',    dot: 'bg-rose-500',    header: 'bg-rose-50' },
  violet:  { bg: 'bg-violet-100',  text: 'text-violet-800',  border: 'border-violet-200',  dot: 'bg-violet-500',  header: 'bg-violet-50' },
  pink:    { bg: 'bg-pink-100',    text: 'text-pink-800',    border: 'border-pink-200',    dot: 'bg-pink-500',    header: 'bg-pink-50' },
  teal:    { bg: 'bg-teal-100',    text: 'text-teal-800',    border: 'border-teal-200',    dot: 'bg-teal-500',    header: 'bg-teal-50' }
};

export const PRIORITY_COLORS = {
  low:    'bg-slate-100 text-slate-600 border-slate-200',
  normal: 'bg-sky-100 text-sky-700 border-sky-200',
  high:   'bg-amber-100 text-amber-700 border-amber-200',
  urgent: 'bg-rose-100 text-rose-700 border-rose-200'
};

export const PRIORITY_LABELS = {
  low: 'Faible',
  normal: 'Normale',
  high: 'Haute',
  urgent: 'Urgente'
};

export function getColor(name) {
  return COLORS[name] || COLORS.slate;
}

export function getIcon(name) {
  return TEMPLATE_ICONS[name] || Layout;
}
