import React from 'react';
import { 
  Calendar, 
  Clock, 
  LayoutGrid, 
  Users, 
  MapPin, 
  BarChart3, 
  Printer, 
  Plus, 
  Trash2, 
  Database, 
  Sparkles,
  RotateCcw,
  Copy,
  Sun,
  Moon,
  Save,
  Check
} from 'lucide-react';
import { DAYS, getDayDateLabel } from '../constants';

export default function Header({
  weeks,
  activeWeekId,
  setActiveWeekId,
  activeTab,
  setActiveTab,
  onOpenNewWeekModal,
  onOpenCopyDayModal,
  onResetPrevious,
  onDeleteWeek,
  theme,
  toggleTheme,
  hasUnsavedChanges = false,
  onSave
}) {
  const currentWeek = weeks.find(w => w.id === activeWeekId) || weeks[0];

  return (
    <header className="bg-slate-900/95 backdrop-blur border-b border-slate-800 shrink-0 z-30 shadow-xl sticky top-0 no-print">
      {/* Top Bar */}
      <div className="px-4 lg:px-6 py-2.5 flex flex-wrap items-center justify-between gap-4">
        {/* Brand & Database Status */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-emerald-500 p-0.5 shadow-lg shadow-blue-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Calendar className="w-5 h-5 text-blue-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base lg:text-lg font-black tracking-tight text-white flex items-center gap-1.5">
                ŠEHEREZADA <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">SHIFT PRO</span>
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Database className="w-3 h-3" /> SQLite Baza Aktivna
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
              Sistem za upravljanje smjenama i osobljem
            </p>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <nav className="flex items-center bg-slate-950/80 p-1 rounded-xl border border-slate-800 shadow-inner">
          <button
            onClick={() => setActiveTab('timeline')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'timeline'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span className="hidden md:inline">Satni Planer</span>
          </button>

          <button
            onClick={() => setActiveTab('grid')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'grid'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            <span className="hidden md:inline">Tjedna Mreža</span>
          </button>

          <button
            onClick={() => setActiveTab('workers')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'workers'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Users className="w-4 h-4" />
            <span className="hidden md:inline">Radnici</span>
          </button>

          <button
            onClick={() => setActiveTab('locations')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'locations'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span className="hidden md:inline">Lokali</span>
          </button>

          <button
            onClick={() => setActiveTab('stats')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'stats'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span className="hidden md:inline">Analitika</span>
          </button>

          <button
            onClick={() => setActiveTab('print')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'print'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Printer className="w-4 h-4 text-emerald-400" />
            <span className="hidden md:inline">Print / Izvoz</span>
          </button>
        </nav>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2">
          {activeTab === 'timeline' && (
            <button
              onClick={onOpenCopyDayModal}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
              title="Kopiraj trenutni dan u druge dane sedmice"
            >
              <Copy className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">Kopiraj Dan</span>
            </button>
          )}

          <button
            onClick={onOpenNewWeekModal}
            className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-blue-600/20 transition-all hover:scale-[1.02]"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Sedmica</span>
          </button>

          {/* Dark / Light Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
            title={theme === 'dark' ? 'Prebaci na svijetlu temu (Light Mode)' : 'Prebaci na tamnu temu (Dark Mode)'}
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Svijetla</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-indigo-400" />
                <span className="hidden sm:inline">Tamna</span>
              </>
            )}
          </button>

          {/* Save Button (Explicit Save) */}
          <button
            onClick={onSave}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm ${
              hasUnsavedChanges
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white ring-2 ring-emerald-400/80 shadow-emerald-600/30 cursor-pointer animate-pulse'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer'
            }`}
            title={hasUnsavedChanges ? 'Imate nesačuvane izmjene! Kliknite da sačuvate stanje' : 'Sve izmjene su sačuvane u bazi'}
          >
            {hasUnsavedChanges ? (
              <>
                <Save className="w-3.5 h-3.5 text-white" />
                <span>Sačuvaj</span>
                <span className="w-2 h-2 rounded-full bg-amber-300 animate-ping ml-0.5" />
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Sačuvano</span>
              </>
            )}
          </button>

          {/* Reset Button (Reverts to previous saved state) */}
          <button
            onClick={onResetPrevious}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
              hasUnsavedChanges
                ? 'bg-rose-950/60 hover:bg-rose-900/80 text-rose-200 border-rose-600/60 shadow-sm'
                : 'bg-rose-950/30 hover:bg-rose-900/50 text-rose-300/80 border-rose-800/30'
            }`}
            title={hasUnsavedChanges ? 'Poništi nesačuvane izmjene i vrati na zadnje spremljeno stanje' : 'Vrati na zadnje spremljeno stanje'}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </div>

      {/* Week Selector Bar */}
      <div className="px-4 lg:px-6 py-2 bg-slate-950/60 border-t border-slate-800/70 flex items-center gap-2 overflow-x-auto no-scrollbar">
        <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 shrink-0 mr-1 flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5 text-blue-400" /> Sedmice:
        </span>
        <div className="flex items-center gap-2">
          {weeks.map((wk, idx) => {
            const isSelected = wk.id === activeWeekId;
            return (
              <div
                key={wk.id}
                onClick={() => setActiveWeekId(wk.id)}
                className={`group px-3 py-1 rounded-lg text-xs font-bold cursor-pointer flex items-center gap-2 border transition-all shrink-0 ${
                  isSelected
                    ? 'bg-blue-600/20 border-blue-500/60 text-blue-200 shadow-sm shadow-blue-500/10'
                    : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                  isSelected ? 'bg-blue-500/30 text-blue-200' : 'bg-slate-800 text-slate-400'
                }`}>
                  #{idx + 1}
                </span>
                <span>{wk.title}</span>
                {weeks.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteWeek(wk.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 hover:text-rose-400 transition-opacity ml-1 p-0.5 rounded"
                    title="Obriši sedmicu"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </header>
  );
}

