import {
  fmtDate, fmtDateFR, addDays, getISOWeek,
  timeToMin, minToTime, generateSlots
} from './utils.js';
import { DAYS_FR, DAYS_SHORT } from './constants.js';

/**
 * Génère un planning hebdomadaire en deux phases :
 *   PHASE 1 — pour chaque personne, sélectionne quels jours elle travaille
 *             (équilibrage de charge sur la semaine, évite que tout le monde
 *             ne travaille du Lu au Je puis disparaisse)
 *   PHASE 2 — pour chaque jour, attribue les créneaux horaires en respectant
 *             dispos, demi-journées, amplitude max, incompatibilités, et minima.
 */
export function generateWeekPlanning(weekStart, staff, leaves, settings, coverage, history) {
  const weekNumber = getISOWeek(weekStart);
  const parity = weekNumber % 2 === 0 ? 'even' : 'odd';
  const shifts = [];
  const alerts = [];
  const hoursByStaff = Object.fromEntries(staff.map(s => [s.id, 0]));
  const daysByStaff = Object.fromEntries(staff.map(s => [s.id, 0]));
  const consecutiveDays = Object.fromEntries(staff.map(s => [s.id, history?.consecutive?.[s.id] || 0]));

  const equityScore = (s) => ({
    h: history?.hours?.[s.id] || 0,
    sat: history?.saturdays?.[s.id] || 0,
    opens: history?.opens?.[s.id] || 0,
    closes: history?.closes?.[s.id] || 0
  });

  /* ---------- PHASE 1 : pré-sélection des jours ---------- */
  const weekDays = [];
  const dayLoad = {};
  for (let off = 0; off < 7; off++) {
    const d = addDays(weekStart, off);
    const dow = d.getDay();
    if (!settings.openingHours[dow]) continue;
    const dateStr = fmtDate(d);
    weekDays.push({ offset: off, dow, date: dateStr });
    dayLoad[dateStr] = 0;
  }

  const availByStaff = {};
  staff.forEach(s => {
    availByStaff[s.id] = weekDays.filter(({ dow, date }) => {
      const onLeave = leaves.some(l => l.staffId === s.id && date >= l.startDate && date <= l.endDate);
      if (onLeave) return false;
      if ((s.fixedOffDays||[]).includes(dow)) return false;
      if ((s.variableOffDays||[]).includes(date)) return false;
      if (dow === 6 && s.saturdayTeam) {
        const expected = parity === 'even' ? 1 : 2;
        if (s.saturdayTeam !== expected) return false;
      }
      return true;
    });
  });

  const workDaysByStaff = {};
  const sortedForDayPick = [...staff].sort((a, b) => {
    const tA = parity === 'even' ? (a.targetDaysEven ?? 5) : (a.targetDaysOdd ?? 5);
    const tB = parity === 'even' ? (b.targetDaysEven ?? 5) : (b.targetDaysOdd ?? 5);
    if (tB !== tA) return tB - tA;
    const hA = parity === 'even' ? (a.targetHoursEven ?? 35) : (a.targetHoursOdd ?? 35);
    const hB = parity === 'even' ? (b.targetHoursEven ?? 35) : (b.targetHoursOdd ?? 35);
    return hB - hA;
  });

  sortedForDayPick.forEach(s => {
    const avail = availByStaff[s.id];
    const rawTarget = parity === 'even' ? (s.targetDaysEven ?? 5) : (s.targetDaysOdd ?? 5);
    const target = Math.min(rawTarget, avail.length);
    const ranked = [...avail].sort((a, b) => {
      if (dayLoad[a.date] !== dayLoad[b.date]) return dayLoad[a.date] - dayLoad[b.date];
      return a.offset - b.offset;
    });
    const picks = ranked.slice(0, target);
    picks.forEach(p => dayLoad[p.date]++);
    workDaysByStaff[s.id] = new Set(picks.map(p => p.date));
  });

  /* ---------- PHASE 2 : créneaux horaires ---------- */
  for (let offset = 0; offset < 7; offset++) {
    const date = addDays(weekStart, offset);
    const dateStr = fmtDate(date);
    const dow = date.getDay();
    const hours = settings.openingHours[dow];
    if (!hours) continue;

    const available = staff.filter(s => {
      if (!workDaysByStaff[s.id]?.has(dateStr)) return false;
      if (consecutiveDays[s.id] >= (s.maxConsecutiveDays || 6)) return false;
      return true;
    });

    const pharmAvail = available.filter(s => s.role === 'pharmacien');
    if (pharmAvail.length === 0) {
      alerts.push({ sev:'error', type:'no_pharmacist_day', date:dateStr, dow,
        message:`Aucun pharmacien disponible le ${DAYS_FR[dow]} ${fmtDateFR(date)}` });
    }

    const openers = available
      .filter(s => s.canOpen !== false)
      .sort((a,b) => {
        const prefA = (a.preferOpen ? -2 : 0) + (a.preferMorning ? -1 : 0);
        const prefB = (b.preferOpen ? -2 : 0) + (b.preferMorning ? -1 : 0);
        if (prefA !== prefB) return prefA - prefB;
        return equityScore(a).opens - equityScore(b).opens;
      });

    const todayAssignments = [];
    available.forEach(s => {
      let shiftStart = hours.start;
      let shiftEnd = hours.end;

      const dayAvail = s.availability && s.availability[dow];
      if (dayAvail) {
        if (dayAvail.start) shiftStart = dayAvail.start > hours.start ? dayAvail.start : hours.start;
        if (dayAvail.end)   shiftEnd   = dayAvail.end   < hours.end   ? dayAvail.end   : hours.end;
      }

      if (s.halfDayOnly) {
        const midMin = (timeToMin(hours.start) + timeToMin(hours.end)) / 2;
        const mid = minToTime(Math.round(midMin/30)*30);
        if (s.preferMorning)  { shiftEnd = mid; }
        else if (s.preferAfternoon) { shiftStart = mid; }
        else { shiftEnd = mid; }
      }

      const maxM = (s.maxDailyHours || 10) * 60;
      const curDur = timeToMin(shiftEnd) - timeToMin(shiftStart);
      if (curDur > maxM) {
        if (s.preferMorning) {
          shiftEnd = minToTime(timeToMin(shiftStart) + maxM);
        } else if (s.preferAfternoon) {
          shiftStart = minToTime(timeToMin(shiftEnd) - maxM);
        } else {
          const idxOpen = openers.findIndex(o => o.id === s.id);
          const isOpener = idxOpen !== -1 && idxOpen < 2;
          if (isOpener) shiftEnd = minToTime(timeToMin(shiftStart) + maxM);
          else shiftStart = minToTime(timeToMin(shiftEnd) - maxM);
        }
      }

      const targetH = parity === 'even' ? (s.targetHoursEven ?? 35) : (s.targetHoursOdd ?? 35);
      const shiftHours = (timeToMin(shiftEnd) - timeToMin(shiftStart)) / 60;

      if (hoursByStaff[s.id] + shiftHours > targetH * 1.15) {
        const remainingMin = Math.max(0, (targetH * 1.15 - hoursByStaff[s.id]) * 60);
        if (remainingMin < 60) return;
        shiftEnd = minToTime(timeToMin(shiftStart) + Math.floor(remainingMin/30)*30);
      }

      todayAssignments.push({
        staffId: s.id, date: dateStr, dow,
        start: shiftStart, end: shiftEnd,
        hours: (timeToMin(shiftEnd) - timeToMin(shiftStart)) / 60
      });
    });

    // Résolution incompatibilités
    for (let i = 0; i < todayAssignments.length; i++) {
      for (let j = i+1; j < todayAssignments.length; j++) {
        const a = todayAssignments[i], b = todayAssignments[j];
        if (!a || !b) continue;
        const sA = staff.find(s => s.id === a.staffId);
        const sB = staff.find(s => s.id === b.staffId);
        const incomp = (sA?.incompatibilities||[]).includes(sB?.id) || (sB?.incompatibilities||[]).includes(sA?.id);
        if (!incomp) continue;
        const overlap = timeToMin(a.start) < timeToMin(b.end) && timeToMin(b.start) < timeToMin(a.end);
        if (!overlap) continue;
        if (a.hours >= b.hours) {
          b.start = minToTime(Math.max(timeToMin(b.start), timeToMin(a.end)));
          if (timeToMin(b.start) >= timeToMin(b.end)) todayAssignments[j] = null;
          else { b.hours = (timeToMin(b.end) - timeToMin(b.start))/60; }
        } else {
          a.end = minToTime(Math.min(timeToMin(a.end), timeToMin(b.start)));
          if (timeToMin(a.start) >= timeToMin(a.end)) todayAssignments[i] = null;
          else { a.hours = (timeToMin(a.end) - timeToMin(a.start))/60; }
        }
        alerts.push({ sev:'warning', type:'incompat', date: dateStr, dow,
          message:`Incompatibilité ${sA?.name}/${sB?.name} — créneau ajusté` });
      }
    }

    const final = todayAssignments.filter(Boolean);

    final.forEach(a => {
      shifts.push(a);
      hoursByStaff[a.staffId] += a.hours;
      daysByStaff[a.staffId] += 1;
    });

    staff.forEach(s => {
      const worked = final.some(a => a.staffId === s.id);
      consecutiveDays[s.id] = worked ? (consecutiveDays[s.id] + 1) : 0;
    });

    // Vérification couverture par créneau 30min
    const slots = generateSlots(hours.start, hours.end);
    slots.forEach(slot => {
      const slotM = timeToMin(slot);
      const working = final.filter(a => timeToMin(a.start) <= slotM && timeToMin(a.end) > slotM);
      const pharm = working.filter(w => staff.find(s => s.id === w.staffId)?.role === 'pharmacien');
      const counter = working.filter(w => staff.find(s => s.id === w.staffId)?.role !== 'logistique');

      const rule = (coverage?.[dow]?.[slot]) || {
        minTotal: settings.defaultMinTotal,
        minPharmacist: settings.defaultMinPharmacist,
        minCounter: settings.defaultMinCounter
      };

      if (pharm.length < rule.minPharmacist) {
        alerts.push({ sev:'error', type:'no_pharmacist_slot', date:dateStr, dow, time:slot,
          message:`Pharmacien manquant ${DAYS_SHORT[dow]} ${slot}` });
      }
      if (counter.length < rule.minCounter) {
        alerts.push({ sev:'warning', type:'understaffed_counter', date:dateStr, dow, time:slot,
          message:`Comptoir insuffisant ${DAYS_SHORT[dow]} ${slot} (${counter.length}/${rule.minCounter})` });
      }
      if (working.length < rule.minTotal) {
        alerts.push({ sev:'warning', type:'understaffed', date:dateStr, dow, time:slot,
          message:`Sous-effectif ${DAYS_SHORT[dow]} ${slot} (${working.length}/${rule.minTotal})` });
      }
    });
  }

  // Surcharge
  staff.forEach(s => {
    const target = parity === 'even' ? (s.targetHoursEven ?? 35) : (s.targetHoursOdd ?? 35);
    if (hoursByStaff[s.id] > target * 1.05) {
      alerts.push({ sev:'warning', type:'overload',
        message:`${s.name} : ${hoursByStaff[s.id].toFixed(1)}h (cible ${target}h)` });
    }
  });

  // Compteurs samedi / ouvertures / fermetures pour équité
  const satByStaff = {}, openByStaff = {}, closeByStaff = {};
  shifts.forEach(sh => {
    if (sh.dow === 6) satByStaff[sh.staffId] = (satByStaff[sh.staffId]||0) + 1;
    const dayHours = settings.openingHours[sh.dow];
    if (dayHours && sh.start === dayHours.start) openByStaff[sh.staffId] = (openByStaff[sh.staffId]||0) + 1;
    if (dayHours && sh.end === dayHours.end) closeByStaff[sh.staffId] = (closeByStaff[sh.staffId]||0) + 1;
  });

  return {
    weekStart: fmtDate(weekStart),
    weekNumber, parity,
    shifts, alerts,
    hoursByStaff, daysByStaff, satByStaff, openByStaff, closeByStaff
  };
}
