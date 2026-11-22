import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Trash2, 
  Clock, 
  MapPin, 
  Users, 
  Sparkles, 
  AlertTriangle, 
  HeartPulse, 
  CheckCircle2, 
  Calendar,
  Search,
  GripHorizontal
} from 'lucide-react';
import { 
  DAYS, 
  START_HOUR, 
  END_HOUR, 
  TOTAL_HOURS, 
  LOCATION_THEMES, 
  formatTime, 
  getDayDateLabel, 
  SHIFT_PRESETS 
} from '../constants';

export default function TimelineView({
  week,
  workers,
  locations,
  activeDay,
  setActiveDay,
  onOpenAddShiftModal,
  onOpenEditShiftModal,
  onOpenAbsenceModal,
  onAssignWorkerQuick,
  onClearWorkerSick,
  onUpdateShiftTime,
  onDeleteShift
}) {
  const [selectedShiftId, setSelectedShiftId] = useState(null);
  const [searchWorker, setSearchWorker] = useState('');
  
  // Real-time live dragging state
  const [dragState, setDragState] = useState(null); // { shiftId, mode: 'move'|'left'|'right', currentStart, currentEnd }
  const dragRef = useRef(null);

  const shifts = week?.shifts || [];
  const statuses = week?.statuses || {};

  // Hourly coverage calculation for a location
  const getHourlyCoverage = (locId, dayIdx) => {
    const locShifts = shifts.filter(s => s.locationId === locId && s.dayIndex === dayIdx);
    const counts = [];
    for (let h = START_HOUR; h < END_HOUR; h++) {
      const c = locShifts.filter(s => s.start <= h + 0.5 && s.end >= h + 0.5).length;
      counts.push({ hour: h, count: c });
    }
    return counts;
  };

  // Start dragging shift (move or resize)
  const getClientX = (e) => {
    if (e.touches && e.touches.length > 0) return e.touches[0].clientX;
    if (e.changedTouches && e.changedTouches.length > 0) return e.changedTouches[0].clientX;
    return e.clientX;
  };

  const handleStartDrag = (e, shift, mode) => {
    e.stopPropagation();
    if (e.cancelable && e.type !== 'touchstart') {
      e.preventDefault();
    }
    setSelectedShiftId(shift.id);

    const trackElem = e.currentTarget.closest('.timeline-track-area');
    if (!trackElem) return;
    const rect = trackElem.getBoundingClientRect();
    const clientX = getClientX(e);
    if (clientX === undefined || clientX === null) return;

    const initialInfo = {
      shiftId: shift.id,
      mode,
      startX: clientX,
      trackWidth: rect.width,
      origStart: shift.start,
      origEnd: shift.end,
      currentStart: shift.start,
      currentEnd: shift.end
    };

    dragRef.current = initialInfo;
    setDragState(initialInfo);
  };

  useEffect(() => {
    if (!dragState) return;

    const handleMove = (e) => {
      const d = dragRef.current;
      if (!d) return;

      const clientX = getClientX(e);
      if (clientX === undefined || clientX === null) return;

      if (e.cancelable && e.type === 'touchmove') {
        e.preventDefault(); // Stop mobile browser scrolling while dragging/resizing
      }

      const rawDeltaHours = ((clientX - d.startX) / d.trackWidth) * TOTAL_HOURS;
      const snappedDelta = Math.round(rawDeltaHours * 2) / 2; // snap to 30 mins
      const duration = d.origEnd - d.origStart;

      let newStart = d.origStart;
      let newEnd = d.origEnd;

      if (d.mode === 'move') {
        newStart = d.origStart + snappedDelta;
        if (newStart < START_HOUR) newStart = START_HOUR;
        if (newStart + duration > END_HOUR) newStart = END_HOUR - duration;
        newEnd = newStart + duration;
      } else if (d.mode === 'left') {
        newStart = Math.min(d.origEnd - 1, Math.max(START_HOUR, d.origStart + snappedDelta));
        newEnd = d.origEnd;
      } else if (d.mode === 'right') {
        newStart = d.origStart;
        newEnd = Math.max(d.origStart + 1, Math.min(END_HOUR, d.origEnd + snappedDelta));
      }

      d.currentStart = newStart;
      d.currentEnd = newEnd;
      setDragState({ ...d });
    };

    const handleEnd = () => {
      const d = dragRef.current;
      if (d) {
        if (d.currentStart !== d.origStart || d.currentEnd !== d.origEnd) {
          onUpdateShiftTime(d.shiftId, d.currentStart, d.currentEnd);
        }
      }
      dragRef.current = null;
      setDragState(null);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleEnd);
    window.addEventListener('touchcancel', handleEnd);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
      window.removeEventListener('touchcancel', handleEnd);
    };
  }, [dragState !== null, onUpdateShiftTime]);

  // Drop worker from sidebar onto timeline track
  const handleTimelineDrop = (e, locId) => {
    e.preventDefault();
    const workerId = e.dataTransfer.getData('workerId');
    if (!workerId) return;

    const trackElem = e.currentTarget;
    const rect = trackElem.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const hourOffset = (clickX / rect.width) * TOTAL_HOURS;
    const startHour = Math.max(START_HOUR, Math.min(END_HOUR - 4, Math.round((START_HOUR + hourOffset) * 2) / 2));

    const worker = workers.find(w => w.id === workerId);
    const duration = worker?.defaultHours || 8;
    const endHour = Math.min(startHour + duration, END_HOUR);

    onAssignWorkerQuick(workerId, locId, activeDay, startHour, endHour);
  };

  const selectedShift = shifts.find(s => s.id === selectedShiftId);
  const selectedWorker = selectedShift ? workers.find(w => w.id === selectedShift.workerId) : null;

  // Active sick leave workers for today or this week
  const sickWorkers = workers.filter(w => statuses[`${w.id}-${activeDay}`] === 'sick');

  // Filter workers in sidebar
  const filteredWorkers = workers.filter(w => 
    w.name.toLowerCase().includes(searchWorker.toLowerCase()) ||
    (w.role && w.role.toLowerCase().includes(searchWorker.toLowerCase()))
  );

  return (
    <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-[#090d16]">
      {/* Center Main Planner Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Day Navigation Tabs */}
        <div className="bg-slate-900/95 border-b border-slate-800 p-3 shrink-0 flex items-center justify-between gap-2 overflow-x-auto">
          <div className="flex items-center gap-1.5 min-w-max">
            {DAYS.map((d, idx) => {
              const dateLabel = getDayDateLabel(week, idx);
              const isActive = activeDay === idx;
              const countWorking = shifts.filter(s => s.dayIndex === idx).length;
              const hasSick = workers.some(w => statuses[`${w.id}-${idx}`] === 'sick');

              return (
                <button
                  key={d}
                  onClick={() => {
                    setActiveDay(idx);
                    setSelectedShiftId(null);
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex flex-col items-start gap-0.5 border ${
                    isActive
                      ? 'bg-blue-600 text-white border-blue-400 shadow-lg shadow-blue-600/30 ring-1 ring-blue-400'
                      : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-850'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span>{d}</span>
                    {hasSick && <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" title="Bolovanje" />}
                  </div>
                  <div className={`text-[10px] font-medium flex items-center gap-1 ${
                    isActive ? 'text-blue-100' : 'text-slate-500'
                  }`}>
                    <span>{dateLabel}</span>
                    <span>• {countWorking} smj.</span>
                  </div>
                </button>
              );
            })}
          </div>

          <button
            onClick={() => onOpenAddShiftModal({ dayIdx: activeDay, locId: locations[0]?.id })}
            className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20 text-xs font-bold flex items-center gap-1.5 transition-all shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Dodaj Smjenu</span>
          </button>
        </div>

        {/* Selected Shift Quick Actions Bar */}
        {selectedShift && selectedWorker && (
          <div className="bg-slate-900 border-b border-blue-500/40 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-xl shrink-0 animate-in fade-in slide-in-from-top-1">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-slate-400">Odabrano:</span>
              <strong className="text-sm text-white font-bold">{selectedWorker.name}</strong>
              <span className="text-xs font-mono font-bold bg-blue-950 text-blue-300 border border-blue-800 px-2 py-0.5 rounded-lg">
                {formatTime(selectedShift.start)} - {formatTime(selectedShift.end)} ({selectedShift.end - selectedShift.start}h)
              </span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">Brze satnice:</span>
              {[
                { label: '07-15 (8h)', s: 7, e: 15 },
                { label: '10-18 (8h)', s: 10, e: 18 },
                { label: '14-22 (8h)', s: 14, e: 22 },
                { label: '15-01 (10h)', s: 15, e: 25 },
                { label: '16-02 (10h)', s: 16, e: 26 },
              ].map(p => (
                <button
                  key={p.label}
                  onClick={() => onUpdateShiftTime(selectedShift.id, p.s, p.e)}
                  className="px-2 py-1 rounded-md bg-slate-800 hover:bg-blue-600 text-[10px] font-bold text-slate-300 hover:text-white transition-colors"
                >
                  {p.label}
                </button>
              ))}

              <button
                onClick={() => onOpenEditShiftModal(selectedShift)}
                className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-blue-400 hover:text-white ml-2 transition-colors border border-slate-700"
              >
                Uredi
              </button>

              <button
                onClick={() => {
                  onDeleteShift(selectedShift.id);
                  setSelectedShiftId(null);
                }}
                className="px-2.5 py-1 rounded-md bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white text-[11px] font-bold transition-colors border border-rose-500/20"
              >
                Ukloni
              </button>
            </div>
          </div>
        )}

        {/* Timeline Locations Canvas */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6">
          {locations.map((loc, locIdx) => {
            const theme = LOCATION_THEMES[loc.theme] || LOCATION_THEMES.blue;
            const locShiftsToday = shifts
              .filter(s => s.dayIndex === activeDay && s.locationId === loc.id)
              .sort((a, b) => a.start - b.start);
            const coverage = getHourlyCoverage(loc.id, activeDay);

            return (
              <section
                key={loc.id}
                className={`bg-slate-900/90 rounded-2xl border-2 ${theme.border} overflow-hidden shadow-xl flex flex-col`}
              >
                {/* Location Header */}
                <div className={`bg-gradient-to-r ${theme.bgHeader} px-4 py-2.5 border-b border-slate-800 flex items-center justify-between`}>
                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${theme.badge}`}>
                      Lokal #{locIdx + 1}
                    </span>
                    <h3 className="text-base font-extrabold text-white">{loc.name}</h3>
                    <span className="text-xs text-slate-400 font-medium">
                      ({formatTime(loc.openHour)} - {formatTime(loc.closeHour)})
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-medium hidden sm:inline">
                      Zahtjev: <strong className="text-slate-200">Min. {loc.minWorkers}</strong>
                    </span>
                    <button
                      onClick={() => onOpenAddShiftModal({ dayIdx: activeDay, locId: loc.id })}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1 border border-slate-700 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> Dodaj
                    </button>
                  </div>
                </div>

                {/* Hourly Scale Header */}
                <div className="flex border-b border-slate-800 bg-slate-950/80 text-[10px] text-slate-400 font-bold select-none">
                  <div className="w-36 md:w-44 shrink-0 border-r border-slate-800 px-3 py-2 uppercase tracking-wider text-slate-500">
                    Radnik / Smjena
                  </div>
                  <div className="flex-1 flex relative">
                    {Array.from({ length: TOTAL_HOURS }).map((_, i) => {
                      const h = START_HOUR + i;
                      const displayH = h % 24;
                      const isPeak = [7, 11, 14, 18, 22].includes(h);

                      return (
                        <div
                          key={i}
                          style={{ width: `${100 / TOTAL_HOURS}%` }}
                          className={`border-r border-slate-800/80 py-2 text-center ${
                            isPeak ? 'bg-blue-500/5 text-blue-400 font-black' : ''
                          }`}
                        >
                          {displayH}h
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Shift Rows & Drop Container */}
                <div
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
                  onDrop={(e) => handleTimelineDrop(e, loc.id)}
                  className="divide-y divide-slate-800/60 bg-slate-950/30"
                >
                  {locShiftsToday.length === 0 ? (
                    <div className="py-8 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-2">
                      <Clock className="w-6 h-6 text-slate-600" />
                      <span>Nema zakazanih smjena za ovaj lokal na ovaj dan.</span>
                      <span className="text-[11px] text-slate-400">
                        Prevuci radnika iz desnog menija ovamo ili{' '}
                        <button
                          onClick={() => onOpenAddShiftModal({ dayIdx: activeDay, locId: loc.id })}
                          className="text-blue-400 hover:underline font-bold"
                        >
                          klikni za dodavanje smjene
                        </button>
                      </span>
                    </div>
                  ) : (
                    locShiftsToday.map(shift => {
                      const worker = workers.find(w => w.id === shift.workerId);
                      const isSelected = selectedShiftId === shift.id;
                      
                      // Check if currently dragging this shift
                      const isDraggingThis = dragState && dragState.shiftId === shift.id;
                      const displayStart = isDraggingThis ? dragState.currentStart : shift.start;
                      const displayEnd = isDraggingThis ? dragState.currentEnd : shift.end;

                      const leftPct = ((displayStart - START_HOUR) / TOTAL_HOURS) * 100;
                      const widthPct = ((displayEnd - displayStart) / TOTAL_HOURS) * 100;

                      return (
                        <div
                          key={shift.id}
                          className={`flex h-12 transition-colors ${
                            isSelected ? 'bg-blue-900/20' : 'hover:bg-slate-850/40'
                          }`}
                        >
                          {/* Worker Label Left Column */}
                          <div
                            onClick={() => setSelectedShiftId(shift.id)}
                            className="w-36 md:w-44 shrink-0 border-r border-slate-800 px-3 flex flex-col justify-center cursor-pointer bg-slate-900/80 z-10 select-none"
                          >
                            <div className="font-bold text-xs text-white truncate flex items-center justify-between">
                              <span>{worker?.name || 'Nepoznat'}</span>
                              <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-1 rounded">
                                {displayEnd - displayStart}h
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-medium font-mono">
                              {formatTime(displayStart)} - {formatTime(displayEnd)}
                            </div>
                          </div>

                          {/* Timeline Bar Track */}
                          <div
                            onClick={() => setSelectedShiftId(shift.id)}
                            className="timeline-track-area flex-1 relative bg-slate-950/40 cursor-pointer"
                            style={{
                              backgroundImage: `repeating-linear-gradient(to right, transparent, transparent calc(100% / ${TOTAL_HOURS} - 1px), rgba(51,65,85,0.25) calc(100% / ${TOTAL_HOURS} - 1px), rgba(51,65,85,0.25) calc(100% / ${TOTAL_HOURS}))`
                            }}
                          >
                            <div
                              onMouseDown={(e) => handleStartDrag(e, shift, 'move')}
                              onTouchStart={(e) => handleStartDrag(e, shift, 'move')}
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                onOpenEditShiftModal(shift);
                              }}
                              style={{
                                left: `${leftPct}%`,
                                width: `calc(${widthPct}% - 2px)`
                              }}
                              className={`absolute top-1.5 bottom-1.5 rounded-lg bg-gradient-to-r ${theme.bar} border cursor-grab active:cursor-grabbing flex items-center justify-between px-2 select-none transition-shadow touch-none ${
                                isSelected || isDraggingThis
                                  ? 'ring-2 ring-white z-30 shadow-[0_0_20px_rgba(59,130,246,0.5)]'
                                  : 'z-10 shadow-md hover:brightness-105'
                              }`}
                              title="Povuci za pomicanje, ili dvoklik za uređivanje"
                            >
                              {/* Left Resize Handle */}
                              <div
                                onMouseDown={(e) => handleStartDrag(e, shift, 'left')}
                                onTouchStart={(e) => handleStartDrag(e, shift, 'left')}
                                className="w-7 sm:w-5 h-full absolute left-0 cursor-ew-resize hover:bg-white/40 active:bg-white/50 rounded-l flex items-center justify-center z-20 touch-none select-none"
                                title="Rastegni početak"
                              >
                                <span className="w-1 sm:w-0.5 h-4 sm:h-3.5 bg-white/90 rounded-full shadow-sm pointer-events-none" />
                              </div>

                              <div className="w-full text-center pointer-events-none text-[11px] font-black text-white font-mono truncate px-1 drop-shadow-sm flex items-center justify-center gap-1 select-none">
                                <span>{formatTime(displayStart)} - {formatTime(displayEnd)}</span>
                                <span className="text-[9px] opacity-80">({displayEnd - displayStart}h)</span>
                              </div>

                              {/* Right Resize Handle */}
                              <div
                                onMouseDown={(e) => handleStartDrag(e, shift, 'right')}
                                onTouchStart={(e) => handleStartDrag(e, shift, 'right')}
                                className="w-7 sm:w-5 h-full absolute right-0 cursor-ew-resize hover:bg-white/40 active:bg-white/50 rounded-r flex items-center justify-center z-20 touch-none select-none"
                                title="Rastegni kraj"
                              >
                                <span className="w-1 sm:w-0.5 h-4 sm:h-3.5 bg-white/90 rounded-full shadow-sm pointer-events-none" />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Hourly Coverage Meter Row */}
                <div className="flex bg-slate-950 border-t border-slate-800 h-9 items-center select-none">
                  <div className="w-36 md:w-44 shrink-0 border-r border-slate-800 px-3 flex items-center justify-between text-[10px] font-black text-slate-500 uppercase tracking-wider">
                    <span>Pokrivenost</span>
                    <span className="text-[9px] text-slate-400 font-normal">Min. {loc.minWorkers}</span>
                  </div>

                  <div className="flex-1 flex h-full">
                    {coverage.map(({ hour, count }) => {
                      const isOpen = hour >= loc.openHour && hour < loc.closeHour;
                      const isUnder = isOpen && count < loc.minWorkers;

                      return (
                        <div
                          key={hour}
                          style={{ width: `${100 / TOTAL_HOURS}%` }}
                          className={`h-full border-r border-slate-900 flex items-center justify-center text-xs font-black transition-colors ${
                            count === 0
                              ? isOpen
                                ? 'bg-rose-950/60 text-rose-500'
                                : 'text-slate-800'
                              : isUnder
                              ? 'bg-rose-500/25 text-rose-300 animate-pulse'
                              : 'bg-emerald-500/15 text-emerald-400'
                          }`}
                          title={`Sat ${hour}:00 - ${count} radnika`}
                        >
                          {count > 0 ? count : (isOpen ? '0' : '')}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {/* Right Sidebar: Worker Availability Panel */}
      <aside className="w-full lg:w-80 shrink-0 bg-[#0c1220] border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-col z-20 shadow-2xl">
        <div className="p-4 border-b border-slate-800 bg-[#0c1220] sticky top-0">
          <div className="flex justify-between items-center mb-1">
            <h3 className="font-extrabold text-xs uppercase tracking-widest text-emerald-400 flex items-center gap-1.5">
              <Users className="w-4 h-4" /> Osoblje ({workers.length})
            </h3>
            <span className="text-[10px] font-bold bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
              {DAYS[activeDay]}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-medium mb-3">
            Prevuci radnika na timeline ili dodijeli jednim klikom
          </p>

          {/* Quick Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Pretraži radnika..."
              value={searchWorker}
              onChange={(e) => setSearchWorker(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Active Sick Leave Banner */}
        {sickWorkers.length > 0 && (
          <div className="mx-3 mt-3 p-3 rounded-xl bg-rose-950/40 border border-rose-500/30">
            <div className="text-[11px] font-extrabold text-rose-300 uppercase flex items-center gap-1.5 mb-1.5">
              <HeartPulse className="w-3.5 h-3.5 text-rose-400" /> Na Bolovanju Danas:
            </div>
            <div className="flex flex-wrap gap-1.5">
              {sickWorkers.map(w => (
                <div
                  key={w.id}
                  className="px-2 py-1 rounded bg-rose-500/20 border border-rose-500/30 text-rose-200 text-xs font-bold flex items-center justify-between w-full"
                >
                  <span>{w.name}</span>
                  <button
                    onClick={() => onClearWorkerSick(w.id, activeDay, true)}
                    className="text-[10px] bg-rose-600 hover:bg-rose-500 text-white px-2 py-0.5 rounded font-bold transition-colors"
                  >
                    Vrati u rad
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Worker Cards List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {filteredWorkers.map(w => {
            const workerShiftsToday = shifts.filter(s => s.dayIndex === activeDay && s.workerId === w.id);
            const isWorking = workerShiftsToday.length > 0;
            const status = statuses[`${w.id}-${activeDay}`] || (isWorking ? 'working' : 'free');
            const isSickToday = status === 'sick';

            // Total hours this worker has scheduled in the whole week
            const totalWeekHours = shifts
              .filter(s => s.workerId === w.id)
              .reduce((acc, s) => acc + (s.end - s.start), 0);

            return (
              <div
                key={w.id}
                draggable="true"
                onDragStart={(e) => {
                  e.dataTransfer.setData('workerId', w.id);
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                className={`p-3 rounded-xl border transition-all cursor-grab active:cursor-grabbing ${
                  isWorking
                    ? 'bg-slate-900/90 border-slate-700 shadow-sm'
                    : isSickToday
                    ? 'bg-rose-950/30 border-rose-500/40'
                    : 'bg-slate-900/50 border-slate-800/80 hover:border-slate-700 hover:shadow-md'
                }`}
              >
                {/* Worker Header Info */}
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-extrabold text-sm text-white flex items-center gap-1.5">
                      {w.name}
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-950 px-1.5 py-0.2 rounded border border-slate-800 font-mono">
                        {totalWeekHours}h/sedm.
                      </span>
                    </div>
                    <div className="text-[11px] font-medium text-slate-400 mt-0.5">
                      {isWorking ? (
                        <span className="text-emerald-400 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> U smjeni ({workerShiftsToday.map(s => `${formatTime(s.start)}-${formatTime(s.end)}`).join(', ')})
                        </span>
                      ) : isSickToday ? (
                        <span className="text-rose-400 font-semibold flex items-center gap-1">
                          <HeartPulse className="w-3 h-3" /> Na Bolovanju
                        </span>
                      ) : (
                        <span className="text-slate-500">Slobodan dan</span>
                      )}
                    </div>
                  </div>

                  <div className={`w-2.5 h-2.5 rounded-full mt-1 ${
                    isWorking
                      ? 'bg-emerald-500 ring-2 ring-emerald-500/20'
                      : isSickToday
                      ? 'bg-rose-500 animate-pulse ring-2 ring-rose-500/20'
                      : 'bg-slate-600'
                  }`} />
                </div>

                {/* Worker Action Buttons */}
                <div className="flex items-center gap-1.5 pt-2 border-t border-slate-800/70">
                  {isSickToday ? (
                    <button
                      onClick={() => onClearWorkerSick(w.id, activeDay, true)}
                      className="w-full py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                    >
                      Prekini bolovanje & vrati smjene
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => onOpenAbsenceModal({ workerId: w.id, type: 'free', fromDay: activeDay, toDay: activeDay })}
                        className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                          !isWorking
                            ? 'bg-slate-700 text-white'
                            : 'bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white'
                        }`}
                      >
                        Slobodan
                      </button>

                      <button
                        onClick={() => onOpenAbsenceModal({ workerId: w.id, type: 'sick', fromDay: activeDay, toDay: 6 })}
                        className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-rose-500/10 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/20 transition-colors"
                        title="Otvori bolovanje"
                      >
                        🏥 Bolovanje
                      </button>
                    </>
                  )}
                </div>

                {/* Quick Add To Location Buttons */}
                {!isWorking && !isSickToday && (
                  <div className="grid grid-cols-2 gap-1.5 mt-2">
                    {locations.map(loc => {
                      const theme = LOCATION_THEMES[loc.theme] || LOCATION_THEMES.blue;
                      return (
                        <button
                          key={loc.id}
                          onClick={() => onAssignWorkerQuick(w.id, loc.id, activeDay)}
                          className={`py-1.5 rounded-lg text-[11px] font-extrabold border truncate px-1 transition-all ${theme.badge}`}
                          title={`Dodaj u ${loc.name}`}
                        >
                          + {loc.name.split(' ')[0]}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
