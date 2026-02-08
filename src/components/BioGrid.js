import { RANKS, CLASSES_LIST, RESPIRACOES, LINHAGENS, CORES, formatHeight } from '../constants/gameData';
import { supabase } from '../lib/supabase';

import React, { memo } from 'react';

const BioGrid = memo(({ activeChar, isEditing, setTempChar }) => {
  const updateField = (field, val) => setTempChar(prev => ({ ...prev, [field]: val }));

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeChar?.id) return;

    // Check size (1.5MB approx for 1500x1500px compressed)
    if (file.size > 2 * 1024 * 1024) {
      alert("Imagem muito grande! Limite de 2MB.");
      return;
    }

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${activeChar.id}-${Math.random()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('character-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('character-images')
        .getPublicUrl(filePath);

      updateField('image_url', publicUrl);
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Error uploading image. Please try again.');
    }
  };

  const SelectField = ({ label, field, options }) => {
    // We memoize the select value to prevent unnecessary re-renders of the dropdown
    // while typing in other fields
    return (
      <div className="space-y-1">
        <span className="text-gray-500 text-[9px] font-black italic uppercase">{label}:</span>
        {isEditing ? (
          <select
            value={activeChar?.[field] || ""}
            onChange={(e) => updateField(field, e.target.value)}
            className="bg-slate-800 border border-white/10 rounded px-3 py-2 w-full text-sm outline-none"
          >
            {options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : <p className="font-bold text-lg leading-none">{activeChar?.[field] || "Nenhum"}</p>}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-2 gap-x-10 gap-y-8 mt-4">
      {/* IMAGE COLUMN */}
      <div className="row-span-3 flex flex-col items-center justify-center bg-black/40 rounded-xl border border-white/5 relative group overflow-hidden aspect-square w-full">
        {activeChar?.image_url ? (
          <img
            src={activeChar.image_url}
            alt={activeChar.char_name}
            className={`w-full h-full object-cover transition-transform ${isEditing ? 'group-hover:scale-105' : ''}`}
          />
        ) : (
          <div className="flex flex-col items-center gap-2 opacity-20">
            <span className="text-4xl">👤</span>
            <p className="text-[10px] font-black uppercase">Sem Imagem</p>
          </div>
        )}
        
        {isEditing && (
          <label className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-2xl mb-2">📸</span>
            <span className="text-[10px] font-black uppercase">Trocar Foto</span>
            <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          </label>
        )}
      </div>

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
});

export default BioGrid;