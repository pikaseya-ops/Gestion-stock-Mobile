import { Cross, Pill, Package, GraduationCap } from 'lucide-react';

export const ROLES = {
  pharmacien:  { label: 'Pharmacien',  short: 'PHARM', icon: Cross,         accent: 'bg-emerald-600', text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', chip: 'bg-emerald-100 text-emerald-800' },
  preparateur: { label: 'Préparateur', short: 'PREP',  icon: Pill,          accent: 'bg-sky-600',     text: 'text-sky-700',     bg: 'bg-sky-50',     border: 'border-sky-200',     chip: 'bg-sky-100 text-sky-800' },
  logistique:  { label: 'Logistique',  short: 'LOGI',  icon: Package,       accent: 'bg-amber-600',   text: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200',   chip: 'bg-amber-100 text-amber-800' },
  alternant:   { label: 'Alternant',   short: 'ALT',   icon: GraduationCap, accent: 'bg-violet-600',  text: 'text-violet-700',  bg: 'bg-violet-50',  border: 'border-violet-200',  chip: 'bg-violet-100 text-violet-800' }
};

export const CONTRACTS = {
  temps_plein:   { label: 'Temps plein',   defaultHours: 35 },
  temps_partiel: { label: 'Temps partiel', defaultHours: 24 },
  alternance:    { label: 'Alternance',    defaultHours: 28 }
};

export const LEAVE_TYPES = {
  cp:      { label: 'Congés payés', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  rtt:     { label: 'RTT',          color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  maladie: { label: 'Maladie',      color: 'bg-rose-100 text-rose-800 border-rose-200' },
  ssc:     { label: 'Sans solde',   color: 'bg-slate-100 text-slate-700 border-slate-200' },
  autre:   { label: 'Autre',        color: 'bg-stone-100 text-stone-700 border-stone-200' }
};

export const DAYS_FR    = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
export const DAYS_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

export const DEFAULT_OPENING = {
  0: null,
  1: { start: '09:00', end: '19:00' },
  2: { start: '08:30', end: '19:00' },
  3: { start: '08:30', end: '19:00' },
  4: { start: '08:30', end: '19:00' },
  5: { start: '08:30', end: '19:00' },
  6: { start: '08:30', end: '19:00' }
};

export const DEFAULT_SETTINGS = {
  pharmacyName: 'Ma Pharmacie',
  openingHours: DEFAULT_OPENING,
  defaultMinPharmacist: 1,
  defaultMinCounter: 2,
  defaultMinTotal: 3,
  slotDuration: 30,
  cpPerYear: 25
};
