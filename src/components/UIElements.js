"use client";
import { useState, useEffect } from 'react';

export function Toast({ toasts, setToasts }) {
  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] flex flex-col gap-3 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))} className="pointer-events-auto cursor-pointer animate-in slide-in-from-top-4 bg-slate-900 border-l-4 border-yellow-500 px-6 py-3 rounded shadow-2xl flex items-center gap-4 min-w-[300px]">
          <div className="text-yellow-500 font-black italic">!</div>
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-200 italic">{t.message}</p>
        </div>
      ))}
    </div>
  );
}

export function Modal({ modal, closeModal }) {
  const [isCustom, setIsCustom] = useState(false);
  const [localData, setLocalData] = useState({ name: '', rarity: 'Comum', value: 0 });

  // Reset internal state when modal opens
  useEffect(() => {
    if (modal.isOpen) {
      setIsCustom(false);
      setLocalData({ name: '', rarity: 'Comum', value: 0 });
    }
  }, [modal.isOpen]);

  if (!modal.isOpen) return null;

  const handleLibrarySelect = (itemName) => {
    const found = modal.library?.find(i => i.name === itemName);
    if (found) setLocalData({ name: found.name, rarity: found.rarity, value: found.value });
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={closeModal}></div>
      <div className="relative bg-slate-900 border-2 border-slate-800 p-8 rounded-[40px] max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
        <h3 className={`text-2xl font-black italic uppercase tracking-tighter mb-2 ${modal.type === 'danger' ? 'text-red-500' : 'text-yellow-500'}`}>
          {modal.title}
        </h3>

        {modal.fields ? (
          <div className="space-y-4 mb-6 mt-4">
            <div className="flex gap-2 items-center">
              {isCustom ? (
                <input
                  autoFocus
                  type="text" placeholder="Novo Nome..."
                  className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-yellow-500"
                  onChange={(e) => setLocalData({ ...localData, name: e.target.value })}
                />
              ) : (
                // Find the <select> for the library and ensure it looks like this:
                <select
                  className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-yellow-500 appearance-none cursor-pointer"
                  onChange={(e) => handleLibrarySelect(e.target.value)}
                  value={localData.name} // Added value binding
                >
                  <option value="">Biblioteca de Itens...</option>
                  {modal.library?.map((i) => (
                    <option key={i.id} value={i.name}>
                      {i.name} ({i.rarity})
                    </option>
                  ))}
                </select>
              )}
              <button
                onClick={() => setIsCustom(!isCustom)}
                className={`p-3 rounded-xl border transition-all cursor-pointer ${isCustom ? 'bg-yellow-500 border-yellow-400 text-black' : 'bg-slate-800 border-white/10 text-gray-400'}`}
              >
                ✎
              </button>
            </div>

            <select
              disabled={!isCustom}
              value={localData.rarity}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-xs outline-none disabled:opacity-30 appearance-none"
              onChange={(e) => setLocalData({ ...localData, rarity: e.target.value })}
            >
              {Object.keys(modal.rarityConfig || {}).map(r => <option key={r} value={r}>{r}</option>)}
            </select>

            <input
              disabled={!isCustom}
              type="number" value={localData.value} placeholder="Valor"
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-xs outline-none disabled:opacity-30"
              onChange={(e) => setLocalData({ ...localData, value: parseInt(e.target.value) || 0 })}
            />
          </div>
        ) : modal.input && (
          <input
            autoFocus type="number" value={modal.inputValue}
            onChange={(e) => modal.setInputValue(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white mb-6 outline-none focus:border-yellow-500"
          />
        )}

        {/* Replace the button div at the bottom of the Modal component in src/components/UIElements.js */}
        <div className="flex gap-3">
          <button
            onClick={closeModal}
            className="flex-1 px-6 py-3 rounded-full bg-slate-800 text-gray-400 font-black text-[10px] uppercase tracking-widest hover:bg-slate-700 hover:text-white hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={() => modal.onConfirm(modal.fields ? localData : modal.inputValue)}
            className={`flex-1 px-6 py-3 rounded-full font-black text-[10px] uppercase shadow-lg transition-all hover:scale-105 active:scale-95 cursor-pointer ${modal.type === 'danger'
                ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-900/20'
                : 'bg-yellow-500 hover:bg-yellow-400 text-black shadow-yellow-900/20'
              }`}
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}