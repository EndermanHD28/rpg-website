"use client";
import { useState, useEffect } from 'react';
import { WEAPON_CATEGORIES, WEAPON_SUBTYPES, HANDS_OPTIONS, TIERS, DAMAGE_TYPES } from '../constants/gameData';

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
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('Item');
  const [localData, setLocalData] = useState({ 
    name: '', 
    rarity: 'Comum', 
    value: 0, 
    isBackpack: false,
    category: '',
    subtype: '',
    hands: 'Uma Mão',
    tier: 'T0',
    upgrade: 0,
    amount: 1,
    damageType: 'Corte'
  });

  // Reset internal state when modal opens
  useEffect(() => {
    if (modal.isOpen) {
      setIsCustom(modal.forcedCustom || false);
      setSearchTerm('');
      setActiveTab('Item');
      setLocalData({ 
        name: modal.initialData?.name || '', 
        type: modal.initialData?.type || 'Item',
        rarity: modal.initialData?.rarity || 'Comum', 
        value: modal.initialData?.value || 0, 
        isBackpack: modal.initialData?.isBackpack || false,
        category: modal.initialData?.category || '',
        subtype: modal.initialData?.subtype || '',
        hands: modal.initialData?.hands || 'Uma Mão',
        tier: modal.initialData?.tier || 'T0',
        upgrade: modal.initialData?.upgrade || 0,
        amount: modal.initialData?.amount || 1,
        damageType: modal.initialData?.damageType || 'Corte'
      });
    }
  }, [modal.isOpen, modal.initialData, modal.forcedCustom]);

  if (!modal.isOpen) return null;

  const handleLibrarySelect = (itemName) => {
    const found = modal.library?.find(i => i.name === itemName);
    if (found) setLocalData({ 
      ...localData,
      name: found.name, 
      type: found.type || 'Item',
      rarity: found.rarity, 
      value: found.value,
      category: found.category || '',
      subtype: found.subtype || '',
      hands: found.hands || 'Uma Mão',
      tier: found.tier || 'T0',
      upgrade: found.upgrade || 0,
      damageType: found.damageType || 'Corte'
    });
  };

  const filteredLibrary = (modal.library || [])
    .filter(i => (i.type || 'Item') === activeTab)
    .filter(i => {
      const search = searchTerm.toLowerCase().replace(/\s/g, '');
      const name = i.name.toLowerCase().replace(/\s/g, '');
      return name.includes(search);
    });

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={closeModal}></div>
      <div className="relative bg-slate-900 border-2 border-slate-800 p-8 rounded-[40px] max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
        <h3 className={`text-2xl font-black italic uppercase tracking-tighter mb-2 ${modal.type === 'danger' ? 'text-red-500' : 'text-yellow-500'}`}>
          {modal.title}
        </h3>

        {modal.fields ? (
          <div className="space-y-4 mb-6 mt-4">
            {/* SEARCH AND TABS (Only if not forced custom) */}
            {!modal.forcedCustom && !isCustom && (
              <div className="space-y-4">
                <div className="flex gap-4 border-b border-white/5 pb-2">
                  {['Item', 'Equipamento', 'Consumível'].map(t => (
                    <button key={t} onClick={() => setActiveTab(t)}
                      className={`text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === t ? 'text-white border-b-2 border-yellow-500 pb-1' : 'text-zinc-600 hover:text-zinc-400'}`}>
                      {t}s
                    </button>
                  ))}
                </div>
                <input 
                  type="text" 
                  placeholder="Pesquisar na biblioteca..."
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-yellow-500"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            )}

            {/* Item Name / Library Select */}
            <div className="flex gap-2 items-center">
              {isCustom || modal.forcedCustom ? (
                <input
                  autoFocus
                  type="text" placeholder="Nome do Item..."
                  className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-yellow-500"
                  value={localData.name}
                  onChange={(e) => setLocalData({ ...localData, name: e.target.value })}
                />
              ) : (
                <select
                  className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-yellow-500 appearance-none cursor-pointer"
                  onChange={(e) => handleLibrarySelect(e.target.value)}
                  value={localData.name}
                >
                  <option value="">{`Selecionar ${activeTab}...`}</option>
                  {filteredLibrary.map((i) => (
                    <option key={i.id} value={i.name}>{i.name}</option>
                  ))}
                </select>
              )}
              {!modal.forcedCustom && (
                <button onClick={() => setIsCustom(!isCustom)} className={`p-3 rounded-xl border transition-all ${isCustom ? 'bg-yellow-500 text-black' : 'bg-slate-800 text-gray-400'}`}>✎</button>
              )}
            </div>

            {/* TYPE SELECTION (Only in forced custom / Management) */}
            {modal.forcedCustom && (
              <div className="grid grid-cols-3 gap-2">
                {['Item', 'Equipamento', 'Consumível'].map(t => (
                  <button
                    key={t}
                    onClick={() => setLocalData({ ...localData, type: t })}
                    className={`py-2 rounded-lg text-[10px] font-black uppercase border transition-all ${localData.type === t ? 'bg-white text-black border-white' : 'border-white/10 text-zinc-500'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}

            {/* SPECIAL PROPERTIES (Only if Equip) */}
            {localData.type === 'Equipamento' && (
              <div className="space-y-4">
                <label className="flex items-center gap-3 bg-black/20 p-3 rounded-xl border border-white/5 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!modal.forcedCustom && !isCustom}
                    checked={localData.isBackpack}
                    onChange={(e) => setLocalData({ ...localData, isBackpack: e.target.checked, category: e.target.checked ? '' : localData.category })}
                    className="accent-yellow-500"
                  />
                  <span className="text-[10px] font-black uppercase text-zinc-400">É uma Mochila?</span>
                </label>

                {!localData.isBackpack && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <select 
                        disabled={!modal.forcedCustom && !isCustom}
                        value={localData.category} 
                        onChange={(e) => setLocalData({ ...localData, category: e.target.value, subtype: '' })}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-[10px] outline-none font-black uppercase disabled:opacity-20"
                      >
                        <option value="">Categoria Arma...</option>
                        {WEAPON_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>

                      <select 
                        disabled={(!modal.forcedCustom && !isCustom) || !localData.category}
                        value={localData.subtype} 
                        onChange={(e) => setLocalData({ ...localData, subtype: e.target.value })}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-[10px] outline-none font-black uppercase disabled:opacity-20"
                      >
                        <option value="">Tipo...</option>
                        {localData.category && WEAPON_SUBTYPES[localData.category].map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>

                    {(localData.subtype || !modal.forcedCustom) && (
                      <div className="space-y-3 p-4 bg-black/20 rounded-2xl border border-white/5">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <span className="text-[8px] font-black text-zinc-500 uppercase">Mãos</span>
                            <select 
                              disabled={!modal.forcedCustom && !isCustom}
                              value={localData.hands} onChange={(e) => setLocalData({ ...localData, hands: e.target.value })} className="w-full bg-slate-800 border border-white/10 rounded px-2 py-1.5 text-[9px] outline-none text-white disabled:opacity-30">
                              {HANDS_OPTIONS.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                          </div>
                          <div className="space-y-1">
                            <span className="text-[8px] font-black text-zinc-500 uppercase">Tier</span>
                            <select
                              disabled={modal.forcedCustom && !modal.isInventoryEdit}
                              value={localData.tier} onChange={(e) => setLocalData({ ...localData, tier: e.target.value })} className="w-full bg-slate-800 border border-white/10 rounded px-2 py-1.5 text-[9px] outline-none text-white disabled:opacity-30">
                              {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <span className="text-[8px] font-black text-zinc-500 uppercase">Upgrade</span>
                            <input
                              disabled={modal.forcedCustom && !modal.isInventoryEdit}
                              type="number" value={localData.upgrade} onChange={(e) => setLocalData({ ...localData, upgrade: parseInt(e.target.value) || 0 })} className="w-full bg-slate-800 border border-white/10 rounded px-2 py-1.5 text-[9px] outline-none text-white disabled:opacity-30" />
                          </div>
                          <div className="space-y-1">
                            <span className="text-[8px] font-black text-zinc-500 uppercase">Dano</span>
                            <select 
                              disabled={!modal.forcedCustom && !isCustom}
                              value={localData.damageType} onChange={(e) => setLocalData({ ...localData, damageType: e.target.value })} className="w-full bg-slate-800 border border-white/10 rounded px-2 py-1.5 text-[9px] outline-none text-white disabled:opacity-30">
                              {DAMAGE_TYPES.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {(modal.forcedCustom || isCustom) && (
                <select
                  value={localData.rarity}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-xs outline-none"
                  onChange={(e) => setLocalData({ ...localData, rarity: e.target.value })}
                >
                  {Object.keys(modal.rarityConfig || {}).map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              )}

              <div className="relative col-start-2">
                <span className="absolute -top-3 left-0 text-[8px] text-zinc-500 font-bold uppercase">
                  {!modal.forcedCustom ? "Quantidade" : "Valor"}
                </span>
                <div className="flex gap-2">
                  {!modal.forcedCustom && !isCustom && (
                    <input
                      type="number" value={localData.amount} placeholder="Qtd"
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-3 text-white text-xs outline-none"
                      onChange={(e) => setLocalData({ ...localData, amount: parseInt(e.target.value) || 1 })}
                    />
                  )}
                  {(modal.forcedCustom || isCustom) && (
                    <input
                      type="number" value={localData.value} placeholder="Valor"
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-3 text-white text-xs outline-none"
                      onChange={(e) => setLocalData({ ...localData, value: parseInt(e.target.value) || 0 })}
                    />
                  )}
                </div>
              </div>
            </div>
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
          {modal.onDelete && (
            <button
              onClick={() => modal.onDelete(localData)}
              className="px-4 py-3 rounded-full bg-red-900/40 text-red-500 font-black text-[10px] uppercase tracking-widest hover:bg-red-900/60 transition-all cursor-pointer"
            >
              Excluir
            </button>
          )}
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
