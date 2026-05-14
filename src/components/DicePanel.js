import { 
  calculateWeaponPAT, 
  calculateDisarmedPAT, 
  calculateAcerto, 
  calculateDesvio, 
  calculateBloqueio,
  calculateSecondaryStat, 
  calculateLootDie 
} from '../lib/rpg-math';

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
  const lootDie = calculateLootDie(luckPerc);

  const convincimento = calculateSecondaryStat(charismaPerc, activeChar, true);
  const raciocinio = calculateSecondaryStat(intelligencePerc, activeChar, false);
  const prosperidade = calculateSecondaryStat(luckPerc, activeChar, false);

  const acertoValue = calculateAcerto(activeChar);
  const desvioValue = calculateDesvio(activeChar);
  const bloqueioValue = calculateBloqueio(activeChar);

  const equippedWeapons = activeChar?.inventory?.filter(i => i.equipped && i.subtype && (i.category === "Arma de Fogo" || i.category === "Arma Branca")) || [];
  const disarmedPat = calculateDisarmedPAT(activeChar);

  const bLvl = Number(activeChar?.breathing_lvl) || 0;
  const learnedSkills = Array.isArray(activeChar?.breathing_skills) ? activeChar.breathing_skills : [];
  const focusDice = learnedSkills.includes('skill_1b') ? (activeChar.breathing_style === 'Tempestade' ? { dice: 10, plus: 15 + (Math.max(0, bLvl - 1) * 3) } : null) : null;

  return (
    <div className="bg-slate-900/80 p-6 rounded-[30px] border-2 border-cyan-500/30 shadow-[0_0_25px_rgba(6,182,212,0.1)]">
      <h3 className="font-black text-cyan-500 text-[13px] italic mb-3 tracking-widest uppercase">Dados Resumidos</h3>

      <div className="space-y-6">
        {/* CATEGORIA COMBATE */}
        <div className="space-y-2">
          <p className="text-[11px] font-black text-zinc-500 uppercase tracking-widest ml-">Combate</p>
          <div className="space-y-3">
            {equippedWeapons.length > 0 ? equippedWeapons.map((w, idx) => {
              const stats = calculateWeaponPAT(w, activeChar);
              return (
                <PatStat
                  key={idx}
                  label={`Ataque (${w.name})`}
                  value={stats}
                  sub={`${w.subtype}`}
                />
              );
            }) : (
              <DataRow label="Ataque (Arma)" value="Nenhuma Equipada" />
            )}
            <PatStat label="Ataque (Desarmado)" value={calculateDisarmedPAT(activeChar)} sub="Soco / Improviso" />

            <CombatStat label="Acerto" value={acertoValue} sub="Base de Precisão / Agilidade" />
            <CombatStat label="Desvio" value={desvioValue} sub="Base de Agilidade / Concentração" />
            <CombatStat label="Bloqueio" value={bloqueioValue} sub="Base de Resistência / Aptidão" />
          </div>
        </div>

        {/* CATEGORIA OUTROS */}
        <div className="space-y-2">
          <p className="text-[11px] font-black text-zinc-500 uppercase tracking-widest ml-1">Outros</p>
          <div className="space-y-3">
            <SecondaryStat label="Convencimento" value={convincimento} sub={`Carisma (${charismaPerc}%)`} />
            <SecondaryStat label="Raciocínio" value={raciocinio} sub={`Inteligência (${intelligencePerc}%)`} />
            <LootStat label="Prosperidade" value={prosperidade} sub={`Sorte (${luckPerc}%)`} />
            <LootStat label="Saqueamento" value={lootDie} sub={`Sorte (${luckPerc}%)`} isDiceNotation />
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

const SecondaryStat = ({ label, value, sub }) => (
  <div className="flex justify-between items-center bg-blue-500/5 p-3 rounded-xl border border-blue-500/20">
    <div className="flex flex-col">
      <span className="text-[11px] font-black text-blue-400 uppercase italic leading-none">{label}</span>
      <span className="text-[10px] text-blue-500/60 font-bold uppercase mt-1">{sub}</span>
    </div>
    <span className="text-[15px] font-mono font-black text-blue-400">1d{value}</span>
  </div>
);

const PatStat = ({ label, value, sub }) => {
  let displayValue = "";
  if (typeof value === 'object') {
    const d = Math.floor(value.dice);
    const p = Math.floor(value.plus);
    const tpt = value.tpt || 1;
    displayValue = `${tpt}d${d}${p > 0 ? ` + ${p}` : ""}`;
  } else {
    displayValue = `1d${value}`;
  }
  return (
    <div className="flex justify-between items-center bg-red-500/5 p-3 rounded-xl border border-red-500/20">
      <div className="flex flex-col min-w-0 pr-2">
        <span className="text-[11px] font-black text-red-500 uppercase italic leading-none truncate">{label}</span>
        <span className="text-[10px] text-red-600/60 font-bold uppercase mt-1 truncate">{sub}</span>
      </div>
      <span className="text-[15px] font-mono font-black text-red-500 whitespace-nowrap shrink-0">{displayValue}</span>
    </div>
  );
};

const LootStat = ({ label, value, sub, isDiceNotation = false }) => (
  <div className="flex justify-between items-center bg-yellow-500/5 p-3 rounded-xl border border-yellow-500/20">
    <div className="flex flex-col">
      <span className="text-[11px] font-black text-yellow-600 uppercase italic leading-none">{label}</span>
      <span className="text-[10px] text-yellow-700/60 font-bold uppercase mt-1">{sub}</span>
    </div>
    <span className="text-[15px] font-mono font-black text-yellow-500">
      {isDiceNotation ? `1d${value}` : `1d${value}`}
    </span>
  </div>
);

const CombatStat = ({ label, value, sub }) => (
  <div className="flex justify-between items-center bg-purple-500/5 p-3 rounded-xl border border-purple-500/20">
    <div className="flex flex-col">
      <span className="text-[11px] font-black text-purple-100 uppercase italic leading-none">{label}</span>
      <span className="text-[10px] text-purple-300/40 font-bold uppercase mt-1">{sub}</span>
    </div>
    <span className="text-sm font-mono font-black text-purple-100">1d{value}</span>
  </div>
);
