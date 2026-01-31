"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function Home() {
  const [user, setUser] = useState(null);
  const [character, setCharacter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [previewAsPlayer, setPreviewAsPlayer] = useState(false);

  const MASTER_DISCORD_ID = "501767960646647818"; 

  const COLOR_MILESTONES = {
    BEYOND: { value: 30, color: 'text-cyan-400' }, 
    GOOD: { value: 15, color: 'text-green-400' },   
    MEDIUM: { value: 10, color: 'text-yellow-400' }, 
    BAD: { value: 5, color: 'text-red-700' }        
  };

  const getStatColor = (perc) => {
    const p = parseFloat(perc);
    if (p >= COLOR_MILESTONES.BEYOND.value) return COLOR_MILESTONES.BEYOND.color;
    if (p >= COLOR_MILESTONES.GOOD.value) return COLOR_MILESTONES.GOOD.color;
    if (p >= COLOR_MILESTONES.MEDIUM.value) return COLOR_MILESTONES.MEDIUM.color;
    return COLOR_MILESTONES.BAD.color;
  };

  useEffect(() => {
    const getData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        // Change .single() to .maybeSingle() to stop the 406 error
        const { data, error } = await supabase
          .from('characters')
          .select('*')
          .eq('id', user.id)
          .maybeSingle(); 
        
        if (error) console.error("Database error:", error.message);
        if (data) setCharacter(data);
      }
      setLoading(false);
    };
    getData();
  }, []);

  const login = () => supabase.auth.signInWithOAuth({ provider: 'discord' });
  const logout = async () => { await supabase.auth.signOut(); window.location.reload(); };

  if (loading) return <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center text-white italic">Carregando Sistema...</div>;
  if (!user) return <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center"><button onClick={login} className="bg-[#5865F2] text-white px-8 py-3 rounded font-bold uppercase tracking-widest text-xs">Entrar com Discord</button></div>;

  const isMaster = user.user_metadata.sub === MASTER_DISCORD_ID;
  const showMasterView = isMaster && !previewAsPlayer;

  // --- MATH (Starting values at 1 if database is empty) ---
  const s = character?.strength || 1;
  const r = character?.resistance || 1;
  const a = character?.aptitude || 1;
  const ag = character?.agility || 1;
  const p = character?.precision || 1;

  const presence = s + r + a + ag + p;
  const life = (s + r) * 4;
  const posture = (r * 0.25) + a;

  const getPerc = (val) => presence > 0 ? ((val / presence) * 100).toFixed(1) : "0.0";

  const StatLine = ({ label, value, isSpecial = false }) => {
    const perc = getPerc(value || 1);
    return (
      <li className="flex justify-between items-center py-1">
        <span className="text-gray-400 capitalize">{label}:</span>
        <div className="flex items-center gap-3">
          <span className={`text-[10px] font-mono ${isSpecial ? getStatColor(perc) : 'text-gray-600'}`}>
            {perc}%
          </span>
          <span className="font-mono text-lg text-yellow-500">{value || 1}</span>
        </div>
      </li>
    );
  };

  return (
    <main className="min-h-screen bg-slate-900 text-white p-6">
      <div className="max-w-4xl mx-auto">
        
        {/* MASTER TOGGLE */}
        {isMaster && (
          <div className="fixed bottom-6 right-6 z-50">
            <button 
              onClick={() => setPreviewAsPlayer(!previewAsPlayer)}
              className={`px-4 py-2 rounded-full font-bold text-[10px] uppercase border-2 shadow-2xl transition-all cursor-pointer hover:scale-105 active:scale-95 ${
                previewAsPlayer ? 'bg-red-600 border-red-400 hover:bg-red-500' : 'bg-blue-600 border-blue-400 hover:bg-blue-500'
              }`}
            >
              {previewAsPlayer ? "VOLTAR PARA MESTRE" : "PREVIEW JOGADOR"}
            </button>
          </div>
        )}

        <header className="flex justify-between items-center mb-8 border-b border-slate-700 pb-4">
          <h1 className="text-2xl font-bold text-yellow-500 italic uppercase">KIMETSU NO YAIBA RPG</h1>
          <div className="text-right">
            <p className="text-xs text-gray-400">Logado como: {user.user_metadata.full_name}</p>
            <button onClick={logout} className="text-[10px] text-red-400 underline uppercase cursor-pointer hover:text-red-300 transition-colors">Sair</button>
          </div>
        </header>

        {showMasterView ? (
          /* ================= MESTRE VIEW ================= */
          <div className="bg-red-900/20 border-2 border-red-500 p-8 rounded-xl shadow-2xl">
            <h2 className="text-3xl font-bold text-red-500 mb-4 italic uppercase tracking-tighter">Painel do Mestre</h2>
            <p className="text-gray-300">Aguardando pedidos de alteração dos jogadores...</p>
            <div className="mt-8 p-6 bg-black/40 rounded-xl border border-red-500/20 italic text-gray-500">
              Dica: Use o botão no canto inferior para testar a visão do jogador.
            </div>
          </div>
        ) : (
          /* ================= JOGADOR VIEW ================= */
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* BASE INFO CARD */}
            <div className="md:col-span-2 bg-slate-800 p-8 rounded-2xl border-2 border-slate-700 shadow-2xl relative">
              <div className="absolute top-4 right-6 opacity-10 text-6xl font-black">鬼</div>
              <h2 className="text-4xl font-black mb-6 text-yellow-500 italic uppercase tracking-tighter">
                {character?.char_name || 'PERSONAGEM'}
              </h2>
              
              <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
                <p><span className="text-gray-500 uppercase text-[10px] block">Rank:</span> <span className="font-bold">{character?.rank || 'E - Recruta'}</span></p>
                <p><span className="text-gray-500 uppercase text-[10px] block">Dólares:</span> <span className="font-bold text-green-500">{character?.dollars || 0}$</span></p>
                <p><span className="text-gray-500 uppercase text-[10px] block">Respiração:</span> <span className="font-bold text-cyan-400">{character?.breathing_style ? `${character.breathing_style} (Lvl.${character.breathing_lvl})` : '-'}</span></p>
                <p><span className="text-gray-500 uppercase text-[10px] block">Linhagem:</span> <span className="font-bold">{character?.bloodline || 'Nenhuma'}</span></p>
                <p><span className="text-gray-500 uppercase text-[10px] block">Cor de Nichirin:</span> <span className="font-bold text-white">{character?.nichirin_color || 'Nenhuma'}</span></p>
              </div>

              <div className="mt-6 p-4 bg-black/20 rounded-lg border border-white/5">
                <span className="text-gray-500 uppercase text-[10px] block mb-1">Anomalias:</span>
                <p className="text-xs text-gray-300 italic">{character?.anomalies?.length > 0 ? character.anomalies.join(' | ') : 'Nenhuma detectada'}</p>
              </div>

              {/* SECONDARY STATS */}
              <div className="mt-10 grid grid-cols-3 gap-4 text-center">
                <div className="bg-slate-900 p-4 rounded-xl border-2 border-red-500 shadow-lg group">
                  <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest">Vida</p>
                  <p className="text-3xl font-black text-white">{life}</p>
                </div>
                <div className="bg-slate-900 p-4 rounded-xl border-2 border-blue-500 shadow-lg group">
                  <p className="text-[10px] text-blue-500 font-bold uppercase tracking-widest">Presença</p>
                  <p className="text-3xl font-black text-white">{presence}</p>
                </div>
                <div className="bg-slate-900 p-4 rounded-xl border-2 border-green-500 shadow-lg group">
                  <p className="text-[10px] text-green-500 font-bold uppercase tracking-widest">Postura</p>
                  <p className="text-3xl font-black text-white">{posture.toFixed(1)}</p>
                </div>
              </div>
            </div>

            {/* ATTRIBUTES CARD */}
            <div className="bg-slate-800 p-6 rounded-2xl border-2 border-slate-700 shadow-2xl">
              <div className="flex justify-between items-center mb-6 pb-2 border-b border-slate-700">
                <h3 className="font-bold text-gray-400 uppercase tracking-widest text-xs">Atributos</h3>
                <div className="bg-yellow-500/10 px-2 py-1 rounded border border-yellow-500/30">
                  <span className="text-yellow-500 font-bold text-xs">{character?.stat_points_available || 0} PS</span>
                </div>
              </div>

              <div className="space-y-6">
                <ul className="space-y-3">
                  <StatLine label="Força" value={character?.strength} />
                  <StatLine label="Resistência" value={character?.resistance} />
                  <StatLine label="Aptidão" value={character?.aptitude} />
                  <StatLine label="Agilidade" value={character?.agility} />
                  <StatLine label="Precisão" value={character?.precision} />
                </ul>

                <div className="pt-4 border-t border-slate-700">
                  <p className="text-[9px] text-cyan-500 font-bold uppercase mb-3">Especialidades</p>
                  <ul className="space-y-3">
                    <StatLine label="Inteligência" value={character?.intelligence} isSpecial />
                    <StatLine label="Sorte" value={character?.luck} isSpecial />
                    <StatLine label="Carisma" value={character?.charisma} isSpecial />
                  </ul>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </main>
  );
}