import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Clock, 
  Users, 
  HeartPulse, 
  Sparkles, 
  Trash2, 
  Edit2, 
  CheckCircle2, 
  Calendar,
  X,
  Search,
  PanelRightClose,
  PanelRightOpen,
  LayoutGrid,
  ChevronDown,
  ArrowDownCircle,
  Eye,
  Layers,
  GripVertical,
  Minimize2,
  Maximize2
} from 'lucide-react';
import { 
  DAYS, 
  START_HOUR, 
  END_HOUR, 
  TOTAL_HOURS, 
  LOCATION_THEMES, 
  formatTime, 
  getDayDateLabel, 
  sortLocations 
} from '../constants';

export default function GridView({
  weeks,
  workers,
  locations,
  onOpenAddShiftModal,
  onOpenEditShiftModal,
  onOpenAbsenceModal,
  onMoveShiftToCell,
  onAssignWorkerQuick,
  onUpdateShiftTime,
  onDeleteShift,
  onClearWorkerSick,
  activeDay,
  setActiveDay
}) {
  // Sort locations: Trubarjeva is always first (#1), Bavarski Dvor below (#2)
  const sortedLocations = sortLocations(locations);

  // Selected day and week for the Inline Hourly Planner (opens directly under that week's table)
  const [inlineTimeline, setInlineTimeline] = useState(null);

  // Reference for smooth auto-scrolling when a day is opened
  const inlineTimelineRef = useRef(null);

  // Real-time dragging inside the inline timeline
  const [timelineDragState, setTimelineDragState] = useState(null);
  const timelineDragRef = useRef(null);

  // Right sidebar docked state: defaults to false so table has 100% width, opens directly on the side when clicked!
  const [showSidebar, setShowSidebar] = useState(false);

  // Sidebar search filter for workers
  const [searchWorker, setSearchWorker] = useState('');

  // Highlight a specific worker across all weeks
  const [highlightWorkerId, setHighlightWorkerId] = useState(null);

  // View mode: 'all' = multi-week stacked (sedmicu ispod sedmice), 'single' = focused week
  const [viewMode, setViewMode] = useState('all');
  const [focusedWeekId, setFocusedWeekId] = useState(weeks[0]?.id || '');

  // Manual compact height toggle per week (allows user to force compact or expand)
  const [manualCompactWeeks, setManualCompactWeeks] = useState({});

  // Active selected day for the sidebar
  const currentSidebarDay = inlineTimeline ? inlineTimeline.dayIdx : (activeDay ?? 0);
  const currentSidebarWeekId = inlineTimeline ? inlineTimeline.weekId : (weeks[0]?.id || '');
  const currentSidebarWeek = weeks.find(w => w.id === currentSidebarWeekId) || weeks[0];

  // Auto-scroll into view when user selects a day for the inline satni planer
  useEffect(() => {
    if (inlineTimeline && inlineTimelineRef.current) {
      setTimeout(() => {
        inlineTimelineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    }
  }, [inlineTimeline]);

  // Drag and drop handler for weekly grid cells
  const handleCellDrop = (e, targetWeekId, dayIdx, locId) => {
    e.preventDefault();
    e.currentTarget.classList.remove('bg-blue-600/30', 'ring-2', 'ring-blue-400');

    const shiftId = e.dataTransfer.getData('shiftId');
    const workerId = e.dataTransfer.getData('workerId');

    if (shiftId) {
      onMoveShiftToCell(shiftId, dayIdx, locId, targetWeekId);
    } else if (workerId) {
      onAssignWorkerQuick(workerId, locId, dayIdx, null, null, targetWeekId);
    }
  };

  // Drag logic for the inline timeline
  const handleStartTimelineDrag = (e, shift, mode, targetWeekId) => {
    e.stopPropagation();
    e.preventDefault();

    const trackElem = e.currentTarget.closest('.timeline-track-area');
    if (!trackElem) return;
    const rect = trackElem.getBoundingClientRect();

    const initialInfo = {
      targetWeekId,
      shiftId: shift.id,
      mode,
      startX: e.clientX,
      trackWidth: rect.width,
      origStart: shift.start,
      origEnd: shift.end,
      currentStart: shift.start,
      currentEnd: shift.end
    };

    timelineDragRef.current = initialInfo;
    setTimelineDragState(initialInfo);
  };

  useEffect(() => {
    if (!timelineDragState) return;

    const handleMouseMove = (e) => {
      const d = timelineDragRef.current;
      if (!d) return;

      const rawDeltaHours = ((e.clientX - d.startX) / d.trackWidth) * TOTAL_HOURS;
      const snappedDelta = Math.round(rawDeltaHours * 2) / 2; // snap to 30 mins
      const duration = d.origEnd - d.origStart;

      let newStart = d.origStart;
      let newEnd = d.origEnd;

      if (d.mode === 'move') {
        newStart = d.origStart + snappedDelta;
        if (newStart < START_HOUR) newStart = START_HOUR;
        if (newStart + duration > END_HOUR) newEnd = END_HOUR;
        else newEnd = newStart + duration;
      } else if (d.mode === 'left') {
        newStart = Math.min(d.origEnd - 1, Math.max(START_HOUR, d.origStart + snappedDelta));
        newEnd = d.origEnd;
      } else if (d.mode === 'right') {
        newStart = d.origStart;
        newEnd = Math.max(d.origStart + 1, Math.min(END_HOUR, d.origEnd + snappedDelta));
      }

      d.currentStart = newStart;
      d.currentEnd = newEnd;
      setTimelineDragState({ ...d });
    };

    const handleMouseUp = () => {
      const d = timelineDragRef.current;
      if (d) {
        if (d.currentStart !== d.origStart || d.currentEnd !== d.origEnd) {
          onUpdateShiftTime(d.shiftId, d.currentStart, d.currentEnd);
        }
      }
      timelineDragRef.current = null;
      setTimelineDragState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [timelineDragState !== null, onUpdateShiftTime]);

  // Hourly coverage calculation helper
  const getHourlyCoverage = (locId, dayIdx, shiftsList) => {
    const locShifts = shiftsList.filter(s => s.locationId === locId && s.dayIndex === dayIdx);
    const counts = [];
    for (let h = START_HOUR; h < END_HOUR; h++) {
      const c = locShifts.filter(s => s.start <= h + 0.5 && s.end >= h + 0.5).length;
      counts.push({ hour: h, count: c });
    }
    return counts;
  };

  // Filter workers in sidebar
  const filteredWorkers = workers.filter(w => 
    w.name.toLowerCase().includes(searchWorker.toLowerCase()) ||
    (w.role && w.role.toLowerCase().includes(searchWorker.toLowerCase()))
  );

  // Weeks to display based on viewMode
  const displayedWeeks = viewMode === 'all' 
    ? weeks 
    : weeks.filter(w => w.id === focusedWeekId);

  return (
    <div className="flex-1 w-full min-w-0 flex overflow-hidden bg-[#090d16] relative">
      {/* Left / Main Column: Weekly Grid Cards (Full natural height, scrollable, shrink-0) */}
      <div className="flex-1 min-w-0 flex flex-col overflow-y-auto p-3 sm:p-5 lg:p-6 space-y-8">
        {/* Top Controls Bar */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div>
            <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <LayoutGrid className="w-5 h-5 text-blue-400" />
              <span>Tjedna Mreža — Pregled Rasporeda</span>
              <span className="text-xs bg-blue-950 text-blue-300 font-mono font-bold px-2.5 py-0.5 rounded-full border border-blue-800">
                {weeks.length} sedmice
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Kompletan tabelarni prikaz svih lokala (Trubarjeva #1, Bavarski Dvor #2) i svih 7 dana.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Mode Switcher: All weeks stacked vs Single week */}
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => setViewMode('all')}
                className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'all' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Sve Sedmice ({weeks.length})</span>
              </button>
              <button
                onClick={() => {
                  setViewMode('single');
                  if (!focusedWeekId && weeks[0]) setFocusedWeekId(weeks[0].id);
                }}
                className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'single' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Pojedinačna</span>
              </button>
            </div>

            {/* If single week mode, week dropdown */}
            {viewMode === 'single' && (
              <select
                value={focusedWeekId}
                onChange={(e) => setFocusedWeekId(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs font-bold text-white outline-none focus:border-blue-500"
              >
                {weeks.map((wk, idx) => (
                  <option key={wk.id} value={wk.id}>
                    #{idx + 1} {wk.title}
                  </option>
                ))}
              </select>
            )}

            {/* Worker Highlighter Toggle */}
            <div className="hidden xl:flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
              <span className="text-[10px] font-black uppercase text-slate-400 mr-1">Istakni:</span>
              <button
                onClick={() => setHighlightWorkerId(null)}
                className={`px-2 py-0.5 rounded-md font-bold text-[11px] transition-all cursor-pointer ${
                  highlightWorkerId === null ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Svi
              </button>
              {workers.slice(0, 6).map(w => (
                <button
                  key={w.id}
                  onClick={() => setHighlightWorkerId(highlightWorkerId === w.id ? null : w.id)}
                  className={`px-2 py-0.5 rounded-md font-bold text-[11px] transition-all cursor-pointer ${
                    highlightWorkerId === w.id ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-300 hover:text-white hover:bg-slate-850'
                  }`}
                >
                  {w.name}
                </button>
              ))}
            </div>

            {/* Toggle Docked Sidebar Button (Opens side-by-side without overlay blur!) */}
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 border shadow-lg transition-all hover:scale-[1.02] cursor-pointer ${
                showSidebar 
                  ? 'bg-blue-600 text-white border-blue-400 shadow-blue-600/40 ring-2 ring-blue-400/30' 
                  : 'bg-slate-800 hover:bg-slate-700 text-white border-slate-700'
              }`}
              title="Otvori ili zatvori bočni panel sa osobljem i bolovanjima"
            >
              <Users className="w-4 h-4" />
              <span>{showSidebar ? 'Zatvori Panel Osoblja' : 'Osoblje & Bolovanja'}</span>
            </button>
          </div>
        </div>

        {/* Loop through displayed Weeks: Sedmicu ispod sedmice (shrink-0 ensures no vertical clipping!) */}
        {displayedWeeks.map((weekObj, weekIndex) => {
          const weekShifts = weekObj.shifts || [];
          const weekStatuses = weekObj.statuses || {};
          const isInlineOpenForThisWeek = inlineTimeline && inlineTimeline.weekId === weekObj.id;
          const inlineDayIdx = isInlineOpenForThisWeek ? inlineTimeline.dayIdx : null;

          // Automatically compact row height when inline satni planer is open (or if manually toggled by user)
          const isWeekCompact = manualCompactWeeks[weekObj.id] !== undefined 
            ? manualCompactWeeks[weekObj.id] 
            : isInlineOpenForThisWeek;

          return (
            <div
              key={weekObj.id}
              className="shrink-0 w-full bg-slate-900 border-2 border-slate-800 rounded-3xl overflow-hidden shadow-2xl transition-all"
            >
              {/* Week Card Banner */}
              <div className="bg-gradient-to-r from-slate-850 via-slate-900 to-slate-900 px-5 sm:px-6 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="bg-blue-600 text-white font-black text-xs px-3 py-1 rounded-lg uppercase tracking-wider shadow-sm">
                    Sedmica #{weekIndex + 1}
                  </span>
                  <h3 className="text-base sm:text-xl font-extrabold text-white">
                    {weekObj.title}
                  </h3>
                  <span className="text-xs text-blue-300 font-mono font-bold bg-blue-950 border border-blue-800 px-2 py-0.5 rounded">
                    {weekShifts.length} smjena
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Compact / Full Row Height Toggle Button */}
                  <button
                    onClick={() => setManualCompactWeeks(prev => ({
                      ...prev,
                      [weekObj.id]: !isWeekCompact
                    }))}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                      isWeekCompact 
                        ? 'bg-blue-600/20 text-blue-300 border-blue-500/40 shadow-sm' 
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                    }`}
                    title="Automatski sužava redove kada je otvoren satni planer radi maksimalne preglednosti"
                  >
                    {isWeekCompact ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
                    <span>{isWeekCompact ? 'Proširi redove' : 'Smanji redove (Kompaktno)'}</span>
                  </button>

                  {isInlineOpenForThisWeek && (
                    <button
                      onClick={() => {
                        inlineTimelineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                      className="px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 text-xs font-bold flex items-center gap-1.5 transition-colors animate-pulse cursor-pointer"
                    >
                      <ArrowDownCircle className="w-4 h-4" />
                      <span>Satni planer otvoren ({DAYS[inlineDayIdx]})</span>
                    </button>
                  )}

                  <button
                    onClick={() => onOpenAddShiftModal({ dayIdx: 0, locId: sortedLocations[0]?.id, weekId: weekObj.id })}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-blue-400" />
                    <span>Dodaj smjenu</span>
                  </button>
                </div>
              </div>

              {/* Weekly Matrix Table: Full natural height, showing Trubarjeva on top, Bavarski Dvor below, and Odsutni */}
              <div className="w-full overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[1050px]">
                  <thead>
                    <tr className="bg-slate-950/95 border-b border-slate-800 text-slate-300 select-none">
                      <th className={`w-44 min-w-[170px] ${isWeekCompact ? 'p-2.5' : 'p-4'} border-r border-slate-800 font-black text-xs uppercase tracking-wider bg-slate-950 sticky left-0 z-20 shadow-[4px_0_12px_rgba(0,0,0,0.5)]`}>
                        <div className="flex items-center justify-between text-slate-400">
                          <span>Lokal</span>
                          <span className="text-[10px] font-normal lowercase text-slate-500">2 lokala</span>
                        </div>
                      </th>

                      {DAYS.map((d, dIdx) => {
                        const isSelectedDay = isInlineOpenForThisWeek && inlineDayIdx === dIdx;
                        const dayCount = weekShifts.filter(s => s.dayIndex === dIdx).length;
                        const hasSick = workers.some(w => weekStatuses[`${w.id}-${dIdx}`] === 'sick');

                        return (
                          <th
                            key={dIdx}
                            onClick={() => {
                              if (isInlineOpenForThisWeek && inlineDayIdx === dIdx) {
                                setInlineTimeline(null); // toggle off
                              } else {
                                setInlineTimeline({ weekId: weekObj.id, dayIdx: dIdx });
                                setActiveDay(dIdx);
                              }
                            }}
                            className={`w-[12%] min-w-[130px] ${isWeekCompact ? 'p-2' : 'p-3'} border-r border-slate-800 text-center cursor-pointer transition-all select-none ${
                              isSelectedDay
                                ? 'bg-blue-600/30 border-b-4 border-b-blue-400 text-white shadow-inner'
                                : 'hover:bg-slate-800/60 text-slate-300'
                            }`}
                            title="Kliknite za otvaranje / zatvaranje satnog planera za ovaj dan"
                          >
                            <div className="flex items-center justify-center gap-1.5">
                              <span className={`text-xs font-black uppercase tracking-wider ${isSelectedDay ? 'text-blue-300' : 'text-slate-200'}`}>
                                {d}
                              </span>
                              {hasSick && (
                                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" title="Ima radnika na bolovanju" />
                              )}
                            </div>
                            
                            <div className="text-[11px] text-blue-400 font-extrabold font-mono mt-0.5">
                              {getDayDateLabel(weekObj, dIdx)}
                            </div>

                            <div className="mt-1 flex items-center justify-center gap-1">
                              <span className="text-[10px] text-slate-400 font-bold bg-slate-950/80 px-2 py-0.5 rounded-md border border-slate-800">
                                {dayCount} smj.
                              </span>
                            </div>

                            {isSelectedDay && (
                              <div className="mt-1 text-[9.5px] font-black text-blue-300 bg-blue-500/20 py-0.5 px-1.5 rounded flex items-center justify-center gap-1">
                                <ChevronDown className="w-3 h-3 animate-bounce" />
                                <span>Satni Planer</span>
                              </div>
                            )}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-800/80">
                    {/* Trubarjeva on top (#1), Bavarski Dvor below (#2) */}
                    {sortedLocations.map((loc, lIdx) => {
                      const theme = LOCATION_THEMES[loc.theme] || LOCATION_THEMES.blue;

                      return (
                        <tr key={loc.id} className="hover:bg-slate-850/20 transition-colors">
                          {/* Location Sticky Info Cell */}
                          {isWeekCompact ? (
                            <td className="w-44 min-w-[170px] p-2.5 border-r border-slate-800 bg-slate-950/95 sticky left-0 z-20 shadow-[4px_0_12px_rgba(0,0,0,0.5)] align-top">
                              <div className="flex items-center gap-2">
                                <span className={`w-2.5 h-2.5 rounded-full ${theme.dot} shrink-0 ring-2 ring-slate-900`} />
                                <div className="font-extrabold text-xs sm:text-sm text-white truncate leading-tight">
                                  #{lIdx + 1} {loc.name}
                                </div>
                              </div>
                              <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
                                <span>Min. {loc.minWorkers}</span>
                                <span className="font-mono text-slate-500">{formatTime(loc.openHour)}-{formatTime(loc.closeHour)}</span>
                              </div>
                            </td>
                          ) : (
                            <td className="w-48 min-w-[190px] p-4 border-r border-slate-800 bg-slate-950/95 sticky left-0 z-20 shadow-[4px_0_12px_rgba(0,0,0,0.5)] align-top">
                              <div className="flex items-start gap-2.5">
                                <span className={`w-3.5 h-3.5 rounded-full mt-1 ${theme.dot} shrink-0 ring-4 ring-slate-900`} />
                                <div>
                                  <div className="text-[10px] uppercase font-black tracking-widest text-slate-400">
                                    LOKAL #{lIdx + 1}
                                  </div>
                                  <div className="font-black text-sm lg:text-base text-white leading-tight mt-0.5">
                                    {loc.name}
                                  </div>
                                </div>
                              </div>

                              <div className="mt-3 space-y-1 text-[11px]">
                                <div className="text-slate-400 font-semibold flex items-center gap-1">
                                  <Users className="w-3 h-3 text-slate-500" />
                                  <span>Min. <strong>{loc.minWorkers}</strong> radnika</span>
                                </div>
                                <div className="text-slate-400 font-mono text-[10px] flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-slate-500" />
                                  <span>{formatTime(loc.openHour)} - {formatTime(loc.closeHour)}</span>
                                </div>
                              </div>
                            </td>
                          )}

                          {/* 7 Day Shift Columns */}
                          {DAYS.map((_, dIdx) => {
                            const isDaySelected = isInlineOpenForThisWeek && inlineDayIdx === dIdx;
                            const cellShifts = weekShifts
                              .filter(s => s.dayIndex === dIdx && s.locationId === loc.id)
                              .sort((a, b) => a.start - b.start);

                            return (
                              <td
                                key={dIdx}
                                onDragOver={(e) => {
                                  e.preventDefault();
                                  e.currentTarget.classList.add('bg-blue-600/30', 'ring-2', 'ring-blue-400');
                                }}
                                onDragLeave={(e) => {
                                  e.currentTarget.classList.remove('bg-blue-600/30', 'ring-2', 'ring-blue-400');
                                }}
                                onDrop={(e) => handleCellDrop(e, weekObj.id, dIdx, loc.id)}
                                onClick={() => {
                                  onOpenAddShiftModal({ dayIdx: dIdx, locId: loc.id, weekId: weekObj.id });
                                }}
                                className={`w-[12%] min-w-[130px] border-r border-slate-800 align-top transition-colors cursor-pointer group ${
                                  isWeekCompact ? 'p-1.5 min-h-[45px]' : 'p-2.5 min-h-[140px]'
                                } ${isDaySelected ? 'bg-blue-950/30' : 'hover:bg-slate-800/40'}`}
                                title={`Kliknite na prazan prostor za dodavanje radnika u ${loc.name} za ${DAYS[dIdx]}`}
                              >
                                <div className={`flex flex-col ${isWeekCompact ? 'gap-1 min-h-0' : 'gap-2 min-h-[100px]'}`}>
                                  {cellShifts.map(s => {
                                    const worker = workers.find(w => w.id === s.workerId);
                                    const isWorkerHighlighted = highlightWorkerId && highlightWorkerId === s.workerId;
                                    const isDimmed = highlightWorkerId && highlightWorkerId !== s.workerId;

                                    if (isWeekCompact) {
                                      // COMPACT MINIMAL HEIGHT ROW (Slim single-line capsule)
                                      return (
                                        <div
                                          key={s.id}
                                          draggable="true"
                                          onDragStart={(e) => {
                                            e.stopPropagation();
                                            e.dataTransfer.setData('shiftId', s.id);
                                            e.dataTransfer.effectAllowed = 'move';
                                          }}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onOpenEditShiftModal(s);
                                          }}
                                          className={`px-2 py-1 rounded-lg border shadow-sm cursor-grab active:cursor-grabbing hover:scale-[1.02] transition-all flex items-center justify-between gap-1 select-none ${theme.badge} ${
                                            isWorkerHighlighted
                                              ? 'ring-2 ring-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.6)] scale-[1.03]'
                                              : isDimmed
                                              ? 'opacity-30 grayscale'
                                              : ''
                                          }`}
                                          title={`${worker?.name || 'Radnik'}: ${formatTime(s.start)} - ${formatTime(s.end)} (${s.end - s.start}h)`}
                                        >
                                          <div className="flex items-center gap-1 min-w-0">
                                            <span className="font-black text-xs text-white truncate max-w-[65px] sm:max-w-[75px]">
                                              {worker?.name || 'Radnik'}
                                            </span>
                                            <span className="text-[9px] font-bold text-slate-300 font-mono">
                                              {s.end - s.start}h
                                            </span>
                                          </div>

                                          <span className="text-[10px] font-mono font-bold text-white/90 shrink-0">
                                            {formatTime(s.start).slice(0, 5)}-{formatTime(s.end).slice(0, 5)}
                                          </span>
                                        </div>
                                      );
                                    }

                                    // NORMAL SPACIOUS ROW (Full 2-line badge)
                                    return (
                                      <div
                                        key={s.id}
                                        draggable="true"
                                        onDragStart={(e) => {
                                          e.stopPropagation();
                                          e.dataTransfer.setData('shiftId', s.id);
                                          e.dataTransfer.effectAllowed = 'move';
                                        }}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onOpenEditShiftModal(s);
                                        }}
                                        className={`p-2.5 rounded-xl border shadow-md cursor-grab active:cursor-grabbing hover:scale-[1.02] active:scale-[0.98] transition-all flex flex-col justify-between ${theme.badge} ${
                                          isWorkerHighlighted
                                            ? 'ring-2 ring-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.6)] scale-[1.03]'
                                            : isDimmed
                                            ? 'opacity-30 grayscale'
                                            : ''
                                        }`}
                                        title="Kliknite za uređivanje vremena smjene, ili prevucite mišem u drugi dan"
                                      >
                                        <div className="flex items-center justify-between gap-1">
                                          <span className="font-black text-xs sm:text-sm text-white truncate">
                                            {worker?.name || 'Radnik'}
                                          </span>
                                          <span className="text-[11px] font-bold text-slate-300 font-mono">
                                            {s.end - s.start}h
                                          </span>
                                        </div>

                                        <div className="mt-1 flex items-center justify-between">
                                          <span className="text-xs sm:text-[13px] font-mono font-bold text-white/90">
                                            {formatTime(s.start)} - {formatTime(s.end)}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}

                                  {/* Empty space slot / Click to add worker button */}
                                  <div
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onOpenAddShiftModal({ dayIdx: dIdx, locId: loc.id, weekId: weekObj.id });
                                    }}
                                    className={`${
                                      isWeekCompact ? 'h-6 text-[10px]' : 'h-8 min-h-[30px] text-xs'
                                    } flex items-center justify-center opacity-30 hover:opacity-100 transition-opacity text-slate-400 hover:text-blue-300 font-bold border-2 border-dashed border-slate-700/60 hover:border-blue-500 rounded-lg cursor-pointer mt-0.5`}
                                    title={`Dodaj radnika u ${loc.name} za ${DAYS[dIdx]}`}
                                  >
                                    + Dodaj radnika
                                  </div>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}

                    {/* Absent Workers Row: Clicking worker opens AbsenceModal with Date Range */}
                    <tr className="bg-slate-950/70">
                      <td className={`w-44 min-w-[170px] ${isWeekCompact ? 'p-2.5' : 'p-4'} border-r border-slate-800 font-extrabold text-xs text-slate-400 uppercase tracking-wider bg-slate-950/95 sticky left-0 z-20 shadow-[4px_0_12px_rgba(0,0,0,0.5)]`}>
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <HeartPulse className="w-3.5 h-3.5 text-rose-400" />
                          <span>Odsutni / Slobodni</span>
                        </div>
                        {!isWeekCompact && (
                          <div className="text-[10px] font-normal text-slate-500 mt-1">
                            Kliknite na ime radnika za postavljanje raspona bolovanja ili slobodnog dana
                          </div>
                        )}
                      </td>

                      {DAYS.map((_, dIdx) => {
                        const freeWorkers = workers.filter(w => !weekShifts.some(s => s.dayIndex === dIdx && s.workerId === w.id));

                        return (
                          <td key={dIdx} className={`w-[12%] min-w-[130px] border-r border-slate-800 ${isWeekCompact ? 'p-1.5' : 'p-2.5'} align-top bg-slate-950/40`}>
                            <div className="flex flex-wrap gap-1">
                              {freeWorkers.map(w => {
                                const isSick = weekStatuses[`${w.id}-${dIdx}`] === 'sick';
                                return (
                                  <button
                                    key={w.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onOpenAbsenceModal({
                                        workerId: w.id,
                                        type: isSick ? 'free' : 'sick',
                                        fromDay: dIdx,
                                        toDay: 6,
                                        weekId: weekObj.id
                                      });
                                    }}
                                    className={`font-bold rounded border shadow-sm transition-all hover:scale-105 cursor-pointer text-left ${
                                      isWeekCompact ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2 py-1 rounded-lg'
                                    } ${
                                      isSick
                                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 hover:bg-rose-500/30 font-black ring-1 ring-rose-500/30'
                                        : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700'
                                    }`}
                                    title={`Klikni za postavljanje raspona bolovanja / slobodnog za ${w.name}`}
                                  >
                                    {w.name} {isSick ? '🏥 BOL' : ''}
                                  </button>
                                );
                              })}

                              {freeWorkers.length === 0 && (
                                <span className="text-[10px] text-slate-600 italic py-0.5">Svi rade</span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* INLINE SATNI PLANER: Opens directly UNDER this week's table upon day click! */}
              {isInlineOpenForThisWeek && inlineDayIdx !== null && (
                <div
                  ref={inlineTimelineRef}
                  className="bg-slate-950 border-t-4 border-blue-500 p-4 sm:p-6 lg:p-8 space-y-6 animate-in fade-in slide-in-from-top-4 duration-300 shadow-[0_0_50px_rgba(37,99,235,0.2)]"
                >
                  {/* Inline Timeline Header Banner */}
                  <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border-2 border-slate-800 p-4 rounded-2xl shadow-xl">
                    <div className="flex items-center gap-3.5">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/40">
                        <Clock className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-lg font-black text-white">
                            Satni Planer Smjena: <span className="text-blue-400 uppercase tracking-wide">{DAYS[inlineDayIdx]}</span>
                          </h4>
                          <span className="text-xs font-mono font-bold bg-blue-950 text-blue-300 border border-blue-800 px-2.5 py-0.5 rounded-lg">
                            {getDayDateLabel(weekObj, inlineDayIdx)} • {weekObj.title}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Povucite traku smjene mišem lijevo-desno za pomjeranje, ili povucite rubove za rastezanje radnog vremena.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      {/* Day switcher tabs inside inline planner */}
                      <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
                        {DAYS.map((d, i) => (
                          <button
                            key={d}
                            onClick={() => {
                              setInlineTimeline({ weekId: weekObj.id, dayIdx: i });
                              setActiveDay(i);
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              inlineDayIdx === i 
                                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' 
                                : 'text-slate-400 hover:text-white hover:bg-slate-900'
                            }`}
                          >
                            {d.slice(0, 3)}
                          </button>
                        ))}
                      </div>

                      {/* Close Inline Timeline Button */}
                      <button
                        onClick={() => setInlineTimeline(null)}
                        className="px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/40 text-xs font-black flex items-center gap-2 transition-all shadow-md cursor-pointer"
                        title="Zatvori satni prikaz"
                      >
                        <X className="w-4 h-4" />
                        <span>Zatvori satni planer</span>
                      </button>
                    </div>
                  </div>

                  {/* Inline Timeline Locations Canvas: 100% full width */}
                  <div className="space-y-6">
                    {sortedLocations.map((loc, locIdx) => {
                      const theme = LOCATION_THEMES[loc.theme] || LOCATION_THEMES.blue;
                      const locShiftsToday = weekShifts
                        .filter(s => s.dayIndex === inlineDayIdx && s.locationId === loc.id)
                        .sort((a, b) => a.start - b.start);
                      const coverage = getHourlyCoverage(loc.id, inlineDayIdx, weekShifts);

                      // Robust theme colors for solid visibility
                      const barBgClass = loc.theme === 'emerald'
                        ? 'bg-emerald-600 from-emerald-600 to-teal-600 border-emerald-400'
                        : 'bg-blue-600 from-blue-600 to-indigo-600 border-blue-400';

                      return (
                        <div
                          key={loc.id}
                          className={`bg-slate-900 rounded-2xl border-2 ${theme.border} overflow-hidden shadow-2xl`}
                        >
                          {/* Location Header */}
                          <div className={`bg-gradient-to-r ${theme.bgHeader} px-5 py-3 border-b border-slate-800 flex items-center justify-between`}>
                            <div className="flex items-center gap-3">
                              <span className={`px-2.5 py-0.5 rounded-lg text-xs font-black uppercase border ${theme.badge}`}>
                                #{locIdx + 1}
                              </span>
                              <h5 className="font-extrabold text-base text-white">{loc.name}</h5>
                              <span className="text-xs text-slate-400 font-mono">
                                ({formatTime(loc.openHour)} - {formatTime(loc.closeHour)})
                              </span>
                              <span className="text-xs text-slate-400">
                                • Min. {loc.minWorkers} osoblja
                              </span>
                            </div>

                            <button
                              onClick={() => onOpenAddShiftModal({ dayIdx: inlineDayIdx, locId: loc.id, weekId: weekObj.id })}
                              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1.5 border border-slate-700 shadow-sm transition-colors cursor-pointer"
                            >
                              <Plus className="w-4 h-4 text-blue-400" />
                              <span>Dodaj smjenu</span>
                            </button>
                          </div>

                          {/* Hourly Scale Header */}
                          <div className="flex border-b border-slate-800 bg-slate-950 text-[11px] text-slate-400 font-bold select-none">
                            <div className="w-40 sm:w-48 shrink-0 border-r border-slate-800 px-4 py-2 uppercase tracking-wider text-slate-500 font-black">
                              Radnik / Vrijeme
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
                                  className={`border-r border-slate-800/80 py-2 text-center font-mono ${
                                    isPeak ? 'bg-blue-500/10 text-blue-400 font-black' : ''
                                  }`}
                                >
                                  {displayH}h
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Shift Rows */}
                        <div className="divide-y divide-slate-800/60 bg-slate-950/50">
                          {locShiftsToday.length === 0 ? (
                            <div className="py-8 text-center text-slate-500 text-xs italic">
                              Nema zakazanih smjena u {loc.name} za {DAYS[inlineDayIdx]}.
                            </div>
                          ) : (
                            locShiftsToday.map(shift => {
                              const worker = workers.find(w => w.id === shift.workerId);
                              const isDraggingThis = timelineDragState && timelineDragState.shiftId === shift.id;
                              const displayStart = isDraggingThis ? timelineDragState.currentStart : shift.start;
                              const displayEnd = isDraggingThis ? timelineDragState.currentEnd : shift.end;

                              const leftPct = ((displayStart - START_HOUR) / TOTAL_HOURS) * 100;
                              const widthPct = ((displayEnd - displayStart) / TOTAL_HOURS) * 100;

                              return (
                                <div key={shift.id} className="flex h-12 transition-colors hover:bg-slate-850/50">
                                  {/* Left Label */}
                                  <div
                                    onClick={() => onOpenEditShiftModal(shift)}
                                    className="w-40 sm:w-48 shrink-0 border-r border-slate-800 px-4 flex flex-col justify-center cursor-pointer bg-slate-900/90 z-10 select-none hover:bg-slate-800 transition-colors"
                                  >
                                    <div className="font-extrabold text-xs text-white truncate flex items-center justify-between">
                                      <span>{worker?.name || 'Radnik'}</span>
                                      <span className="text-[10px] font-mono font-bold text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded">
                                        {displayEnd - displayStart}h
                                      </span>
                                    </div>
                                    <div className="text-[10px] text-blue-300 font-mono font-bold mt-0.5">
                                      {formatTime(displayStart)} - {formatTime(displayEnd)}
                                    </div>
                                  </div>

                                  {/* Track Canvas */}
                                  <div
                                    className="timeline-track-area flex-1 relative bg-slate-950/40 cursor-pointer"
                                    style={{
                                      backgroundImage: `repeating-linear-gradient(to right, transparent, transparent calc(100% / ${TOTAL_HOURS} - 1px), rgba(51,65,85,0.25) calc(100% / ${TOTAL_HOURS} - 1px), rgba(51,65,85,0.25) calc(100% / ${TOTAL_HOURS}))`
                                    }}
                                  >
                                    <div
                                      onMouseDown={(e) => handleStartTimelineDrag(e, shift, 'move', weekObj.id)}
                                      onDoubleClick={() => onOpenEditShiftModal(shift)}
                                      style={{
                                        left: `${leftPct}%`,
                                        width: `calc(${widthPct}% - 2px)`
                                      }}
                                      className={`absolute top-1.5 bottom-1.5 rounded-xl bg-gradient-to-r ${barBgClass} border border-white/30 cursor-grab active:cursor-grabbing flex items-center justify-between px-2 select-none shadow-lg text-white ${
                                        isDraggingThis ? 'ring-3 ring-amber-400 z-30 shadow-[0_0_20px_rgba(251,191,36,0.6)]' : 'z-10'
                                      }`}
                                      title="Povucite traku za pomjeranje, ili dvokliknite za izmjenu"
                                    >
                                      {/* Left resize handle */}
                                      <div
                                        onMouseDown={(e) => handleStartTimelineDrag(e, shift, 'left', weekObj.id)}
                                        className="w-3 h-full absolute left-0 cursor-ew-resize hover:bg-white/40 rounded-l-xl"
                                        title="Rastegni početak"
                                      />
                                      
                                      <div className="w-full text-center pointer-events-none text-xs font-black font-mono truncate drop-shadow-md">
                                        {formatTime(displayStart)} - {formatTime(displayEnd)}
                                      </div>

                                      {/* Right resize handle */}
                                      <div
                                        onMouseDown={(e) => handleStartTimelineDrag(e, shift, 'right', weekObj.id)}
                                        className="w-3 h-full absolute right-0 cursor-ew-resize hover:bg-white/40 rounded-r-xl"
                                        title="Rastegni kraj"
                                      />
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>

                        {/* Hourly Coverage Meter Row */}
                        <div className="flex bg-slate-950 border-t border-slate-800 h-9 items-center select-none">
                          <div className="w-40 sm:w-48 shrink-0 border-r border-slate-800 px-4 flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-wider">
                            <span>Pokrivenost</span>
                            <span className="text-[10px] text-slate-500 font-normal">Min. {loc.minWorkers}</span>
                          </div>

                          <div className="flex-1 flex h-full">
                            {coverage.map(({ hour, count }) => {
                              const isOpen = hour >= loc.openHour && hour < loc.closeHour;
                              const isUnder = isOpen && count < loc.minWorkers;

                              return (
                                <div
                                  key={hour}
                                  style={{ width: `${100 / TOTAL_HOURS}%` }}
                                  className={`h-full border-r border-slate-900 flex items-center justify-center text-xs font-black font-mono ${
                                    count === 0
                                      ? isOpen ? 'bg-rose-950/60 text-rose-500' : 'text-slate-800'
                                      : isUnder ? 'bg-rose-500/30 text-rose-300 animate-pulse' : 'bg-emerald-500/20 text-emerald-400'
                                  }`}
                                >
                                  {count > 0 ? count : (isOpen ? '0' : '')}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>

    {/* Right Column: Docked Side Panel (Opened directly on the side without ANY overlay or blur!) */}
    {showSidebar && (
      <aside className="w-80 sm:w-96 shrink-0 bg-[#0c1220] border-l border-slate-800 flex flex-col h-full z-20 shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-[#0c1220] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-white">
                Upravljanje Osobljem ({workers.length})
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                Slobodni dani, bolovanja i dodjela smjena
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowSidebar(false)}
            className="p-1.5 rounded-xl bg-slate-850 hover:bg-slate-750 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Zatvori bočni panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Search */}
        <div className="p-4 border-b border-slate-800/80 bg-slate-950/60 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Pretraži radnika..."
              value={searchWorker}
              onChange={(e) => setSearchWorker(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Drag instructions hint */}
        <div className="px-4 py-2 bg-blue-950/30 border-b border-blue-900/30 text-[11px] text-blue-300 flex items-center gap-1.5">
          <GripVertical className="w-3.5 h-3.5 shrink-0 text-blue-400" />
          <span>Savjet: Možete prevući radnika u bilo koju ćeliju u tabeli!</span>
        </div>

        {/* Workers Cards List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredWorkers.map(w => {
            const weekShifts = currentSidebarWeek?.shifts || [];
            const weekStatuses = currentSidebarWeek?.statuses || {};
            const workerShiftsToday = weekShifts.filter(s => s.dayIndex === currentSidebarDay && s.workerId === w.id);
            const isWorking = workerShiftsToday.length > 0;
            const status = weekStatuses[`${w.id}-${currentSidebarDay}`] || (isWorking ? 'working' : 'free');
            const isSickToday = status === 'sick';

            // Total hours in current week
            const totalWeekHours = weekShifts
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
                className={`p-3.5 rounded-2xl border transition-all cursor-grab active:cursor-grabbing hover:border-blue-500/50 ${
                  isWorking
                    ? 'bg-slate-900/95 border-slate-700 shadow-sm'
                    : isSickToday
                    ? 'bg-rose-950/30 border-rose-500/40'
                    : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
                }`}
                title="Uhvati mišem radnika i prevuci u tabelu"
              >
                {/* Worker Info */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-start gap-1.5">
                    <GripVertical className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                    <div>
                      <div className="font-extrabold text-sm text-white flex items-center gap-2">
                        <span>{w.name}</span>
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-950 px-2 py-0.5 rounded-full border border-slate-800 font-mono">
                          {totalWeekHours}h zakazano
                        </span>
                      </div>
                      <div className="text-[11px] font-medium text-slate-400 mt-1">
                        {isWorking ? (
                          <span className="text-emerald-400 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> U smjeni ({workerShiftsToday.map(s => `${formatTime(s.start)}-${formatTime(s.end)}`).join(', ')})
                          </span>
                        ) : isSickToday ? (
                          <span className="text-rose-400 font-semibold flex items-center gap-1">
                            <HeartPulse className="w-3.5 h-3.5" /> Na Bolovanju
                          </span>
                        ) : (
                          <span className="text-slate-500">Slobodan dan</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className={`w-3 h-3 rounded-full mt-1 ${
                    isWorking
                      ? 'bg-emerald-500 ring-2 ring-emerald-500/20'
                      : isSickToday
                      ? 'bg-rose-500 animate-pulse ring-2 ring-rose-500/20'
                      : 'bg-slate-600'
                  }`} />
                </div>

                {/* Actions: Slobodan or Bolovanje with Date Range! */}
                <div className="flex items-center gap-2 pt-2.5 border-t border-slate-800/70">
                  {isSickToday ? (
                    <button
                      onClick={() => onClearWorkerSick(w.id, currentSidebarDay, true)}
                      className="w-full py-1.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer"
                    >
                      Prekini bolovanje & vrati smjene
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => onOpenAbsenceModal({
                          workerId: w.id,
                          type: 'free',
                          fromDay: currentSidebarDay,
                          toDay: currentSidebarDay,
                          weekId: currentSidebarWeekId
                        })}
                        className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                          !isWorking
                            ? 'bg-slate-700 text-white'
                            : 'bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white'
                        }`}
                        title="Postavi raspon slobodnih dana"
                      >
                        Slobodan (Raspon)
                      </button>

                      <button
                        onClick={() => onOpenAbsenceModal({
                          workerId: w.id,
                          type: 'sick',
                          fromDay: currentSidebarDay,
                          toDay: 6,
                          weekId: currentSidebarWeekId
                        })}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-extrabold bg-rose-500/15 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 transition-colors cursor-pointer"
                        title="Postavi raspon bolovanja"
                      >
                        🏥 BOL
                      </button>
                    </>
                  )}
                </div>

                {/* Quick Add to Location */}
                {!isWorking && !isSickToday && (
                  <div className="grid grid-cols-2 gap-2 mt-2.5">
                    {sortedLocations.map(loc => {
                      const theme = LOCATION_THEMES[loc.theme] || LOCATION_THEMES.blue;
                      return (
                        <button
                          key={loc.id}
                          onClick={() => onAssignWorkerQuick(w.id, loc.id, currentSidebarDay, null, null, currentSidebarWeekId)}
                          className={`py-1.5 rounded-xl text-xs font-black border truncate px-2 transition-all cursor-pointer ${theme.badge}`}
                          title={`Dodaj u ${loc.name}`}
                        >
                          + {loc.name}
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
    )}
  </div>
);
}
