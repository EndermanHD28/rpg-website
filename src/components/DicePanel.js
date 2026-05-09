import { useState, useEffect } from 'react';
import { 
  calculateWeaponPAT, 
  calculateDisarmedPAT, 
  calculateAcerto, 
  calculateDesvio, 
  calculateBloqueio,
  calculateSecondaryStat, 
  calculateLootDie,
  rollDice
} from '../lib/rpg-math';
import { supabase } from '../lib/supabase';

export default function DicePanel({
  activeChar,
  luckPerc,
  charismaPerc,
  intelligencePerc,
  strengthPerc,
  resistancePerc,
  aptitudePerc,
  agilityPerc,
  precisionPerc
}) {
  const [selectingWeapon, setSelectingWeapon] = useState(false);
  const equippedWeapons = activeChar?.inventory?.filter(i => i.equipped && i.subtype && (i.category === "Arma de Fogo" || i.category === "Arma Branca")) || [];

  // Reset state if character changes
  useEffect(() => {
    setSelectingWeapon(false);
  }, [activeChar?.id]);

  const lootDie = calculateLootDie(luckPerc);

  const convincimento = calculateSecondaryStat(charismaPerc, activeChar, true);
  const raciocinio = calculateSecondaryStat(intelligencePerc, activeChar, false);
  const prosperidade = calculateSecondaryStat(luckPerc, activeChar, false);

  const acertoValue = calculateAcerto(activeChar);
  const desvioValue = calculateDesvio(activeChar);
  const bloqueioValue = calculateBloqueio(activeChar);

  const disarmedPat = calculateDisarmedPAT(activeChar);

  const bLvl = Number(activeChar?.breathing_lvl) || 0;
  const learnedSkills = Array.isArray(activeChar?.breathing_skills) ? activeChar.breathing_skills : [];
  const focusDice = learnedSkills.includes('skill_1b') ? (activeChar.breathing_style === 'Tempestade' ? { dice: 10, plus: 15 + (Math.max(0, bLvl - 1) * 3) } : null) : null;

  const handleRoll = async (type, label, value) => {
    if (!activeChar) return;

    let diceExpr = "";
    if (typeof value === 'object') {
      const d = Math.round(value.dice);
      const p = Math.round(value.plus);
      const tpt = value.tpt || 1;
      diceExpr = `${tpt}d${d}${p > 0 ? ` + ${p}` : ""}`;
    } else {
      diceExpr = `1d${value}`;
    }

    const fullInput = `/${type} ${diceExpr}`;
    const diceResult = rollDice(fullInput, activeChar);

    if (diceResult) {
      const playerName = activeChar.char_name || activeChar.name || "Desconhecido";
      const playerImage = activeChar.image_url || "";

      let detail = diceResult.original;
      diceResult.rolls.forEach(r => {
        detail = detail.replace(r.notation, `<span class="text-zinc-500 font-mono text-[10px]">[${r.results.join(', ')}]</span>`);
      });

      const statusLabel = diceResult.status !== "Normal" ? ` <span class="${diceResult.statusColor} text-[10px] font-black uppercase tracking-widest bg-black/40 px-2 py-0.5 rounded-full border border-white/5 shadow-sm">${diceResult.status}</span>` : "";

      let category = "normal";
      if (['acerto', 'desvio', 'bloqueio', 'dano'].includes(diceResult.type)) {
        category = "combat";
      } else if (label.includes('Convencimento') || label.includes('Raciocínio')) {
        category = "secondary";
      } else if (label.includes('Prosperidade') || label.includes('Saqueamento')) {
        category = "luck";
      }

      await supabase.from('messages').insert({
        player_name: "SISTEMA",
        content: `DICE_ROLL|${playerName}|${fullInput}|${diceResult.total}|${detail}|${statusLabel}|${category}|${playerImage}|${diceResult.type || ''}`,
        is_system: true
      });
    }

    if (type === 'dano') {
      setSelectingWeapon(false);
    }
  };

  if (selectingWeapon) {
    return (
      <div className="bg-slate-900/80 p-6 rounded-[30px] border-2 border-red-500/30 shadow-[0_0_25px_rgba(239,68,68,0.1)] animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-black text-red-500 text-[13px] italic tracking-widest uppercase">Selecionar Arma</h3>
          <button 
            onClick={() => setSelectingWeapon(false)}
            className="text-zinc-500 hover:text-white text-xs font-black uppercase tracking-tighter"
          >
            Voltar
          </button>
        </div>

        <div className="space-y-3">
          <button 
            onClick={() => handleRoll('dano', 'Ataque (Desarmado)', disarmedPat)}
            className="w-full text-left"
          >
            <PatStat label="Desarmado" value={disarmedPat} sub="Soco / Improviso" clickable />
          </button>

          {equippedWeapons.map((w, idx) => {
            const stats = calculateWeaponPAT(w, activeChar);
            return (
              <button 
                key={idx}
                onClick={() => handleRoll('dano', `Ataque (${w.name})`, stats)}
                className="w-full text-left"
              >
                <PatStat
                  label={w.name}
                  value={stats}
                  sub={`${w.subtype}`}
                  clickable
                />
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/80 p-6 rounded-[30px] border-2 border-cyan-500/30 shadow-[0_0_25px_rgba(6,182,212,0.1)] transition-all duration-300">
      <h3 className="font-black text-cyan-500 text-[13px] italic mb-3 tracking-widest uppercase">Dados Resumidos</h3>

      <div className="space-y-6">
        {/* CATEGORIA COMBATE */}
        <div className="space-y-2">
          <p className="text-[11px] font-black text-zinc-500 uppercase tracking-widest ml-">Combate</p>
          <div className="space-y-3">
            <div onClick={() => equippedWeapons.length > 0 ? setSelectingWeapon(true) : handleRoll('dano', 'Ataque (Desarmado)', disarmedPat)}>
              <PatStat 
                label="Ataque (Dano)" 
                value={equippedWeapons.length === 1 ? calculateWeaponPAT(equippedWeapons[0], activeChar) : "Selecionar"} 
                sub={equippedWeapons.length === 1 ? equippedWeapons[0].name : (equippedWeapons.length > 1 ? "Múltiplas Armas" : "Desarmado")} 
                clickable 
              />
            </div>

            <div onClick={() => handleRoll('acerto', 'Acerto', acertoValue)}>
              <CombatStat label="Acerto" value={acertoValue} sub="Base de Precisão / Agilidade" clickable />
            </div>
            <div onClick={() => handleRoll('desvio', 'Desvio', desvioValue)}>
              <CombatStat label="Desvio" value={desvioValue} sub="Base de Agilidade / Concentração" clickable />
            </div>
            <div onClick={() => handleRoll('bloqueio', 'Bloqueio', bloqueioValue)}>
              <CombatStat label="Bloqueio" value={bloqueioValue} sub="Base de Resistência / Aptidão" clickable />
            </div>
          </div>
        </div>

        {/* CATEGORIA OUTROS */}
        <div className="space-y-2">
          <p className="text-[11px] font-black text-zinc-500 uppercase tracking-widest ml-1">Outros</p>
          <div className="space-y-3">
            <div onClick={() => handleRoll('normal', 'Convencimento', convincimento)}>
              <SecondaryStat label="Convencimento" value={convincimento} sub={`Carisma (${charismaPerc}%)`} clickable />
            </div>
            <div onClick={() => handleRoll('normal', 'Raciocínio', raciocinio)}>
              <SecondaryStat label="Raciocínio" value={raciocinio} sub={`Inteligência (${intelligencePerc}%)`} clickable />
            </div>
            <div onClick={() => handleRoll('normal', 'Prosperidade', prosperidade)}>
              <LootStat label="Prosperidade" value={prosperidade} sub={`Sorte (${luckPerc}%)`} clickable />
            </div>
            <div onClick={() => handleRoll('normal', 'Saqueamento', lootDie)}>
              <LootStat label="Saqueamento" value={lootDie} sub={`Sorte (${luckPerc}%)`} isDiceNotation clickable />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const DataRow = ({ label, value, subtitle }) => (
  <div className="flex justify-between items-center bg-black/40 p-3 rounded-xl border border-white/5 relative group">
    <div className="flex flex-col">
      <span className="text-[9px] font-black text-gray-400 uppercase italic">{label}</span>
      {subtitle && <span className="text-[7px] text-zinc-600 font-bold uppercase">{subtitle}</span>}
    </div>
    <span className="text-sm font-mono font-black text-red-500">{value}</span>
  </div>
);

const SecondaryStat = ({ label, value, sub, clickable }) => (
  <div className={`flex justify-between items-center bg-blue-500/5 p-3 rounded-xl border border-blue-500/20 transition-all ${clickable ? 'cursor-pointer hover:bg-blue-500/10 hover:border-blue-500/40 active:scale-[0.98]' : ''}`}>
    <div className="flex flex-col">
      <span className="text-[11px] font-black text-blue-400 uppercase italic leading-none">{label}</span>
      <span className="text-[10px] text-blue-500/60 font-bold uppercase mt-1">{sub}</span>
    </div>
    <span className="text-[15px] font-mono font-black text-blue-400">1d{value}</span>
  </div>
);

const PatStat = ({ label, value, sub, clickable }) => {
  let displayValue = "";
  if (typeof value === 'object') {
    const d = Math.round(value.dice);
    const p = Math.round(value.plus);
    const tpt = value.tpt || 1;
    displayValue = `${tpt}d${d}${p > 0 ? ` + ${p}` : ""}`;
  } else {
    displayValue = value === "Selecionar" ? "Selecionar" : `1d${value}`;
  }
  return (
    <div className={`flex justify-between items-center bg-red-500/5 p-3 rounded-xl border border-red-500/20 transition-all ${clickable ? 'cursor-pointer hover:bg-red-500/10 hover:border-red-500/40 active:scale-[0.98]' : ''}`}>
      <div className="flex flex-col min-w-0 pr-2">
        <span className="text-[11px] font-black text-red-500 uppercase italic leading-none truncate">{label}</span>
        <span className="text-[10px] text-red-600/60 font-bold uppercase mt-1 truncate">{sub}</span>
      </div>
      <span className="text-[15px] font-mono font-black text-red-500 whitespace-nowrap shrink-0">{displayValue}</span>
    </div>
  );
};

const LootStat = ({ label, value, sub, isDiceNotation = false, clickable }) => (
  <div className={`flex justify-between items-center bg-yellow-500/5 p-3 rounded-xl border border-yellow-500/20 transition-all ${clickable ? 'cursor-pointer hover:bg-yellow-500/10 hover:border-yellow-500/40 active:scale-[0.98]' : ''}`}>
    <div className="flex flex-col">
      <span className="text-[11px] font-black text-yellow-600 uppercase italic leading-none">{label}</span>
      <span className="text-[10px] text-yellow-700/60 font-bold uppercase mt-1">{sub}</span>
    </div>
    <span className="text-[15px] font-mono font-black text-yellow-500">
      {isDiceNotation ? `1d${value}` : `1d${value}`}
    </span>
  </div>
);

const CombatStat = ({ label, value, sub, clickable }) => (
  <div className={`flex justify-between items-center bg-purple-500/5 p-3 rounded-xl border border-purple-500/20 transition-all ${clickable ? 'cursor-pointer hover:bg-purple-500/10 hover:border-purple-500/40 active:scale-[0.98]' : ''}`}>
    <div className="flex flex-col">
      <span className="text-[11px] font-black text-purple-100 uppercase italic leading-none">{label}</span>
      <span className="text-[10px] text-purple-300/40 font-bold uppercase mt-1">{sub}</span>
    </div>
    <span className="text-sm font-mono font-black text-purple-100">1d{value}</span>
  </div>
);

