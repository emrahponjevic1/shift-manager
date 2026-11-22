import React, { useEffect } from 'react';
import { 
  X, 
  AlertTriangle, 
  AlertOctagon, 
  Info, 
  CheckCircle2, 
  ShieldAlert 
} from 'lucide-react';

export default function AppDialog({
  isOpen,
  type = 'error', // 'error' | 'warning' | 'danger' | 'info' | 'success'
  title,
  message,
  details = [],
  confirmText = 'U redu',
  cancelText = null,
  onConfirm,
  onCancel
}) {
  if (!isOpen) return null;

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (cancelText && onCancel) {
          onCancel();
        } else if (onConfirm) {
          onConfirm();
        }
      } else if (e.key === 'Enter') {
        if (onConfirm) onConfirm();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cancelText, onConfirm, onCancel]);

  const isDanger = type === 'error' || type === 'danger';
  const isWarning = type === 'warning';
  const isSuccess = type === 'success';

  const badgeConfig = isDanger
    ? {
        bg: 'bg-rose-500/15 border-rose-500/40 text-rose-400',
        border: 'border-rose-500/40 shadow-rose-950/40',
        btnConfirm: 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30',
        icon: <AlertOctagon className="w-6 h-6 text-rose-400 shrink-0" />
      }
    : isWarning
    ? {
        bg: 'bg-amber-500/15 border-amber-500/40 text-amber-400',
        border: 'border-amber-500/40 shadow-amber-950/40',
        btnConfirm: 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/30',
        icon: <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0" />
      }
    : isSuccess
    ? {
        bg: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400',
        border: 'border-emerald-500/40 shadow-emerald-950/40',
        btnConfirm: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30',
        icon: <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
      }
    : {
        bg: 'bg-blue-500/15 border-blue-500/40 text-blue-400',
        border: 'border-blue-500/40 shadow-blue-950/40',
        btnConfirm: 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30',
        icon: <Info className="w-6 h-6 text-blue-400 shrink-0" />
      };

  return (
    <div 
      className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          if (cancelText && onCancel) onCancel();
          else if (onConfirm) onConfirm();
        }
      }}
    >
      <div className={`bg-slate-900 border rounded-2xl w-full max-w-md p-6 shadow-2xl relative animate-in zoom-in-95 duration-150 ${badgeConfig.border}`}>
        {/* Close Button */}
        <button
          onClick={() => {
            if (cancelText && onCancel) onCancel();
            else if (onConfirm) onConfirm();
          }}
          className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header with Icon */}
        <div className="flex items-start gap-3.5 mb-4 pr-6">
          <div className={`p-2.5 rounded-xl border shrink-0 ${badgeConfig.bg}`}>
            {badgeConfig.icon}
          </div>
          <div>
            <h3 className="text-base font-extrabold text-white leading-tight">
              {title || (isDanger ? 'Zabranjena akcija' : isWarning ? 'Upozorenje' : 'Obavještenje')}
            </h3>
            <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-400">
              Šeherezada Shift Pro
            </span>
          </div>
        </div>

        {/* Message Body */}
        {message && (
          <div className="text-sm text-slate-200 leading-relaxed whitespace-pre-line mb-3 font-medium">
            {message}
          </div>
        )}

        {/* Optional Bullet Details (e.g. rest warnings) */}
        {details && details.length > 0 && (
          <div className="my-3 p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5">
            {details.map((d, idx) => (
              <div key={idx} className="text-xs text-amber-300/90 leading-snug flex items-start gap-1.5">
                <span className="text-amber-400 shrink-0">•</span>
                <span>{d}</span>
              </div>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 mt-6 pt-3 border-t border-slate-800/80">
          {cancelText && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-colors border border-slate-700 cursor-pointer"
            >
              {cancelText}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            className={`px-5 py-2.5 rounded-xl text-xs font-black shadow-lg transition-all cursor-pointer ${badgeConfig.btnConfirm}`}
            autoFocus
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

