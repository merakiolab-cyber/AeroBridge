import React from 'react';
import { Check, Info, AlertTriangle, AlertCircle } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  title: string;
  description?: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          onClick={() => onDismiss(toast.id)}
          className="pointer-events-auto flex items-center gap-3 px-4 py-3 bg-[#161820]/95 text-slate-100 rounded-xl border border-white/10 shadow-2xl backdrop-blur-md transition-all animate-in fade-in slide-in-from-bottom-2 duration-200 cursor-pointer hover:border-white/20"
        >
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
              toast.type === 'success'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : toast.type === 'error'
                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                : toast.type === 'warning'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
            }`}
          >
            {toast.type === 'success' && <Check className="w-4 h-4" />}
            {toast.type === 'error' && <AlertCircle className="w-4 h-4" />}
            {toast.type === 'warning' && <AlertTriangle className="w-4 h-4" />}
            {toast.type === 'info' && <Info className="w-4 h-4" />}
          </div>

          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold leading-tight">{toast.title}</div>
            {toast.description && (
              <div className="text-[11px] text-slate-400 truncate mt-0.5">
                {toast.description}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
