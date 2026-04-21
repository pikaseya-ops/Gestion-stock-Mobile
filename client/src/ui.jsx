import React, { useEffect } from 'react';
import { X, Check } from 'lucide-react';

/* =========================================================
   BUTTON
   ========================================================= */
export function Btn({ variant = 'primary', size = 'md', icon: Icon, children, className = '', disabled, ...props }) {
  const variants = {
    primary:   'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm',
    secondary: 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-sm',
    ghost:     'hover:bg-slate-100 text-slate-700',
    danger:    'bg-rose-600 hover:bg-rose-700 text-white shadow-sm',
    subtle:    'bg-slate-100 hover:bg-slate-200 text-slate-700'
  };
  const sizes = {
    sm: 'px-2.5 py-1 text-xs gap-1',
    md: 'px-3.5 py-2 text-sm gap-2',
    lg: 'px-5 py-2.5 text-sm gap-2'
  };
  const iconSize = { sm: 'w-3.5 h-3.5', md: 'w-4 h-4', lg: 'w-4 h-4' }[size];
  return (
    <button
      disabled={disabled}
      className={`inline-flex items-center justify-center font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {Icon && <Icon className={iconSize}/>}
      {children}
    </button>
  );
}

/* =========================================================
   INPUT
   ========================================================= */
export function Input({ label, hint, error, className = '', ...props }) {
  return (
    <label className="block">
      {label && <span className="block text-xs font-medium text-slate-700 mb-1">{label}</span>}
      <input
        className={`w-full px-3 py-2 text-sm border rounded-lg outline-none transition focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 ${error ? 'border-rose-400' : 'border-slate-300'} ${className}`}
        {...props}
      />
      {hint && !error && <span className="block text-xs text-slate-500 mt-1">{hint}</span>}
      {error && <span className="block text-xs text-rose-600 mt-1">{error}</span>}
    </label>
  );
}

/* =========================================================
   TEXTAREA
   ========================================================= */
export function Textarea({ label, hint, error, rows = 4, className = '', ...props }) {
  return (
    <label className="block">
      {label && <span className="block text-xs font-medium text-slate-700 mb-1">{label}</span>}
      <textarea
        rows={rows}
        className={`w-full px-3 py-2 text-sm border rounded-lg outline-none transition focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 resize-none ${error ? 'border-rose-400' : 'border-slate-300'} ${className}`}
        {...props}
      />
      {hint && !error && <span className="block text-xs text-slate-500 mt-1">{hint}</span>}
      {error && <span className="block text-xs text-rose-600 mt-1">{error}</span>}
    </label>
  );
}

/* =========================================================
   SELECT
   ========================================================= */
export function Select({ label, hint, children, className = '', ...props }) {
  return (
    <label className="block">
      {label && <span className="block text-xs font-medium text-slate-700 mb-1">{label}</span>}
      <select
        className={`w-full px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none bg-white transition focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 ${className}`}
        {...props}
      >
        {children}
      </select>
      {hint && <span className="block text-xs text-slate-500 mt-1">{hint}</span>}
    </label>
  );
}

/* =========================================================
   TOGGLE
   ========================================================= */
export function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`shrink-0 w-9 h-5 rounded-full transition relative mt-0.5 ${checked ? 'bg-emerald-600' : 'bg-slate-300'}`}
      >
        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`}/>
      </button>
      {(label || hint) && (
        <div className="flex-1 -mt-0.5">
          {label && <div className="text-sm text-slate-800">{label}</div>}
          {hint && <div className="text-xs text-slate-500 mt-0.5">{hint}</div>}
        </div>
      )}
    </label>
  );
}

/* =========================================================
   MODAL
   ========================================================= */
export function Modal({ open, onClose, title, subtitle, size = 'md', children, footer }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className={`w-full ${widths[size]} bg-white rounded-xl shadow-2xl max-h-[90vh] flex flex-col animate-slide-up`}>
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-100">
          <div className="flex-1 min-w-0">
            {title && <h2 className="text-base font-semibold text-slate-900 truncate">{title}</h2>}
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 -m-1 rounded-md hover:bg-slate-100 transition"
            aria-label="Fermer"
          >
            <X className="w-5 h-5"/>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 scrollbar-thin">
          {children}
        </div>
        {footer && <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 rounded-b-xl">{footer}</div>}
      </div>
    </div>
  );
}

