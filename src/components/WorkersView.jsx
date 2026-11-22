import React from 'react';
import { Users, Plus, Edit2, Trash2, Phone, Briefcase, Clock, MapPin, CheckCircle2 } from 'lucide-react';

export default function WorkersView({
  workers,
  locations,
  week,
  onOpenAddWorkerModal,
  onOpenEditWorkerModal,
  onDeleteWorker
}) {
  const shifts = week?.shifts || [];

  return (
    <div className="flex-1 overflow-y-auto p-4 lg:p-8 bg-[#090d16] space-y-6">
      {/* Header section */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2.5">
            <Users className="w-6 h-6 text-blue-400" />
            Upravljanje Osobljem ({workers.length} radnika)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Pregled svih uposlenika, ugovorenih radnih sati i raspoređenog fonda sati u sedmici: <span className="text-white font-bold">{week?.title}</span>
          </p>
        </div>

        <button
          onClick={onOpenAddWorkerModal}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-600/30 transition-all hover:scale-[1.02]"
        >
          <Plus className="w-4 h-4" />
          <span>Dodaj Novog Radnika</span>
        </button>
      </div>

      {/* Workers Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {workers.map(w => {
          // Calculate scheduled hours in active week
          const workerShifts = shifts.filter(s => s.workerId === w.id);
          const totalHours = workerShifts.reduce((acc, s) => acc + (s.end - s.start), 0);
          const primaryLocation = locations.find(l => l.id === w.primaryLoc);
          const targetWeeklyHours = (w.defaultHours || 8) * 5; // standard 5 days
          const diff = totalHours - targetWeeklyHours;

          return (
            <div
              key={w.id}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-lg transition-all flex flex-col justify-between group"
            >
              <div>
                {/* Header card info */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-slate-800 to-slate-700 flex items-center justify-center font-bold text-base text-blue-400 border border-slate-700">
                      {w.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-extrabold text-base text-white">{w.name}</h3>
                      <span className="text-xs text-slate-400 font-medium flex items-center gap-1 mt-0.5">
                        <Briefcase className="w-3 h-3 text-slate-500" /> {w.role || 'Radnik'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onOpenEditWorkerModal(w)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-blue-600/30 text-slate-300 hover:text-blue-300 transition-colors border border-slate-700 hover:border-blue-500/50 cursor-pointer shadow-sm"
                      title="Uredi radnika"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDeleteWorker(w.id)}
                      className="p-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 hover:text-rose-200 transition-colors border border-rose-500/30 hover:border-rose-500/60 cursor-pointer shadow-sm"
                      title="Obriši radnika"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Details badge pills */}
                <div className="space-y-2 mt-4 text-xs">
                  <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950 border border-slate-800/80">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-blue-400" /> Dnevna smjena:
                    </span>
                    <strong className="text-white font-mono">{w.defaultHours || 8}h</strong>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950 border border-slate-800/80">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-emerald-400" /> Glavni lokal:
                    </span>
                    <strong className="text-white truncate max-w-[150px]">
                      {primaryLocation?.name || 'Svi lokali'}
                    </strong>
                  </div>

                  {w.phone && (
                    <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950 border border-slate-800/80">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-amber-400" /> Telefon:
                      </span>
                      <strong className="text-slate-300 font-mono">{w.phone}</strong>
                    </div>
                  )}
                </div>
              </div>

              {/* Hours calculation in current week */}
              <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                    Zakazano ove sedmice
                  </div>
                  <div className="text-lg font-black text-white font-mono flex items-baseline gap-1 mt-0.5">
                    <span>{totalHours}h</span>
                    <span className="text-xs text-slate-400 font-normal">/ {workerShifts.length} smjena</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                    totalHours >= 40
                      ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                      : totalHours > 0
                      ? 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}>
                    {totalHours >= 40 ? 'Puna norma' : totalHours > 0 ? 'Djelimično' : 'Nema smjena'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

