import { RANKS, CLASSES_LIST, RESPIRACOES, LINHAGENS, CORES, formatHeight } from '../constants/gameData';

export default function BioGrid({ activeChar, isEditing, setTempChar }) {
  const updateField = (field, val) => setTempChar(prev => ({ ...prev, [field]: val }));

  const SelectField = ({ label, field, options }) => (
    <div className="space-y-1">
      <span className="text-gray-500 text-[9px] font-black italic uppercase">{label}:</span>
      {isEditing ? (
        <select 
          value={activeChar?.[field]} 
          onChange={(e) => updateField(field, e.target.value)}
          className="bg-slate-800 border border-white/10 rounded px-3 py-2 w-full text-sm outline-none"
        >
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : <p className="font-bold text-lg leading-none">{activeChar?.[field] || "Nenhum"}</p>}
    </div>
  );

  return (
    <div className="grid grid-cols-2 gap-x-10 gap-y-8 mt-4">
      <SelectField label="Rank" field="rank" options={RANKS} />
      
      <div className="space-y-1">
        <span className="text-gray-500 text-[9px] font-black italic uppercase">Dólares:</span>
        {isEditing ? (
          <input type="number" value={activeChar?.dollars ?? ""} onChange={(e) => updateField('dollars', e.target.value === "" ? "" : Math.max(0, parseInt(e.target.value)))} className="bg-slate-800 border border-white/10 rounded px-3 py-2 w-full text-sm outline-none" />
        ) : <p className="font-bold text-lg leading-none">{activeChar?.dollars || 0}$</p>}
      </div>

      <SelectField label="Classe" field="class" options={CLASSES_LIST} />

      <div className="space-y-1">
        <span className="text-gray-500 text-[9px] font-black italic uppercase">Altura:</span>
        {isEditing ? (
          <input type="text" value={activeChar?.height || ""} onChange={(e) => updateField('height', formatHeight(e.target.value))} className="bg-slate-800 border border-white/10 rounded px-3 py-2 w-full text-sm outline-none" placeholder="Ex: 175" />
        ) : <p className="font-bold text-lg leading-none">{activeChar?.height || "0,00m"}</p>}
      </div>

      <div className="space-y-1">
        <span className="text-gray-500 text-[9px] font-black italic uppercase">Respiração:</span>
        {isEditing ? (
          <div className="flex gap-2">
            <select value={activeChar?.breathing_style} onChange={(e) => updateField('breathing_style', e.target.value)} className="bg-slate-800 border border-white/10 rounded px-3 py-2 flex-1 text-sm outline-none">
              {RESPIRACOES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <div className="relative">
              <span className="absolute -top-3 left-0 text-[8px] text-gray-500 font-bold uppercase">Nível</span>
              <input type="number" value={activeChar?.breathing_lvl ?? ""} onChange={(e) => updateField('breathing_lvl', e.target.value === "" ? "" : Math.max(1, parseInt(e.target.value)))} className="bg-slate-800 border border-white/10 rounded px-3 py-2 w-16 text-sm outline-none" />
            </div>
          </div>
        ) : <p className="font-bold text-lg leading-none">{activeChar?.breathing_style === "Nenhuma" ? "Nenhuma" : `${activeChar?.breathing_style} (Lvl.${activeChar?.breathing_lvl})`}</p>}
      </div>

      <div className="space-y-1">
        <span className="text-gray-500 text-[9px] font-black italic uppercase">Idade:</span>
        {isEditing ? (
          <input type="number" value={activeChar?.age ?? ""} onChange={(e) => updateField('age', e.target.value === "" ? "" : Math.max(0, parseInt(e.target.value)))} className="bg-slate-800 border border-white/10 rounded px-3 py-2 w-full text-sm outline-none" />
        ) : <p className="font-bold text-lg leading-none">{activeChar?.age || 0} anos</p>}
      </div>

      <SelectField label="Linhagem" field="bloodline" options={LINHAGENS} />
      <SelectField label="Cor de Nichirin" field="nichirin_color" options={CORES} />
    </div>
  );
}