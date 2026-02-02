export default function DicePanel({ activeChar, luckPerc }) {
  const lootDie = Math.round(15 + (5 * Math.pow(luckPerc / 15, 0.8)));
  const patWith = `1d20 + ${activeChar?.precision || 0}`;
  const patWithout = `1d20 + ${activeChar?.strength || 0}`;

  return (
    <div className="bg-slate-900/80 p-6 rounded-[30px] border-2 border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.1)]">
      <h3 className="font-black text-cyan-500 text-[10px] italic mb-4 tracking-widest uppercase">Sistema de Dados</h3>
      <div className="space-y-3">
        <DataRow label="PAT (Com Arma)" value={patWith} />
        <DataRow label="PAT (Desarmado)" value={patWithout} />
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

const DataRow = ({ label, value }) => (
  <div className="flex justify-between items-center bg-black/40 p-3 rounded-xl border border-white/5">
    <span className="text-[9px] font-black text-gray-400 uppercase italic">{label}</span>
    <span className="text-sm font-mono font-black text-white">{value}</span>
  </div>
);