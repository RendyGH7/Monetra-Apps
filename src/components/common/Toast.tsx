import React from 'react';
import { useAppStore } from '../../store';
import { Undo2, X } from 'lucide-react';

export const Toast: React.FC = () => {
  const { toast, clearToast } = useAppStore();

  if (!toast) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-4 left-1/2 -translate-x-1/2 md:left-auto md:right-6 md:translate-x-0 z-50 px-4 py-3 rounded-2xl glass-3 border border-[rgba(205,225,245,0.22)] shadow-2xl flex items-center gap-3 text-xs text-[#EEF2F6] animate-in fade-in slide-in-from-top-2 duration-200"
    >
      <span className="font-medium">{toast.message}</span>
      {toast.onUndo && (
        <button
          type="button"
          onClick={() => {
            toast.onUndo?.();
            clearToast();
          }}
          className="px-2 py-1 rounded-lg bg-[rgba(227,154,94,0.18)] text-[#E39A5E] font-semibold hover:bg-[rgba(227,154,94,0.28)] transition-colors flex items-center gap-1 cursor-pointer"
        >
          <Undo2 size={13} />
          <span>Urungkan</span>
        </button>
      )}
      <button
        type="button"
        onClick={clearToast}
        aria-label="Tutup notifikasi"
        className="p-1 text-[#A3AFBC] hover:text-[#EEF2F6] cursor-pointer"
      >
        <X size={14} />
      </button>
    </div>
  );
};
