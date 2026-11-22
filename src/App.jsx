import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { api } from './api';
import Header from './components/Header';
import TimelineView from './components/TimelineView';
import GridView from './components/GridView';
import WorkersView from './components/WorkersView';
import LocationsView from './components/LocationsView';
import StatsView from './components/StatsView';
import PrintSheetView from './components/PrintSheetView';
import { 
  ShiftModal, 
  WorkerModal, 
  LocationModal, 
  AbsenceModal, 
  NewWeekModal, 
  CopyDayModal 
} from './components/Modals';
import AppDialog from './components/AppDialog';
import { DAYS, formatTime } from './constants';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [locations, setLocations] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [weeks, setWeeks] = useState([]);
  const [activeWeekId, setActiveWeekId] = useState('');
  const [activeDay, setActiveDay] = useState(0); // 0 = Ponedjeljak
  const [activeTab, setActiveTab] = useState('timeline'); // timeline | grid | workers | locations | stats | print

  // Save & Unsaved Changes State (Explicit Save / Revert system)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState(null);

  // Dark / Light Theme State with Persistence
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('shift_pro_theme') || 'dark';
  });

  useEffect(() => {
    localStorage.setItem('shift_pro_theme', theme);
    if (theme === 'light') {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Toast Notification State
  const [toast, setToast] = useState(null);

  // In-Page Custom App Dialog State (Replaces system window.alert & window.confirm)
  const [appDialog, setAppDialog] = useState(null);

  const showAppAlert = ({ title, message, details = [], type = 'error', confirmText = 'U redu' }) => {
    return new Promise(resolve => {
      setAppDialog({
        isOpen: true,
        type,
        title,
        message,
        details,
        confirmText,
        cancelText: null,
        onConfirm: () => {
          setAppDialog(null);
          resolve(true);
        },
        onCancel: () => {
          setAppDialog(null);
          resolve(true);
        }
      });
    });
  };

  const showAppConfirm = ({ title, message, details = [], type = 'warning', confirmText = 'Ipak nastavi', cancelText = 'Odustani' }) => {
    return new Promise(resolve => {
      setAppDialog({
        isOpen: true,
        type,
        title,
        message,
        details,
        confirmText,
        cancelText,
        onConfirm: () => {
          setAppDialog(null);
          resolve(true);
        },
        onCancel: () => {
          setAppDialog(null);
          resolve(false);
        }
      });
    });
  };

  // Modals state
  const [shiftModal, setShiftModal] = useState({ isOpen: false, shift: null, newShiftParams: null });
  const [workerModal, setWorkerModal] = useState({ isOpen: false, worker: null });
  const [locationModal, setLocationModal] = useState({ isOpen: false, location: null });
  const [absenceModal, setAbsenceModal] = useState({ isOpen: false, config: null });
  const [showNewWeekModal, setShowNewWeekModal] = useState(false);
  const [showCopyDayModal, setShowCopyDayModal] = useState(false);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(prev => (prev?.message === message ? null : prev));
    }, 3200);
  };

  // Load data from SQLite backend (with support for fresh session reset)
  const loadData = async (preferredWeekId = null, isFresh = false) => {
    try {
      setLoading(true);
      const data = await api.getBootstrap({ fresh: isFresh });
      setLocations(data.locations || []);
      setWorkers(data.workers || []);
      setWeeks(data.weeks || []);

      if (data.lastSavedInfo) {
        setLastSavedTime(data.lastSavedInfo.savedAt);
      }
      if (isFresh) {
        setHasUnsavedChanges(false);
      }

      if (preferredWeekId && data.weeks.some(w => w.id === preferredWeekId)) {
        setActiveWeekId(preferredWeekId);
      } else if (data.weeks.length > 0) {
        setActiveWeekId(prev => (data.weeks.some(w => w.id === prev) ? prev : data.weeks[0].id));
      }
      setError(null);
    } catch (err) {
      console.error('Failed to load initial data from server:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(null, true);
  }, []);

  // Warn user before closing or leaving page if there are unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'Imate nesačuvane izmjene u rasporedu smjena! Ako zatvorite stranicu bez spremanja, izmjene će biti izgubljene.';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const currentWeek = weeks.find(w => w.id === activeWeekId) || weeks[0];

  // --- VALIDATION HELPERS ---

  // Helper: check if worker already works on the given day in target week (Strict Rule)
  const checkSameDayShiftConflict = (workerId, dayIndex, weekId, excludeShiftId = null) => {
    const targetWeek = weeks.find(w => w.id === (weekId || activeWeekId)) || currentWeek;
    if (!targetWeek || !targetWeek.shifts) return { hasConflict: false };

    const conflict = targetWeek.shifts.find(s => 
      s.workerId === workerId && 
      Number(s.dayIndex) === Number(dayIndex) && 
      s.id !== excludeShiftId
    );

    if (conflict) {
      const loc = locations.find(l => l.id === conflict.locationId);
      return {
        hasConflict: true,
        existingShift: conflict,
        locName: loc?.name || 'lokalu'
      };
    }
    return { hasConflict: false };
  };

  // Helper: check 9-hour rest interval rule (Warning with override)
  const checkShiftRestViolation = (workerId, dayIndex, start, end, weekId, excludeShiftId = null) => {
    const targetWeekId = weekId || activeWeekId;
    const currentWeekIdx = weeks.findIndex(w => w.id === targetWeekId);
    const targetWeek = weeks[currentWeekIdx] || currentWeek;
    if (!targetWeek || !targetWeek.shifts) return { hasViolation: false, warnings: [] };

    const targetShifts = targetWeek.shifts;
    const d = Number(dayIndex);
    const sStart = Number(start);
    const sEnd = Number(end);

    // Previous day shift
    let prevShift = null;
    let prevDayLabel = '';
    if (d > 0) {
      prevShift = targetShifts.find(s => s.workerId === workerId && Number(s.dayIndex) === d - 1 && s.id !== excludeShiftId);
      prevDayLabel = DAYS[d - 1];
    } else if (d === 0 && currentWeekIdx > 0) {
      const prevWeek = weeks[currentWeekIdx - 1];
      prevShift = prevWeek?.shifts?.find(s => s.workerId === workerId && Number(s.dayIndex) === 6);
      prevDayLabel = `Nedjelja (${prevWeek?.title || 'prethodna sedmica'})`;
    }

    // Next day shift
    let nextShift = null;
    let nextDayLabel = '';
    if (d < 6) {
      nextShift = targetShifts.find(s => s.workerId === workerId && Number(s.dayIndex) === d + 1 && s.id !== excludeShiftId);
      nextDayLabel = DAYS[d + 1];
    } else if (d === 6 && currentWeekIdx >= 0 && currentWeekIdx < weeks.length - 1) {
      const nextWeek = weeks[currentWeekIdx + 1];
      nextShift = nextWeek?.shifts?.find(s => s.workerId === workerId && Number(s.dayIndex) === 0);
      nextDayLabel = `Ponedjeljak (${nextWeek?.title || 'naredna sedmica'})`;
    }

    const warnings = [];
    if (prevShift) {
      const restBefore = (24 + sStart) - Number(prevShift.end);
      if (restBefore < 9) {
        const prevLocName = locations.find(l => l.id === prevShift.locationId)?.name || 'lokalu';
        warnings.push(`Samo ${restBefore}h odmora prije ove smjene! Prethodna smjena (${prevDayLabel} u "${prevLocName}") završava u ${formatTime(prevShift.end)}, a ova smjena počinje u ${formatTime(sStart)}. (Propisani minimum je 9h).`);
      }
    }

    if (nextShift) {
      const restAfter = (24 + Number(nextShift.start)) - sEnd;
      if (restAfter < 9) {
        const nextLocName = locations.find(l => l.id === nextShift.locationId)?.name || 'lokalu';
        warnings.push(`Samo ${restAfter}h odmora nakon ove smjene! Ova smjena završava u ${formatTime(sEnd)}, a naredna smjena (${nextDayLabel} u "${nextLocName}") počinje u ${formatTime(nextShift.start)}. (Propisani minimum je 9h).`);
      }
    }

    return {
      hasViolation: warnings.length > 0,
      warnings
    };
  };

  // --- CRUD HANDLERS ---

  // Shift: Create or Edit
  const handleSaveShift = async (shiftData) => {
    try {
      setHasUnsavedChanges(true);
      if (shiftData.id) {
        await api.updateShift(shiftData.id, shiftData);
        showToast('Smjena uspješno ažurirana u bazi!');
      } else {
        const targetWeekId = shiftData.weekId || activeWeekId;
        await api.addShift({ ...shiftData, weekId: targetWeekId });
        showToast('Nova smjena uspješno spremljena u bazu!');
        await loadData(targetWeekId);
        return;
      }
      await loadData(activeWeekId);
    } catch (err) {
      showAppAlert({ type: 'error', title: 'Greška pri spremanju smjene', message: err.message });
    }
  };

  // Shift: Delete
  const handleDeleteShift = async (shiftId) => {
    try {
      setHasUnsavedChanges(true);
      await api.deleteShift(shiftId);
      showToast('Smjena uklonjena.');
      await loadData(activeWeekId);
    } catch (err) {
      showAppAlert({ type: 'error', title: 'Greška pri brisanju smjene', message: err.message });
    }
  };

  // Shift: Quick time update (from drag or preset)
  const handleUpdateShiftTime = async (shiftId, start, end, targetWeekId = null) => {
    try {
      setHasUnsavedChanges(true);
      const wId = targetWeekId || activeWeekId;
      const targetWeek = weeks.find(w => w.id === wId) || currentWeek;
      const shift = targetWeek?.shifts?.find(s => s.id === shiftId);
      if (shift) {
        const worker = workers.find(w => w.id === shift.workerId);
        const restCheck = checkShiftRestViolation(shift.workerId, shift.dayIndex, start, end, wId, shiftId);
        if (restCheck.hasViolation) {
          const proceed = await showAppConfirm({
            type: 'warning',
            title: 'UPOZORENJE ZA ODMOR (Manje od 9 sati)',
            message: `Promjenom satnice radnik ${worker?.name} imat će manje od 9h propisanog odmora:`,
            details: restCheck.warnings,
            confirmText: 'Ipak spremi smjenu',
            cancelText: 'Odustani'
          });
          if (!proceed) {
            await loadData(wId);
            return;
          }
        }
      }

      // Optimistic update
      setWeeks(prev => prev.map(w => {
        if (w.id !== wId) return w;
        return {
          ...w,
          shifts: w.shifts.map(s => s.id === shiftId ? { ...s, start, end } : s)
        };
      }));

      await api.updateShift(shiftId, { start, end });
      showToast('Radno vrijeme ažurirano!');
    } catch (err) {
      await loadData(activeWeekId);
      showAppAlert({ type: 'error', title: 'Greška pri ažuriranju satnice', message: err.message });
    }
  };

  // Shift: Quick assign worker from sidebar or drop
  const handleAssignWorkerQuick = async (workerId, locationId, dayIdx, customStart = null, customEnd = null, targetWeekId = null) => {
    try {
      setHasUnsavedChanges(true);
      const wId = targetWeekId || activeWeekId;
      const worker = workers.find(w => w.id === workerId);
      const loc = locations.find(l => l.id === locationId);
      const start = customStart !== null ? customStart : (loc ? loc.openHour : 7);
      const end = customEnd !== null ? customEnd : Math.min(start + (worker?.defaultHours || 8), 27);

      // 1. Strict Prevention: Same-Day / Multi-Location (In-page alert)
      const conflict = checkSameDayShiftConflict(workerId, dayIdx, wId);
      if (conflict.hasConflict) {
        showToast(`⛔ Radnik već ima smjenu na dan ${DAYS[dayIdx]}!`, 'error');
        await showAppAlert({
          type: 'danger',
          title: 'ZABRANJENO: Dupla smjena / lokal',
          message: `Radnik ${worker?.name} već ima raspoređenu smjenu na dan ${DAYS[dayIdx]} u lokalu "${conflict.locName}" (${formatTime(conflict.existingShift.start)} - ${formatTime(conflict.existingShift.end)})!\n\nJedan radnik ne može raditi 2x u istom danu niti u dva lokala istovremeno.`
        });
        return;
      }

      // 2. Warning with Override: 9h rest interval (In-page confirm)
      const restCheck = checkShiftRestViolation(workerId, dayIdx, start, end, wId);
      if (restCheck.hasViolation) {
        const proceed = await showAppConfirm({
          type: 'warning',
          title: 'UPOZORENJE ZA ODMOR (Manje od 9 sati)',
          message: `Radnik ${worker?.name} imat će manje od 9h propisanog odmora između smjena:`,
          details: restCheck.warnings,
          confirmText: 'Ipak dodaj smjenu',
          cancelText: 'Odustani / Izaberi drugog'
        });
        if (!proceed) return;
      }

      await api.addShift({
        weekId: wId,
        workerId,
        locationId,
        dayIndex: dayIdx,
        start,
        end
      });

      showToast(`${worker?.name} uspješno dodan/a u smjenu!`);
      await loadData(wId);
    } catch (err) {
      showAppAlert({ type: 'error', title: 'Greška pri dodjeli smjene', message: err.message });
    }
  };

  // Shift: Move to another cell (day & location)
  const handleMoveShiftToCell = async (shiftId, newDayIdx, newLocId, targetWeekId = null) => {
    try {
      setHasUnsavedChanges(true);
      const wId = targetWeekId || activeWeekId;
      const targetWeek = weeks.find(w => w.id === wId) || currentWeek;
      const shift = targetWeek?.shifts?.find(s => s.id === shiftId);
      if (!shift) return;

      const worker = workers.find(w => w.id === shift.workerId);

      // Check conflict if changing day or location
      if (shift.dayIndex !== newDayIdx || shift.locationId !== newLocId) {
        const conflict = checkSameDayShiftConflict(shift.workerId, newDayIdx, wId, shiftId);
        if (conflict.hasConflict) {
          showToast(`⛔ Radnik već ima smjenu na dan ${DAYS[newDayIdx]}!`, 'error');
          await showAppAlert({
            type: 'danger',
            title: 'ZABRANJENO: Premještanje smjene',
            message: `Radnik ${worker?.name} već ima smjenu na dan ${DAYS[newDayIdx]} u lokalu "${conflict.locName}". Radnik ne može imati 2 smjene na isti dan.`
          });
          return;
        }

        const restCheck = checkShiftRestViolation(shift.workerId, newDayIdx, shift.start, shift.end, wId, shiftId);
        if (restCheck.hasViolation) {
          const proceed = await showAppConfirm({
            type: 'warning',
            title: 'UPOZORENJE ZA ODMOR (Manje od 9 sati)',
            message: `Premještanjem smjene radnik ${worker?.name} imat će manje od 9h propisanog odmora:`,
            details: restCheck.warnings,
            confirmText: 'Ipak premjesti',
            cancelText: 'Odustani'
          });
          if (!proceed) return;
        }
      }

      await api.updateShift(shiftId, { dayIndex: newDayIdx, locationId: newLocId });
      showToast('Smjena premještena!');
      await loadData(wId);
    } catch (err) {
      showAppAlert({ type: 'error', title: 'Greška pri premještanju smjene', message: err.message });
    }
  };

  // Absence: Apply Sick or Free Day
  const handleApplyAbsence = async ({ weekId, workerId, type, fromDay, toDay, note }) => {
    try {
      setHasUnsavedChanges(true);
      const targetWeekId = weekId || activeWeekId;
      await api.setWorkerStatus({
        weekId: targetWeekId,
        workerId,
        fromDay,
        toDay,
        status: type,
        note
      });
      showToast(type === 'sick' ? '🏥 Bolovanje prijavljeno i smjene arhivirane.' : 'Slobodni dani postavljeni.');
      await loadData(targetWeekId);
    } catch (err) {
      showAppAlert({ type: 'error', title: 'Greška pri postavljanju odsustva', message: err.message });
    }
  };

  // Absence: Clear Sick and Restore Shifts
  const handleClearWorkerSick = async (workerId, fromDay, restoreShifts) => {
    try {
      setHasUnsavedChanges(true);
      await api.clearWorkerSick({
        weekId: activeWeekId,
        workerId,
        fromDay,
        restoreShifts
      });
      showToast('✅ Bolovanje prekinuto i radnik vraćen u smjene!');
      await loadData(activeWeekId);
    } catch (err) {
      showAppAlert({ type: 'error', title: 'Greška pri prekidu bolovanja', message: err.message });
    }
  };

  // Copy Day Shifts
  const handleCopyDay = async (sourceDay, targetDays) => {
    try {
      setHasUnsavedChanges(true);
      await api.copyDayShifts({
        weekId: activeWeekId,
        sourceDay,
        targetDays
      });
      showToast('Raspored dana uspješno prekopiran!');
      await loadData(activeWeekId);
    } catch (err) {
      showAppAlert({ type: 'error', title: 'Greška pri kopiranju dana', message: err.message });
    }
  };

  // Worker: Save
  const handleSaveWorker = async (workerData) => {
    try {
      setHasUnsavedChanges(true);
      if (workerData.id) {
        await api.updateWorker(workerData.id, workerData);
        showToast('Podaci o radniku ažurirani u bazi!');
      } else {
        await api.addWorker(workerData);
        showToast('Novi radnik uspješno dodan u bazu!');
      }
      await loadData(activeWeekId);
    } catch (err) {
      showAppAlert({ type: 'error', title: 'Greška pri spremanju radnika', message: err.message });
    }
  };

  // Worker: Delete
  const handleDeleteWorker = async (workerId) => {
    try {
      setHasUnsavedChanges(true);
      await api.deleteWorker(workerId);
      showToast('Radnik obrisan.');
      await loadData(activeWeekId);
    } catch (err) {
      showAppAlert({ type: 'error', title: 'Greška pri brisanju radnika', message: err.message });
    }
  };

  // Location: Save
  const handleSaveLocation = async (locData) => {
    try {
      setHasUnsavedChanges(true);
      if (locData.id) {
        await api.updateLocation(locData.id, locData);
        showToast('Lokal ažuriran!');
      } else {
        await api.addLocation(locData);
        showToast('Novi lokal kreiran u bazi!');
      }
      await loadData(activeWeekId);
    } catch (err) {
      showAppAlert({ type: 'error', title: 'Greška pri spremanju lokala', message: err.message });
    }
  };

  // Location: Delete
  const handleDeleteLocation = async (locId) => {
    try {
      setHasUnsavedChanges(true);
      await api.deleteLocation(locId);
      showToast('Lokal obrisan.');
      await loadData(activeWeekId);
    } catch (err) {
      showAppAlert({ type: 'error', title: 'Greška pri brisanju lokala', message: err.message });
    }
  };

  // Week: Create
  const handleCreateWeek = async (weekData) => {
    try {
      setHasUnsavedChanges(true);
      const newWeek = await api.addWeek(weekData);
      showToast('Nova sedmica kreirana u bazi!');
      await loadData(newWeek.id);
      setActiveDay(0);
    } catch (err) {
      showAppAlert({ type: 'error', title: 'Greška pri kreiranju sedmice', message: err.message });
    }
  };

  // Week: Delete
  const handleDeleteWeek = async (weekId) => {
    if (weeks.length <= 1) {
      await showAppAlert({
        type: 'warning',
        title: 'Upozorenje',
        message: 'Mora postojati barem jedna sedmica u rasporedu!'
      });
      return;
    }
    const proceed = await showAppConfirm({
      type: 'danger',
      title: 'Brisanje sedmice',
      message: 'Jeste li sigurni da želite obrisati ovu sedmicu i sve njene smjene iz baze podataka?',
      confirmText: 'Obriši sedmicu',
      cancelText: 'Odustani'
    });
    if (!proceed) return;

    try {
      setHasUnsavedChanges(true);
      await api.deleteWeek(weekId);
      showToast('Sedmica obrisana.');
      await loadData();
    } catch (err) {
      showAppAlert({ type: 'error', title: 'Greška pri brisanju sedmice', message: err.message });
    }
  };

  // Explicit Save: Save current state to permanent checkpoint
  const handleSaveAll = async () => {
    try {
      const res = await api.saveCurrentState();
      setHasUnsavedChanges(false);
      if (res?.savedAt) setLastSavedTime(res.savedAt);
      showToast('✅ Sve izmjene su uspješno i trajno sačuvane u bazi!');
    } catch (err) {
      showAppAlert({ type: 'error', title: 'Greška pri spremanju', message: err.message });
    }
  };

  // Reset to previous saved state (Revert, NOT hardreset)
  const handleResetToPrevious = async () => {
    if (hasUnsavedChanges) {
      const proceed = await showAppConfirm({
        type: 'warning',
        title: 'Poništavanje nesačuvanih izmjena',
        message: 'Imate nesačuvane izmjene u rasporedu smjena. Želite li poništiti sve izmjene i vratiti raspored na zadnje sačuvano stanje?',
        confirmText: 'Da, poništi izmjene',
        cancelText: 'Odustani'
      });
      if (!proceed) return;
    } else {
      const proceed = await showAppConfirm({
        type: 'info',
        title: 'Vraćanje na zadnje spremljeno stanje',
        message: 'Raspored je već usklađen sa zadnjim spremljenim stanjem. Želite li ponovo osvježiti raspored iz zadnjeg spremanja?',
        confirmText: 'Osvježi iz baze',
        cancelText: 'Odustani'
      });
      if (!proceed) return;
    }

    try {
      const res = await api.revertToSaved();
      setHasUnsavedChanges(false);
      if (res?.savedAt) setLastSavedTime(res.savedAt);
      showToast('↩️ Raspored uspješno vraćen na zadnje spremljeno stanje!');
      await loadData(activeWeekId);
    } catch (err) {
      showAppAlert({ type: 'error', title: 'Greška pri vraćanju', message: err.message });
    }
  };

  // Import Backup
  const handleImportBackup = async (backupData) => {
    try {
      await api.importBackup(backupData);
      showToast('Baza podataka uspješno učitana iz JSON backupa!');
      await loadData();
    } catch (err) {
      showAppAlert({ type: 'error', title: 'Greška pri uvozu backupa', message: err.message });
    }
  };

  if (loading && weeks.length === 0) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-[#090d16] text-white gap-4">
        <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
        <div className="text-sm font-bold tracking-wider uppercase text-slate-400">
          Učitavanje baze podataka Šeherezada Shift Pro...
        </div>
      </div>
    );
  }

  if (error && weeks.length === 0) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-[#090d16] text-white p-6 text-center">
        <AlertCircle className="w-12 h-12 text-rose-500 mb-4" />
        <h2 className="text-xl font-bold mb-2">Greška pri povezivanju sa SQLite bazom podataka</h2>
        <p className="text-slate-400 text-sm max-w-md mb-6">{error}</p>
        <button
          onClick={() => loadData()}
          className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-xs"
        >
          Pokušaj ponovo
        </button>
      </div>
    );
  }

  return (
    <div className={`h-screen w-full flex flex-col overflow-hidden font-sans transition-colors duration-150 ${theme === 'light' ? 'bg-slate-100 text-slate-900' : 'bg-[#090d16] text-slate-100'}`}>
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-emerald-500/50 text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-bold">{toast.message}</span>
        </div>
      )}

      {/* Main App Header */}
      <Header
        weeks={weeks}
        activeWeekId={activeWeekId}
        setActiveWeekId={setActiveWeekId}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenNewWeekModal={() => setShowNewWeekModal(true)}
        onOpenCopyDayModal={() => setShowCopyDayModal(true)}
        onResetPrevious={handleResetToPrevious}
        onDeleteWeek={handleDeleteWeek}
        theme={theme}
        toggleTheme={toggleTheme}
        hasUnsavedChanges={hasUnsavedChanges}
        onSave={handleSaveAll}
      />

      {/* View Content */}
      <main className="flex-1 flex w-full min-w-0 overflow-hidden">
        {activeTab === 'timeline' && currentWeek && (
          <TimelineView
            week={currentWeek}
            workers={workers}
            locations={locations}
            activeDay={activeDay}
            setActiveDay={setActiveDay}
            onOpenAddShiftModal={(params) => setShiftModal({ isOpen: true, shift: null, newShiftParams: params })}
            onOpenEditShiftModal={(shift) => setShiftModal({ isOpen: true, shift, newShiftParams: null })}
            onOpenAbsenceModal={(config) => setAbsenceModal({ isOpen: true, config })}
            onAssignWorkerQuick={handleAssignWorkerQuick}
            onClearWorkerSick={handleClearWorkerSick}
            onUpdateShiftTime={handleUpdateShiftTime}
            onDeleteShift={handleDeleteShift}
          />
        )}

        {activeTab === 'grid' && weeks.length > 0 && (
          <GridView
            weeks={weeks}
            workers={workers}
            locations={locations}
            onOpenAddShiftModal={(params) => setShiftModal({ isOpen: true, shift: null, newShiftParams: params })}
            onOpenEditShiftModal={(shift) => setShiftModal({ isOpen: true, shift, newShiftParams: null })}
            onOpenAbsenceModal={(config) => setAbsenceModal({ isOpen: true, config })}
            onMoveShiftToCell={handleMoveShiftToCell}
            onAssignWorkerQuick={handleAssignWorkerQuick}
            onUpdateShiftTime={handleUpdateShiftTime}
            onDeleteShift={handleDeleteShift}
            onClearWorkerSick={handleClearWorkerSick}
            activeDay={activeDay}
            setActiveDay={setActiveDay}
          />
        )}

        {activeTab === 'workers' && (
          <WorkersView
            workers={workers}
            locations={locations}
            week={currentWeek}
            onOpenAddWorkerModal={() => setWorkerModal({ isOpen: true, worker: null })}
            onOpenEditWorkerModal={(worker) => setWorkerModal({ isOpen: true, worker })}
            onDeleteWorker={handleDeleteWorker}
          />
        )}

        {activeTab === 'locations' && (
          <LocationsView
            locations={locations}
            week={currentWeek}
            onOpenAddLocationModal={() => setLocationModal({ isOpen: true, location: null })}
            onOpenEditLocationModal={(location) => setLocationModal({ isOpen: true, location })}
            onDeleteLocation={handleDeleteLocation}
          />
        )}

        {activeTab === 'stats' && currentWeek && (
          <StatsView
            week={currentWeek}
            workers={workers}
            locations={locations}
          />
        )}

        {activeTab === 'print' && currentWeek && (
          <PrintSheetView
            week={currentWeek}
            workers={workers}
            locations={locations}
            onShowToast={showToast}
            onImportBackup={handleImportBackup}
          />
        )}
      </main>

      {/* Modals */}
      <ShiftModal
        isOpen={shiftModal.isOpen}
        onClose={() => setShiftModal({ isOpen: false, shift: null, newShiftParams: null })}
        shift={shiftModal.shift}
        newShiftParams={shiftModal.newShiftParams}
        workers={workers}
        locations={locations}
        weeks={weeks}
        activeWeekId={activeWeekId}
        onSaveShift={handleSaveShift}
        onDeleteShift={handleDeleteShift}
        showAppAlert={showAppAlert}
        showAppConfirm={showAppConfirm}
      />

      <WorkerModal
        isOpen={workerModal.isOpen}
        onClose={() => setWorkerModal({ isOpen: false, worker: null })}
        worker={workerModal.worker}
        locations={locations}
        onSaveWorker={handleSaveWorker}
        onDeleteWorker={handleDeleteWorker}
        showAppAlert={showAppAlert}
        showAppConfirm={showAppConfirm}
      />

      <LocationModal
        isOpen={locationModal.isOpen}
        onClose={() => setLocationModal({ isOpen: false, location: null })}
        location={locationModal.location}
        onSaveLocation={handleSaveLocation}
        onDeleteLocation={handleDeleteLocation}
        showAppAlert={showAppAlert}
        showAppConfirm={showAppConfirm}
      />

      <AbsenceModal
        isOpen={absenceModal.isOpen}
        onClose={() => setAbsenceModal({ isOpen: false, config: null })}
        config={absenceModal.config}
        workers={workers}
        weeks={weeks}
        onApplyAbsence={handleApplyAbsence}
      />

      <NewWeekModal
        isOpen={showNewWeekModal}
        onClose={() => setShowNewWeekModal(false)}
        lastWeek={weeks[weeks.length - 1]}
        onCreateWeek={handleCreateWeek}
      />

      <CopyDayModal
        isOpen={showCopyDayModal}
        onClose={() => setShowCopyDayModal(false)}
        activeDay={activeDay}
        onCopyDay={handleCopyDay}
        showAppAlert={showAppAlert}
      />

      {/* In-Page Custom App Dialog (Alerts, Warnings & Confirms) */}
      <AppDialog
        isOpen={Boolean(appDialog?.isOpen)}
        type={appDialog?.type || 'error'}
        title={appDialog?.title}
        message={appDialog?.message}
        details={appDialog?.details}
        confirmText={appDialog?.confirmText || 'U redu'}
        cancelText={appDialog?.cancelText}
        onConfirm={appDialog?.onConfirm}
        onCancel={appDialog?.onCancel}
      />
    </div>
  );
}
