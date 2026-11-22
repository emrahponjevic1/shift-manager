import React from 'react';
import { BarChart3, Clock, Users, MapPin, AlertTriangle, CheckCircle2, HeartPulse } from 'lucide-react';
import { DAYS, formatTime } from '../constants';

export default function StatsView({ week, workers, locations }) {
  const shifts = week?.shifts || [];
  const statuses = week?.statuses || {};

  // Total scheduled hours
  const totalHours = shifts.reduce((acc, s) => acc + (s.end - s.start), 0);

  // Hours per location
  const locStats = locations.map(loc => {
    const locShifts = shifts.filter(s => s.locationId === loc.id);
    const hours = locShifts.reduce((acc, s) => acc + (s.end - s.start), 0);
    return {
      ...loc,
      hours,
      shiftsCount: locShifts.length,
      pct: totalHours > 0 ? Math.round((hours / totalHours) * 100) : 0
    };
  });

  // Hours per worker
  const workerStats = workers.map(w => {
    const wShifts = shifts.filter(s => s.workerId === w.id);
    const hours = wShifts.reduce((acc, s) => acc + (s.end - s.start), 0);
    const targetHours = (w.defaultHours || 8) * 5;
    const diff = hours - targetHours;
    return {
      ...w,
      hours,
      shiftsCount: wShifts.length,
      targetHours,
      diff
    };
  }).sort((a, b) => b.hours - a.hours);

  // Sick days count
  const sickCount = Object.values(statuses).filter(s => s === 'sick').length;
  const freeCount = Object.values(statuses).filter(s => s === 'free').length;

  return (
    <div className="flex-1 overflow-y-auto p-4 lg:p-8 bg-[#090d16] space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <h2 className="text-xl font-black text-white flex items-center gap-2.5">
          <BarChart3 className="w-6 h-6 text-blue-400" />
          Sedmična Analitika & Statistika: <span className="text-blue-400">{week?.title}</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Automatski izračun ukupnog fonda sati po radnicima i lokacijama
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-lg">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Ukupno Radnih Sati</span>
          <div className="text-3xl font-black text-white font-mono mt-1 flex items-baseline gap-2">
            <span>{totalHours}h</span>
            <span className="text-xs text-blue-400 font-bold font-sans">({shifts.length} smjena)</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-lg">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Aktivnih Radnika</span>
          <div className="text-3xl font-black text-emerald-400 font-mono mt-1">
            {workers.filter(w => shifts.some(s => s.workerId === w.id)).length} / {workers.length}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-lg">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Bolovanja (Danas/Sedmica)</span>
          <div className="text-3xl font-black text-rose-400 font-mono mt-1 flex items-center gap-2">
            <HeartPulse className="w-6 h-6" /> {sickCount} dana
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-lg">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Lokali u pogonu</span>
          <div className="text-3xl font-black text-purple-400 font-mono mt-1">
            {locations.length} lokala
          </div>
        </div>
      </div>

      {/* Hours by Location */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <h3 className="text-base font-extrabold text-white mb-4 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-emerald-400" />
          Distribucija Radnih Sati po Lokalima
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {locStats.map(loc => (
            <div key={loc.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800">
              <div className="flex justify-between items-center mb-2">
                <span className="font-extrabold text-white text-sm">{loc.name}</span>
                <span className="text-xs font-mono font-bold text-emerald-400">{loc.hours}h ({loc.pct}%)</span>
              </div>
              <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500"
                  style={{ width: `${loc.pct}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-slate-400 mt-2">
                <span>{loc.shiftsCount} zakazanih smjena</span>
                <span>Min. {loc.minWorkers} radnika po satu</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Hours by Worker Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-5 border-b border-slate-800">
          <h3 className="text-base font-extrabold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            Izvještaj Radnih Sati po Uposleniku
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-extrabold uppercase">
                <th className="p-3.5 pl-6">Radnik</th>
                <th className="p-3.5">Pozicija</th>
                <th className="p-3.5 text-center">Smjena</th>
                <th className="p-3.5 text-center">Odrađeno Sati</th>
                <th className="p-3.5 text-center">Standard Norma</th>
                <th className="p-3.5 text-center">Status / Razlika</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {workerStats.map(w => {
                const isOver = w.diff > 0;
                const isUnder = w.diff < 0;

                return (
                  <tr key={w.id} className="hover:bg-slate-850/40 transition-colors">
                    <td className="p-3.5 pl-6 font-extrabold text-white text-sm">
                      {w.name}
                    </td>
                    <td className="p-3.5 text-slate-300 font-medium">
                      {w.role || 'Radnik'}
                    </td>
                    <td className="p-3.5 text-center font-mono font-bold text-slate-300">
                      {w.shiftsCount}
                    </td>
                    <td className="p-3.5 text-center font-mono font-bold text-white text-sm">
                      {w.hours}h
                    </td>
                    <td className="p-3.5 text-center font-mono text-slate-400">
                      {w.targetHours}h
                    </td>
                    <td className="p-3.5 text-center">
                      <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] ${
                        w.hours === 0
                          ? 'bg-slate-800 text-slate-400'
                          : isOver
                          ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                          : isUnder
                          ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                          : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                      }`}>
                        {w.hours === 0 ? 'Bez smjena' : isOver ? `+${w.diff}h prekovremeno` : isUnder ? `${w.diff}h manje` : 'Tačno norma'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

