import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  LayoutDashboard, Users, Calendar, CalendarDays, Sliders, Grid3x3, Award,
  Printer, Settings as SettingsIcon, LogOut, UserCircle, ShieldCheck,
  Cross, ChevronDown, Key, CheckSquare, MessageSquare
} from 'lucide-react';

import { AuthProvider, useAuth } from './auth.jsx';
import { usePlanningData } from './usePlanningData.js';
import { Btn, Card, Toast, Modal, Input } from './ui.jsx';
import { DEFAULT_SETTINGS } from './constants.js';
import { getMonday, fmtDate, addDays, getISOWeek, fmtDateFR } from './utils.js';
import { generateWeekPlanning } from './planning-algorithm.js';
import api from './api.js';

import LoginScreen from './LoginScreen.jsx';
import UsersScreen from './UsersScreen.jsx';
import TasksScreen from './tasks/TasksScreen.jsx';
import TransmissionsScreen from './transmissions/TransmissionsScreen.jsx';
import {
  Dashboard, StaffScreen, StaffFormModal,
  ConstraintsScreen, ConstraintsFormModal,
  LeavesScreen, LeaveFormModal,
  MinimumsScreen,
  PlanningScreen,
  EquityScreen,
  WallView,
  SettingsModal
} from './screens.jsx';

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}

function AppInner() {
  const { loading: authLoading, isAuthenticated } = useAuth();

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-sm text-slate-400">Chargement...</div>
      </div>
    );
  }

  if (!isAuthenticated) return <LoginScreen />;

  return <AuthenticatedApp />;
}

