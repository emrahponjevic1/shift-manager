import React, { useState, useEffect } from 'react';
import { 
  X, 
  Clock, 
  Users, 
  MapPin, 
  Calendar, 
  HeartPulse, 
  Check, 
  Trash2, 
  Copy,
  AlertTriangle,
  AlertOctagon
} from 'lucide-react';
import { 
  DAYS, 
  START_HOUR, 
  END_HOUR, 
  formatTime, 
  SHIFT_PRESETS, 
  LOCATION_THEMES 
} from '../constants';

// 1. Shift Modal (Add or Edit)
export function ShiftModal({
  isOpen,
  onClose,
  shift, // if editing
  newShiftParams, // if adding { dayIdx, locId, weekId }
  workers = [],
  locations = [],
  weeks = [],
  activeWeekId,
  onSaveShift,
  onDeleteShift,
  showAppAlert,
  showAppConfirm
}) {
  if (!isOpen) return null;

  const isEditing = Boolean(shift);
  const targetWeekId = shift?.weekId || newShiftParams?.weekId || activeWeekId;
  const targetWeek = weeks?.find(w => w.id === targetWeekId) || weeks?.[0];
  const targetShifts = targetWeek?.shifts || [];

  const [workerId, setWorkerId] = useState(shift ? shift.workerId : (workers[0]?.id || ''));
  const [locationId, setLocationId] = useState(shift ? shift.locationId : (newShiftParams?.locId || locations[0]?.id || ''));
  const [dayIndex, setDayIndex] = useState(shift ? shift.dayIndex : (newShiftParams?.dayIdx ?? 0));
  const [start, setStart] = useState(shift ? shift.start : 7);
  const [end, setEnd] = useState(shift ? shift.end : 15);
  const [note, setNote] = useState(shift ? shift.note || '' : '');
  const [showRestConfirm, setShowRestConfirm] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setWorkerId(shift ? shift.workerId : (workers[0]?.id || ''));
      setLocationId(shift ? shift.locationId : (newShiftParams?.locId || locations[0]?.id || ''));
      setDayIndex(shift ? shift.dayIndex : (newShiftParams?.dayIdx ?? 0));
      setStart(shift ? shift.start : 7);
      setEnd(shift ? shift.end : 15);
      setNote(shift ? shift.note || '' : '');
      setShowRestConfirm(false);
    }
  }, [isOpen, shift, newShiftParams]);

  // Reset confirmation whenever user alters worker, day or times
  useEffect(() => {
    setShowRestConfirm(false);
  }, [workerId, dayIndex, start, end]);

  const applyPreset = (preset) => {
    setStart(preset.start);
    setEnd(preset.end);
  };

  const selectedWorker = workers.find(w => w.id === workerId);
  const selectedLocation = locations.find(l => l.id === locationId);

  // 1. Same-Day Duplicate & Multi-Location Conflict Rule (Strict Prevention)
  const sameDayConflict = targetShifts.find(s => 
    s.workerId === workerId && 
    Number(s.dayIndex) === Number(dayIndex) && 
    s.id !== shift?.id
  );
  const conflictLoc = sameDayConflict ? locations.find(l => l.id === sameDayConflict.locationId) : null;

  // 2. 9-Hour Rest Interval Calculation (Warning with Override)
  const currentWeekIdx = weeks ? weeks.findIndex(w => w.id === targetWeekId) : -1;
  const d = Number(dayIndex);
  const sStart = Number(start);
  const sEnd = Number(end);

  // Previous Day Shift
  let prevShift = null;
  let prevDayLabel = '';
  if (d > 0) {
    prevShift = targetShifts.find(s => s.workerId === workerId && Number(s.dayIndex) === d - 1);
    prevDayLabel = DAYS[d - 1];
  } else if (d === 0 && currentWeekIdx > 0) {
    const prevWeek = weeks[currentWeekIdx - 1];
    prevShift = prevWeek?.shifts?.find(s => s.workerId === workerId && Number(s.dayIndex) === 6);
    prevDayLabel = `Nedjelja (${prevWeek?.title || 'prethodna sedmica'})`;
  }

  // Next Day Shift
  let nextShift = null;
  let nextDayLabel = '';
  if (d < 6) {
    nextShift = targetShifts.find(s => s.workerId === workerId && Number(s.dayIndex) === d + 1);
    nextDayLabel = DAYS[d + 1];
  } else if (d === 6 && currentWeekIdx >= 0 && currentWeekIdx < weeks.length - 1) {
    const nextWeek = weeks[currentWeekIdx + 1];
    nextShift = nextWeek?.shifts?.find(s => s.workerId === workerId && Number(s.dayIndex) === 0);
    nextDayLabel = `Ponedjeljak (${nextWeek?.title || 'naredna sedmica'})`;
  }

  const restWarnings = [];
  if (prevShift) {
    const restBefore = (24 + sStart) - Number(prevShift.end);
    if (restBefore < 9) {
      const prevLocName = locations.find(l => l.id === prevShift.locationId)?.name || 'lokalu';
      restWarnings.push({
        type: 'before',
        hours: restBefore,
        message: `Samo ${restBefore}h odmora prije ove smjene! Prethodna smjena (${prevDayLabel} u "${prevLocName}") završava u ${formatTime(prevShift.end)}, a ova smjena počinje u ${formatTime(sStart)}. (Propisani odmor: najmanje 9h).`
      });
    }
  }

  if (nextShift) {
    const restAfter = (24 + Number(nextShift.start)) - sEnd;
    if (restAfter < 9) {
      const nextLocName = locations.find(l => l.id === nextShift.locationId)?.name || 'lokalu';
      restWarnings.push({
        type: 'after',
        hours: restAfter,
        message: `Samo ${restAfter}h odmora nakon ove smjene! Ova smjena završava u ${formatTime(sEnd)}, a naredna smjena (${nextDayLabel} u "${nextLocName}") počinje u ${formatTime(nextShift.start)}. (Propisani odmor: najmanje 9h).`
      });
    }
  }

  const executeSave = () => {
    if (end <= start) {
      showAppAlert?.({
        type: 'warning',
        title: 'Neispravno radno vrijeme',
        message: 'Vrijeme završetka smjene mora biti nakon vremena početka!'
      });
      return;
    }
    onSaveShift({
      id: shift?.id,
      weekId: targetWeekId,
      workerId,
      locationId,
      dayIndex: Number(dayIndex),
      start: Number(start),
      end: Number(end),
      note
    });
    onClose();
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (sameDayConflict) return;

    if (end <= start) {
      showAppAlert?.({
        type: 'warning',
        title: 'Neispravno radno vrijeme',
        message: 'Vrijeme završetka smjene mora biti nakon vremena početka!'
      });
      return;
    }

    // If rest warning exists and user has not confirmed yet, trigger confirmation prompt
    if (restWarnings.length > 0 && !showRestConfirm) {
      setShowRestConfirm(true);
      return;
    }

    executeSave();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
        <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-800">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-400" />
            {isEditing ? 'Uredi Smjenu' : 'Nova Smjena'}
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleFormSubmit} className="space-y-4">
          {/* Worker Select */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>Radnik:</span>
              {sameDayConflict && (
                <span className="text-rose-400 font-extrabold text-[11px] flex items-center gap-1 lowercase">
                  <AlertOctagon className="w-3.5 h-3.5" /> već radi na ovaj dan
                </span>
              )}
            </label>
            <select
              value={workerId}
              onChange={(e) => setWorkerId(e.target.value)}
              className={`w-full bg-slate-950 border rounded-xl px-3 py-2 text-sm text-white font-semibold outline-none transition-colors ${
                sameDayConflict ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
              }`}
              required
            >
              {workers.map(w => {
                const hasShift = targetShifts.some(s => s.workerId === w.id && Number(s.dayIndex) === Number(dayIndex) && s.id !== shift?.id);
                return (
                  <option key={w.id} value={w.id} className={hasShift ? 'text-rose-400 bg-slate-900 font-bold' : ''}>
                    {w.name} {hasShift ? `(⛔ Već radi na ${DAYS[dayIndex]})` : `(${w.role || 'Radnik'})`}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Location & Day Select */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Lokal:</label>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-semibold outline-none focus:border-blue-500"
              >
                {locations.map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Dan:</label>
              <select
                value={dayIndex}
                onChange={(e) => setDayIndex(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-semibold outline-none focus:border-blue-500"
              >
                {DAYS.map((d, i) => (
                  <option key={i} value={i}>{d}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Time Picker */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Početak smjene:</label>
              <select
                value={start}
                onChange={(e) => setStart(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono text-emerald-400 font-bold outline-none focus:border-blue-500"
              >
                {Array.from({ length: 22 }).map((_, i) => {
                  const h = START_HOUR + i;
                  return <option key={h} value={h}>{formatTime(h)}</option>;
                })}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Završetak smjene:</label>
              <select
                value={end}
                onChange={(e) => setEnd(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono text-blue-400 font-bold outline-none focus:border-blue-500"
              >
                {Array.from({ length: 22 }).map((_, i) => {
                  const h = START_HOUR + 1 + i;
                  return <option key={h} value={h}>{formatTime(h)} ({h - start > 0 ? `${h - start}h` : ''})</option>;
                })}
              </select>
            </div>
          </div>

          {/* Same-day / Multi-location Conflict Error Banner */}
          {sameDayConflict && (
            <div className="p-3.5 rounded-xl bg-rose-950/70 border-2 border-rose-500/70 text-rose-200 text-xs flex items-start gap-3 shadow-lg shadow-rose-950/40 animate-in fade-in duration-150">
              <AlertOctagon className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-black text-rose-100 text-sm">
                  ⛔ ZABRANJENO: Radnik već ima smjenu!
                </div>
                <div className="text-rose-200 leading-snug">
                  Radnik <strong className="text-white underline">{selectedWorker?.name}</strong> je već raspoređen/a na dan <strong className="text-white">{DAYS[dayIndex]}</strong> u lokalu <strong className="text-white">{conflictLoc?.name || 'drugom lokalu'}</strong> ({formatTime(sameDayConflict.start)} - {formatTime(sameDayConflict.end)}).
                </div>
                <div className="text-[11px] text-rose-300 font-medium pt-0.5">
                  Jedan radnik ne može raditi 2x u istom danu niti u dva lokala istovremeno. Izaberite drugog radnika ili drugi dan.
                </div>
              </div>
            </div>
          )}

          {/* 9-Hour Rest Interval Warning Banner */}
          {!sameDayConflict && restWarnings.length > 0 && (
            <div className="p-3.5 rounded-xl bg-amber-500/15 border-2 border-amber-500/50 text-amber-200 text-xs space-y-2 shadow-lg shadow-amber-950/30 animate-in fade-in duration-150">
              <div className="flex items-center gap-2 font-black text-amber-300 text-sm">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>UPOZORENJE: Manje od 9 sati odmora!</span>
              </div>
              <div className="space-y-1.5 pl-1">
                {restWarnings.map((w, idx) => (
                  <div key={idx} className="text-amber-200/90 leading-relaxed font-medium">
                    • {w.message}
                  </div>
                ))}
              </div>
              <div className="text-[11px] text-amber-300/80 italic border-t border-amber-500/20 pt-1.5">
                Ovo je samo upozorenje. Možete odustati i izabrati drugog radnika, ili potvrditi da ga ipak želite staviti u smjenu.
              </div>
            </div>
          )}

          {/* Presets */}
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1.5">Brzi šabloni radnog vremena:</label>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 bg-slate-950/60 rounded-xl border border-slate-800">
              {SHIFT_PRESETS.map((p, idx) => (
                <button
                  type="button"
                  key={idx}
                  onClick={() => applyPreset(p)}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-blue-600/80 text-[11px] font-medium text-slate-300 hover:text-white transition-colors"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Actions & Confirmation */}
          <div className="pt-4 border-t border-slate-800 mt-6 space-y-3">
            {showRestConfirm && !sameDayConflict ? (
              <div className="p-3.5 rounded-xl bg-amber-950/90 border-2 border-amber-500/70 shadow-2xl space-y-2.5 animate-in zoom-in-95 duration-150">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-extrabold text-sm text-white">Potvrda rasporeda sa skraćenim odmorom</div>
                    <div className="text-xs text-amber-200 mt-1 leading-snug">
                      Radnik <strong className="text-white underline">{selectedWorker?.name}</strong> imat će manje od 9 sati odmora ({restWarnings.map(w => `${w.hours}h`).join(', ')}). Želite li ga ipak rasporediti u ovu smjenu?
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowRestConfirm(false)}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors cursor-pointer"
                  >
                    Odustani / Izaberi drugog
                  </button>
                  <button
                    type="button"
                    onClick={executeSave}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-lg shadow-amber-500/30 transition-colors cursor-pointer"
                  >
                    Ipak spremi smjenu
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex justify-between items-center">
                {isEditing ? (
                  <button
                    type="button"
                    onClick={async () => {
                      const proceed = await showAppConfirm?.({
                        type: 'danger',
                        title: 'Uklanjanje smjene',
                        message: 'Jeste li sigurni da želite obrisati ovu smjenu iz rasporeda?',
                        confirmText: 'Ukloni smjenu',
                        cancelText: 'Odustani'
                      });
                      if (proceed) {
                        onDeleteShift(shift.id);
                        onClose();
                      }
                    }}
                    className="px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-1.5 transition-colors border border-rose-500/30 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" /> Ukloni
                  </button>
                ) : <div />}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
                  >
                    Odustani
                  </button>

                  {sameDayConflict ? (
                    <button
                      type="button"
                      disabled
                      className="px-5 py-2 rounded-xl bg-slate-800 text-slate-500 text-xs font-bold border border-slate-700 cursor-not-allowed opacity-60 flex items-center gap-1.5"
                    >
                      <AlertOctagon className="w-4 h-4 text-rose-500" />
                      Nemoguće spremiti
                    </button>
                  ) : (
                    <button
                      type="submit"
                      className={`px-5 py-2 rounded-xl text-white text-xs font-bold shadow-lg transition-all cursor-pointer ${
                        restWarnings.length > 0
                          ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/30'
                          : 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/30'
                      }`}
                    >
                      {isEditing ? 'Spremi Izmjene' : '+ Dodaj Smjenu'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

// 2. Worker Modal (Add or Edit)
export function WorkerModal({
  isOpen,
  onClose,
  worker, // if editing
  locations,
  onSaveWorker,
  onDeleteWorker,
  showAppAlert,
  showAppConfirm
}) {
  if (!isOpen) return null;

  const isEditing = Boolean(worker);
  const [name, setName] = useState(worker ? worker.name : '');
  const [defaultHours, setDefaultHours] = useState(worker ? worker.defaultHours : 8);
  const [primaryLoc, setPrimaryLoc] = useState(worker ? worker.primaryLoc || '' : locations[0]?.id || '');
  const [role, setRole] = useState(worker ? worker.role || 'Radnik' : 'Radnik');
  const [phone, setPhone] = useState(worker ? worker.phone || '' : '');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSaveWorker({
      id: worker?.id,
      name: name.trim(),
      defaultHours: Number(defaultHours),
      primaryLoc,
      role: role.trim(),
      phone: phone.trim()
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
        <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-800">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            {isEditing ? 'Uredi Radnika' : 'Novi Radnik'}
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Ime i Prezime:</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="npr. Elvisa, Murat..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-semibold outline-none focus:border-blue-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Standardni sati:</label>
              <select
                value={defaultHours}
                onChange={(e) => setDefaultHours(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-semibold outline-none focus:border-blue-500"
              >
                <option value={8}>8h (Puno vrijeme)</option>
                <option value={10}>10h (Smjena 10h)</option>
                <option value={6}>6h (Skraćeno)</option>
                <option value={4}>4h (Pola radnog vremena)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Pozicija / Uloga:</label>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="npr. Jutro, Noćna..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Glavni lokal:</label>
              <select
                value={primaryLoc}
                onChange={(e) => setPrimaryLoc(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-semibold outline-none focus:border-blue-500"
              >
                {locations.map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Telefon:</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+387..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-slate-800 mt-6">
            {isEditing ? (
              <button
                type="button"
                onClick={async () => {
                  const proceed = await showAppConfirm?.({
                    type: 'danger',
                    title: 'Brisanje radnika',
                    message: `Jeste li sigurni da želite obrisati radnika "${worker.name}"?\nSve njegove smjene bit će trajno uklonjene iz baze.`,
                    confirmText: 'Obriši radnika',
                    cancelText: 'Odustani'
                  });
                  if (proceed) {
                    onDeleteWorker(worker.id);
                    onClose();
                  }
                }}
                className="px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-1.5 transition-colors border border-rose-500/30 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" /> Obriši
              </button>
            ) : <div />}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
              >
                Odustani
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition-all"
              >
                {isEditing ? 'Spremi' : '+ Dodaj'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// 3. Location Modal (Add or Edit)
export function LocationModal({
  isOpen,
  onClose,
  location, // if editing
  onSaveLocation,
  onDeleteLocation,
  showAppAlert,
  showAppConfirm
}) {
  if (!isOpen) return null;

  const isEditing = Boolean(location);
  const [name, setName] = useState(location ? location.name : '');
  const [theme, setTheme] = useState(location ? location.theme : 'blue');
  const [openHour, setOpenHour] = useState(location ? location.openHour : 7);
  const [closeHour, setCloseHour] = useState(location ? location.closeHour : 25);
  const [minWorkers, setMinWorkers] = useState(location ? location.minWorkers : 2);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSaveLocation({
      id: location?.id,
      name: name.trim(),
      theme,
      openHour: Number(openHour),
      closeHour: Number(closeHour),
      minWorkers: Number(minWorkers)
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
        <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-800">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <MapPin className="w-5 h-5 text-emerald-400" />
            {isEditing ? 'Uredi Lokal' : 'Novi Lokal'}
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Naziv Lokala:</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="npr. Trubarjeva, Bavarski Dvor..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-semibold outline-none focus:border-blue-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Boja / Tema:</label>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-semibold outline-none focus:border-blue-500"
              >
                {Object.values(LOCATION_THEMES).map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Min. radnika po satu:</label>
              <input
                type="number"
                min="1"
                max="10"
                value={minWorkers}
                onChange={(e) => setMinWorkers(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-semibold outline-none focus:border-blue-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Otvaranje:</label>
              <select
                value={openHour}
                onChange={(e) => setOpenHour(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono outline-none focus:border-blue-500"
              >
                {Array.from({ length: 18 }).map((_, i) => (
                  <option key={i + 6} value={i + 6}>{formatTime(i + 6)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Zatvaranje:</label>
              <select
                value={closeHour}
                onChange={(e) => setCloseHour(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono outline-none focus:border-blue-500"
              >
                {Array.from({ length: 18 }).map((_, i) => (
                  <option key={i + 12} value={i + 12}>{formatTime(i + 12)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-slate-800 mt-6">
            {isEditing ? (
              <button
                type="button"
                onClick={async () => {
                  const proceed = await showAppConfirm?.({
                    type: 'danger',
                    title: 'Brisanje lokala',
                    message: `Jeste li sigurni da želite obrisati lokal "${location.name}"?\nSve smjene u tom lokalu bit će trajno uklonjene.`,
                    confirmText: 'Obriši lokal',
                    cancelText: 'Odustani'
                  });
                  if (proceed) {
                    onDeleteLocation(location.id);
                    onClose();
                  }
                }}
                className="px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-1.5 transition-colors border border-rose-500/30 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" /> Obriši
              </button>
            ) : <div />}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
              >
                Odustani
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 transition-all"
              >
                {isEditing ? 'Spremi' : '+ Kreiraj'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// 4. Absence Modal (Sick leave or Free day with date range)
export function AbsenceModal({
  isOpen,
  onClose,
  config, // { workerId, type: 'free' | 'sick', fromDay: 0, toDay: 6, weekId }
  workers,
  weeks,
  onApplyAbsence
}) {
  if (!isOpen) return null;

  const [selectedWorkerId, setSelectedWorkerId] = useState(config?.workerId || workers[0]?.id || '');
  const [selectedWeekId, setSelectedWeekId] = useState(config?.weekId || (weeks && weeks[0]?.id) || '');
  const [type, setType] = useState(config?.type || 'free');
  const [fromDay, setFromDay] = useState(config?.fromDay ?? 0);
  const [toDay, setToDay] = useState(config?.toDay ?? 6);
  const [note, setNote] = useState('');

  const worker = workers.find(w => w.id === selectedWorkerId);

  // Quick range helpers
  const setRangeTodayOnly = () => {
    setToDay(fromDay);
  };

  const setRangeUntilSunday = () => {
    setToDay(6);
  };

  const setRangeWholeWeek = () => {
    setFromDay(0);
    setToDay(6);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onApplyAbsence({
      weekId: selectedWeekId,
      workerId: selectedWorkerId,
      type,
      fromDay: Number(fromDay),
      toDay: Number(toDay),
      note
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
        <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-800">
          <h3 className="text-base font-black text-white flex items-center gap-2">
            <HeartPulse className="w-5 h-5 text-rose-400" />
            {type === 'sick' ? 'Prijava Bolovanja (Raspon Datuma)' : 'Slobodni Dani (Raspon Datuma)'}
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Worker Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Radnik:</label>
            <select
              value={selectedWorkerId}
              onChange={(e) => setSelectedWorkerId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-bold outline-none focus:border-blue-500"
            >
              {workers.map(w => (
                <option key={w.id} value={w.id}>{w.name} ({w.role || 'Radnik'})</option>
              ))}
            </select>
          </div>

          {/* Week Selector if multiple exist */}
          {weeks && weeks.length > 1 && (
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Sedmica:</label>
              <select
                value={selectedWeekId}
                onChange={(e) => setSelectedWeekId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-semibold outline-none focus:border-blue-500"
              >
                {weeks.map(wk => (
                  <option key={wk.id} value={wk.id}>{wk.title}</option>
                ))}
              </select>
            </div>
          )}

          {/* Type Toggle: Free Day vs Sick Leave */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Status:</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType('free')}
                className={`py-2 px-3 rounded-xl text-xs font-extrabold border transition-all ${
                  type === 'free'
                    ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/30'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-850'
                }`}
              >
                Slobodan Dan
              </button>
              <button
                type="button"
                onClick={() => setType('sick')}
                className={`py-2 px-3 rounded-xl text-xs font-extrabold border transition-all ${
                  type === 'sick'
                    ? 'bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-600/30'
                    : 'bg-slate-950 text-rose-400 border-slate-800 hover:bg-slate-850'
                }`}
              >
                🏥 Bolovanje
              </button>
            </div>
          </div>

          {/* Quick Range Presets */}
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Brzi raspon:</div>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={setRangeTodayOnly}
                className="flex-1 py-1 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-slate-300 hover:text-white transition-colors"
              >
                Samo {DAYS[fromDay]}
              </button>
              <button
                type="button"
                onClick={setRangeUntilSunday}
                className="flex-1 py-1 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-slate-300 hover:text-white transition-colors"
              >
                Do Nedjelje
              </button>
              <button
                type="button"
                onClick={setRangeWholeWeek}
                className="flex-1 py-1 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-slate-300 hover:text-white transition-colors"
              >
                Cijela sedmica
              </button>
            </div>
          </div>

          {/* From Day and To Day Dropdowns */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Od dana:</label>
              <select
                value={fromDay}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setFromDay(val);
                  if (toDay < val) setToDay(val);
                }}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-blue-500"
              >
                {DAYS.map((d, i) => (
                  <option key={i} value={i}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Do dana (uključivo):</label>
              <select
                value={toDay}
                onChange={(e) => setToDay(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-blue-500"
              >
                {DAYS.map((d, i) => (
                  <option key={i} value={i} disabled={i < fromDay}>{d}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Optional Note */}
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1">Napomena (opcionalno):</label>
            <input
              type="text"
              placeholder="npr. Godišnji odmor, Pregled kod ljekara..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-blue-500"
            />
          </div>

          <p className="text-[11px] text-slate-400 italic">
            * Za odabrani raspon dana ({DAYS[fromDay]} - {DAYS[toDay]}), smjene se automatski uklanjaju. Ako je bolovanje, prethodne smjene se spremaju u arhivu radi brzog vraćanja.
          </p>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-800 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
            >
              Odustani
            </button>
            <button
              type="submit"
              className={`px-5 py-2 rounded-xl text-white text-xs font-bold shadow-lg transition-all ${
                type === 'sick' ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/30' : 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/30'
              }`}
            >
              Potvrdi Raspon
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// 5. New Week Modal
export function NewWeekModal({
  isOpen,
  onClose,
  lastWeek,
  onCreateWeek
}) {
  if (!isOpen) return null;

  let nextMonday = new Date();
  if (lastWeek && lastWeek.startDateISO) {
    nextMonday = new Date(lastWeek.startDateISO);
    nextMonday.setDate(nextMonday.getDate() + 7);
  }

  const defaultTitle = (() => {
    const sunday = new Date(nextMonday);
    sunday.setDate(nextMonday.getDate() + 6);
    const fmt = (d) => `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.`;
    return `${fmt(nextMonday)} - ${fmt(sunday)}${sunday.getFullYear()}.`;
  })();

  const [title, setTitle] = useState(defaultTitle);
  const [copyFromCurrent, setCopyFromCurrent] = useState(true);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    onCreateWeek({
      title: title.trim(),
      startDateISO: nextMonday.toISOString(),
      copyFromWeekId: copyFromCurrent && lastWeek ? lastWeek.id : null
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
        <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-800">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-400" />
            Dodaj Novu Sedmicu
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Naziv / Period Sedmice:</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-semibold outline-none focus:border-blue-500"
              required
            />
          </div>

          <div className="space-y-2 p-3 bg-slate-950 rounded-xl border border-slate-800">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="radio"
                checked={copyFromCurrent}
                onChange={() => setCopyFromCurrent(true)}
                className="text-blue-600 focus:ring-0"
              />
              <span className="text-xs text-white font-semibold">
                Kopiraj smjene iz trenutne sedmice ({lastWeek?.title})
              </span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="radio"
                checked={!copyFromCurrent}
                onChange={() => setCopyFromCurrent(false)}
                className="text-blue-600 focus:ring-0"
              />
              <span className="text-xs text-white font-semibold">
                Započni praznu novu sedmicu
              </span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-800 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
            >
              Odustani
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition-all"
            >
              + Kreiraj Sedmicu
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// 6. Copy Day Modal
export function CopyDayModal({
  isOpen,
  onClose,
  activeDay,
  onCopyDay,
  showAppAlert
}) {
  if (!isOpen) return null;

  const [selectedDays, setSelectedDays] = useState([]);

  const toggleDay = (idx) => {
    setSelectedDays(prev => 
      prev.includes(idx) ? prev.filter(d => d !== idx) : [...prev, idx]
    );
  };

  const handleSelectAll = () => {
    const allExceptActive = DAYS.map((_, i) => i).filter(i => i !== activeDay);
    if (selectedDays.length === allExceptActive.length) {
      setSelectedDays([]);
    } else {
      setSelectedDays(allExceptActive);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selectedDays.length === 0) {
      showAppAlert?.({
        type: 'warning',
        title: 'Odabir dana',
        message: 'Odaberite barem jedan ciljni dan za kopiranje rasporeda!'
      });
      return;
    }
    onCopyDay(activeDay, selectedDays);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
        <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-800">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Copy className="w-5 h-5 text-blue-400" />
            Kopiraj Raspored Dana
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs">
            Izvorni dan:{' '}
            <strong className="text-blue-400 text-sm font-bold uppercase ml-1">
              {DAYS[activeDay]}
            </strong>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Ciljni dani (prepiši raspored):
              </label>
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-xs text-blue-400 hover:underline font-semibold"
              >
                Označi sve
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {DAYS.map((d, i) => {
                if (i === activeDay) return null;
                const isChecked = selectedDays.includes(i);
                return (
                  <button
                    type="button"
                    key={i}
                    onClick={() => toggleDay(i)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border text-left flex items-center justify-between transition-all ${
                      isChecked
                        ? 'bg-blue-600/20 border-blue-500 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span>{d}</span>
                    {isChecked && <Check className="w-4 h-4 text-blue-400" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-800 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
            >
              Odustani
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition-all"
            >
              Kopiraj Smjene
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

