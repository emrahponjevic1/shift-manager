import React, { useState, useRef } from 'react';
import { 
  Printer, 
  Share2, 
  Download, 
  Upload, 
  CheckCircle2, 
  FileSpreadsheet, 
  CheckSquare, 
  Square,
  Settings2,
  Calendar,
  MapPin,
  Clock
} from 'lucide-react';
import { 
  DAYS, 
  LOCATION_THEMES, 
  formatTime, 
  getDayDateLabel, 
  sortLocations 
} from '../constants';

export default function PrintSheetView({
  week,
  workers,
  locations,
  onShowToast,
  onImportBackup
}) {
  const printRef = useRef(null);
  const shifts = week?.shifts || [];
  const statuses = week?.statuses || {};

  // Sort locations so Trubarjeva is first, Bavarski Dvor is below
  const sortedLocations = sortLocations(locations);

  // Checkbox configuration for what tables to print (Default to only the 2 location tables on Page 1)
  const [printSections, setPrintSections] = useState({
    loc_trubarjeva: true,
    loc_bavarski: true,
    combinedGrid: false,
    absentTable: false,
    availabilityMatrix: false,
    hoursReport: false
  });

  // Print typography size: 'large' (default for high readability) vs 'compact'
  const [printFontSize, setPrintFontSize] = useState('large');

  const toggleSection = (key) => {
    setPrintSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSelectAll = (val) => {
    setPrintSections({
      loc_trubarjeva: val,
      loc_bavarski: val,
      combinedGrid: val,
      absentTable: val,
      availabilityMatrix: val,
      hoursReport: val
    });
  };

  // 1. Direct browser print (A4 landscape)
  const handlePrint = () => {
    window.print();
  };

  // 2. Export to CSV / Excel spreadsheet
  const handleExportCSV = () => {
    if (!week) return;

    let csv = `Lokacija,Dan,Datum,Radnik,Pocetak,Kraj,Trajanje_Sati\n`;
    sortedLocations.forEach(loc => {
      DAYS.forEach((d, dIdx) => {
        const dateLbl = getDayDateLabel(week, dIdx);
        const dayShifts = shifts.filter(s => s.dayIndex === dIdx && s.locationId === loc.id);
        dayShifts.forEach(s => {
          const w = workers.find(wk => wk.id === s.workerId);
          csv += `"${loc.name}","${d}","${dateLbl}","${w?.name || 'Radnik'}","${formatTime(s.start)}","${formatTime(s.end)}",${s.end - s.start}\n`;
        });
      });
    });

    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Siftarica_${week.title.replace(/[^a-zA-Z0-9]/g, '_')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    onShowToast('CSV fajl uspješno preuzet!');
  };

  // 3. Generate WhatsApp Formatted Text
  const handleCopyWhatsApp = () => {
    if (!week) return;

    let txt = `📅 *ŠIFTARICA (${week.title})*\n`;
    txt += `==============================\n`;

    sortedLocations.forEach(loc => {
      txt += `\n📍 *${loc.name.toUpperCase()}*\n`;
      DAYS.forEach((d, dIdx) => {
        const dateLbl = getDayDateLabel(week, dIdx);
        const dayShifts = shifts
          .filter(s => s.dayIndex === dIdx && s.locationId === loc.id)
          .sort((a, b) => a.start - b.start);

        const formatted = dayShifts.map(s => {
          const w = workers.find(wk => wk.id === s.workerId);
          return `${w?.name || 'Radnik'} (${formatTime(s.start)}-${formatTime(s.end)})`;
        }).join(', ');

        txt += `• *${d}${dateLbl ? ` (${dateLbl})` : ''}:* ${formatted || 'Nema smjena'}\n`;
      });
    });

    txt += `\n🏥 *ODSUTNI / BOLOVANJE:*\n`;
    DAYS.forEach((d, dIdx) => {
      const free = [];
      const sick = [];
      workers.forEach(w => {
        const hasShift = shifts.some(s => s.dayIndex === dIdx && s.workerId === w.id);
        const st = statuses[`${w.id}-${dIdx}`];
        if (st === 'sick') sick.push(w.name);
        else if (!hasShift || st === 'free') free.push(w.name);
      });

      if (sick.length > 0 || free.length > 0) {
        txt += `• *${d}:* ${sick.length > 0 ? `Bolovanje: ${sick.join(', ')} ` : ''}${free.length > 0 ? `Slobodni: ${free.join(', ')}` : ''}\n`;
      }
    });

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(() => {
        onShowToast('Formatiran tekst za WhatsApp kopiran u međuspremnik!');
      });
    } else {
      const textArea = document.createElement('textarea');
      textArea.value = txt;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      onShowToast('Formatiran tekst za WhatsApp kopiran u međuspremnik!');
    }
  };

  // 4. Download Full Database JSON
  const handleDownloadBackup = () => {
    window.open('/api/backup/export', '_blank');
    onShowToast('Preuzimanje baze podataka pokrenuto!');
  };

  // 5. File input trigger
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        onImportBackup(parsed);
      } catch (err) {
        onShowToast('Neispravan format JSON backup fajla!', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 lg:p-8 bg-[#090d16] space-y-6 print:p-0 print:m-0 print:bg-white print:overflow-visible">
      {/* Configuration & Selection Card (Hidden in Print) */}
      <div className="no-print bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2.5">
              <Printer className="w-6 h-6 text-emerald-400" />
              Opcije Štampanja & PDF Izvoza (A4 Landscape)
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Odaberite koje tabele želite uključiti u štampanje i prilagodite veličinu fonta
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black flex items-center gap-2 shadow-lg shadow-blue-600/30 transition-all hover:scale-[1.02]"
            >
              <Printer className="w-4 h-4" />
              <span>Printaj / Sačuvaj kao PDF</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all"
              title="Preuzmi u Excel formatu"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Izvoz u Excel / CSV</span>
            </button>

            <button
              onClick={handleCopyWhatsApp}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-2 transition-colors"
            >
              <Share2 className="w-4 h-4 text-emerald-400" />
              <span>WhatsApp Tekst</span>
            </button>

            <button
              onClick={handleDownloadBackup}
              className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-4 h-4 text-blue-400" />
              <span>Backup JSON</span>
            </button>
          </div>
        </div>

        {/* Checkbox Selector: What to print */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-blue-400" />
              Odaberi tabele za print:
            </h4>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleSelectAll(true)}
                className="text-xs text-blue-400 hover:underline font-bold"
              >
                Označi sve
              </button>
              <span className="text-slate-600">•</span>
              <button
                type="button"
                onClick={() => handleSelectAll(false)}
                className="text-xs text-slate-400 hover:underline font-semibold"
              >
                Odznači sve
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors">
              <input
                type="checkbox"
                checked={printSections.loc_trubarjeva}
                onChange={() => toggleSection('loc_trubarjeva')}
                className="w-4 h-4 rounded text-blue-600 focus:ring-0"
              />
              <span className="text-xs font-bold text-white">📍 Lokal #1: Trubarjeva (Gore)</span>
            </label>

            <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors">
              <input
                type="checkbox"
                checked={printSections.loc_bavarski}
                onChange={() => toggleSection('loc_bavarski')}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-0"
              />
              <span className="text-xs font-bold text-white">📍 Lokal #2: Bavarski Dvor (Ispod)</span>
            </label>

            <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors">
              <input
                type="checkbox"
                checked={printSections.combinedGrid}
                onChange={() => toggleSection('combinedGrid')}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-0"
              />
              <span className="text-xs font-bold text-white">📊 Velika Tjedna Mreža Smjena</span>
            </label>

            <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors">
              <input
                type="checkbox"
                checked={printSections.absentTable}
                onChange={() => toggleSection('absentTable')}
                className="w-4 h-4 rounded text-amber-600 focus:ring-0"
              />
              <span className="text-xs font-bold text-white">🏥 Odsutni i Bolovanja po Danima</span>
            </label>

            <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors">
              <input
                type="checkbox"
                checked={printSections.availabilityMatrix}
                onChange={() => toggleSection('availabilityMatrix')}
                className="w-4 h-4 rounded text-purple-600 focus:ring-0"
              />
              <span className="text-xs font-bold text-white">👥 Matrica Osoblja (Radnik po danima)</span>
            </label>

            <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors">
              <input
                type="checkbox"
                checked={printSections.hoursReport}
                onChange={() => toggleSection('hoursReport')}
                className="w-4 h-4 rounded text-teal-600 focus:ring-0"
              />
              <span className="text-xs font-bold text-white">⏱️ Izvještaj Sati i Norme Osoblja</span>
            </label>
          </div>
        </div>
      </div>

      {/* Printable Sheet Card (White Paper styled for A4 Landscape) */}
      <div className="overflow-x-auto rounded-2xl shadow-2xl border border-slate-800 bg-white mx-auto max-w-[1280px] print:border-none print:shadow-none print:rounded-none print:m-0 print:p-0 print:max-w-none print:w-full print:bg-white print:overflow-visible">
        <div ref={printRef} className="print-container p-6 md:p-8 bg-white text-slate-950 print:p-0 print:my-0 print:mx-auto print:w-[99%] print:max-w-[99%] print:min-w-0 print:bg-white">
          {/* Document Header - Clean & Professional for A4 Landscape */}
          <div className="flex justify-between items-center border-b border-slate-300 pb-2 mb-2.5">
            <div className="flex items-center gap-3">
              <span className="text-xl font-black tracking-tight text-slate-900 uppercase">
                ŠEHEREZADA
              </span>
              <span className="bg-slate-100 border border-slate-300 text-slate-800 text-[10px] font-black px-2.5 py-0.5 rounded tracking-wider uppercase">
                Službeni Raspored Smjena
              </span>
              <span className="text-xs font-bold text-slate-600 ml-1">
                Period: <span className="text-slate-900 font-black">{week?.title}</span>
              </span>
            </div>

            <div className="text-right text-[10px] text-slate-500 font-bold flex items-center gap-2">
              <span>Štampano: {new Date().toLocaleDateString('bs-BA')}</span>
              <span className="font-mono text-slate-400">• A4 Landscape</span>
            </div>
          </div>

          <div className="space-y-2.5">
            {/* Table 1: Trubarjeva (Na Vrhu) */}
            {printSections.loc_trubarjeva && (() => {
              const loc = sortedLocations.find(l => l.id === 'loc_trubarjeva' || l.name.toLowerCase().includes('trubarjeva')) || sortedLocations[0];
              if (!loc) return null;
              const theme = LOCATION_THEMES[loc.theme] || LOCATION_THEMES.blue;

              return (
                <div key={loc.id} className="print-table-section border border-slate-300 rounded-lg overflow-hidden bg-white shadow-none w-full">
                  <div className="bg-slate-100 border-b border-slate-300 px-3 py-1 font-black text-xs uppercase tracking-wider flex justify-between items-center text-slate-900">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block"></span>
                      <span className="font-black">LOKAL #1: {loc.name}</span>
                    </div>
                    <span className="text-[11px] font-mono font-bold text-slate-600">
                      Radno vrijeme: {formatTime(loc.openHour)} - {formatTime(loc.closeHour)}
                    </span>
                  </div>

                  <table className="w-full border-collapse text-left print-table table-fixed">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-300 text-xs font-black text-slate-800 uppercase">
                        {DAYS.map((d, dIdx) => (
                          <th key={d} className="py-1 px-1.5 border-r border-slate-200 last:border-r-0 w-[14.285%] bg-transparent">
                            <div className="font-black text-xs text-slate-900 bg-transparent">{d}</div>
                            <div className="text-[9.5px] font-bold text-slate-500 font-mono bg-transparent">
                              {getDayDateLabel(week, dIdx)}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="align-top">
                        {DAYS.map((_, dIdx) => {
                          const dayShifts = shifts
                            .filter(s => s.dayIndex === dIdx && s.locationId === loc.id)
                            .sort((a, b) => a.start - b.start);

                          return (
                            <td key={dIdx} className="p-1 border-r border-slate-200 last:border-r-0 space-y-1 w-[14.285%]">
                              {dayShifts.length === 0 ? (
                                <div className="text-xs text-slate-300 italic py-2.5 text-center font-bold">—</div>
                              ) : (
                                dayShifts.map(s => {
                                  const worker = workers.find(wk => wk.id === s.workerId);
                                  const isNight = s.end >= 24;

                                  return (
                                    <div
                                      key={s.id}
                                      className={`py-0.5 px-1.5 rounded border text-[11px] flex items-center justify-between font-bold leading-tight ${
                                        isNight
                                          ? 'bg-slate-50 border-slate-300 text-slate-900'
                                          : 'bg-amber-50/70 border-amber-300 text-slate-900'
                                      }`}
                                    >
                                      <span className="text-[10.5px] font-black text-slate-900 shrink-0 mr-1">{worker?.name || 'Radnik'}</span>
                                      <span className="font-mono text-[9.5px] font-bold text-slate-700 whitespace-nowrap ml-auto">
                                        {formatTime(s.start)} - {formatTime(s.end)}
                                      </span>
                                    </div>
                                  );
                                })
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              );
            })()}

            {/* Table 2: Bavarski Dvor (Ispod) */}
            {printSections.loc_bavarski && (() => {
              const loc = sortedLocations.find(l => l.id === 'loc_bavarski' || l.name.toLowerCase().includes('bavarski')) || sortedLocations[1];
              if (!loc) return null;
              const theme = LOCATION_THEMES[loc.theme] || LOCATION_THEMES.emerald;

              return (
                <div key={loc.id} className="print-table-section border border-slate-300 rounded-lg overflow-hidden bg-white shadow-none w-full">
                  <div className="bg-slate-100 border-b border-slate-300 px-3 py-1 font-black text-xs uppercase tracking-wider flex justify-between items-center text-slate-900">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block"></span>
                      <span className="font-black">LOKAL #2: {loc.name}</span>
                    </div>
                    <span className="text-[11px] font-mono font-bold text-slate-600">
                      Radno vrijeme: {formatTime(loc.openHour)} - {formatTime(loc.closeHour)}
                    </span>
                  </div>

                  <table className="w-full border-collapse text-left print-table table-fixed">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-300 text-xs font-black text-slate-800 uppercase">
                        {DAYS.map((d, dIdx) => (
                          <th key={d} className="py-1 px-1.5 border-r border-slate-200 last:border-r-0 w-[14.285%] bg-transparent">
                            <div className="font-black text-xs text-slate-900 bg-transparent">{d}</div>
                            <div className="text-[9.5px] font-bold text-slate-500 font-mono bg-transparent">
                              {getDayDateLabel(week, dIdx)}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="align-top">
                        {DAYS.map((_, dIdx) => {
                          const dayShifts = shifts
                            .filter(s => s.dayIndex === dIdx && s.locationId === loc.id)
                            .sort((a, b) => a.start - b.start);

                          return (
                            <td key={dIdx} className="p-1 border-r border-slate-200 last:border-r-0 space-y-1 w-[14.285%]">
                              {dayShifts.length === 0 ? (
                                <div className="text-xs text-slate-300 italic py-2.5 text-center font-bold">—</div>
                              ) : (
                                dayShifts.map(s => {
                                  const worker = workers.find(wk => wk.id === s.workerId);
                                  const isNight = s.end >= 24;

                                  return (
                                    <div
                                      key={s.id}
                                      className={`py-0.5 px-1.5 rounded border text-[11px] flex items-center justify-between font-bold leading-tight ${
                                        isNight
                                          ? 'bg-slate-50 border-slate-300 text-slate-900'
                                          : 'bg-emerald-50/70 border-emerald-300 text-slate-900'
                                      }`}
                                    >
                                      <span className="text-[10.5px] font-black text-slate-900 shrink-0 mr-1">{worker?.name || 'Radnik'}</span>
                                      <span className="font-mono text-[9.5px] font-bold text-slate-700 whitespace-nowrap ml-auto">
                                        {formatTime(s.start)} - {formatTime(s.end)}
                                      </span>
                                    </div>
                                  );
                                })
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              );
            })()}

            {/* Combined Weekly Matrix (Requested: Tjedna mreža i to ne da je sitno) */}
            {printSections.combinedGrid && (
              <div className="print-table-section print-page-break border border-slate-300 rounded-lg overflow-hidden bg-white shadow-none">
                <div className="bg-slate-100 border-b border-slate-300 text-slate-900 px-4 py-1.5 font-black text-xs uppercase tracking-wider flex justify-between items-center">
                  <span>KOMBINIRANA TJEDNA MREŽA SVIH SMJENA (A4 LANDSCAPE)</span>
                  <span className="text-[11px] font-mono text-slate-600">Trubarjeva & Bavarski Dvor</span>
                </div>

                <table className="w-full border-collapse text-left print-table table-fixed">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-300 text-xs font-black text-slate-800 uppercase">
                      <th className="p-2 border-r border-slate-200 w-32">Lokal</th>
                      {DAYS.map((d, dIdx) => (
                        <th key={d} className="p-1.5 border-r border-slate-200 last:border-r-0 text-center">
                          <div className="font-extrabold text-xs text-slate-900">{d}</div>
                          <div className="text-[9.5px] text-slate-500 font-mono font-bold">
                            {getDayDateLabel(week, dIdx)}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {sortedLocations.map(loc => (
                      <tr key={loc.id}>
                        <td className="p-2 border-r border-slate-200 font-black text-xs bg-slate-50 text-slate-900">
                          <div>{loc.name}</div>
                        </td>
                        {DAYS.map((_, dIdx) => {
                          const cellShifts = shifts
                            .filter(s => s.dayIndex === dIdx && s.locationId === loc.id)
                            .sort((a, b) => a.start - b.start);

                          return (
                            <td key={dIdx} className="p-1 border-r border-slate-200 last:border-r-0 align-top space-y-1">
                              {cellShifts.map(s => {
                                const w = workers.find(wk => wk.id === s.workerId);
                                return (
                                  <div
                                    key={s.id}
                                    className="p-1 rounded border border-slate-300 bg-white shadow-none flex flex-col"
                                  >
                                    <span className="font-extrabold text-[11px] text-slate-900">{w?.name}</span>
                                    <span className="font-mono text-[9.5px] font-bold text-slate-600">
                                      {formatTime(s.start)}-{formatTime(s.end)}
                                    </span>
                                  </div>
                                );
                              })}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Table 3: Absent Workers & Sick Leave */}
            {printSections.absentTable && (
              <div className="print-table-section print-page-break border border-slate-300 rounded-lg overflow-hidden bg-white shadow-none">
                <div className="bg-slate-100 border-b border-slate-300 text-slate-900 px-4 py-1.5 font-black text-xs uppercase tracking-wider flex justify-between">
                  <span>Slobodni Dani i Bolovanja po Danima</span>
                </div>
                <table className="w-full border-collapse text-left print-table table-fixed">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-300 text-xs font-black text-slate-800 uppercase">
                      {DAYS.map(d => (
                        <th key={d} className="py-1 px-1.5 border-r border-slate-200 last:border-r-0 w-[14.285%]">
                          {d}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="align-top">
                      {DAYS.map((_, dIdx) => {
                        const free = [];
                        const sick = [];
                        workers.forEach(w => {
                          const hasShift = shifts.some(s => s.dayIndex === dIdx && s.workerId === w.id);
                          const st = statuses[`${w.id}-${dIdx}`];
                          if (st === 'sick') sick.push(w.name);
                          else if (!hasShift || st === 'free') free.push(w.name);
                        });

                        return (
                          <td key={dIdx} className="p-2.5 border-r-2 border-slate-300 last:border-r-0 text-xs space-y-1.5 font-bold">
                            {sick.map(n => (
                              <div key={n} className="px-2 py-1 rounded bg-rose-100 border border-rose-500 text-rose-950 font-black">
                                🏥 BOL: {n}
                              </div>
                            ))}
                            {free.map(n => (
                              <div key={n} className="px-2 py-1 rounded bg-slate-100 border border-slate-400 text-slate-900 font-bold">
                                SLOB: {n}
                              </div>
                            ))}
                            {free.length === 0 && sick.length === 0 && (
                              <div className="text-slate-400 text-center py-2 font-semibold">Svi rade</div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Table 4: Worker Availability Matrix */}
            {printSections.availabilityMatrix && (
              <div className="print-table-section print-page-break border border-slate-300 rounded-lg overflow-hidden bg-white shadow-none">
                <div className="bg-slate-100 border-b border-slate-300 text-slate-900 px-4 py-1.5 font-black text-xs uppercase tracking-wider flex justify-between">
                  <span>Matrica Dostupnosti Osoblja (Radnik po Danima)</span>
                  <span className="text-[11px] font-mono text-slate-600">Ukupno radnika: {workers.length}</span>
                </div>
                <table className="w-full border-collapse text-center text-xs print-table table-fixed">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-300 font-black text-slate-800 uppercase">
                      <th className="py-1 px-3 border-r border-slate-200 text-left w-28">Radnik</th>
                      {DAYS.map(d => (
                        <th key={d} className="py-1 px-1 border-r border-slate-200 last:border-r-0">
                          {d}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {workers.map(w => (
                      <tr key={w.id} className="hover:bg-slate-50">
                        <td className="py-1 px-3 border-r border-slate-200 font-black text-slate-900 text-left text-xs">
                          {w.name}
                        </td>
                        {DAYS.map((_, dIdx) => {
                          const hasShift = shifts.some(s => s.dayIndex === dIdx && s.workerId === w.id);
                          const st = statuses[`${w.id}-${dIdx}`];

                          if (st === 'sick') {
                            return (
                              <td key={dIdx} className="p-0.5 border-r border-slate-200 last:border-r-0 bg-rose-50 text-rose-800 font-bold uppercase text-[10px]">
                                Bolovanje
                              </td>
                            );
                          }
                          if (!hasShift || st === 'free') {
                            return (
                              <td key={dIdx} className="p-0.5 border-r border-slate-200 last:border-r-0 bg-emerald-50 text-emerald-800 font-bold uppercase text-[10px]">
                                Slobodan
                              </td>
                            );
                          }
                          return (
                            <td key={dIdx} className="p-0.5 border-r border-slate-200 last:border-r-0 text-slate-600 font-bold font-mono text-[10px]">
                              U smjeni
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Table 5: Hours & Contract Norm Report */}
            {printSections.hoursReport && (
              <div className="print-table-section print-page-break border border-slate-300 rounded-lg overflow-hidden bg-white shadow-none">
                <div className="bg-slate-100 border-b border-slate-300 text-slate-900 px-4 py-1.5 font-black text-xs uppercase tracking-wider flex justify-between">
                  <span>Pregled Ukupno Odrađenih Sati i Norme</span>
                  <span className="text-[11px] font-mono text-slate-600">Period: {week?.title}</span>
                </div>
                <table className="w-full border-collapse text-left text-xs print-table table-fixed">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-300 font-black text-slate-800 uppercase">
                      <th className="py-1 px-3 border-r border-slate-200">Radnik</th>
                      <th className="py-1 px-2 border-r border-slate-200">Uloga</th>
                      <th className="py-1 px-2 border-r border-slate-200 text-center">Smjena</th>
                      <th className="py-1 px-2 border-r border-slate-200 text-center">Sati</th>
                      <th className="py-1 px-2 border-r border-slate-200 text-center">Norma</th>
                      <th className="py-1 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {workers.map(w => {
                      const wShifts = shifts.filter(s => s.workerId === w.id);
                      const totalHours = wShifts.reduce((acc, s) => acc + (s.end - s.start), 0);
                      const norm = (w.defaultHours || 8) * 5;
                      const diff = totalHours - norm;

                      return (
                        <tr key={w.id}>
                          <td className="py-1 px-3 border-r border-slate-200 font-black text-slate-900 text-xs">
                            {w.name}
                          </td>
                          <td className="py-1 px-2 border-r border-slate-200 text-slate-600 text-[11px]">
                            {w.role || 'Radnik'}
                          </td>
                          <td className="py-1 px-2 border-r border-slate-200 text-center font-mono font-bold text-xs">
                            {wShifts.length}
                          </td>
                          <td className="py-1 px-2 border-r border-slate-200 text-center font-mono font-black text-xs">
                            {totalHours}h
                          </td>
                          <td className="py-1 px-2 border-r border-slate-200 text-center font-mono text-slate-500 font-bold text-xs">
                            {norm}h
                          </td>
                          <td className="py-1 px-3 text-center font-bold text-[11px]">
                            {totalHours === 0 ? (
                              <span className="text-slate-400">Nema smjena</span>
                            ) : diff > 0 ? (
                              <span className="text-amber-800 font-bold">+{diff}h prekovremeno</span>
                            ) : diff < 0 ? (
                              <span className="text-blue-800 font-bold">{diff}h manje</span>
                            ) : (
                              <span className="text-emerald-800 font-bold">Tačno u normi</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
