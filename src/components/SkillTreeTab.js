"use client";
import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { SKILL_TREES, STAT_LABELS } from '../constants/gameData';

export default function SkillTreeTab({ user, character, isMaster, showToast, playSound, onReturn }) {
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState("Assaltante");
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef(null);
  const [isPanning, setIsPanning] = useState(false);
  const [imageErrors, setImageErrors] = useState({});
  const mouseOffset = useRef({ x: 0, y: 0 });
  const prevClassRef = useRef(selectedClass);

  const [optimisticSkills, setOptimisticSkills] = useState(character?.class_skills || []);
  const [optimisticPoints, setOptimisticPoints] = useState(character?.ph_points || 0);

  useEffect(() => {
    if (character) {
      setOptimisticSkills(character.class_skills || []);
      setOptimisticPoints(character.ph_points || 0);
    }
  }, [character?.class_skills, character?.ph_points]);

  const treeData = SKILL_TREES[selectedClass];
  const learnedSkills = optimisticSkills;

  const isViewingOthers = user && character && user.id !== character.id;

  // View Configuration
  const BOARD_WIDTH = 2100 * (treeData.boardMultiplier?.x || 1);
  const BOARD_HEIGHT = 1050 * (treeData.boardMultiplier?.y || 1);
  const ZOOM_MIN = 0.8;
  const ZOOM_MAX = 1.5;
  const PAN_MARGIN = 200;
  
  const OFFSET_X = BOARD_WIDTH / 2;
  const OFFSET_Y = BOARD_HEIGHT / 2;

  const prevDims = useRef({ width: BOARD_WIDTH, height: BOARD_HEIGHT });

  useLayoutEffect(() => {
    if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const isClassChange = prevClassRef.current !== selectedClass;
        
        if (loading || isClassChange) {
            // Center on the root skill on initial load or when switching classes,
            // and reset zoom so the new layout is fully visible.
            const rootSkill = treeData.skills.find(s => !s.parent);
            const centerX = rootSkill ? rootSkill.pos.x + OFFSET_X : OFFSET_X;
            const centerY = rootSkill ? rootSkill.pos.y + OFFSET_Y : OFFSET_Y;
            setPan({
                x: Math.round(rect.width / 2 - centerX),
                y: Math.round(rect.height / 2 - centerY)
            });
            setZoom(1);
            setLoading(false);
            prevClassRef.current = selectedClass;
        } else {
            // Adjust pan when board dimensions change for any other reason.
            const dx = (BOARD_WIDTH - prevDims.current.width) / 2;
            const dy = (BOARD_HEIGHT - prevDims.current.height) / 2;
            if (dx !== 0 || dy !== 0) {
                setPan(prev => ({ x: prev.x - dx, y: prev.y - dy }));
            }
        }
        prevDims.current = { width: BOARD_WIDTH, height: BOARD_HEIGHT };
    }
  }, [BOARD_WIDTH, BOARD_HEIGHT, selectedClass]);

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

  // A skill is "revealed" if it's learned, unlockable, or its parent is the root skill.
  // This lets players see a bit of each route without buying the first skill.
  const isRevealed = (skill) => {
    if (learnedSkills.includes(skill.id)) return true;
    if (!skill.parent) return true;
    const parentSkill = treeData.skills.find(s => s.id === skill.parent);
    if (parentSkill && !parentSkill.parent) return true;
    return learnedSkills.includes(skill.parent);
  };

  const canLearn = (skill) => {
    if (learnedSkills.includes(skill.id)) return false;
    if (!isUnlocked(skill)) return false;
    const points = optimisticPoints;
    if (points < skill.cost) return false;
    if (skill.requirements) {
      for (const [stat, val] of Object.entries(skill.requirements)) {
        if ((character[stat] || 0) < val) return false;
      }
    }
    if (skill.requiredClass && character.class !== skill.requiredClass) return false;
    return true;
  };

  const handleLearn = async (skill) => {
    if (!canLearn(skill)) {
      playSound('error');
      showToast("Requisitos não atendidos ou PH insuficiente.");
      return;
    }
    const newPoints = optimisticPoints - skill.cost;
    const newSkills = [...learnedSkills, skill.id];
    
    // Optimistically apply state changes and play sound immediately
    setOptimisticSkills(newSkills);
    setOptimisticPoints(newPoints);
    playSound('skill_unlock');

    const { error } = await supabase.from('characters').update({ ph_points: newPoints, class_skills: newSkills }).eq('id', character.id);
    if (!error) {
      showToast(`${skill.name} aprendida!`);
    } else {
      // Rollback on database update failure
      setOptimisticSkills(character?.class_skills || []);
      setOptimisticPoints(character?.ph_points || 0);
      playSound('error');
      showToast("Erro ao aprender habilidade.");
    }
  };

  const formatText = (text) => {
    if (!text) return null;
    let formatted = text;
    formatted = formatted.replace(/_/g, '\u00A0');
    formatted = formatted.replace(/\n/g, '<br />');
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong class="text-zinc-200 font-black">$1</strong>');
    formatted = formatted.replace(/<u>(.*?)<\/u>/g, '<u class="decoration-zinc-500/50">$1</u>');
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
            <h2 className="text-4xl font-black italic text-zinc-100 uppercase tracking-tighter">
              {isViewingOthers ? `Habilidades: ${character.char_name || character.name}` : `Árvore de Habilidades`}
            </h2>
            <div className="flex gap-2 mt-2">
                {Object.keys(SKILL_TREES).map(cls => (
                    <button 
                        key={cls}
                        onClick={() => { playSound('random_button'); setSelectedClass(cls); }}
                        className={`px-3 py-1 text-[10px] font-black uppercase rounded-full border transition-all ${selectedClass === cls ? 'bg-white text-black border-white' : 'bg-zinc-800 text-zinc-500 border-zinc-700 hover:text-zinc-300'}`}
                    >
                        {cls}
                    </button>
                ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-zinc-800 border border-zinc-600 px-6 py-2 rounded-full shadow-lg shadow-black/50">
            <span className="text-zinc-100 font-black text-sm">{optimisticPoints} PONTOS DE HABILIDADE</span>
          </div>
        </div>
      </div>

      <div 
        ref={containerRef}
        className="flex-1 relative border-4 border-zinc-900 rounded-[40px] bg-black/40 overflow-hidden cursor-grab active:cursor-grabbing"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onWheel={onWheel}
      >
        <div className="absolute inset-0 opacity-10 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]"></div>
        
        <div 
          style={{ 
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'top left',
            width: BOARD_WIDTH,
            height: BOARD_HEIGHT,
            backgroundColor: 'rgba(255,255,255,0.02)',
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
              
              const x1 = parent.pos.x + OFFSET_X;
              const y1 = parent.pos.y + OFFSET_Y;
              const x2 = skill.pos.x + OFFSET_X;
              const y2 = skill.pos.y + OFFSET_Y;

              return (
                <line 
                  key={`line-${skill.id}`}
                  x1={x1} y1={y1}
                  x2={x2} y2={y2}
                  stroke={isLineUnlocked ? "#ffffff" : "#3f3f46"}
                  strokeWidth="2"
                  strokeDasharray={isLineUnlocked ? "0" : "4,4"}
                  className="transition-all duration-500"
                />
              );
            })}
          </svg>

            {treeData.skills.map(skill => {
            const isLearned = learnedSkills.includes(skill.id);
            const unlocked = isUnlocked(skill);
            const revealed = isRevealed(skill);
            const previewed = revealed && !unlocked;
            
            const left = skill.pos.x + OFFSET_X - 40;
            const top = skill.pos.y + OFFSET_Y - 40;

            // Image path logic
            const classKey = selectedClass.toLowerCase();
            const iconPath = skill.type && skill.type == 'epic' ? `/skill_icons/${classKey}_epic.jpeg` : `/skill_icons/${classKey}_default.jpeg`;
            const skillIconPath = skill.image ? skill.image : iconPath;
            const hasImageError = imageErrors[skill.id];

            return (
              <div
                key={skill.id}
                onClick={() => !isLearned && unlocked && handleLearn(skill)}
                style={{ left, top, zIndex: (isLearned ? 60 : 50) }}
                className={`skill-node absolute w-20 h-20 border-2 transition-all duration-300 group bg-black
                  ${isLearned ? 'border-white shadow-[0_0_15px_rgba(255,255,255,0.3)] hover:!z-[1000]' : (unlocked ? 'border-zinc-700 hover:border-zinc-400 hover:scale-105 hover:!z-[1000]' : (previewed ? 'border-zinc-800 hover:!z-[1000]' : 'border-zinc-900 hover:!z-[1000]'))}
                `}
              >
                <div className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${isLearned ? 'bg-zinc-800' : 'bg-black'} overflow-hidden`}>
                    {!hasImageError ? (
                      <img 
                        src={skillIconPath} 
                        alt={skill.name} 
                        className={`w-full h-full object-cover transition-all duration-300 ${isLearned ? 'opacity-100' : (unlocked ? 'opacity-50 grayscale-[0.2]' : (previewed ? 'opacity-40 grayscale-[0.4] brightness-[0.45]' : 'opacity-50 grayscale-[0.6] brightness-[0.2]'))}`}
                        onError={() => setImageErrors(prev => ({ ...prev, [skill.id]: true }))}
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className={`text-2xl transition-all duration-300 ${isLearned ? 'grayscale-0' : (unlocked ? 'grayscale opacity-50' : (previewed ? 'grayscale opacity-35 brightness-75' : 'grayscale opacity-15 brightness-50'))}`}>
                            {selectedClass === 'Vanguarda' && '🛡️'}
                            {selectedClass === 'Artista' && '🎨'}
                            {selectedClass === 'Assaltante' && '🗡️'}
                            {selectedClass === 'Atirador' && '🎯'}
                            {selectedClass === 'Infiltrador' && '👤'}
                        </span>
                      </div>
                    )}
                    {!revealed && !isLearned && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <span className="text-zinc-700 text-xl">🔒</span>
                      </div>
                    )}
                </div>
                <div className={`absolute bottom-0 left-0 right-0 py-1 border-t border-white/5 z-10 pointer-events-none transition-all ${isLearned ? 'bg-white/10' : 'bg-black/90'} ${!revealed && !isLearned ? 'opacity-50' : (previewed ? 'opacity-60' : '')}`}>
                  <p className="text-[7px] font-black uppercase text-center text-white truncate px-1">
                    {revealed || isLearned ? skill.name : '????'}
                  </p>
                </div>
                
                {/* Tooltip - Solid Background */}
                <div className="absolute top-1/2 left-[110%] -translate-y-1/2 w-72 p-4 bg-[#0a0a0a] border border-zinc-700 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-[9999] shadow-[0_0_50px_rgba(0,0,0,1)] scale-95 group-hover:scale-100 origin-left">
                  <div className="absolute inset-0 bg-zinc-950 rounded-lg"></div>
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-lg"></div>
                  <div className="relative z-[1000] flex flex-col gap-2">
                    <div>
                      <div className="flex justify-between items-center">
                        <p className="text-white font-black uppercase text-[11px] leading-tight">
                          {revealed || isLearned ? skill.name : 'Habilidade Bloqueada'}
                        </p>
                        {!revealed && !isLearned && <span className="text-[9px] font-black text-zinc-600 uppercase tracking-tighter">Bloqueada</span>}
                      </div>
                      {isMaster && (
                        <p className="text-zinc-600 font-mono text-[8px] uppercase mt-0.5 tracking-tighter">ID: {skill.id}</p>
                      )}
                    </div>
                    
                    <div className="flex flex-col gap-3">
                      {revealed || isLearned ? (
                        <>
                          {skill.flavor && <p className="text-zinc-500 text-[9px] italic leading-snug border-l border-zinc-700 pl-2">"{skill.flavor}"</p>}
                          <div className="text-zinc-300 text-[10px] leading-relaxed break-words whitespace-normal relative z-[1010]">{formatText(skill.effect)}</div>
                          <div className="flex flex-col gap-1.5 border-t border-white/10 pt-2 relative z-[1010]">
                            <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-0.5">Requisitos:</p>
                            <p className="text-[9px] font-bold text-white uppercase">Custo: {skill.cost} PH</p>
                            {skill.requirements && Object.entries(skill.requirements).map(([stat, val]) => (
                              <p key={stat} className={`text-[9px] font-bold uppercase ${character[stat] >= val ? 'text-green-500' : 'text-red-500'}`}>{STAT_LABELS[stat] || stat}: {val}</p>
                            ))}
                            {skill.requiredClass && (
                              <p className={`text-[9px] font-bold uppercase ${character.class === skill.requiredClass ? 'text-green-500' : 'text-red-500'}`}>Classe: {skill.requiredClass}</p>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-zinc-700 text-xs">🔒</span>
                          <p className="text-zinc-600 text-[9px] font-black uppercase italic tracking-tighter">
                            Esta habilidade está oculta.
                          </p>
                        </div>
                      )}
                    </div>
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
