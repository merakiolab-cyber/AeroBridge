import React, { useState, useEffect, useRef } from 'react';
import { X, Check, FolderPlus, Edit3, Trash2 } from 'lucide-react';

export interface InputDialogProps {
  isOpen: boolean;
  type: 'rename' | 'new-folder' | 'confirm-delete';
  title: string;
  initialValue?: string;
  itemCount?: number;
  onClose: () => void;
  onSubmit: (value: string) => void;
}

export const InputDialog: React.FC<InputDialogProps> = ({
  isOpen,
  type,
  title,
  initialValue = '',
  itemCount = 1,
  onClose,
  onSubmit,
}) => {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValue(initialValue);
      setError(null);
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          // Select just filename stem without extension for easy editing
          if (type === 'rename') {
            const lastDot = initialValue.lastIndexOf('.');
            if (lastDot > 0) {
              inputRef.current.setSelectionRange(0, lastDot);
            } else {
              inputRef.current.select();
            }
          } else {
            inputRef.current.select();
          }
        }
      }, 50);
    }
  }, [isOpen, initialValue, type]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (type === 'confirm-delete') {
      onSubmit('');
      return;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      setError('Název nemůže být prázdný');
      return;
    }
    if (/[\\/:*?"<>|]/.test(trimmed)) {
      setError('Název nesmí obsahovat znaky: \\ / : * ? " < > |');
      return;
    }
    onSubmit(trimmed);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div
        className="w-full max-w-md bg-[#16181d] border border-white/10 shadow-2xl rounded-none text-zinc-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.08] bg-[#1a1c23]">
          <div className="flex items-center gap-2.5 font-semibold text-sm text-white">
            {type === 'new-folder' && <FolderPlus className="w-4 h-4 text-[#e2e4e9]" />}
            {type === 'rename' && <Edit3 className="w-4 h-4 text-[#e2e4e9]" />}
            {type === 'confirm-delete' && <Trash2 className="w-4 h-4 text-rose-400" />}
            <span>{title}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5">
          {type === 'confirm-delete' ? (
            <div className="py-2 text-sm text-zinc-300">
              Opravdu chcete přesunout{' '}
              <span className="font-semibold text-white">
                {itemCount === 1 ? `"${initialValue}"` : `${itemCount} vybraných položek`}
              </span>{' '}
              do Koše Windows?
              <div className="text-xs text-zinc-400 mt-2">
                Položky budou přesunuty do Koše a můžete je v případě potřeby obnovit.
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="block text-xs font-medium text-zinc-400">
                {type === 'new-folder' ? 'Název nové složky:' : 'Nový název:'}
              </label>
              <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  if (error) setError(null);
                }}
                className={`w-full px-3 py-2 bg-[#0c0d10] border ${
                  error ? 'border-rose-500' : 'border-white/15 focus:border-[#e2e4e9]'
                } text-white text-sm outline-none rounded-none font-mono transition-colors`}
              />
              {error && <div className="text-xs text-rose-400">{error}</div>}
            </div>
          )}

          {/* Footer buttons */}
          <div className="flex items-center justify-end gap-3 mt-6 pt-3 border-t border-white/[0.06]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors rounded-none cursor-pointer"
            >
              Zrušit
            </button>
            <button
              type="submit"
              className={`flex items-center gap-2 px-4 py-1.5 text-xs font-semibold rounded-none transition-colors cursor-pointer ${
                type === 'confirm-delete'
                  ? 'bg-rose-600 hover:bg-rose-500 text-white'
                  : 'bg-[#e2e4e9] hover:bg-white text-black'
              }`}
            >
              {type === 'confirm-delete' ? (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Přesunout do Koše</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Potvrdit</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
