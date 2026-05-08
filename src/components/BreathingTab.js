"use client";
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

// Skill Tree Data for Tempestade
const BREATHING_TREES = {
  "Tempestade": {
    skills: [
      // Cloud Formation (Center-ish)
      { id: 'temp_1', name: 'Névoa Inicial', cost: 1, requirements: { aptitude: 3 }, pos: { x: 500, y: 300 }, description: 'O início de uma tempestade começa com a névoa.' },
      { id: 'temp_2', name: 'Vento Cortante', cost: 2, requirements: { agility: 4 }, pos: { x: 400, y: 220 }, parent: 'temp_1', description: 'Ventos que cortam como navalhas.' },
      { id: 'temp_3', name: 'Acúmulo Estático', cost: 2, requirements: { concentration: 4 }, pos: { x: 600, y: 220 }, parent: 'temp_1', description: 'A energia elétrica começa a se acumular.' },
      { id: 'temp_4', name: 'Olho do Furacão', cost: 3, requirements: { resistance: 5 }, pos: { x: 500, y: 150 }, parent: 'temp_2', description: 'Calma absoluta no centro do caos.' },
      { id: 'temp_5', name: 'Trovão Distante', cost: 3, requirements: { strength: 5 }, pos: { x: 700, y: 150 }, parent: 'temp_3', description: 'Um som que ecoa antes do impacto.' },
      
      // Rain Formation (Falling from the cloud)
      { id: 'temp_6', name: 'Garoa Ácida', cost: 2, requirements: { precision: 4 }, pos: { x: 350, y: 450 }, parent: 'temp_2', description: 'Gotas que corroem a defesa inimiga.' },
      { id: 'temp_7', name: 'Chuva Torrencial', cost: 3, requirements: { aptitude: 5 }, pos: { x: 450, y: 550 }, parent: 'temp_6', description: 'Uma sequência incessante de golpes.' },
      { id: 'temp_8', name: 'Relâmpago Vertical', cost: 4, requirements: { agility: 6 }, pos: { x: 550, y: 450 }, parent: 'temp_3', description: 'Um ataque vindo de cima com velocidade extrema.' },
      { id: 'temp_9', name: 'Tempestade Devastadora', cost: 5, requirements: { strength: 7, concentration: 7 }, pos: { x: 650, y: 550 }, parent: 'temp_8', description: 'O ápice da Respiração da Tempestade.' },
    ]
  }
};

