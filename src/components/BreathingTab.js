"use client";
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { BREATHING_TREES, STAT_LABELS } from '../constants/gameData';

export default function BreathingTab({ user, character, isMaster, showToast, playSound, onReturn }) {
  const [loading, setLoading] = useState(true);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef(null);
  const [isPanning, setIsPanning] = useState(false);
  const mouseOffset = useRef({ x: 0, y: 0 });

  const breathingStyle = character?.breathing_style || "Tempestade";
  const treeData = BREATHING_TREES[breathingStyle] || BREATHING_TREES["Tempestade"];
  const learnedSkills = character?.breathing_skills || [];

  const isViewingOthers = user && character && user.id !== character.id;
  const isActingAsMaster = isMaster && !isViewingOthers;

  // View Configuration
  const BOARD_WIDTH = 2100;
  const BOARD_HEIGHT = 1050;
  const ZOOM_MIN = 0.8;
  const ZOOM_MAX = 1.5;
  const PAN_MARGIN = 200;
  
  const OFFSET_X = BOARD_WIDTH / 2;
  const OFFSET_Y = BOARD_HEIGHT / 2;

  // Track dimensions to adjust pan when they change
  const prevDims = useRef({ width: BOARD_WIDTH, height: BOARD_HEIGHT });

  useEffect(() => {
    if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        
        if (loading) {
            // Initial centering
            setPan({
                x: Math.round(rect.width / 2 - OFFSET_X),
                y: Math.round(rect.height / 2 - OFFSET_Y)
            });
            setLoading(false);
        } else {
            // Adjust pan if dimensions changed to keep content stationary relative to screen
            const dx = (BOARD_WIDTH - prevDims.current.width) / 2;
            const dy = (BOARD_HEIGHT - prevDims.current.height) / 2;
            if (dx !== 0 || dy !== 0) {
                setPan(prev => ({ x: prev.x - dx, y: prev.y - dy }));
            }
        }
        prevDims.current = { width: BOARD_WIDTH, height: BOARD_HEIGHT };
    }
  }, [BOARD_WIDTH, BOARD_HEIGHT]);

  const onMouseDown = (e) => {
    if (e.target.closest('.skill-node')) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - containerRect.left;
    const mouseY = e.clientY - containerRect.top;

    if (e.button === 0) {
        setIsPanning(true);
        mouseOffset.current = { x: mouseX - pan.x, y: mouseY - pan.y };
    }
  };

  const onMouseMove = (e) => {
    if (isPanning) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const mouseX = e.clientX - containerRect.left;
        const mouseY = e.clientY - containerRect.top;

        const nx = mouseX - mouseOffset.current.x;
        const ny = mouseY - mouseOffset.current.y;
        
        const minX = containerRect.width - (BOARD_WIDTH * zoom) - PAN_MARGIN;
        const maxX = PAN_MARGIN;
        const minY = containerRect.height - (BOARD_HEIGHT * zoom) - PAN_MARGIN;
        const maxY = PAN_MARGIN;

        setPan({ 
            x: Math.max(minX, Math.min(maxX, nx)), 
            y: Math.max(minY, Math.min(maxY, ny)) 
        });
    }
  };

  const onMouseUp = () => setIsPanning(false);

  const onWheel = (e) => {
    e.preventDefault();
    const containerRect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - containerRect.left;
    const mouseY = e.clientY - containerRect.top;
    
    const zoomSpeed = 0.001;
    const delta = -e.deltaY;
    const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom + delta * zoomSpeed));
    
    const zoomRatio = newZoom / zoom;
    let nx = mouseX - (mouseX - pan.x) * zoomRatio;
    let ny = mouseY - (mouseY - pan.y) * zoomRatio;
    
    const minX = containerRect.width - (BOARD_WIDTH * newZoom) - PAN_MARGIN;
    const maxX = PAN_MARGIN;
    const minY = containerRect.height - (BOARD_HEIGHT * newZoom) - PAN_MARGIN;
    const maxY = PAN_MARGIN;
    
    setPan({ 
        x: Math.max(minX, Math.min(maxX, nx)), 
        y: Math.max(minY, Math.min(maxY, ny)) 
    });
    setZoom(newZoom);
  };

  const isUnlocked = (skill) => {
    if (learnedSkills.includes(skill.id)) return true;
    if (!skill.parent) return true;
    return learnedSkills.includes(skill.parent);
  };

  const canLearn = (skill) => {
    if (learnedSkills.includes(skill.id)) return false;
    if (!isUnlocked(skill)) return false;
    const points = character?.breathing_points || 0;
    if (points < skill.cost) return false;
    if (skill.requirements) {
      for (const [stat, val] of Object.entries(skill.requirements)) {
        if ((character[stat] || 0) < val) return false;
      }
    }
    return true;
  };

  const handleLearn = async (skill) => {
    if (!canLearn(skill)) {
      playSound('error');
      showToast("Requisitos não atendidos ou pontos insuficientes.");
      return;
    }
    const newPoints = (character.breathing_points || 0) - skill.cost;
    const newSkills = [...learnedSkills, skill.id];
    const { error } = await supabase.from('characters').update({ breathing_points: newPoints, breathing_skills: newSkills }).eq('id', character.id);
    if (!error) {
      playSound('celebration');
      showToast(`${skill.name} aprendida!`);
    } else showToast("Erro ao aprender habilidade.");
  };

  const formatText = (text) => {
    if (!text) return null;
    let formatted = text;
    formatted = formatted.replace(/_/g, '\u00A0');
    formatted = formatted.replace(/\n/g, '<br />');
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong class="text-cyan-400 font-black">$1</strong>');
    formatted = formatted.replace(/<u>(.*?)<\/u>/g, '<u class="decoration-cyan-500/50">$1</u>');
    return <span dangerouslySetInnerHTML={{ __html: formatted }} />;
  };

  return (
    <div className="h-full flex flex-col p-8 bg-zinc-950 overflow-hidden select-none">
      <div className="flex justify-between items-center mb-8 bg-zinc-900/80 p-6 rounded-2xl border border-zinc-800 backdrop-blur-sm z-10">
        <div className="flex items-center gap-6">
          {isViewingOthers && (
            <button onClick={onReturn} className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 w-10 h-10 rounded-full flex items-center justify-center transition-all border border-zinc-700 shadow-lg group">
              <span className="group-hover:-translate-x-0.5 transition-transform">←</span>
            </button>
          )}
          <div>
            <h2 className="text-4xl font-black italic text-cyan-500 uppercase tracking-tighter">
              {isViewingOthers ? `Respiração: ${character.char_name || character.name}` : `Respiração: ${breathingStyle}`}
            </h2>
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mt-1">
              {isViewingOthers ? 'Visualizando Árvore de Habilidades' : 'Arraste para navegar • Clique nas habilidades para aprender'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-cyan-950/30 border border-cyan-500/30 px-6 py-2 rounded-full">
            <span className="text-cyan-400 font-black text-sm">{character?.breathing_points || 0} PONTOS DE RESPIRAÇÃO</span>
          </div>
        </div>
      </div>

      <div 
        ref={containerRef}
        className="flex-1 relative border-4 border-zinc-900 rounded-[40px] bg-black/60 overflow-hidden cursor-grab active:cursor-grabbing"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onWheel={onWheel}
      >
        <div className="absolute inset-0 opacity-20 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]"></div>
        
        <div 
          style={{ 
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'top left',
            width: BOARD_WIDTH,
            height: BOARD_HEIGHT,
            backgroundColor: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.05)'
          }}
          className="absolute"
        >
          <svg className="absolute inset-0 pointer-events-none overflow-visible" style={{ width: BOARD_WIDTH, height: BOARD_HEIGHT }}>
            {treeData.skills.map(skill => {
              if (!skill.parent) return null;
              const parent = treeData.skills.find(s => s.id === skill.parent);
              if (!parent) return null;
              const isLineUnlocked = learnedSkills.includes(skill.id);
              
              // Apply centering offset to skill positions
              const x1 = parent.pos.x + OFFSET_X + 40;
              const y1 = parent.pos.y + OFFSET_Y + 40;
              const x2 = skill.pos.x + OFFSET_X + 40;
              const y2 = skill.pos.y + OFFSET_Y + 40;

              return (
                <line 
                  key={`line-${skill.id}`}
                  x1={x1} y1={y1}
                  x2={x2} y2={y2}
                  stroke={isLineUnlocked ? "#06b6d4" : "#1e293b"}
                  strokeWidth="3"
                  strokeDasharray={isLineUnlocked ? "0" : "5,5"}
                  className="transition-all duration-500"
                />
              );
            })}
          </svg>

          {treeData.skills.map(skill => {
            const isLearned = learnedSkills.includes(skill.id);
            const unlocked = isUnlocked(skill);
            const iconPath = `/breathing_styles/icon_breathing_${breathingStyle.toLowerCase()}.png`;
            
            // Apply centering offset
            const left = skill.pos.x + OFFSET_X;
            const top = skill.pos.y + OFFSET_Y;

            return (
              <div
                key={skill.id}
                onClick={() => !isLearned && unlocked && handleLearn(skill)}
                style={{ left, top, zIndex: (isLearned ? 60 : 50) }}
                className={`skill-node absolute w-20 h-20 border-2 transition-all duration-300 group
                  ${isLearned ? 'border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.4)] hover:!z-[1000]' : (unlocked ? 'border-cyan-900/50 hover:border-cyan-500 hover:scale-105 hover:!z-[1000]' : 'border-zinc-800 hover:!z-[1000]')}
                `}
              >
                <div className="absolute inset-0 bg-black overflow-hidden pointer-events-none">
                    <img src={iconPath} alt={skill.name} className={`w-full h-full object-cover transition-all duration-300 ${isLearned ? 'opacity-100 brightness-110' : (unlocked ? 'opacity-50 grayscale-[0.75] brightness-75' : 'opacity-20 grayscale brightness-50')}`} />
                    {!unlocked && <div className="absolute inset-0 flex items-center justify-center bg-black/60"><span className="text-zinc-500 text-2xl">🔒</span></div>}
                </div>
                {unlocked && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black/80 py-1 border-t border-white/5 z-10 pointer-events-none">
                    <p className="text-[7px] font-black uppercase text-center text-white truncate px-1">{skill.name}</p>
                  </div>
                )}
                <div className="absolute top-1/2 left-[110%] -translate-y-1/2 w-72 p-4 bg-[#0a0a0a] border border-cyan-500/30 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-[9999] shadow-[0_0_50px_rgba(0,0,0,1)] scale-95 group-hover:scale-100 origin-left">
                  <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-purple-500/10 to-transparent rounded-lg"></div>
                  <div className="relative z-[1000] flex flex-col gap-2">
                    <div>
                      <p className="text-cyan-400 font-black uppercase text-[11px] leading-tight">{skill.name}</p>
                      {isMaster && (
                        <p className="text-zinc-600 font-mono text-[8px] uppercase mt-0.5 tracking-tighter">ID: {skill.id}</p>
                      )}
                    </div>
                    {unlocked ? (
                      <div className="flex flex-col gap-3">
                        {skill.flavor && <p className="text-zinc-500 text-[9px] italic leading-snug border-l border-zinc-800 pl-2">"{skill.flavor}"</p>}
                        <div className="text-zinc-300 text-[10px] leading-relaxed break-words whitespace-normal relative z-[1010]">{formatText(skill.effect)}</div>
                        <div className="flex flex-col gap-1.5 border-t border-white/10 pt-2 relative z-[1010]">
                          <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-0.5">Requisitos:</p>
                          <p className="text-[9px] font-bold text-cyan-400 uppercase">Custo: {skill.cost} Pontos</p>
                          {skill.requirements && Object.entries(skill.requirements).map(([stat, val]) => (
                            <p key={stat} className={`text-[9px] font-bold uppercase ${character[stat] >= val ? 'text-green-500' : 'text-red-500'}`}>{STAT_LABELS[stat] || stat}: {val}</p>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mt-1"><span className="text-zinc-600 text-xs">🔒</span><p className="text-zinc-500 text-[9px] font-black uppercase italic tracking-tighter">Habilidade Bloqueada</p></div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
