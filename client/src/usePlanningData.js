import { useState, useEffect, useCallback } from 'react';
import api from './api.js';
import { DEFAULT_SETTINGS } from './constants.js';

/**
 * Hook qui charge et synchronise les données du planning avec le backend.
 *
 * Retourne :
 *   { staff, leaves, settings, coverage, plannings, loading, error,
 *     reload, mutateStaff, mutateLeaves, ... }
 *
 * Stratégie :
 *   - Chargement initial parallèle (Promise.all)
 *   - Mises à jour optimistes : on met à jour l'état local immédiatement,
 *     puis on synchronise avec le serveur. En cas d'échec, on recharge.
 */
export function usePlanningData() {
  const [staff, setStaff] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [coverage, setCoverage] = useState({});
  const [plannings, setPlannings] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, l, st, c, p] = await Promise.all([
        api.staff.list(),
        api.leaves.list(),
        api.settings.get(),
        api.coverage.get(),
        api.plannings.get()
      ]);
      setStaff(s);
      setLeaves(l);
      setSettings({ ...DEFAULT_SETTINGS, ...st });
      setCoverage(c || {});
      setPlannings(p || {});
    } catch (e) {
      setError(e);
      console.error('Erreur de chargement', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  /* ---------- Mutations Staff ---------- */
  const addStaff = async (item) => {
    try {
      const created = await api.staff.add(item);
      setStaff(prev => [...prev, created]);
      return created;
    } catch (e) { throw e; }
  };

  const updateStaff = async (id, item) => {
    const prev = staff;
    setStaff(s => s.map(x => x.id === id ? { ...x, ...item } : x));
    try {
      await api.staff.update(id, item);
    } catch (e) { setStaff(prev); throw e; }
  };

  const removeStaff = async (id) => {
    const prev = staff;
    setStaff(s => s.filter(x => x.id !== id));
    try {
      await api.staff.remove(id);
    } catch (e) { setStaff(prev); throw e; }
  };

  /* ---------- Mutations Leaves ---------- */
  const addLeave = async (item) => {
    const created = await api.leaves.add(item);
    setLeaves(prev => [...prev, created]);
    return created;
  };
  const updateLeave = async (id, item) => {
    const prev = leaves;
    setLeaves(l => l.map(x => x.id === id ? { ...x, ...item } : x));
    try { await api.leaves.update(id, item); }
    catch (e) { setLeaves(prev); throw e; }
  };
  const removeLeave = async (id) => {
    const prev = leaves;
    setLeaves(l => l.filter(x => x.id !== id));
    try { await api.leaves.remove(id); }
    catch (e) { setLeaves(prev); throw e; }
  };

  /* ---------- Mutations Singletons ---------- */
  const updateSettings = async (newSettings) => {
    const prev = settings;
    const next = typeof newSettings === 'function' ? newSettings(prev) : newSettings;
    setSettings(next);
    try { await api.settings.set(next); }
    catch (e) { setSettings(prev); throw e; }
  };

  const updateCoverage = async (newCoverage) => {
    const prev = coverage;
    const next = typeof newCoverage === 'function' ? newCoverage(prev) : newCoverage;
    setCoverage(next);
    try { await api.coverage.set(next); }
    catch (e) { setCoverage(prev); throw e; }
  };

  const setPlanning = async (weekKey, planning) => {
    const next = { ...plannings, [weekKey]: planning };
    setPlannings(next);
    try { await api.plannings.set(next); }
    catch (e) { setPlannings(plannings); throw e; }
  };

  const replaceAllPlannings = async (newPlannings) => {
    const prev = plannings;
    const next = typeof newPlannings === 'function' ? newPlannings(prev) : newPlannings;
    setPlannings(next);
    try { await api.plannings.set(next); }
    catch (e) { setPlannings(prev); throw e; }
  };

  const resetAll = async () => {
    try {
      await api.plannings.set({});
      await api.coverage.set({});
      await api.settings.set(DEFAULT_SETTINGS);
      // Staff et leaves : on vide via replaceAll
      await api.staff.replaceAll([]);
      await api.leaves.replaceAll([]);
      setStaff([]);
      setLeaves([]);
      setPlannings({});
      setCoverage({});
      setSettings(DEFAULT_SETTINGS);
    } catch (e) { throw e; }
  };

  return {
    staff, leaves, settings, coverage, plannings,
    loading, error, reload,
    addStaff, updateStaff, removeStaff,
    addLeave, updateLeave, removeLeave,
    updateSettings, updateCoverage,
    setPlanning, replaceAllPlannings, resetAll
  };
}
