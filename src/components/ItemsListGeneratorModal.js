"use client";
import { useState } from 'react';
import { RARITY_CONFIG } from '../constants/gameData';

export default function ItemsListGeneratorModal({ isOpen, closeModal, library, showToast }) {
  const [generateMode, setGenerateMode] = useState('all'); // 'all' or 'random'
  const [randomCount, setRandomCount] = useState(5);
  const [filterRarity, setFilterRarity] = useState('Todas');
  const [filterType, setFilterType] = useState('Todos');
  const [includeName, setIncludeName] = useState(false);
  const [generatedList, setGeneratedList] = useState('');

  if (!isOpen) return null;

  const handleGenerate = () => {
    let filtered = library.filter(item => {
      if (filterRarity !== 'Todas' && item.rarity !== filterRarity) return false;
      if (filterType !== 'Todos' && (item.type || 'Item') !== filterType) return false;
      return true;
    });

    if (generateMode === 'random') {
      const shuffled = [...filtered].sort(() => 0.5 - Math.random());
      filtered = shuffled.slice(0, randomCount);
    }

    const lines = filtered.map(item => {
      // id, rarity, value (and can mark to put name right after id or not)
      const idStr = item.item_id || item.id;
      const nameStr = includeName ? ` (${item.name})` : '';
      return `${idStr}${nameStr} - ${item.rarity} - $${item.value}`;
    });

    if (lines.length === 0) {
      setGeneratedList("Nenhum item encontrado com esses filtros.");
    } else {
      setGeneratedList(lines.join('\n'));
    }
  };

  const copyToClipboard = () => {
    if (!generatedList) return;
    navigator.clipboard.writeText(generatedList);
    showToast("Lista copiada!");
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={closeModal}></div>
      <div className="relative bg-zinc-900 border-2 border-zinc-800 p-8 rounded-[40px] max-w-lg w-full shadow-2xl animate-in zoom-in-95 duration-200">
        <h3 className="text-2xl font-black italic uppercase tracking-tighter mb-4 text-yellow-500">
          Gerar Lista de Itens
        </h3>

        <div className="space-y-4 mb-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <span className="text-[10px] text-zinc-500 font-bold uppercase">Modo</span>
              <select
                value={generateMode}
                onChange={(e) => setGenerateMode(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-yellow-500"
              >
                <option value="all">Todos os Itens</option>
                <option value="random">Itens Aleatórios</option>
              </select>
            </div>
            
            {generateMode === 'random' && (
              <div className="space-y-1">
                <span className="text-[10px] text-zinc-500 font-bold uppercase">Quantidade</span>
                <input
                  type="number"
                  min="1"
                  value={randomCount}
                  onChange={(e) => setRandomCount(parseInt(e.target.value) || 1)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-yellow-500"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <span className="text-[10px] text-zinc-500 font-bold uppercase">Filtrar Raridade</span>
              <select
                value={filterRarity}
                onChange={(e) => setFilterRarity(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-yellow-500"
              >
                <option value="Todas">Todas</option>
                {Object.keys(RARITY_CONFIG || {}).map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-zinc-500 font-bold uppercase">Filtrar Tipo</span>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-yellow-500"
              >
                <option value="Todos">Todos</option>
                <option value="Item">Item</option>
                <option value="Equipamento">Equipamento</option>
                <option value="Consumível">Consumível</option>
              </select>
            </div>
          </div>

          <label className="flex items-center gap-3 bg-black/20 p-3 rounded-xl border border-white/5 cursor-pointer">
            <input
              type="checkbox"
              checked={includeName}
              onChange={(e) => setIncludeName(e.target.checked)}
              className="accent-yellow-500"
            />
            <span className="text-[10px] font-black uppercase text-zinc-400">Incluir Nome após o ID?</span>
          </label>

          <button
            onClick={handleGenerate}
            className="w-full bg-yellow-500 text-black px-4 py-3 rounded-xl font-black uppercase text-xs hover:bg-yellow-400 transition-all"
          >
            Gerar
          </button>

          {generatedList && (
            <div className="space-y-2 mt-4 animate-in fade-in slide-in-from-top-2">
              <textarea
                readOnly
                value={generatedList}
                className="w-full h-32 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-[10px] font-mono outline-none resize-none custom-scrollbar"
              />
              <button
                onClick={copyToClipboard}
                className="w-full bg-zinc-800 text-zinc-300 border border-zinc-700 px-4 py-2 rounded-xl font-black uppercase text-[10px] hover:text-white hover:border-zinc-500 transition-all"
              >
                Copiar para a Área de Transferência
              </button>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={closeModal}
            className="flex-1 px-6 py-3 rounded-full bg-slate-800 text-gray-400 font-black text-[10px] uppercase tracking-widest hover:bg-slate-700 hover:text-white hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
