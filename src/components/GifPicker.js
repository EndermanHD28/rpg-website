'use client';

import React, { useState, useEffect } from 'react';

// ⚠️ COLOQUE AQUI A CHAVE QUE VOCÊ GEROU NO GIPHY DEVELOPERS
const GIPHY_API_KEY = "rGyZpxCzkD6BGZAUFT3OWh64LZ6MxdB5"; 

export default function GifPicker({ onSelect, onClose }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [gifs, setGifs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchGifs = async (term = '') => {
    setLoading(true);
    setError(null);
    try {
      // Se não tem busca, mostra os trending (bombando)
      const url = term 
        ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(term)}&limit=25&rating=g`
        : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=25&rating=g`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.meta.status !== 200) {
        throw new Error(data.meta.msg);
      }

      setGifs(data.data);
    } catch (err) {
      console.error("Erro na API:", err);
      setError("Erro ao carregar GIFs. Verifique sua API Key.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGifs();
  }, []);

  // Busca com debounce (espera o usuário parar de digitar)
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchGifs(searchTerm);
    }, 600);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  return (
    <div className="absolute bottom-full right-0 mb-4 w-80 h-[450px] bg-[#1e1f22] border border-white/10 rounded-xl shadow-2xl flex flex-col overflow-hidden z-[100] animate-in fade-in zoom-in-95 duration-200">
      {/* Header */}
      <div className="p-3 border-b border-white/5 bg-[#2b2d31] flex items-center justify-between">
        <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Biblioteca de GIFs</span>
        <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>

      {/* Search */}
      <div className="p-3 bg-[#2b2d31]">
        <div className="relative">
          <input
            autoFocus
            type="text"
            placeholder="Procure o GIF perfeito..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#1e1f22] border-none rounded-md px-3 py-2 text-sm text-zinc-200 outline-none focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-zinc-600"
          />
        </div>
      </div>

      {/* Grid estilo Discord (Masonry) */}
      <div className="flex-1 overflow-y-auto p-2 bg-[#313338] custom-scrollbar">
        {error ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
             <p className="text-red-400 text-xs mb-2">❌ {error}</p>
             <p className="text-[10px] text-zinc-500">Verifique se sua API KEY do Giphy está correta.</p>
          </div>
        ) : (
          <div className="columns-2 gap-2 space-y-2">
            {gifs.map((gif) => (
              <div
                key={gif.id}
                onClick={() => onSelect(gif.images.fixed_height.url, gif.images.fixed_height.width, gif.images.fixed_height.height)}
                className="relative break-inside-avoid bg-[#2b2d31] rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-indigo-500 transition-all group"
              >
                <img
                  src={gif.images.fixed_height_small.url}
                  alt={gif.title}
                  className="w-full h-auto block min-h-[50px]"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            ))}
          </div>
        )}

        {loading && (
          <div className="flex justify-center p-4">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && !error && gifs.length === 0 && (
          <p className="text-center text-zinc-500 text-xs mt-10">Nenhum GIF do "{searchTerm}" encontrado</p>
        )}
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-white/5 bg-[#2b2d31] flex justify-center items-center">
         <img src="https://giphy.com/static/img/powered_by_giphy_light.png" alt="Giphy" className="h-3 opacity-30" />
      </div>
    </div>
  );
}