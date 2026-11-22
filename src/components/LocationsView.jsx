import React from 'react';
import { MapPin, Plus, Edit2, Trash2, Clock, Users } from 'lucide-react';
import { LOCATION_THEMES, formatTime } from '../constants';

export default function LocationsView({
  locations,
  week,
  onOpenAddLocationModal,
  onOpenEditLocationModal,
  onDeleteLocation
}) {
  const shifts = week?.shifts || [];

  return (
    <div className="flex-1 overflow-y-auto p-4 lg:p-8 bg-[#090d16] space-y-6">
      {/* Header section */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2.5">
            <MapPin className="w-6 h-6 text-emerald-400" />
            Upravljanje Lokalima ({locations.length} lokala)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Konfiguracija radnog vremena, minimalnog broja radnika i tema boja za svaki objekat
          </p>
        </div>

        <button
          onClick={onOpenAddLocationModal}
          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition-all hover:scale-[1.02]"
        >
          <Plus className="w-4 h-4" />
          <span>Dodaj Novi Lokal</span>
        </button>
      </div>

      {/* Locations Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {locations.map((loc, idx) => {
          const theme = LOCATION_THEMES[loc.theme] || LOCATION_THEMES.blue;
          const locShifts = shifts.filter(s => s.locationId === loc.id);
          const totalHours = locShifts.reduce((acc, s) => acc + (s.end - s.start), 0);

          return (
            <div
              key={loc.id}
              className={`bg-slate-900 border-2 ${theme.border} rounded-2xl overflow-hidden shadow-xl flex flex-col justify-between`}
            >
              {/* Header */}
              <div className={`bg-gradient-to-r ${theme.bgHeader} p-5 border-b border-slate-800 flex items-center justify-between`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl bg-slate-950 flex items-center justify-center border ${theme.border}`}>
                    <MapPin className={`w-5 h-5 ${theme.accent}`} />
                  </div>
                  <div>
                    <span className={`px-2 py-0.2 rounded text-[10px] font-black uppercase tracking-wider border ${theme.badge}`}>
                      Lokal #{idx + 1}
                    </span>
                    <h3 className="text-lg font-black text-white mt-1">{loc.name}</h3>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onOpenEditLocationModal(loc)}
                    className="p-2 rounded-xl bg-slate-850 hover:bg-slate-750 text-slate-300 hover:text-white transition-colors border border-slate-700"
                    title="Uredi lokal"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  {locations.length > 1 && (
                    <button
                      onClick={() => onDeleteLocation(loc.id)}
                      className="p-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 transition-colors border border-rose-500/30"
                      title="Obriši lokal"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-slate-400 block mb-1">Radno vrijeme:</span>
                    <strong className="text-white font-mono text-sm">
                      {formatTime(loc.openHour)} - {formatTime(loc.closeHour)}
                    </strong>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-slate-400 block mb-1">Potrebno osoblje:</span>
                    <strong className="text-emerald-400 font-bold text-sm">
                      Min. {loc.minWorkers} radnika po satu
                    </strong>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Ukupno sati u sedmici:
                    </span>
                    <strong className="text-xl font-black text-white font-mono mt-0.5 block">
                      {totalHours} sati
                    </strong>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400 block">Broj smjena:</span>
                    <strong className="text-sm font-bold text-blue-400">{locShifts.length} smjena</strong>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

