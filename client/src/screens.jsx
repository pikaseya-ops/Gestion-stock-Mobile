/**
 * Écrans du module Planning — version API (livraison 3).
 * Adapté du monolithe d'origine, en utilisant les primitives ./ui.jsx
 * et les hooks ./usePlanningData.js.
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  LayoutDashboard, Users, Calendar, Clock, Settings as SettingsIcon,
  AlertTriangle, BarChart3, Printer, Plus, Trash2, Edit2, X,
  ChevronLeft, ChevronRight, Check, Download, RefreshCw, Save,
  CalendarDays, Sliders, Grid3x3, Award, Pill, Package, GraduationCap,
  CheckCircle2, Info, Search, Sparkles, Cross, Moon, Sun, ArrowRight,
  Coffee, LogIn, LogOut, UserX, AlertCircle, TrendingUp
} from 'lucide-react';

import {
  Btn, Input, Select, Toggle, Modal, Card, StatCard, EmptyState, Tag,
  Textarea
} from './ui.jsx';
import {
  ROLES, CONTRACTS, LEAVE_TYPES, DAYS_FR, DAYS_SHORT,
  DEFAULT_OPENING, DEFAULT_SETTINGS
} from './constants.js';
import {
  uuid, timeToMin, minToTime, generateSlots,
  fmtDate, fmtDateFR, parseDate, addDays,
  getISOWeek, getMonday, countBusinessDays
} from './utils.js';
import { generateWeekPlanning } from './planning-algorithm.js';

function dedupeAlerts(alerts) {
  const seen = new Set();
  return alerts.filter(a => {
    const k = `${a.type}_${a.date||''}_${a.time||''}_${a.message}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function Dashboard({ staff, leaves, plannings, weekStart, setWeekStart, currentPlanning, onGenerate, onGoto, settings }) {
  const weekEnd = addDays(weekStart, 6);
  const weekNumber = getISOWeek(weekStart);
  const parity = weekNumber % 2 === 0 ? 'paire' : 'impaire';
  const weekKey = fmtDate(weekStart);

  const activeLeavesCount = useMemo(() => {
    return leaves.filter(l => {
      const now = fmtDate(new Date());
      return l.endDate >= now;
    }).length;
  }, [leaves]);

  const alerts = currentPlanning?.alerts || [];
  const criticalAlerts = alerts.filter(a => a.sev === 'error');
  const warnings = alerts.filter(a => a.sev === 'warning');

  const byRole = useMemo(() => {
    const r = { pharmacien:0, preparateur:0, logistique:0, alternant:0 };
    staff.forEach(s => { r[s.role] = (r[s.role]||0) + 1; });
    return r;
  }, [staff]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <header>
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Tableau de bord</h1>
            <p className="text-sm text-slate-500 mt-1">
              Semaine {weekNumber} ({parity}) · du {fmtDateFR(weekStart)} au {fmtDateFR(weekEnd)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setWeekStart(addDays(weekStart, -7))}
              className="p-2 rounded-md border border-slate-300 hover:bg-slate-50">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => setWeekStart(getMonday(new Date()))}
              className="px-3 py-2 text-sm rounded-md border border-slate-300 hover:bg-slate-50">
              Aujourd'hui
            </button>
            <button onClick={() => setWeekStart(addDays(weekStart, 7))}
              className="p-2 rounded-md border border-slate-300 hover:bg-slate-50">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Effectif total" value={staff.length} icon={Users}
          hint={`${byRole.pharmacien} pharmacien(s)`}/>
        <StatCard label="Congés en cours" value={activeLeavesCount} icon={CalendarDays}
          hint={leaves.length + ' au total'}/>
        <StatCard label="Alertes critiques" value={criticalAlerts.length}
          accent={criticalAlerts.length>0 ? 'text-rose-600' : 'text-emerald-700'}
          icon={AlertTriangle}
          hint={`${warnings.length} avertissement(s)`}/>
        <StatCard label="Heures planifiées" value={
          currentPlanning ? `${Object.values(currentPlanning.hoursByStaff).reduce((a,b)=>a+b,0).toFixed(0)}h` : '—'
        } icon={Clock} hint={currentPlanning ? `${currentPlanning.shifts.length} créneaux` : 'Non généré'}/>
      </div>

      {/* Alertes */}
      <Card className="overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <h2 className="font-semibold text-sm">Alertes de la semaine</h2>
          </div>
          {!currentPlanning && <Btn size="sm" icon={Sparkles} onClick={onGenerate}>Générer</Btn>}
        </div>
        <div className="divide-y divide-slate-100">
          {!currentPlanning ? (
            <EmptyState icon={Calendar} title="Aucun planning généré pour cette semaine"
              description="Lancez une génération pour détecter les alertes automatiquement."
              action={<Btn icon={Sparkles} onClick={onGenerate}>Générer le planning</Btn>} />
          ) : alerts.length === 0 ? (
            <div className="py-10 text-center text-sm text-emerald-700 flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Aucune alerte, planning conforme
            </div>
          ) : (
            <ul className="max-h-72 overflow-y-auto">
              {alerts.slice(0, 20).map((a, i) => (
                <li key={i} className="px-5 py-3 flex items-center gap-3 text-sm">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${a.sev==='error' ? 'bg-rose-500' : 'bg-amber-500'}`} />
                  <span className="flex-1">{a.message}</span>
                  <span className="text-[11px] text-slate-400 uppercase tracking-wider">{a.sev}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      {/* Vue hebdo rapide */}
      {currentPlanning && (
        <Card className="overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-semibold text-sm">Vue semaine</h2>
            <Btn size="sm" variant="ghost" onClick={() => onGoto('planning')}>
              Voir détail <ArrowRight className="w-3.5 h-3.5"/>
            </Btn>
          </div>
          <div className="grid grid-cols-7 gap-px bg-slate-200">
            {[1,2,3,4,5,6,0].map(dow => {
              const date = addDays(weekStart, dow === 0 ? 6 : dow - 1);
              const dateStr = fmtDate(date);
              const shifts = currentPlanning.shifts.filter(s => s.date === dateStr);
              const hours = settings.openingHours[dow];
              return (
                <div key={dow} className="bg-white p-3 min-h-[120px]">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{DAYS_SHORT[dow]}</div>
                  <div className="text-sm font-medium">{pad(date.getDate())}/{pad(date.getMonth()+1)}</div>
                  {!hours ? (
                    <div className="mt-2 text-[11px] text-slate-400">Fermé</div>
                  ) : (
                    <div className="mt-2 space-y-1">
                      <div className="text-[11px] text-slate-500">{hours.start}–{hours.end}</div>
                      <div className="flex items-center gap-1 text-[11px] text-slate-600">
                        <Users className="w-3 h-3" />
                        {shifts.length}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Équipe */}
      <Card>
        <div className="px-5 py-3.5 border-b border-slate-200">
          <h2 className="font-semibold text-sm">Composition de l'équipe</h2>
        </div>
        <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(ROLES).map(([key, role]) => {
            const count = byRole[key];
            const Icon = role.icon;
            return (
              <div key={key} className={`p-4 rounded-lg ${role.bg} ${role.border} border`}>
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${role.text}`} />
                  <span className={`text-xs font-medium ${role.text}`}>{role.label}</span>
                </div>
                <div className={`text-2xl font-semibold mt-2 ${role.text}`}>{count}</div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

export function StaffScreen({ staff, setStaff, onEdit, onShowConstraints }) {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const filtered = staff.filter(s => {
    const match = s.name.toLowerCase().includes(search.toLowerCase());
    const roleOk = roleFilter === 'all' || s.role === roleFilter;
    return match && roleOk;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Personnel</h1>
          <p className="text-sm text-slate-500 mt-1">{staff.length} personne(s)</p>
        </div>
        <Btn icon={Plus} onClick={() => onEdit({})}>Ajouter une personne</Btn>
      </header>

      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text" placeholder="Rechercher…"
              value={search} onChange={e=>setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
            />
          </div>
          <select value={roleFilter} onChange={e=>setRoleFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-md focus:outline-none">
            <option value="all">Tous les rôles</option>
            {Object.entries(ROLES).map(([k,r]) => <option key={k} value={k}>{r.label}</option>)}
          </select>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={Users}
            title={staff.length===0 ? 'Aucune personne enregistrée' : 'Aucun résultat'}
            description={staff.length===0 ? 'Commencez par ajouter les membres de votre équipe.' : 'Ajustez vos filtres.'}
            action={staff.length===0 && <Btn icon={Plus} onClick={()=>onEdit({})}>Ajouter</Btn>}
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="text-left px-5 py-2.5 font-medium">Nom</th>
                  <th className="text-left px-4 py-2.5 font-medium">Rôle</th>
                  <th className="text-left px-4 py-2.5 font-medium">Contrat</th>
                  <th className="text-center px-4 py-2.5 font-medium">H paire</th>
                  <th className="text-center px-4 py-2.5 font-medium">H impaire</th>
                  <th className="text-center px-4 py-2.5 font-medium">Samedi</th>
                  <th className="text-right px-5 py-2.5 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(s => {
                  const role = ROLES[s.role];
                  const Icon = role.icon;
                  return (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-full ${role.bg} ${role.border} border flex items-center justify-center`}>
                            <Icon className={`w-4 h-4 ${role.text}`} />
                          </div>
                          <div>
                            <div className="font-medium">{s.name}</div>
                            {s.halfDayOnly && <div className="text-[11px] text-slate-500">Demi-journée uniquement</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3"><Tag color={s.role==='pharmacien'?'emerald':s.role==='preparateur'?'blue':s.role==='logistique'?'amber':'violet'}>{role.label}</Tag></td>
                      <td className="px-4 py-3 text-slate-600">{CONTRACTS[s.contract]?.label || '—'}</td>
                      <td className="px-4 py-3 text-center">{s.targetHoursEven ?? '—'}h</td>
                      <td className="px-4 py-3 text-center">{s.targetHoursOdd ?? '—'}h</td>
                      <td className="px-4 py-3 text-center">
                        {s.saturdayTeam ? <Tag color={s.saturdayTeam===1?'emerald':'blue'}>Éq. {s.saturdayTeam}</Tag> : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button onClick={() => onShowConstraints(s)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded">
                          <Sliders className="w-3.5 h-3.5"/> Contraintes
                        </button>
                        <button onClick={() => onEdit(s)}
                          className="ml-1 inline-flex items-center gap-1 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded">
                          <Edit2 className="w-3.5 h-3.5"/> Éditer
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

export function StaffFormModal({ staff, onClose, onSave, onDelete }) {
  const [form, setForm] = useState({
    name: '', role: 'preparateur', contract: 'temps_plein',
    targetHoursEven: 35, targetHoursOdd: 35,
    targetDaysEven: 5, targetDaysOdd: 5,
    maxDailyHours: 10, maxConsecutiveDays: 6,
    canOpen: true, canClose: true,
    saturdayTeam: null, halfDayOnly: false,
    ...staff
  });

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = () => {
    if (!form.name?.trim()) { alert('Nom requis'); return; }
    onSave(form);
  };

  return (
    <Modal open onClose={onClose} title={form.id ? `Éditer ${form.name}` : 'Nouvelle personne'} size="lg">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Nom complet" value={form.name||''} onChange={e=>update('name', e.target.value)} placeholder="Marie Dupont" />
          <Select label="Rôle" value={form.role} onChange={e=>update('role', e.target.value)}>
            {Object.entries(ROLES).map(([k,r]) => <option key={k} value={k}>{r.label}</option>)}
          </Select>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Select label="Contrat" value={form.contract} onChange={e=>{
            const c = e.target.value;
            update('contract', c);
            if (CONTRACTS[c]) {
              update('targetHoursEven', CONTRACTS[c].defaultHours);
              update('targetHoursOdd', CONTRACTS[c].defaultHours);
            }
          }}>
            {Object.entries(CONTRACTS).map(([k,c]) => <option key={k} value={k}>{c.label}</option>)}
          </Select>
          <Select label="Équipe samedi" value={form.saturdayTeam||''} onChange={e=>update('saturdayTeam', e.target.value ? Number(e.target.value) : null)}>
            <option value="">Non applicable</option>
            <option value="1">Équipe 1 (sem. paire)</option>
            <option value="2">Équipe 2 (sem. impaire)</option>
          </Select>
          <Input type="number" label="Amplitude max / jour (h)" value={form.maxDailyHours} onChange={e=>update('maxDailyHours', Number(e.target.value))} min="1" max="12" />
        </div>

        <div className="border-t border-slate-100 pt-5">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Heures & jours cibles</div>
          <div className="grid grid-cols-2 gap-5">
            <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4 space-y-3">
              <div className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">Semaine paire</div>
              <div className="grid grid-cols-2 gap-3">
                <Input type="number" label="Heures" value={form.targetHoursEven} onChange={e=>update('targetHoursEven', Number(e.target.value))} />
                <Input type="number" label="Jours" value={form.targetDaysEven} onChange={e=>update('targetDaysEven', Number(e.target.value))} min="0" max="6" />
              </div>
            </div>
            <div className="bg-sky-50 border border-sky-100 rounded-lg p-4 space-y-3">
              <div className="text-xs font-semibold text-sky-800 uppercase tracking-wider">Semaine impaire</div>
              <div className="grid grid-cols-2 gap-3">
                <Input type="number" label="Heures" value={form.targetHoursOdd} onChange={e=>update('targetHoursOdd', Number(e.target.value))} />
                <Input type="number" label="Jours" value={form.targetDaysOdd} onChange={e=>update('targetDaysOdd', Number(e.target.value))} min="0" max="6" />
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-5 grid grid-cols-2 gap-x-6">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Autorisations</div>
            <Toggle label="Peut ouvrir" checked={form.canOpen!==false} onChange={v=>update('canOpen', v)} />
            <Toggle label="Peut fermer" checked={form.canClose!==false} onChange={v=>update('canClose', v)} />
            <Toggle label="Demi-journée uniquement" checked={!!form.halfDayOnly} onChange={v=>update('halfDayOnly', v)} />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Préférences</div>
            <Toggle label="Préfère matin" checked={!!form.preferMorning} onChange={v=>update('preferMorning', v && !form.preferAfternoon)} />
            <Toggle label="Préfère après-midi" checked={!!form.preferAfternoon} onChange={v=>update('preferAfternoon', v && !form.preferMorning)} />
            <Toggle label="Préfère ouverture" checked={!!form.preferOpen} onChange={v=>update('preferOpen', v && !form.preferClose)} />
            <Toggle label="Préfère fermeture" checked={!!form.preferClose} onChange={v=>update('preferClose', v && !form.preferOpen)} />
          </div>
        </div>

        <Input type="number" label="Jours consécutifs max" value={form.maxConsecutiveDays} onChange={e=>update('maxConsecutiveDays', Number(e.target.value))} min="1" max="7" />

        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <div>
            {form.id && <Btn variant="danger" icon={Trash2} onClick={() => { if (confirm('Supprimer ?')) onDelete(form.id); }}>Supprimer</Btn>}
          </div>
          <div className="flex gap-2">
            <Btn variant="secondary" onClick={onClose}>Annuler</Btn>
            <Btn icon={Save} onClick={submit}>Enregistrer</Btn>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export function ConstraintsScreen({ staff, setStaff, onEdit }) {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Contraintes individuelles</h1>
        <p className="text-sm text-slate-500 mt-1">Jours OFF, disponibilités, incompatibilités</p>
      </header>

      {staff.length === 0 ? (
        <Card><EmptyState icon={Sliders} title="Ajoutez d'abord du personnel" /></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {staff.map(s => {
            const role = ROLES[s.role];
            const Icon = role.icon;
            const hasVarOff = (s.variableOffDays||[]).length;
            const hasFixOff = (s.fixedOffDays||[]).length;
            const hasAvail = Object.keys(s.availability||{}).length;
            const hasIncomp = (s.incompatibilities||[]).length;
            return (
              <Card key={s.id} className="p-4 hover:shadow-sm transition-shadow cursor-pointer" >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-full ${role.bg} ${role.border} border flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`w-5 h-5 ${role.text}`} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{s.name}</div>
                      <div className="text-xs text-slate-500">{role.label}</div>
                    </div>
                  </div>
                  <Btn size="sm" variant="ghost" icon={Edit2} onClick={()=>onEdit(s)}>Modifier</Btn>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {hasFixOff > 0 && <Tag color="rose">{hasFixOff} jour(s) OFF fixe</Tag>}
                  {hasVarOff > 0 && <Tag color="amber">{hasVarOff} OFF variable(s)</Tag>}
                  {hasAvail > 0 && <Tag color="blue">{hasAvail} dispo(s) personnalisées</Tag>}
                  {hasIncomp > 0 && <Tag color="violet">{hasIncomp} incompatibilité(s)</Tag>}
                  {s.preferMorning && <Tag>Préf. matin</Tag>}
                  {s.preferAfternoon && <Tag>Préf. après-midi</Tag>}
                  {s.preferOpen && <Tag>Préf. ouverture</Tag>}
                  {s.preferClose && <Tag>Préf. fermeture</Tag>}
                  {s.halfDayOnly && <Tag color="amber">Demi-journée</Tag>}
                  {!hasFixOff && !hasVarOff && !hasAvail && !hasIncomp && !s.preferMorning && !s.preferAfternoon && !s.preferOpen && !s.preferClose && !s.halfDayOnly && (
                    <span className="text-xs text-slate-400">Aucune contrainte spécifique</span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ConstraintsFormModal({ person, allStaff, onClose, onSave }) {
  const [form, setForm] = useState({
    fixedOffDays: [],
    variableOffDays: [],
    availability: {},
    incompatibilities: [],
    ...person
  });
  const [newVarDate, setNewVarDate] = useState('');

  const toggleFixed = (dow) => {
    const cur = new Set(form.fixedOffDays || []);
    if (cur.has(dow)) cur.delete(dow); else cur.add(dow);
    setForm(f => ({ ...f, fixedOffDays: Array.from(cur).sort() }));
  };

  const addVarOff = () => {
    if (!newVarDate) return;
    if ((form.variableOffDays||[]).includes(newVarDate)) return;
    setForm(f => ({ ...f, variableOffDays: [...(f.variableOffDays||[]), newVarDate].sort() }));
    setNewVarDate('');
  };

  const removeVarOff = (d) => setForm(f => ({ ...f, variableOffDays: f.variableOffDays.filter(x=>x!==d) }));

  const setDayAvail = (dow, field, value) => {
    setForm(f => ({
      ...f,
      availability: {
        ...(f.availability||{}),
        [dow]: { ...(f.availability?.[dow]||{}), [field]: value }
      }
    }));
  };

  const clearDayAvail = (dow) => {
    setForm(f => {
      const a = { ...(f.availability||{}) };
      delete a[dow];
      return { ...f, availability: a };
    });
  };

  const toggleIncomp = (id) => {
    const cur = new Set(form.incompatibilities || []);
    if (cur.has(id)) cur.delete(id); else cur.add(id);
    setForm(f => ({ ...f, incompatibilities: Array.from(cur) }));
  };

  return (
    <Modal open onClose={onClose} title={`Contraintes — ${person.name}`} size="lg">
      <div className="space-y-6">
        {/* Jours OFF fixes */}
        <section>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Jours OFF fixes (hebdomadaire)</div>
          <div className="grid grid-cols-7 gap-2">
            {[1,2,3,4,5,6,0].map(dow => {
              const off = (form.fixedOffDays||[]).includes(dow);
              return (
                <button key={dow} onClick={() => toggleFixed(dow)}
                  className={`py-2.5 rounded-md text-xs font-medium border transition-colors ${
                    off ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}>
                  {DAYS_SHORT[dow]}
                </button>
              );
            })}
          </div>
        </section>

        {/* OFF variables */}
        <section>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Jours OFF variables (dates ponctuelles)</div>
          <div className="flex items-center gap-2">
            <input type="date" value={newVarDate} onChange={e=>setNewVarDate(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-300 rounded-md" />
            <Btn size="sm" icon={Plus} onClick={addVarOff}>Ajouter</Btn>
          </div>
          {(form.variableOffDays||[]).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {form.variableOffDays.map(d => (
                <span key={d} className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded">
                  {fmtDateFR(parseDate(d))}
                  <button onClick={() => removeVarOff(d)} className="hover:text-amber-900"><X className="w-3 h-3"/></button>
                </span>
              ))}
            </div>
          )}
        </section>

        {/* Disponibilités variables */}
        <section>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Disponibilités personnalisées par jour</div>
          <div className="space-y-2">
            {[1,2,3,4,5,6,0].map(dow => {
              const avail = form.availability?.[dow];
              return (
                <div key={dow} className="flex items-center gap-3 py-1.5 border-b border-slate-100 last:border-0">
                  <div className="w-14 text-sm font-medium text-slate-700">{DAYS_SHORT[dow]}</div>
                  <input type="time" value={avail?.start||''} onChange={e=>setDayAvail(dow, 'start', e.target.value)}
                    className="px-2 py-1 text-sm border border-slate-300 rounded" step="1800"/>
                  <span className="text-slate-400">–</span>
                  <input type="time" value={avail?.end||''} onChange={e=>setDayAvail(dow, 'end', e.target.value)}
                    className="px-2 py-1 text-sm border border-slate-300 rounded" step="1800"/>
                  {avail && (
                    <button onClick={() => clearDayAvail(dow)} className="ml-auto text-xs text-slate-400 hover:text-rose-600">
                      Effacer
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-slate-500 mt-2">Laissez vide pour utiliser les horaires d'ouverture par défaut.</p>
        </section>

        {/* Incompatibilités */}
        <section>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Incompatibilités (ne pas planifier ensemble)</div>
          {allStaff.filter(s => s.id !== person.id).length === 0 ? (
            <p className="text-xs text-slate-500">Aucune autre personne enregistrée.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
              {allStaff.filter(s => s.id !== person.id).map(s => {
                const sel = (form.incompatibilities||[]).includes(s.id);
                return (
                  <label key={s.id} className={`flex items-center gap-2 p-2 rounded border cursor-pointer ${sel?'bg-violet-50 border-violet-200':'bg-white border-slate-200'}`}>
                    <input type="checkbox" checked={sel} onChange={()=>toggleIncomp(s.id)} className="accent-violet-600"/>
                    <span className="text-sm">{s.name}</span>
                  </label>
                );
              })}
            </div>
          )}
        </section>

        <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
          <Btn variant="secondary" onClick={onClose}>Annuler</Btn>
          <Btn icon={Save} onClick={()=>onSave(form)}>Enregistrer</Btn>
        </div>
      </div>
    </Modal>
  );
}

export function LeavesScreen({ staff, leaves, setLeaves, settings, onEdit, showToast }) {
  const [filter, setFilter] = useState('all');

  const now = fmtDate(new Date());
  const filtered = leaves
    .filter(l => {
      if (filter === 'current') return l.startDate <= now && l.endDate >= now;
      if (filter === 'upcoming') return l.startDate > now;
      if (filter === 'past') return l.endDate < now;
      return true;
    })
    .sort((a,b) => a.startDate.localeCompare(b.startDate));

  const counters = useMemo(() => {
    const c = {};
    staff.forEach(s => { c[s.id] = { cp: 0, rtt: 0, maladie: 0, total: 0 }; });
    leaves.forEach(l => {
      if (!c[l.staffId]) return;
      const days = countBusinessDays(parseDate(l.startDate), parseDate(l.endDate));
      c[l.staffId][l.type] = (c[l.staffId][l.type] || 0) + days;
      c[l.staffId].total += days;
    });
    return c;
  }, [leaves, staff]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Congés</h1>
          <p className="text-sm text-slate-500 mt-1">{leaves.length} période(s) enregistrée(s)</p>
        </div>
        <Btn icon={Plus} onClick={() => onEdit({})} disabled={staff.length===0}>Ajouter un congé</Btn>
      </header>

      {/* Compteurs */}
      {staff.length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-semibold text-sm">Décompte annuel</h2>
            <span className="text-xs text-slate-500">Quota CP : {settings.cpPerYear} jours / an</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="text-left px-5 py-2.5 font-medium">Personne</th>
                  <th className="text-center px-3 py-2.5 font-medium">CP utilisés</th>
                  <th className="text-center px-3 py-2.5 font-medium">CP restants</th>
                  <th className="text-center px-3 py-2.5 font-medium">RTT</th>
                  <th className="text-center px-3 py-2.5 font-medium">Maladie</th>
                  <th className="text-center px-3 py-2.5 font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staff.map(s => {
                  const c = counters[s.id] || {};
                  const cpRem = settings.cpPerYear - (c.cp || 0);
                  return (
                    <tr key={s.id}>
                      <td className="px-5 py-2.5 font-medium">{s.name}</td>
                      <td className="px-3 py-2.5 text-center">{c.cp || 0} j</td>
                      <td className={`px-3 py-2.5 text-center font-medium ${cpRem < 5 ? 'text-amber-600' : 'text-emerald-700'}`}>{cpRem} j</td>
                      <td className="px-3 py-2.5 text-center text-slate-600">{c.rtt || 0} j</td>
                      <td className="px-3 py-2.5 text-center text-slate-600">{c.maladie || 0} j</td>
                      <td className="px-3 py-2.5 text-center font-medium">{c.total || 0} j</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Filtres */}
      <div className="flex items-center gap-2">
        {[
          {k:'all', l:'Tous'},
          {k:'current', l:'En cours'},
          {k:'upcoming', l:'À venir'},
          {k:'past', l:'Passés'}
        ].map(f => (
          <button key={f.k} onClick={()=>setFilter(f.k)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium ${
              filter===f.k ? 'bg-emerald-700 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}>{f.l}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card><EmptyState icon={CalendarDays} title="Aucun congé" /></Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-slate-100">
            {filtered.map(l => {
              const s = staff.find(x => x.id === l.staffId);
              if (!s) return null;
              const role = ROLES[s.role];
              const days = countBusinessDays(parseDate(l.startDate), parseDate(l.endDate));
              const isPast = l.endDate < now;
              const isCurrent = l.startDate <= now && l.endDate >= now;
              return (
                <li key={l.id} className={`px-5 py-3.5 flex items-center gap-4 hover:bg-slate-50 ${isPast?'opacity-60':''}`}>
                  <div className={`w-9 h-9 rounded-full ${role.bg} ${role.border} border flex items-center justify-center flex-shrink-0`}>
                    <role.icon className={`w-4 h-4 ${role.text}`}/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-medium">{s.name}</div>
                      <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded border ${LEAVE_TYPES[l.type]?.color}`}>
                        {LEAVE_TYPES[l.type]?.label}
                      </span>
                      {isCurrent && <Tag color="emerald">En cours</Tag>}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Du {fmtDateFR(parseDate(l.startDate))} au {fmtDateFR(parseDate(l.endDate))} · {days} jour(s) ouvré(s)
                    </div>
                  </div>
                  <Btn size="sm" variant="ghost" icon={Edit2} onClick={()=>onEdit(l)}>Modifier</Btn>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}

export function LeaveFormModal({ leave, staff, onClose, onSave, onDelete }) {
  const [form, setForm] = useState({
    staffId: staff[0]?.id || '', type: 'cp',
    startDate: fmtDate(new Date()),
    endDate: fmtDate(new Date()),
    ...leave
  });
  const days = form.startDate && form.endDate && form.startDate <= form.endDate
    ? countBusinessDays(parseDate(form.startDate), parseDate(form.endDate))
    : 0;

  const submit = () => {
    if (!form.staffId) { alert('Sélectionnez une personne'); return; }
    if (form.endDate < form.startDate) { alert('Date de fin antérieure'); return; }
    onSave(form);
  };

  return (
    <Modal open onClose={onClose} title={form.id ? 'Modifier le congé' : 'Nouveau congé'} size="md">
      <div className="space-y-4">
        <Select label="Personne" value={form.staffId} onChange={e=>setForm(f=>({...f, staffId:e.target.value}))}>
          {staff.map(s => <option key={s.id} value={s.id}>{s.name} — {ROLES[s.role].label}</option>)}
        </Select>
        <Select label="Type de congé" value={form.type} onChange={e=>setForm(f=>({...f, type:e.target.value}))}>
          {Object.entries(LEAVE_TYPES).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
        </Select>
        <div className="grid grid-cols-2 gap-3">
          <Input type="date" label="Date de début" value={form.startDate} onChange={e=>setForm(f=>({...f, startDate:e.target.value}))} />
          <Input type="date" label="Date de fin" value={form.endDate} onChange={e=>setForm(f=>({...f, endDate:e.target.value}))} />
        </div>
        <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-md text-sm text-emerald-800">
          <Info className="w-4 h-4 inline mr-1.5 -mt-0.5" />
          Durée : <strong>{days}</strong> jour(s) ouvré(s)
        </div>
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <div>
            {form.id && <Btn variant="danger" icon={Trash2} onClick={()=>{ if(confirm('Supprimer ?')) onDelete(form.id); }}>Supprimer</Btn>}
          </div>
          <div className="flex gap-2">
            <Btn variant="secondary" onClick={onClose}>Annuler</Btn>
            <Btn icon={Save} onClick={submit}>Enregistrer</Btn>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export function MinimumsScreen({ settings, coverage, setCoverage, showToast }) {
  const [selectedDow, setSelectedDow] = useState(1);
  const hours = settings.openingHours[selectedDow];
  const slots = hours ? generateSlots(hours.start, hours.end) : [];

  const getVal = (slot, field) => {
    const v = coverage[selectedDow]?.[slot]?.[field];
    if (v !== undefined) return v;
    const defaults = { minTotal: settings.defaultMinTotal, minPharmacist: settings.defaultMinPharmacist, minCounter: settings.defaultMinCounter };
    return defaults[field];
  };

  const setVal = (slot, field, value) => {
    setCoverage(prev => ({
      ...prev,
      [selectedDow]: {
        ...(prev[selectedDow]||{}),
        [slot]: { ...(prev[selectedDow]?.[slot]||{}), [field]: value }
      }
    }));
  };

  const resetDay = () => {
    setCoverage(prev => {
      const n = {...prev}; delete n[selectedDow]; return n;
    });
    showToast('Minima du jour réinitialisés');
  };

  const applyToAll = () => {
    if (!hours) return;
    // Copier les valeurs configurées de ce jour vers tous les autres jours ouverts
    const thisDay = coverage[selectedDow] || {};
    const newCov = { ...coverage };
    [0,1,2,3,4,5,6].forEach(d => {
      if (!settings.openingHours[d]) return;
      const daySlots = generateSlots(settings.openingHours[d].start, settings.openingHours[d].end);
      newCov[d] = {};
      daySlots.forEach(slot => {
        // appliquer si le slot existe dans le jour source
        if (thisDay[slot]) newCov[d][slot] = { ...thisDay[slot] };
      });
    });
    setCoverage(newCov);
    showToast('Minima appliqués à tous les jours ouverts');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Minima par tranche de 30 min</h1>
        <p className="text-sm text-slate-500 mt-1">Effectif minimum requis à chaque créneau</p>
      </header>

      <div className="flex items-center gap-2 flex-wrap">
        {[1,2,3,4,5,6,0].map(dow => {
          const open = !!settings.openingHours[dow];
          return (
            <button key={dow} onClick={() => open && setSelectedDow(dow)}
              disabled={!open}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                !open ? 'bg-slate-100 text-slate-400 cursor-not-allowed' :
                selectedDow === dow ? 'bg-emerald-700 text-white' :
                'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}>
              {DAYS_FR[dow]}
              {!open && ' (fermé)'}
            </button>
          );
        })}
      </div>

      {!hours ? (
        <Card><EmptyState icon={Grid3x3} title="Pharmacie fermée ce jour-là" /></Card>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <Btn size="sm" variant="secondary" onClick={applyToAll}>Appliquer à tous les jours</Btn>
            <Btn size="sm" variant="ghost" onClick={resetDay}>Réinitialiser ce jour</Btn>
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[11px] tracking-wider">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium">Créneau</th>
                    <th className="text-center px-3 py-2.5 font-medium">Effectif total</th>
                    <th className="text-center px-3 py-2.5 font-medium">Pharmaciens</th>
                    <th className="text-center px-3 py-2.5 font-medium">Comptoir (hors logi)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {slots.map(slot => {
                    const slotEnd = minToTime(timeToMin(slot) + 30);
                    return (
                      <tr key={slot} className="hover:bg-slate-50">
                        <td className="px-4 py-2 font-medium">{slot} – {slotEnd}</td>
                        <td className="px-3 py-2 text-center">
                          <input type="number" min="0" max="20" value={getVal(slot, 'minTotal')}
                            onChange={e=>setVal(slot, 'minTotal', Number(e.target.value))}
                            className="w-16 px-2 py-1 text-center border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500"/>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input type="number" min="0" max="10" value={getVal(slot, 'minPharmacist')}
                            onChange={e=>setVal(slot, 'minPharmacist', Number(e.target.value))}
                            className="w-16 px-2 py-1 text-center border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500"/>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input type="number" min="0" max="20" value={getVal(slot, 'minCounter')}
                            onChange={e=>setVal(slot, 'minCounter', Number(e.target.value))}
                            className="w-16 px-2 py-1 text-center border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500"/>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
          <p className="text-xs text-slate-500">
            <Info className="w-3.5 h-3.5 inline mr-1 -mt-0.5"/>
            Les valeurs par défaut ({settings.defaultMinTotal} total / {settings.defaultMinPharmacist} pharm. / {settings.defaultMinCounter} comptoir) sont appliquées si vous ne modifiez pas un créneau.
          </p>
        </>
      )}
    </div>
  );
}

export function PlanningScreen({ staff, leaves, settings, weekStart, setWeekStart, planning, onGenerate, onClear, setPlannings, weekKey, showToast }) {
  const weekNumber = getISOWeek(weekStart);
  const parity = weekNumber % 2 === 0 ? 'paire' : 'impaire';

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Planning hebdomadaire</h1>
          <p className="text-sm text-slate-500 mt-1">
            Semaine {weekNumber} ({parity}) — {fmtDateFR(weekStart)} au {fmtDateFR(addDays(weekStart,6))}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setWeekStart(addDays(weekStart, -7))} className="p-2 rounded-md border border-slate-300 hover:bg-slate-50"><ChevronLeft className="w-4 h-4"/></button>
          <button onClick={() => setWeekStart(getMonday(new Date()))} className="px-3 py-2 text-sm rounded-md border border-slate-300 hover:bg-slate-50">Cette semaine</button>
          <button onClick={() => setWeekStart(addDays(weekStart, 7))} className="p-2 rounded-md border border-slate-300 hover:bg-slate-50"><ChevronRight className="w-4 h-4"/></button>
          <div className="w-px h-6 bg-slate-300 mx-1"/>
          {planning ? (
            <>
              <Btn variant="secondary" icon={RefreshCw} onClick={onGenerate}>Regénérer</Btn>
              <Btn variant="ghost" icon={Trash2} onClick={() => { if (confirm('Supprimer ce planning ?')) onClear(); }}>Effacer</Btn>
            </>
          ) : (
            <Btn icon={Sparkles} onClick={onGenerate}>Générer le planning</Btn>
          )}
        </div>
      </header>

      {!planning ? (
        <Card>
          <EmptyState
            icon={Calendar}
            title="Pas encore de planning pour cette semaine"
            description="Lancez la génération automatique. Vos contraintes, congés et minima seront appliqués."
            action={<Btn icon={Sparkles} onClick={onGenerate}>Générer maintenant</Btn>}
          />
        </Card>
      ) : (
        <>
          {planning.alerts.length > 0 && (
            <Card className="overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600"/>
                <h2 className="font-semibold text-sm">{planning.alerts.length} alerte(s)</h2>
              </div>
              <ul className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                {planning.alerts.slice(0,10).map((a,i)=>(
                  <li key={i} className="px-5 py-2 flex items-center gap-3 text-sm">
                    <span className={`w-1.5 h-1.5 rounded-full ${a.sev==='error'?'bg-rose-500':'bg-amber-500'}`}/>
                    <span className="flex-1">{a.message}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <PlanningGrid planning={planning} staff={staff} settings={settings} weekStart={weekStart} />
        </>
      )}
    </div>
  );
}

/* Grille de planning: colonnes = jours, lignes = créneaux 30min */

function PlanningGrid({ planning, staff, settings, weekStart }) {
  // Trouver amplitude globale
  const allOpen = [1,2,3,4,5,6].map(d => settings.openingHours[d]).filter(Boolean);
  if (allOpen.length === 0) return null;
  const minStart = allOpen.reduce((m, h) => timeToMin(h.start) < m ? timeToMin(h.start) : m, 24*60);
  const maxEnd = allOpen.reduce((m, h) => timeToMin(h.end) > m ? timeToMin(h.end) : m, 0);
  const globalSlots = generateSlots(minToTime(minStart), minToTime(maxEnd));

  const byDate = {};
  planning.shifts.forEach(sh => {
    if (!byDate[sh.date]) byDate[sh.date] = [];
    byDate[sh.date].push(sh);
  });

  return (
    <Card className="overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
        <h2 className="font-semibold text-sm">Grille de planning</h2>
        <div className="flex items-center gap-3 text-[11px]">
          {Object.entries(ROLES).map(([k,r]) => (
            <div key={k} className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-sm ${r.accent}`}/>
              {r.label}
            </div>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto scrollbar-thin">
        <div className="min-w-[900px] grid" style={{gridTemplateColumns:'80px repeat(7, 1fr)'}}>
          {/* Header */}
          <div className="bg-slate-50 border-b border-r border-slate-200 p-2 text-[11px] font-medium text-slate-500 uppercase">Heure</div>
          {[1,2,3,4,5,6,0].map(dow => {
            const date = addDays(weekStart, dow === 0 ? 6 : dow - 1);
            const hours = settings.openingHours[dow];
            return (
              <div key={dow} className="bg-slate-50 border-b border-r border-slate-200 p-2 text-center">
                <div className="text-[11px] font-semibold text-slate-700 uppercase">{DAYS_SHORT[dow]}</div>
                <div className="text-xs text-slate-500">{pad(date.getDate())}/{pad(date.getMonth()+1)}</div>
                {hours && <div className="text-[10px] text-slate-400">{hours.start}–{hours.end}</div>}
              </div>
            );
          })}

          {/* Slots */}
          {globalSlots.map((slot, rowIdx) => (
            <React.Fragment key={slot}>
              <div className={`border-r border-b border-slate-100 p-1 text-[10px] text-slate-500 text-right pr-2 ${slot.endsWith(':00') ? 'font-semibold text-slate-700 bg-slate-50/50' : ''}`}>
                {slot.endsWith(':00') || slot.endsWith(':30') ? slot : ''}
              </div>
              {[1,2,3,4,5,6,0].map(dow => {
                const date = addDays(weekStart, dow === 0 ? 6 : dow - 1);
                const dateStr = fmtDate(date);
                const hours = settings.openingHours[dow];
                const slotM = timeToMin(slot);
                const isOpen = hours && slotM >= timeToMin(hours.start) && slotM < timeToMin(hours.end);
                const shiftsHere = (byDate[dateStr] || []).filter(sh =>
                  timeToMin(sh.start) <= slotM && timeToMin(sh.end) > slotM
                );
                return (
                  <div key={dow} className={`border-r border-b border-slate-100 p-1 ${!hours ? 'bg-slate-50' : !isOpen ? 'bg-slate-50/50' : 'bg-white'} min-h-[28px]`}>
                    {isOpen && (
                      <div className="flex flex-wrap gap-0.5">
                        {shiftsHere.map((sh, i) => {
                          const person = staff.find(s => s.id === sh.staffId);
                          if (!person) return null;
                          const role = ROLES[person.role];
                          // Afficher le nom uniquement au 1er créneau du shift pour éviter répétition
                          const isStart = sh.start === slot;
                          return (
                            <div key={i}
                              title={`${person.name} · ${sh.start}–${sh.end}`}
                              className={`${role.accent} text-white text-[10px] font-medium px-1.5 py-0.5 rounded leading-tight truncate min-w-0`}
                              style={{maxWidth:'100%'}}>
                              {isStart ? person.name.split(' ')[0] : '·'}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    </Card>
  );
}

export function EquityScreen({ staff, plannings, settings }) {
  // Agrégation sur tous les plannings générés
  const totals = useMemo(() => {
    const t = {};
    staff.forEach(s => {
      t[s.id] = { hours: 0, days: 0, saturdays: 0, opens: 0, closes: 0, weeks: 0 };
    });
    Object.values(plannings).forEach(p => {
      staff.forEach(s => {
        const h = p.hoursByStaff?.[s.id] || 0;
        if (h > 0) t[s.id].weeks += 1;
        t[s.id].hours += h;
        t[s.id].days += p.daysByStaff?.[s.id] || 0;
        t[s.id].saturdays += p.satByStaff?.[s.id] || 0;
        t[s.id].opens += p.openByStaff?.[s.id] || 0;
        t[s.id].closes += p.closeByStaff?.[s.id] || 0;
      });
    });
    return t;
  }, [staff, plannings]);

  const maxH = Math.max(1, ...Object.values(totals).map(t => t.hours));
  const maxSat = Math.max(1, ...Object.values(totals).map(t => t.saturdays));

  const planningsCount = Object.keys(plannings).length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Suivi de l'équité</h1>
        <p className="text-sm text-slate-500 mt-1">
          Répartition sur {planningsCount} planning(s) généré(s)
        </p>
      </header>

      {planningsCount === 0 ? (
        <Card><EmptyState icon={BarChart3} title="Aucune donnée disponible" description="Générez au moins un planning pour voir la répartition." /></Card>
      ) : (
        <>
          {/* Charge de travail */}
          <Card className="overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200">
              <h2 className="font-semibold text-sm">Total heures travaillées</h2>
            </div>
            <div className="p-5 space-y-3">
              {staff.map(s => {
                const t = totals[s.id];
                const pct = (t.hours / maxH) * 100;
                const role = ROLES[s.role];
                return (
                  <div key={s.id} className="flex items-center gap-3">
                    <div className="w-40 text-sm font-medium truncate">{s.name}</div>
                    <div className="flex-1 h-7 bg-slate-100 rounded overflow-hidden relative">
                      <div className={`h-full ${role.accent} transition-all`} style={{width:`${pct}%`}}/>
                      <div className="absolute inset-0 flex items-center px-2 text-xs font-medium">
                        <span className={pct>30 ? 'text-white' : 'text-slate-700'}>{t.hours.toFixed(1)}h</span>
                      </div>
                    </div>
                    <div className="w-20 text-right text-xs text-slate-500">{t.days} j / {t.weeks} sem.</div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Samedi / ouvertures / fermetures */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <EquityCard title="Samedis travaillés" icon={Calendar} data={staff.map(s => ({ name:s.name, value: totals[s.id].saturdays, role: s.role }))} color="emerald"/>
            <EquityCard title="Ouvertures" icon={LogIn} data={staff.map(s => ({ name:s.name, value: totals[s.id].opens, role: s.role }))} color="sky"/>
            <EquityCard title="Fermetures" icon={LogOut} data={staff.map(s => ({ name:s.name, value: totals[s.id].closes, role: s.role }))} color="violet"/>
          </div>

          {/* Table récap */}
          <Card className="overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200">
              <h2 className="font-semibold text-sm">Détail par personne</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[11px] tracking-wider">
                  <tr>
                    <th className="text-left px-5 py-2.5 font-medium">Personne</th>
                    <th className="text-center px-3 py-2.5 font-medium">Semaines</th>
                    <th className="text-center px-3 py-2.5 font-medium">Heures</th>
                    <th className="text-center px-3 py-2.5 font-medium">Jours</th>
                    <th className="text-center px-3 py-2.5 font-medium">Samedis</th>
                    <th className="text-center px-3 py-2.5 font-medium">Ouvertures</th>
                    <th className="text-center px-3 py-2.5 font-medium">Fermetures</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {staff.map(s => {
                    const t = totals[s.id];
                    return (
                      <tr key={s.id}>
                        <td className="px-5 py-2.5 font-medium">{s.name}</td>
                        <td className="px-3 py-2.5 text-center">{t.weeks}</td>
                        <td className="px-3 py-2.5 text-center">{t.hours.toFixed(1)}h</td>
                        <td className="px-3 py-2.5 text-center">{t.days}</td>
                        <td className="px-3 py-2.5 text-center">{t.saturdays}</td>
                        <td className="px-3 py-2.5 text-center">{t.opens}</td>
                        <td className="px-3 py-2.5 text-center">{t.closes}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function EquityCard({ title, icon:Icon, data, color }) {
  const max = Math.max(1, ...data.map(d => d.value));
  const colorMap = {
    emerald:'bg-emerald-500', sky:'bg-sky-500', violet:'bg-violet-500', amber:'bg-amber-500'
  };
  return (
    <Card>
      <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2">
        <Icon className="w-4 h-4 text-slate-500"/>
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="p-4 space-y-2">
        {data.map((d,i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <div className="w-20 truncate text-slate-600">{d.name}</div>
            <div className="flex-1 h-4 bg-slate-100 rounded overflow-hidden">
              <div className={`h-full ${colorMap[color]}`} style={{width:`${(d.value/max)*100}%`}}/>
            </div>
            <div className="w-6 text-right font-medium">{d.value}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function WallView({ staff, settings, planning, weekStart, onGenerate }) {
  const weekNumber = getISOWeek(weekStart);
  const parity = weekNumber % 2 === 0 ? 'paire' : 'impaire';

  const handlePrint = () => window.print();

  if (!planning) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <Card><EmptyState icon={Printer} title="Aucun planning à afficher"
          description="Générez un planning pour cette semaine avant d'accéder à la vue murale."
          action={<Btn icon={Sparkles} onClick={onGenerate}>Générer</Btn>}/>
        </Card>
      </div>
    );
  }

  // Shifts par personne et par jour
  const byPerson = {};
  planning.shifts.forEach(sh => {
    if (!byPerson[sh.staffId]) byPerson[sh.staffId] = {};
    byPerson[sh.staffId][sh.date] = sh;
  });

  // Ordre d'affichage: par rôle (pharm, prep, alt, logi) puis alphabétique
  const roleOrder = ['pharmacien', 'preparateur', 'alternant', 'logistique'];
  const sortedStaff = [...staff]
    .filter(s => byPerson[s.id])
    .sort((a,b) => {
      const ra = roleOrder.indexOf(a.role), rb = roleOrder.indexOf(b.role);
      if (ra !== rb) return ra - rb;
      return a.name.localeCompare(b.name);
    });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="no-print flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Vue murale / export</h1>
          <p className="text-sm text-slate-500">Format imprimable affichage pharmacie</p>
        </div>
        <Btn icon={Printer} onClick={handlePrint}>Imprimer</Btn>
      </div>

      <div className="print-full bg-white rounded-lg border border-slate-300 p-8">
        <header className="border-b-2 border-emerald-700 pb-4 mb-6 flex items-end justify-between">
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-widest">Planning hebdomadaire</div>
            <h1 className="text-3xl font-bold tracking-tight">{settings.pharmacyName}</h1>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500 uppercase tracking-wider">Semaine</div>
            <div className="text-4xl font-bold text-emerald-700">{weekNumber}</div>
            <div className="text-xs text-slate-600">({parity})</div>
          </div>
        </header>

        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="border border-slate-300 bg-slate-100 p-2 text-left text-xs uppercase tracking-wider">Personne</th>
              {[1,2,3,4,5,6,0].map(dow => {
                const date = addDays(weekStart, dow === 0 ? 6 : dow - 1);
                const hours = settings.openingHours[dow];
                return (
                  <th key={dow} className="border border-slate-300 bg-slate-100 p-2 text-xs uppercase tracking-wider">
                    <div>{DAYS_SHORT[dow]}</div>
                    <div className="text-[10px] font-normal text-slate-500">{pad(date.getDate())}/{pad(date.getMonth()+1)}</div>
                    {hours && <div className="text-[10px] font-normal text-slate-500">{hours.start}–{hours.end}</div>}
                  </th>
                );
              })}
              <th className="border border-slate-300 bg-slate-100 p-2 text-xs uppercase tracking-wider">Total</th>
            </tr>
          </thead>
          <tbody>
            {sortedStaff.map(s => {
              const role = ROLES[s.role];
              const total = planning.hoursByStaff?.[s.id] || 0;
              return (
                <tr key={s.id}>
                  <td className={`border border-slate-300 p-2 text-sm font-medium ${role.bg}`}>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${role.accent}`}/>
                      <span>{s.name}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{role.label}</div>
                  </td>
                  {[1,2,3,4,5,6,0].map(dow => {
                    const date = addDays(weekStart, dow === 0 ? 6 : dow - 1);
                    const dateStr = fmtDate(date);
                    const sh = byPerson[s.id]?.[dateStr];
                    return (
                      <td key={dow} className="border border-slate-300 p-1.5 text-center text-xs align-top">
                        {sh ? (
                          <div className="font-semibold text-slate-800">{sh.start}–{sh.end}</div>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="border border-slate-300 p-2 text-center text-sm font-semibold bg-slate-50">{total.toFixed(1)}h</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <footer className="mt-6 pt-4 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
          <div>Généré le {new Date(planning.generatedAt).toLocaleString('fr-FR')}</div>
          <div>{planning.shifts.length} créneaux · {planning.alerts.length} alerte(s)</div>
        </footer>
      </div>
    </div>
  );
}

export function SettingsModal({ settings, setSettings, onClose, showToast, onResetAll }) {
  const [form, setForm] = useState(settings);

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const updateHour = (dow, field, val) => {
    setForm(f => ({
      ...f,
      openingHours: {
        ...f.openingHours,
        [dow]: f.openingHours[dow] ? { ...f.openingHours[dow], [field]: val } : { start:'09:00', end:'19:00', [field]: val }
      }
    }));
  };
  const toggleDayOpen = (dow) => {
    setForm(f => ({
      ...f,
      openingHours: {
        ...f.openingHours,
        [dow]: f.openingHours[dow] ? null : { start:'08:30', end:'19:00' }
      }
    }));
  };

  const save = () => {
    setSettings(form);
    showToast('Paramètres enregistrés');
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="Paramètres" size="lg">
      <div className="space-y-6">
        <section>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Identification</div>
          <Input label="Nom de la pharmacie" value={form.pharmacyName} onChange={e=>update('pharmacyName', e.target.value)} />
        </section>

        <section>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Horaires d'ouverture</div>
          <div className="space-y-2">
            {[1,2,3,4,5,6,0].map(dow => {
              const h = form.openingHours[dow];
              return (
                <div key={dow} className="flex items-center gap-3 py-1.5 border-b border-slate-100 last:border-0">
                  <div className="w-24 text-sm font-medium">{DAYS_FR[dow]}</div>
                  <button
                    onClick={() => toggleDayOpen(dow)}
                    className={`px-2.5 py-1 rounded text-xs font-medium ${h?'bg-emerald-100 text-emerald-800':'bg-slate-100 text-slate-500'}`}>
                    {h ? 'Ouvert' : 'Fermé'}
                  </button>
                  {h && (
                    <>
                      <input type="time" value={h.start} onChange={e=>updateHour(dow, 'start', e.target.value)} step="1800"
                        className="px-2 py-1 text-sm border border-slate-300 rounded"/>
                      <span className="text-slate-400">–</span>
                      <input type="time" value={h.end} onChange={e=>updateHour(dow, 'end', e.target.value)} step="1800"
                        className="px-2 py-1 text-sm border border-slate-300 rounded"/>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Minima par défaut</div>
          <div className="grid grid-cols-3 gap-3">
            <Input type="number" label="Effectif total min." value={form.defaultMinTotal} onChange={e=>update('defaultMinTotal', Number(e.target.value))} min="0"/>
            <Input type="number" label="Pharmaciens min." value={form.defaultMinPharmacist} onChange={e=>update('defaultMinPharmacist', Number(e.target.value))} min="0"/>
            <Input type="number" label="Comptoir min. (hors logi)" value={form.defaultMinCounter} onChange={e=>update('defaultMinCounter', Number(e.target.value))} min="0"/>
          </div>
        </section>

        <section>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Congés</div>
          <Input type="number" label="Quota de congés payés annuel (jours)" value={form.cpPerYear} onChange={e=>update('cpPerYear', Number(e.target.value))} min="0"/>
        </section>

        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <Btn variant="danger" icon={Trash2} onClick={onResetAll}>Tout réinitialiser</Btn>
          <div className="flex gap-2">
            <Btn variant="secondary" onClick={onClose}>Annuler</Btn>
            <Btn icon={Save} onClick={save}>Enregistrer</Btn>
          </div>
        </div>
      </div>
    </Modal>
  );
}

