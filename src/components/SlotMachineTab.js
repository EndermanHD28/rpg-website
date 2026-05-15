"use client";
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { LINHAGENS, RESPIRACOES, CORES } from '../constants/gameData';

export default function SlotMachineTab({ user, isMaster, allPlayers, showToast, playSound }) {
  const [targetType, setTargetType] = useState('Linhagens');
  const [playerNameInput, setPlayerNameInput] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [reel, setReel] = useState([]);
  const [offset, setOffset] = useState(0);
  const [winnerIndex, setWinnerIndex] = useState(null); // Track the winning element index
  const [globalState, setGlobalState] = useState(null);

  const ITEM_HEIGHT = 100;
  const VIEWPORT_HEIGHT = 296;
  const CENTER_CONSTANT = (VIEWPORT_HEIGHT / 2 - ITEM_HEIGHT / 2);

  const TARGET_OPTIONS = {
    'Linhagens': LINHAGENS.filter(l => l !== 'Nenhuma'),
    'Respirações': RESPIRACOES.filter(r => r !== 'Nenhuma'),
    'Cores Nichirin': CORES.filter(c => c !== 'Nenhuma')
  };

  useEffect(() => {
    const fetchGlobal = async () => {
      const { data } = await supabase.from('global').select('*').eq('id', 1).single();
      if (data) {
        setGlobalState(data);
        if (data.slot_machine_target) setTargetType(data.slot_machine_target);

        if (data.slot_machine_is_spinning && data.slot_machine_result) {
          prepareAndStartAnimation(data.slot_machine_result, data.slot_machine_target);
        } else if (data.slot_machine_result) {
          // Mostra o resultado com vizinhos ao carregar a página
          const windowReel = getResultWindow(data.slot_machine_result, data.slot_machine_target || targetType);
          setReel(windowReel);
          setWinnerIndex(1);
          setOffset(1 * ITEM_HEIGHT - CENTER_CONSTANT);
        }
      }
    };
    fetchGlobal();

    const channel = supabase.channel('slot_machine_realtime')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'global', filter: 'id=eq.1' }, (payload) => {
        const newData = payload.new;
        const oldData = payload.old;
        setGlobalState(newData);

        if (newData.slot_machine_is_spinning && !oldData?.slot_machine_is_spinning) {
          prepareAndStartAnimation(newData.slot_machine_result, newData.slot_machine_target);
        }

        // Quando o sorteio para no banco, ajustamos a roleta para mostrar os 3 itens
        if (!newData.slot_machine_is_spinning && oldData?.slot_machine_is_spinning) {
          setIsSpinning(false);
          setIsAnimating(false);
          const windowReel = getResultWindow(newData.slot_machine_result, newData.slot_machine_target);
          setReel(windowReel);
          setWinnerIndex(1);
          setOffset(1 * ITEM_HEIGHT - CENTER_CONSTANT);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

 const prepareAndStartAnimation = (finalResult, type) => {
  const options = TARGET_OPTIONS[type] || [];
  if (options.length === 0) return;

  setIsSpinning(true);
  setIsAnimating(false);
  setOffset(0);
  setWinnerIndex(null);

  let fullList = [];
  const loopsCount = 8; 
  for (let i = 0; i < loopsCount; i++) {
    fullList = [...fullList, ...[...options].sort(() => Math.random() - 0.5)];
  }

  const stopSegmentStart = fullList.length;

  // AJUSTE AQUI: Adicionamos a lista original + os primeiros 5 itens dela novamente
  // Isso garante que sempre haja conteúdo visual "abaixo" do último item
  fullList = [...fullList, ...options, ...options.slice(0, 5)];
  
  const resultIdxInOptions = options.indexOf(finalResult);
  const targetIdx = stopSegmentStart + resultIdxInOptions;
  
  setReel(fullList);

  setTimeout(() => {
    setIsAnimating(true);
    setWinnerIndex(targetIdx);
    const targetOffset = (targetIdx * ITEM_HEIGHT) - CENTER_CONSTANT;
    setOffset(targetOffset);

    setTimeout(() => {
      setIsAnimating(false);
      const windowReel = getResultWindow(finalResult, type);
      setReel(windowReel);
      setWinnerIndex(1);
      setOffset(1 * ITEM_HEIGHT - CENTER_CONSTANT);
    }, 10000);
  }, 100);
};

  const handleSpin = async () => {
    if (!isMaster || isSpinning || !selectedPlayer) return;

    const options = TARGET_OPTIONS[targetType];
    const finalResult = options[Math.floor(Math.random() * options.length)];

    playSound('random_button');

    await supabase.from('global').update({
      slot_machine_is_spinning: true,
      slot_machine_result: finalResult,
      slot_machine_target: targetType,
      slot_machine_player_id: selectedPlayer.id,
      slot_machine_character_name: selectedPlayer.char_name
    }).eq('id', 1);

    setTimeout(async () => {
      await supabase.from('global').update({
        slot_machine_is_spinning: false
      }).eq('id', 1);
      playSound('celebration');
    }, 10500);
  };

  const handlePlayerSearch = (val) => {
    setPlayerNameInput(val);
    const found = allPlayers.find(p =>
      p.char_name?.toLowerCase().includes(val.toLowerCase()) ||
      p.discord_username?.toLowerCase().includes(val.toLowerCase())
    );
    setSelectedPlayer(found || null);
  };

  const getResultWindow = (result, type) => {
    const options = TARGET_OPTIONS[type] || [];
    const idx = options.indexOf(result);
    if (idx === -1) return [result];

    // Pega exatamente quem está antes e depois na lista original (com loop se necessário)
    const prev = options[(idx - 1 + options.length) % options.length];
    const next = options[(idx + 1) % options.length];
    return [prev, result, next];
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[75vh] p-8 space-y-12">

      {/* Header Info */}
      <div className="text-center space-y-6">
        <h3 className="text-5xl font-black italic text-red-600 uppercase tracking-tighter">
          {targetType}
        </h3>

        <div className="h-20 flex flex-col items-center justify-center">
          {globalState?.slot_machine_character_name ? (
            <div className="animate-in zoom-in duration-500 text-center">
              <p className="text-zinc-500 text-xs font-black uppercase tracking-[0.3em]">
                {globalState.slot_machine_player_id ? `@Sorteado` : 'Aguardando'}
              </p>
              <h4 className="text-3xl font-black text-white uppercase italic tracking-tight mt-1">
                {globalState.slot_machine_character_name}
              </h4>
            </div>
          ) : (
            <p className="text-zinc-700 text-base font-black italic uppercase tracking-[0.3em] opacity-50">Pronto para iniciar</p>
          )}
        </div>
      </div>

      {/* Slot Machine Display */}
      <div className="relative">
        <div className="relative w-[500px] h-80 bg-zinc-950 border-[12px] border-zinc-900 rounded-[60px] shadow-[0_0_80px_rgba(0,0,0,0.8)] flex items-center justify-center overflow-hidden">

          <div className="relative w-full h-full overflow-hidden">
            <div
              className="flex flex-col items-center w-full"
              style={{
                transform: `translateY(${-offset}px)`,
                transition: isAnimating ? 'transform 10s cubic-bezier(0.1, 0, 0.1, 1)' : 'none'
              }}
            >
              {reel.map((item, i) => {
                const isWinner = i === winnerIndex;
                // MUDANÇA AQUI: Brilha se for o vencedor e a animação de movimento parou
                const showHighlight = isWinner && !isAnimating;

                return (
                  <div key={i} className="flex items-center justify-center w-full shrink-0 h-[100px]">
                    <span className={`uppercase italic font-black text-4xl transition-all duration-700 
  ${showHighlight
                        ? 'text-white scale-125 drop-shadow-[0_0_15px_rgba(255,255,255,0.6)] opacity-100'
                        : 'text-zinc-500 scale-90 opacity-50'} 
  ${isAnimating ? 'blur-[1px]' : 'blur-0'}`}>
                      {item}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Overlays (Removed red bar) */}
            <div className="absolute inset-0 pointer-events-none z-20">
              <div className="absolute top-0 w-full h-[40%] bg-gradient-to-b from-zinc-950 via-zinc-950/80 to-transparent"></div>
              <div className="absolute bottom-0 w-full h-[40%] bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-transparent"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Master Controls */}
      {isMaster && (
        <div className="w-full max-w-lg bg-zinc-900/50 p-8 rounded-[40px] border border-zinc-800 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase ml-2">Randomizar</label>
              <select
                value={targetType}
                onChange={(e) => setTargetType(e.target.value)}
                className="bg-black border border-zinc-800 rounded-xl p-3 text-white font-bold outline-none focus:border-red-600"
              >
                {Object.keys(TARGET_OPTIONS).map(opt => <option key={opt}>{opt}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase ml-2">Jogador</label>
              <input
                type="text"
                value={playerNameInput}
                onChange={(e) => handlePlayerSearch(e.target.value)}
                placeholder="Pesquisar..."
                className="bg-black border border-zinc-800 rounded-xl p-3 text-white font-bold outline-none focus:border-red-600"
              />
            </div>
          </div>

          <button
            onClick={handleSpin}
            disabled={isSpinning || !selectedPlayer}
            className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest transition-all
              ${isSpinning || !selectedPlayer ? 'bg-zinc-800 text-zinc-600' : 'bg-red-600 text-white hover:bg-red-500 active:scale-95'}`}
          >
            {isSpinning ? 'Sorteando...' : 'Iniciar Sorteio'}
          </button>
        </div>
      )}
    </div>
  );
}