export default function BreathingTab({ user, character, isMaster, showToast, playSound }) {
  const [loading, setLoading] = useState(true);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef(null);
  const [isPanning, setIsPanning] = useState(false);
  const mouseOffset = useRef({ x: 0, y: 0 });

  const breathingStyle = character?.breathing_style || "Tempestade";
  const treeData = BREATHING_TREES[breathingStyle] || BREATHING_TREES["Tempestade"];
  const learnedSkills = character?.breathing_skills || [];

  const BOARD_WIDTH = 2000;
  const BOARD_HEIGHT = 2000;

  useEffect(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setPan({
        x: rect.width / 2 - 500,
        y: rect.height / 2 - 300
      });
      setLoading(false);
    }
  }, []);

  const onMouseDown = (e) => {
    if (e.button === 0) {
      setIsPanning(true);
      const containerRect = containerRef.current.getBoundingClientRect();
      mouseOffset.current = { 
        x: (e.clientX - containerRect.left) - pan.x, 
        y: (e.clientY - containerRect.top) - pan.y 
      };
    }
  };

  const onMouseMove = (e) => {
    if (isPanning) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const nx = (e.clientX - containerRect.left) - mouseOffset.current.x;
      const ny = (e.clientY - containerRect.top) - mouseOffset.current.y;
      setPan({ x: nx, y: ny });
    }
  };

  const onMouseUp = () => setIsPanning(false);

  const onWheel = (e) => {
    e.preventDefault();
    const delta = -e.deltaY;
    const zoomSpeed = 0.001;
    const newZoom = Math.max(0.4, Math.min(1.5, zoom + delta * zoomSpeed));
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
    
    // Check points
    const points = character?.breathing_points || 0;
    if (points < skill.cost) return false;

    // Check requirements
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

    const { error } = await supabase.from('characters')
      .update({ 
        breathing_points: newPoints,
        breathing_skills: newSkills
      })
      .eq('id', character.id);

    if (!error) {
      playSound('celebration');
      showToast(`${skill.name} aprendida!`);
    } else {
      showToast("Erro ao aprender habilidade.");
    }
  };

  return (
    <div className="h-full flex flex-col p-8 bg-zinc-950 overflow-hidden select-none">
      <div className="flex justify-between items-center mb-8 bg-zinc-900/80 p-6 rounded-2xl border border-zinc-800 backdrop-blur-sm z-10">
        <div>
          <h2 className="text-4xl font-black italic text-cyan-500 uppercase tracking-tighter">Respiração: {breathingStyle}</h2>
          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mt-1">Arraste para navegar • Clique nas habilidades para aprender</p>
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
            transformOrigin: '0 0',
            width: BOARD_WIDTH,
            height: BOARD_HEIGHT,
          }}
          className="absolute inset-0"
        >
          {/* Render Connections */}
          <svg className="absolute inset-0 pointer-events-none overflow-visible" style={{ width: BOARD_WIDTH, height: BOARD_HEIGHT }}>
            {treeData.skills.map(skill => {
              if (!skill.parent) return null;
              const parent = treeData.skills.find(s => s.id === skill.parent);
              if (!parent) return null;

              const isLineUnlocked = learnedSkills.includes(skill.id);

              return (
                <line 
                  key={`line-${skill.id}`}
                  x1={parent.pos.x + 40} y1={parent.pos.y + 40}
                  x2={skill.pos.x + 40} y2={skill.pos.y + 40}
                  stroke={isLineUnlocked ? "#06b6d4" : "#1e293b"}
                  strokeWidth="3"
                  strokeDasharray={isLineUnlocked ? "0" : "5,5"}
                  className="transition-all duration-500"
                />
              );
            })}
          </svg>

          {/* Render Skills */}
          {treeData.skills.map(skill => {
            const isLearned = learnedSkills.includes(skill.id);
            const unlocked = isUnlocked(skill);
            const available = canLearn(skill);
            const iconPath = `/breathing_styles/icon_breathing_${breathingStyle.toLowerCase()}.png`;

            return (
              <div
                key={skill.id}
                onClick={() => !isLearned && unlocked && handleLearn(skill)}
                style={{ left: skill.pos.x, top: skill.pos.y }}
                className={`absolute w-20 h-20 border-2 transition-all duration-300 group overflow-hidden
                  ${isLearned 
                    ? 'border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.4)] z-20' 
                    : (unlocked 
                      ? 'border-cyan-900/50 hover:border-cyan-500 hover:scale-105 z-10' 
                      : 'border-zinc-800 z-0')}
                `}
              >
                {/* Background Image/Icon */}
                <div className="absolute inset-0 bg-black">
                    <img 
                      src={iconPath} 
                      alt={skill.name}
                      className={`w-full h-full object-cover transition-all duration-300
                        ${isLearned ? 'opacity-100 brightness-110' : (unlocked ? 'opacity-50 grayscale-[0.75] brightness-75' : 'opacity-20 grayscale brightness-50')}
                      `}
                    />
                    
                    {/* Locked Symbol */}
                    {!unlocked && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                        <span className="text-zinc-500 text-2xl">🔒</span>
                      </div>
                    )}
                </div>

                {/* Name Label (Only if unlocked) */}
                {unlocked && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black/80 py-1 border-t border-white/5">
                    <p className="text-[7px] font-black uppercase text-center text-white truncate px-1">
                      {skill.name}
                    </p>
                  </div>
                )}

                {/* Galaxy Tooltip (Hover) */}
                <div className="absolute top-full mt-4 left-1/2 -translate-x-1/2 w-52 p-4 bg-zinc-950/95 border border-cyan-500/30 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[100] backdrop-blur-xl shadow-[0_0_40px_rgba(0,0,0,0.9)]">
                  <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-purple-500/10 to-transparent rounded-2xl"></div>
                  <div className="relative">
                    <p className="text-cyan-400 font-black uppercase text-[10px] mb-1">{skill.name}</p>
                    
                    {unlocked ? (
                      <>
                        <p className="text-zinc-300 text-[9px] mb-2 leading-tight">{skill.description}</p>
                        <div className="flex flex-col gap-1 border-t border-white/5 pt-2">
                          <p className="text-[8px] font-bold text-zinc-500 uppercase">Custo: <span className="text-yellow-500">{skill.cost} Pontos</span></p>
                          {skill.requirements && Object.entries(skill.requirements).map(([stat, val]) => (
                            <p key={stat} className={`text-[8px] font-bold uppercase ${character[stat] >= val ? 'text-green-500' : 'text-red-500'}`}>
                              {stat}: {val}
                            </p>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="text-zinc-500 text-[8px] font-black uppercase italic">Habilidade Bloqueada</p>
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