function AuthenticatedApp() {
  const { user, isAdmin, logout } = useAuth();
  const data = usePlanningData();
  const {
    staff, leaves, settings, coverage, plannings,
    loading, error,
    addStaff, updateStaff, removeStaff,
    addLeave, updateLeave, removeLeave,
    updateSettings, updateCoverage,
    setPlanning, replaceAllPlannings, resetAll
  } = data;

  const [view, setView] = useState('dashboard');
  const [weekStart, setWeekStart] = useState(getMonday(new Date()));
  const [editStaff, setEditStaff] = useState(null);
  const [editConstraints, setEditConstraints] = useState(null);
  const [editLeave, setEditLeave] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [toast, setToast] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Charge la liste des utilisateurs (pour les assignations de tâches et transmissions)
  // listTeam est accessible à tous les utilisateurs connectés (contrairement à listUsers qui est admin only)
  useEffect(() => {
    api.auth.listTeam().then(setAllUsers).catch(() => setAllUsers([]));
  }, []);

  // Compteur de transmissions non lues (rafraîchi toutes les 30 s et à chaque navigation)
  const refreshUnread = useCallback(() => {
    api.transmissions.unreadCount()
      .then(r => setUnreadCount(r.count || 0))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshUnread();
    const id = setInterval(refreshUnread, 30000);
    return () => clearInterval(id);
  }, [refreshUnread]);

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
  }, []);

  const weekKey = fmtDate(weekStart);
  const currentPlanning = plannings[weekKey];

  /* ---------- Adaptateurs pour compatibilité avec les écrans extraits ---------- */
  // Les écrans attendent des setters React-style (accepte valeur OU fonction updater).
  // On crée ici des wrappers qui maintiennent cette API tout en appelant les fonctions
  // de synchronisation backend.

  const setStaffCompat = useCallback(async (updater) => {
    const next = typeof updater === 'function' ? updater(staff) : updater;
    // Diff pour détecter les créations/suppressions/modifications
    // Simple : on remplace tout
    try {
      await api.staff.replaceAll(next);
      await data.reload();
    } catch (e) {
      showToast('Erreur de sauvegarde', 'error');
    }
  }, [staff, data, showToast]);

  const setLeavesCompat = useCallback(async (updater) => {
    const next = typeof updater === 'function' ? updater(leaves) : updater;
    try {
      await api.leaves.replaceAll(next);
      await data.reload();
    } catch (e) {
      showToast('Erreur de sauvegarde', 'error');
    }
  }, [leaves, data, showToast]);

  const setPlanningsCompat = useCallback((updater) => {
    replaceAllPlannings(updater).catch(() => showToast('Erreur de sauvegarde', 'error'));
  }, [replaceAllPlannings, showToast]);

  const setSettingsCompat = useCallback((updater) => {
    updateSettings(updater).catch(() => showToast('Erreur de sauvegarde', 'error'));
  }, [updateSettings, showToast]);

  const setCoverageCompat = useCallback((updater) => {
    updateCoverage(updater).catch(() => showToast('Erreur de sauvegarde', 'error'));
  }, [updateCoverage, showToast]);

  /* ---------- Génération du planning ---------- */
  const onGeneratePlanning = useCallback(() => {
    // Historique : 4 dernières semaines de plannings pour équité
    const history = computeHistory(plannings, weekStart);
    const result = generateWeekPlanning(weekStart, staff, leaves, settings, coverage, history);
    setPlanning(weekKey, result)
      .then(() => showToast(`Planning de la semaine ${result.weekNumber} généré`))
      .catch(() => showToast('Erreur de sauvegarde', 'error'));
  }, [plannings, weekStart, staff, leaves, settings, coverage, weekKey, setPlanning, showToast]);

  const onClearPlanning = useCallback(() => {
    if (!confirm('Supprimer le planning de cette semaine ?')) return;
    const next = { ...plannings };
    delete next[weekKey];
    replaceAllPlannings(next)
      .then(() => showToast('Planning supprimé', 'warning'))
      .catch(() => showToast('Erreur de sauvegarde', 'error'));
  }, [plannings, weekKey, replaceAllPlannings, showToast]);

  const onResetAll = useCallback(() => {
    if (!confirm('Supprimer TOUTES les données (personnel, congés, plannings, paramètres) ? Cette action est irréversible.')) return;
    resetAll()
      .then(() => {
        showToast('Données réinitialisées', 'warning');
        setShowSettings(false);
      })
      .catch(() => showToast('Erreur de réinitialisation', 'error'));
  }, [resetAll, showToast]);

  /* ---------- Handlers des modales ---------- */
  const handleStaffSave = async (data) => {
    try {
      if (editStaff && editStaff.id) {
        await updateStaff(editStaff.id, data);
        showToast(`${data.name} modifié`);
      } else {
        await addStaff(data);
        showToast(`${data.name} ajouté`);
      }
    } catch { showToast('Erreur de sauvegarde', 'error'); }
    setEditStaff(null);
  };

  const handleStaffDelete = async (id) => {
    if (!confirm('Supprimer cette personne ?')) return;
    try {
      await removeStaff(id);
      showToast('Personne supprimée', 'warning');
    } catch { showToast('Erreur de suppression', 'error'); }
    setEditStaff(null);
  };

  const handleConstraintsSave = async (personId, constraints) => {
    try {
      const person = staff.find(s => s.id === personId);
      if (!person) return;
      await updateStaff(personId, { ...person, ...constraints });
      showToast('Contraintes enregistrées');
    } catch { showToast('Erreur de sauvegarde', 'error'); }
    setEditConstraints(null);
  };

  const handleLeaveSave = async (data) => {
    try {
      if (editLeave && editLeave.id) {
        await updateLeave(editLeave.id, data);
        showToast('Congé modifié');
      } else {
        await addLeave(data);
        showToast('Congé ajouté');
      }
    } catch { showToast('Erreur de sauvegarde', 'error'); }
    setEditLeave(null);
  };

  const handleLeaveDelete = async (id) => {
    if (!confirm('Supprimer ce congé ?')) return;
    try {
      await removeLeave(id);
      showToast('Congé supprimé', 'warning');
    } catch { showToast('Erreur de suppression', 'error'); }
    setEditLeave(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-sm text-slate-400">Chargement des données...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <Card className="p-6 max-w-md">
          <h2 className="text-lg font-semibold text-rose-700">Erreur de connexion</h2>
          <p className="text-sm text-slate-600 mt-2">Impossible de charger les données depuis le serveur. Vérifiez que le serveur est en cours d'exécution.</p>
          <Btn onClick={() => data.reload()} className="mt-4">Réessayer</Btn>
        </Card>
      </div>
    );
  }

  /* ---------- Navigation items (filtrés selon rôle) ---------- */
  const navItems = [
    { id: 'dashboard',     label: 'Tableau de bord', icon: LayoutDashboard },
    { id: 'transmissions', label: 'Transmissions',   icon: MessageSquare, badge: unreadCount },
    { id: 'tasks',         label: 'Tâches',          icon: CheckSquare },
    { id: 'planning',      label: 'Planning',        icon: Calendar, divider: 'before' },
    { id: 'wall',          label: 'Vue murale',      icon: Printer },
    { id: 'equity',        label: 'Équité',          icon: Award },
    ...(isAdmin ? [
      { id: 'staff',       label: 'Personnel',       icon: Users, divider: 'before' },
      { id: 'constraints', label: 'Contraintes',     icon: Sliders },
      { id: 'leaves',      label: 'Congés',          icon: CalendarDays },
      { id: 'minimums',    label: 'Minima',          icon: Grid3x3 },
      { id: 'users',       label: 'Comptes',         icon: ShieldCheck, divider: 'before' }
    ] : [])
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex h-screen overflow-hidden">
        {/* SIDEBAR */}
        <aside className="no-print w-60 bg-white border-r border-slate-200 flex flex-col flex-shrink-0">
          <div className="px-5 py-5 border-b border-slate-200">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-sm">
                <Cross className="w-5 h-5"/>
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-sm text-slate-900 truncate">
                  {settings.pharmacyName || 'Ma Pharmacie'}
                </div>
                <div className="text-[11px] text-slate-500">Planning équipe</div>
              </div>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto py-3 px-2 scrollbar-thin">
            {navItems.map(item => (
              <React.Fragment key={item.id}>
                {item.divider === 'before' && <div className="my-2 h-px bg-slate-100"/>}
                <button
                  onClick={() => { setView(item.id); if (item.id === 'transmissions') refreshUnread(); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition ${
                    view === item.id
                      ? 'bg-emerald-50 text-emerald-700 font-medium'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <item.icon className="w-4 h-4"/>
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.badge > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-semibold bg-rose-600 text-white rounded-full">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </button>
              </React.Fragment>
            ))}
          </nav>

          {/* User footer */}
          <div className="border-t border-slate-200 p-2 relative">
            <button
              onClick={() => setShowProfile(s => !s)}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg hover:bg-slate-50"
            >
              <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-semibold flex-shrink-0">
                {(user?.displayName || '?').split(/\s+/).slice(0, 2).map(s => s[0]).join('').toUpperCase()}
              </div>
              <div className="flex-1 text-left min-w-0">
                <div className="font-medium text-slate-900 truncate text-xs">{user?.displayName}</div>
                <div className="text-[10px] text-slate-500 truncate">
                  {isAdmin ? 'Administrateur' : 'Membre'}
                </div>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition ${showProfile ? 'rotate-180' : ''}`}/>
            </button>
            {showProfile && (
              <div className="absolute bottom-full left-2 right-2 mb-2 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden z-20">
                {isAdmin && (
                  <button
                    onClick={() => { setShowSettings(true); setShowProfile(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 text-left"
                  >
                    <SettingsIcon className="w-4 h-4"/> Paramètres
                  </button>
                )}
                <button
                  onClick={() => { setShowProfile(false); setView('change-password'); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 text-left border-t border-slate-100"
                >
                  <Key className="w-4 h-4"/> Mot de passe
                </button>
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-rose-700 hover:bg-rose-50 text-left border-t border-slate-100"
                >
                  <LogOut className="w-4 h-4"/> Se déconnecter
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* MAIN */}
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          {view === 'dashboard' && (
            <Dashboard
              staff={staff} leaves={leaves} plannings={plannings}
              weekStart={weekStart} setWeekStart={setWeekStart}
              currentPlanning={currentPlanning}
              onGenerate={onGeneratePlanning}
              onGoto={setView}
              settings={settings}
            />
          )}
          {view === 'staff' && isAdmin && (
            <StaffScreen
              staff={staff} setStaff={setStaffCompat}
              onEdit={setEditStaff}
              onShowConstraints={setEditConstraints}
            />
          )}
          {view === 'constraints' && isAdmin && (
            <ConstraintsScreen
              staff={staff} setStaff={setStaffCompat}
              onEdit={setEditConstraints}
            />
          )}
          {view === 'leaves' && isAdmin && (
            <LeavesScreen
              staff={staff} leaves={leaves} setLeaves={setLeavesCompat}
              settings={settings}
              onEdit={setEditLeave}
              showToast={showToast}
            />
          )}
          {view === 'minimums' && isAdmin && (
            <MinimumsScreen
              settings={settings} coverage={coverage}
              setCoverage={setCoverageCompat}
              showToast={showToast}
            />
          )}
          {view === 'planning' && (
            <PlanningScreen
              staff={staff} leaves={leaves} settings={settings}
              weekStart={weekStart} setWeekStart={setWeekStart}
              planning={currentPlanning}
              onGenerate={onGeneratePlanning}
              onClear={onClearPlanning}
              setPlannings={setPlanningsCompat}
              weekKey={weekKey}
              showToast={showToast}
            />
          )}
          {view === 'equity' && (
            <EquityScreen
              staff={staff} plannings={plannings} settings={settings}
            />
          )}
          {view === 'wall' && (
            <WallView
              staff={staff} settings={settings}
              planning={currentPlanning}
              weekStart={weekStart}
              onGenerate={onGeneratePlanning}
            />
          )}
          {view === 'users' && isAdmin && (
            <UsersScreen staff={staff}/>
          )}
          {view === 'tasks' && (
            <TasksScreen users={allUsers} showToast={showToast}/>
          )}
          {view === 'transmissions' && (
            <TransmissionsScreen users={allUsers} showToast={(msg, type) => { showToast(msg, type); refreshUnread(); }}/>
          )}
          {view === 'change-password' && (
            <ChangePasswordScreen onClose={() => setView('dashboard')} showToast={showToast}/>
          )}
        </main>
      </div>

      {/* MODALES */}
      {editStaff !== null && (
        <StaffFormModal
          staff={editStaff}
          onClose={() => setEditStaff(null)}
          onSave={handleStaffSave}
          onDelete={handleStaffDelete}
        />
      )}
      {editConstraints !== null && (
        <ConstraintsFormModal
          person={editConstraints}
          allStaff={staff}
          onClose={() => setEditConstraints(null)}
          onSave={(constraints) => handleConstraintsSave(editConstraints.id, constraints)}
        />
      )}
      {editLeave !== null && (
        <LeaveFormModal
          leave={editLeave}
          staff={staff}
          onClose={() => setEditLeave(null)}
          onSave={handleLeaveSave}
          onDelete={handleLeaveDelete}
        />
      )}
      {showSettings && isAdmin && (
        <SettingsModal
          settings={settings}
          setSettings={setSettingsCompat}
          onClose={() => setShowSettings(false)}
          showToast={showToast}
          onResetAll={onResetAll}
        />
      )}

      {/* TOAST */}
      {toast && (
        <Toast
          message={toast.msg}
          type={toast.type === 'warning' ? 'warning' : toast.type === 'error' ? 'error' : 'success'}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

/* ---------- Historique pour équité ---------- */
function computeHistory(plannings, currentWeekStart) {
  const history = { hours: {}, saturdays: {}, opens: {}, closes: {}, consecutive: {} };
  for (let i = 1; i <= 4; i++) {
    const wk = fmtDate(addDays(currentWeekStart, -7 * i));
    const p = plannings[wk];
    if (!p) continue;
    Object.entries(p.hoursByStaff || {}).forEach(([id, h]) => {
      history.hours[id] = (history.hours[id] || 0) + h;
    });
    Object.entries(p.satByStaff || {}).forEach(([id, n]) => {
      history.saturdays[id] = (history.saturdays[id] || 0) + n;
    });
    Object.entries(p.openByStaff || {}).forEach(([id, n]) => {
      history.opens[id] = (history.opens[id] || 0) + n;
    });
    Object.entries(p.closeByStaff || {}).forEach(([id, n]) => {
      history.closes[id] = (history.closes[id] || 0) + n;
    });
  }
  return history;
}

/* ---------- Écran changement de mot de passe ---------- */
function ChangePasswordScreen({ onClose, showToast }) {
  const [oldPassword, setOld] = useState('');
  const [newPassword, setNew] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 6) { setError('Mot de passe trop court (6 caractères min.)'); return; }
    if (newPassword !== confirm) { setError('Les mots de passe ne correspondent pas'); return; }
    setSaving(true);
    try {
      await api.auth.password(oldPassword, newPassword);
      showToast('Mot de passe modifié');
      onClose();
    } catch (err) {
      setError(err.message || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-xl font-semibold text-slate-900 mb-1">Changer mon mot de passe</h1>
      <p className="text-sm text-slate-500 mb-6">Définissez un nouveau mot de passe pour votre compte.</p>
      <Card className="p-6">
        <form onSubmit={submit} className="space-y-4">
          <Input label="Mot de passe actuel" type="password" value={oldPassword} onChange={e => setOld(e.target.value)} autoFocus required/>
          <Input label="Nouveau mot de passe" type="password" value={newPassword} onChange={e => setNew(e.target.value)} hint="6 caractères minimum" required/>
          <Input label="Confirmer le nouveau mot de passe" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required/>
          {error && <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">{error}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="secondary" onClick={onClose} type="button">Annuler</Btn>
            <Btn type="submit" disabled={saving}>{saving ? 'Enregistrement...' : 'Changer le mot de passe'}</Btn>
          </div>
        </form>
      </Card>
    </div>
  );
}
