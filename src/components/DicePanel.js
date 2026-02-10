import { calculateWeaponPAT, calculateDisarmedPAT } from '../lib/rpg-math';

export default function DicePanel({ activeChar, luckPerc, charismaPerc, intelligencePerc }) {
  const lootDie = Math.round(15 + (5 * Math.pow(luckPerc / 15, 0.8)));
  
  const calculateSecondary = (perc) => {
    const p = parseFloat(perc) || 0;
    return Math.round(20 * Math.pow(p / 20, 0.6215));
  };

  const convincimento = calculateSecondary(charismaPerc);
  const raciocinio = calculateSecondary(intelligencePerc);
  const prosperidade = calculateSecondary(luckPerc);

  const equippedWeapons = activeChar?.inventory?.filter(i => i.equipped && i.subtype && (i.category === "Arma de Fogo" || i.category === "Arma Branca")) || [];
  const disarmedPat = calculateDisarmedPAT(activeChar);

  return (
    <div className="bg-slate-900/80 p-6 rounded-[30px] border-2 border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.1)]">
      <h3 className="font-black text-cyan-500 text-[10px] italic mb-4 tracking-widest uppercase">Dados Resumidos</h3>
      <div className="space-y-3">
        {equippedWeapons.length > 0 ? equippedWeapons.map((w, idx) => (
          <PatStat
            key={idx}
            label={`PAT (${w.name})`}
            value={Math.round(calculateWeaponPAT(w, activeChar))}
            sub={`${w.subtype} | ${w.tier}`}
          />
        )) : (
          <DataRow label="PAT (Arma)" value="Nenhuma Equipada" />
        )}
        <PatStat label="PAT (Desarmado)" value={Math.round(disarmedPat)} sub="Soco / Improviso" />
        
        <SecondaryStat label="Convencimento" value={convincimento} sub={`Carisma (${charismaPerc}%)`} />
        <SecondaryStat label="Raciocínio" value={raciocinio} sub={`Inteligência (${intelligencePerc}%)`} />
        <SecondaryStat label="Prosperidade" value={prosperidade} sub={`Sorte (${luckPerc}%)`} />

        <div className="flex justify-between items-center bg-yellow-500/5 p-3 rounded-xl border border-yellow-500/20">
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-yellow-600 uppercase italic leading-none">Qualidade de Loot</span>
            <span className="text-[7px] text-yellow-700 font-bold uppercase mt-1">Sorte ({luckPerc}%)</span>
          </div>
          <span className="text-sm font-mono font-black text-yellow-500">1d{lootDie}</span>
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
      <span className="text-[9px] font-black text-blue-400 uppercase italic leading-none">{label}</span>
      <span className="text-[7px] text-blue-500/60 font-bold uppercase mt-1">{sub}</span>
    </div>
    <span className="text-sm font-mono font-black text-blue-400">1d{value}</span>
  </div>
);

const PatStat = ({ label, value, sub }) => (
  <div className="flex justify-between items-center bg-red-500/5 p-3 rounded-xl border border-red-500/20">
    <div className="flex flex-col">
      <span className="text-[9px] font-black text-red-500 uppercase italic leading-none">{label}</span>
      <span className="text-[7px] text-red-600/60 font-bold uppercase mt-1">{sub}</span>
    </div>
    <span className="text-sm font-mono font-black text-red-500">1d{value}</span>
  </div>
);