/* =========================================================
   CARD
   ========================================================= */
export function Card({ children, className = '', ...props }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 ${className}`} {...props}>
      {children}
    </div>
  );
}

/* =========================================================
   STAT CARD
   ========================================================= */
export function StatCard({ icon: Icon, label, value, accent = 'slate', hint }) {
  const accents = {
    emerald: 'bg-emerald-100 text-emerald-700',
    sky:     'bg-sky-100 text-sky-700',
    amber:   'bg-amber-100 text-amber-700',
    rose:    'bg-rose-100 text-rose-700',
    violet:  'bg-violet-100 text-violet-700',
    slate:   'bg-slate-100 text-slate-700'
  };
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${accents[accent]}`}>
            <Icon className="w-5 h-5"/>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide truncate">{label}</div>
          <div className="text-xl font-semibold text-slate-900 mt-0.5">{value}</div>
          {hint && <div className="text-xs text-slate-500 mt-0.5">{hint}</div>}
        </div>
      </div>
    </Card>
  );
}

/* =========================================================
   EMPTY STATE
   ========================================================= */
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="text-center py-12 px-6">
      {Icon && (
        <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
          <Icon className="w-6 h-6"/>
        </div>
      )}
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {description && <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* =========================================================
   TAG / CHIP
   ========================================================= */
export function Tag({ children, color = 'slate', icon: Icon, className = '' }) {
  const colors = {
    slate:   'bg-slate-100 text-slate-700 border-slate-200',
    emerald: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    sky:     'bg-sky-100 text-sky-800 border-sky-200',
    amber:   'bg-amber-100 text-amber-800 border-amber-200',
    rose:    'bg-rose-100 text-rose-800 border-rose-200',
    violet:  'bg-violet-100 text-violet-800 border-violet-200',
    pink:    'bg-pink-100 text-pink-800 border-pink-200'
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-md border ${colors[color]} ${className}`}>
      {Icon && <Icon className="w-3 h-3"/>}
      {children}
    </span>
  );
}

/* =========================================================
   AVATAR (initials)
   ========================================================= */
export function Avatar({ name = '?', size = 'md', color }) {
  const sizes = {
    xs: 'w-5 h-5 text-[9px]',
    sm: 'w-6 h-6 text-[10px]',
    md: 'w-8 h-8 text-xs',
    lg: 'w-10 h-10 text-sm'
  };
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase() || '?';
  // Couleur générée à partir du nom (déterministe)
  const palette = ['bg-emerald-600', 'bg-sky-600', 'bg-amber-600', 'bg-rose-600', 'bg-violet-600', 'bg-pink-600', 'bg-teal-600'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const bg = color || palette[Math.abs(hash) % palette.length];
  return (
    <div className={`${sizes[size]} ${bg} rounded-full text-white flex items-center justify-center font-semibold flex-shrink-0`} title={name}>
      {initials}
    </div>
  );
}

/* =========================================================
   TOAST
   ========================================================= */
export function Toast({ message, type = 'success', onClose }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => onClose?.(), 2800);
    return () => clearTimeout(t);
  }, [message, onClose]);

  if (!message) return null;
  const colors = {
    success: 'bg-emerald-700',
    warning: 'bg-amber-600',
    error:   'bg-rose-600',
    info:    'bg-slate-700'
  };
  return (
    <div className="fixed bottom-6 right-6 z-50 animate-slide-up no-print">
      <div className={`px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 text-sm text-white ${colors[type]}`}>
        {type === 'success' && <Check className="w-4 h-4"/>}
        {message}
      </div>
    </div>
  );
}

/* =========================================================
   CONFIRM DIALOG
   ========================================================= */
export function ConfirmDialog({ open, title, description, confirmLabel = 'Confirmer', cancelLabel = 'Annuler', danger, onConfirm, onCancel }) {
  return (
    <Modal open={open} onClose={onCancel} title={title} size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Btn variant="secondary" onClick={onCancel}>{cancelLabel}</Btn>
          <Btn variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>{confirmLabel}</Btn>
        </div>
      }
    >
      {description && <p className="text-sm text-slate-700">{description}</p>}
    </Modal>
  );
}
