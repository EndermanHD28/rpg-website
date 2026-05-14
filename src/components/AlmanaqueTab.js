"use client";
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Toast, Modal, TooltipWrapper } from './UIElements';

export default function AlmanaqueTab({ user, isMaster, showToast, playSound }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingData, setEditingData] = useState(null);

  // Fetch data
  const fetchEntries = async () => {
    setLoading(true);
    let query = supabase.from('almanaque_entries').select('*').order('order_index', { ascending: true });
    
    // Players only see public entries (enforced by RLS anyway, but good to be explicit)
    if (!isMaster) {
      query = query.eq('is_public', true);
    }

    const { data, error } = await query;
    if (error) {
      showToast("Erro ao carregar o Almanaque.");
    } else {
      setEntries(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchEntries();

    const channel = supabase.channel('almanaque_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'almanaque_entries' }, () => {
        fetchEntries();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isMaster]);

  const filteredEntries = entries.filter(entry => 
    entry.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (entry.description && entry.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleSave = async () => {
    if (!editingData.title) {
      showToast("O título é obrigatório.");
      return;
    }

    const { error } = await supabase
      .from('almanaque_entries')
      .upsert({
        ...editingData,
        updated_at: new Date().toISOString()
      });

    if (error) {
      showToast("Erro ao salvar.");
    } else {
      showToast("Salvo com sucesso!");
      setIsEditing(false);
      setEditingData(null);
      if (selectedEntry?.id === editingData.id) {
        setSelectedEntry(editingData);
      }
    }
  };

  const handleCreate = () => {
    const newEntry = {
      title: "Novo Título",
      description: "Pequena descrição...",
      content: [],
      is_public: false,
      order_index: entries.length
    };
    setEditingData(newEntry);
    setIsEditing(true);
    setSelectedEntry(null);
  };

  const handleDelete = async (id) => {
    if (confirm("Tem certeza que deseja excluir esta informação?")) {
      const { error } = await supabase.from('almanaque_entries').delete().eq('id', id);
      if (error) {
        showToast("Erro ao excluir.");
      } else {
        showToast("Excluído.");
        setSelectedEntry(null);
      }
    }
  };

  // Helper to add blocks
  const addBlock = (type, parentContent = null, setParentContent = null) => {
    const newBlock = type === 'text' ? { type: 'text', value: '', size: 'normal' } :
                     type === 'image' ? { type: 'image', url: '', caption: '' } :
                     type === 'tabs' ? { type: 'tabs', items: [{ title: 'Tab 1', content: [] }] } : null;
    
    if (parentContent) {
      setParentContent([...parentContent, newBlock]);
    } else {
      setEditingData({ ...editingData, content: [...editingData.content, newBlock] });
    }
  };

  return (
    <div className="h-full flex flex-col p-8 bg-zinc-950 overflow-hidden relative">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-8 bg-zinc-900/50 p-6 rounded-[2rem] border border-zinc-800 backdrop-blur-sm z-10 animate-in fade-in slide-in-from-top-4 duration-700">
        <div>
          <h2 className="text-4xl font-black italic text-red-600 uppercase tracking-tighter">Almanaque</h2>
          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mt-1">Conhecimento e Segredos</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative group">
             <input
                type="text"
                placeholder="Pesquisar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-black/40 border border-zinc-800 rounded-full px-6 py-2 text-xs text-white outline-none focus:border-red-600/50 w-64 transition-all group-hover:border-zinc-700"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 opacity-30">🔍</span>
          </div>
          
          {isMaster && (
            <button
              onClick={handleCreate}
              className="bg-red-600 hover:bg-red-500 text-white px-6 py-2.5 rounded-full font-black uppercase text-[10px] transition-all shadow-lg active:scale-95 flex items-center gap-2"
            >
              <span>+</span> Novo Registro
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex gap-8 overflow-hidden">
        {/* LIST */}
        <div className="w-1/3 bg-zinc-900/30 rounded-[2rem] border border-zinc-900/50 overflow-y-auto custom-scrollbar p-4 space-y-3 animate-in fade-in slide-in-from-left-4 duration-700">
          {loading ? (
            <div className="flex items-center justify-center h-full text-zinc-600 font-black italic animate-pulse uppercase text-xs tracking-widest">Sincronizando...</div>
          ) : filteredEntries.length === 0 ? (
             <div className="flex items-center justify-center h-full text-zinc-700 font-bold italic uppercase text-[10px] tracking-widest">Nenhum registro encontrado</div>
          ) : (
            filteredEntries.map((entry, idx) => (
              <div
                key={entry.id}
                onClick={() => {
                  playSound('tab_change');
                  setSelectedEntry(entry);
                  setIsEditing(false);
                }}
                className={`p-5 rounded-2xl border transition-all cursor-pointer group relative overflow-hidden ${
                  selectedEntry?.id === entry.id
                    ? 'bg-red-600/10 border-red-600/50 shadow-[0_0_20px_rgba(220,38,38,0.1)]'
                    : 'bg-zinc-900/50 border-white/5 hover:border-zinc-700 hover:bg-zinc-800/50'
                }`}
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                {!entry.is_public && isMaster && (
                   <span className="absolute top-2 right-4 text-[8px] font-black text-yellow-500/50 uppercase tracking-tighter">Privado</span>
                )}
                <h3 className={`font-black uppercase text-sm tracking-tight transition-colors ${selectedEntry?.id === entry.id ? 'text-red-500' : 'text-zinc-200 group-hover:text-white'}`}>{entry.title}</h3>
                <p className="text-[10px] text-zinc-500 font-medium line-clamp-2 mt-1 leading-relaxed">{entry.description || "Sem descrição."}</p>
                
                {selectedEntry?.id === entry.id && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-600" />
                )}
              </div>
            ))
          )}
        </div>

        {/* DETAIL / EDIT AREA */}
        <div className="flex-1 bg-zinc-900/30 rounded-[2rem] border border-zinc-900/50 overflow-hidden flex flex-col relative animate-in fade-in slide-in-from-right-4 duration-700">
          {!selectedEntry && !editingData ? (
            <div className="flex-1 flex items-center justify-center text-zinc-800 flex-col gap-4">
               <div className="text-6xl grayscale opacity-10">📖</div>
               <p className="font-black italic uppercase text-xs tracking-[0.2em]">Selecione um registro para ler</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              {/* DETAIL HEADER */}
              <div className="p-8 border-b border-white/5 flex justify-between items-start bg-zinc-900/20">
                <div className="flex-1">
                   {isEditing ? (
                     <div className="space-y-4">
                        <input
                          value={editingData.title}
                          onChange={(e) => setEditingData({...editingData, title: e.target.value})}
                          className="text-4xl font-black italic text-red-600 bg-transparent border-b border-red-600/30 outline-none w-full uppercase tracking-tighter"
                          placeholder="Título do Registro"
                        />
                        <textarea
                          value={editingData.description}
                          onChange={(e) => setEditingData({...editingData, description: e.target.value})}
                          className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl p-4 text-xs text-zinc-400 outline-none focus:border-red-600/30 transition-all resize-none h-20"
                          placeholder="Pequena descrição de resumo..."
                        />
                        <div className="flex items-center gap-4">
                           <label className="flex items-center gap-2 cursor-pointer group">
                              <input 
                                type="checkbox" 
                                checked={editingData.is_public}
                                onChange={(e) => setEditingData({...editingData, is_public: e.target.checked})}
                                className="hidden"
                              />
                              <div className={`w-10 h-5 rounded-full p-1 transition-all ${editingData.is_public ? 'bg-green-600' : 'bg-zinc-800'}`}>
                                 <div className={`w-3 h-3 bg-white rounded-full transition-all ${editingData.is_public ? 'translate-x-5' : 'translate-x-0'}`} />
                              </div>
                              <span className="text-[10px] font-black uppercase text-zinc-500 group-hover:text-zinc-300 transition-colors">
                                {editingData.is_public ? 'Público' : 'Privado'}
                              </span>
                           </label>
                        </div>
                     </div>
                   ) : (
                     <>
                        <div className="flex items-center gap-3 mb-2">
                           <h3 className="text-5xl font-black italic text-red-600 uppercase tracking-tighter">
                             {selectedEntry.title}
                           </h3>
                           {!selectedEntry.is_public && (
                             <span className="px-2 py-0.5 bg-yellow-500/10 border border-yellow-500/30 text-yellow-500 text-[8px] font-black uppercase rounded tracking-widest">Privado</span>
                           )}
                        </div>
                        <p className="text-zinc-500 font-medium italic text-sm max-w-2xl">{selectedEntry.description}</p>
                     </>
                   )}
                </div>

                {isMaster && (
                  <div className="flex gap-2 shrink-0 ml-4">
                    {isEditing ? (
                      <>
                        <button 
                          onClick={handleSave}
                          className="bg-green-600 hover:bg-green-500 text-white px-6 py-2 rounded-full font-black uppercase text-[10px] transition-all shadow-lg active:scale-95"
                        >
                          Salvar
                        </button>
                        <button 
                          onClick={() => {
                            setIsEditing(false);
                            if (!selectedEntry) setEditingData(null);
                          }}
                          className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-6 py-2 rounded-full font-black uppercase text-[10px] transition-all"
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <button 
                          onClick={() => {
                            setEditingData(selectedEntry);
                            setIsEditing(true);
                          }}
                          className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-full font-black uppercase text-[10px] transition-all flex items-center gap-2 border border-white/5"
                        >
                          <span>✎</span> Editar
                        </button>
                        <button 
                          onClick={() => handleDelete(selectedEntry.id)}
                          className="bg-zinc-950 hover:bg-red-950 text-red-900 hover:text-red-500 px-4 py-2 rounded-full font-black uppercase text-[10px] transition-all border border-red-900/20"
                        >
                          Excluir
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* CONTENT AREA */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-10 bg-zinc-950/20">
                 <div className="max-w-4xl mx-auto space-y-8 pb-20">
                    {isEditing ? (
                      <div className="space-y-6">
                        {editingData.content?.map((block, bIdx) => (
                          <div key={bIdx} className="relative group/block bg-white/5 p-6 rounded-3xl border border-white/5">
                             <div className="absolute -left-3 top-1/2 -translate-y-1/2 opacity-0 group-hover/block:opacity-100 transition-all flex flex-col gap-1">
                                <button onClick={() => {
                                   const newContent = [...editingData.content];
                                   if (bIdx > 0) {
                                      const temp = newContent[bIdx];
                                      newContent[bIdx] = newContent[bIdx-1];
                                      newContent[bIdx-1] = temp;
                                      setEditingData({...editingData, content: newContent});
                                   }
                                }} className="bg-zinc-800 p-1 rounded hover:bg-red-600 text-[10px]">▲</button>
                                <button onClick={() => {
                                   const newContent = [...editingData.content];
                                   if (bIdx < newContent.length - 1) {
                                      const temp = newContent[bIdx];
                                      newContent[bIdx] = newContent[bIdx+1];
                                      newContent[bIdx+1] = temp;
                                      setEditingData({...editingData, content: newContent});
                                   }
                                }} className="bg-zinc-800 p-1 rounded hover:bg-red-600 text-[10px]">▼</button>
                             </div>

                             <button 
                               onClick={() => {
                                 const newContent = editingData.content.filter((_, i) => i !== bIdx);
                                 setEditingData({...editingData, content: newContent});
                               }}
                               className="absolute -right-3 -top-3 bg-red-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs opacity-0 group-hover/block:opacity-100 transition-all"
                             >
                               ×
                             </button>

                             {block.type === 'text' && (
                               <div className="space-y-4">
                                  <div className="flex gap-2 mb-2">
                                     {['normal', 'Title', 'Subtitle'].map(s => (
                                       <button 
                                          key={s}
                                          onClick={() => {
                                            const newContent = [...editingData.content];
                                            newContent[bIdx].size = s;
                                            setEditingData({...editingData, content: newContent});
                                          }}
                                          className={`px-3 py-1 rounded-full text-[8px] font-black uppercase border transition-all ${block.size === s ? 'bg-red-600 border-red-500' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}
                                       >
                                         {s}
                                       </button>
                                     ))}
                                  </div>
                                  <textarea
                                    value={block.value}
                                    onChange={(e) => {
                                      const newContent = [...editingData.content];
                                      newContent[bIdx].value = e.target.value;
                                      setEditingData({...editingData, content: newContent});
                                    }}
                                    className={`w-full bg-transparent border-none outline-none text-zinc-200 placeholder:text-zinc-700 resize-none overflow-hidden ${
                                      block.size === 'Title' ? 'text-3xl font-black italic uppercase tracking-tighter text-white' : 
                                      block.size === 'Subtitle' ? 'text-xl font-bold italic text-zinc-300' : 'text-sm leading-relaxed text-zinc-400'
                                    }`}
                                    placeholder="Digite o conteúdo..."
                                    rows={block.value.split('\n').length || 1}
                                  />
                               </div>
                             )}

                             {block.type === 'image' && (
                               <div className="space-y-4">
                                  <div className="flex gap-2 mb-2">
                                     {['small', 'medium', 'large', 'full'].map(s => (
                                       <button 
                                          key={s}
                                          onClick={() => {
                                            const newContent = [...editingData.content];
                                            newContent[bIdx].size = s;
                                            setEditingData({...editingData, content: newContent});
                                          }}
                                          className={`px-3 py-1 rounded-full text-[8px] font-black uppercase border transition-all ${block.size === s ? 'bg-red-600 border-red-500' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}
                                       >
                                         {s}
                                       </button>
                                     ))}
                                  </div>
                                  <input
                                    value={block.url}
                                    onChange={(e) => {
                                      const newContent = [...editingData.content];
                                      newContent[bIdx].url = e.target.value;
                                      setEditingData({...editingData, content: newContent});
                                    }}
                                    className="w-full bg-zinc-950/50 border border-zinc-800 rounded-lg px-4 py-2 text-xs text-zinc-400 outline-none"
                                    placeholder="Link da Imagem (URL)..."
                                  />
                                  {block.url && (
                                    <div className={`relative aspect-video bg-black rounded-2xl overflow-hidden border border-white/5 mx-auto ${
                                      block.size === 'small' ? 'max-w-xs' : 
                                      block.size === 'medium' ? 'max-w-md' : 
                                      block.size === 'large' ? 'max-w-2xl' : 'w-full'
                                    }`}>
                                      <img src={block.url} className="w-full h-full object-contain" alt="Preview" />
                                    </div>
                                  )}
                                  <input
                                    value={block.caption}
                                    onChange={(e) => {
                                      const newContent = [...editingData.content];
                                      newContent[bIdx].caption = e.target.value;
                                      setEditingData({...editingData, content: newContent});
                                    }}
                                    className="w-full bg-transparent border-none text-[10px] text-zinc-500 italic outline-none text-center"
                                    placeholder="Legenda da imagem (opcional)"
                                  />
                               </div>
                             )}

                             {block.type === 'tabs' && (
                               <div className="space-y-6">
                                  <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-4">Abas Expansíveis</p>
                                  {block.items.map((item, tIdx) => (
                                    <div key={tIdx} className="bg-black/40 p-6 rounded-2xl border border-white/5 space-y-4">
                                       <div className="flex justify-between items-center">
                                          <input 
                                            value={item.title}
                                            onChange={(e) => {
                                              const newContent = [...editingData.content];
                                              newContent[bIdx].items[tIdx].title = e.target.value;
                                              setEditingData({...editingData, content: newContent});
                                            }}
                                            className="bg-transparent border-none text-sm font-black uppercase text-zinc-300 outline-none w-1/2"
                                          />
                                          <button 
                                            onClick={() => {
                                              const newContent = [...editingData.content];
                                              newContent[bIdx].items = newContent[bIdx].items.filter((_, i) => i !== tIdx);
                                              if (newContent[bIdx].items.length === 0) {
                                                editingData.content.splice(bIdx, 1);
                                              }
                                              setEditingData({...editingData, content: newContent});
                                            }}
                                            className="text-red-900 hover:text-red-600 text-xs font-black uppercase tracking-widest"
                                          >
                                            Remover Aba
                                          </button>
                                       </div>
                                       
                                       {/* NESTED BLOCKS IN TABS */}
                                       <div className="space-y-4 pt-4 border-t border-white/5">
                                          {Array.isArray(item.content) ? (
                                            item.content.map((nestedBlock, nIdx) => (
                                              <div key={nIdx} className="relative group/nested bg-white/5 p-4 rounded-xl border border-white/5">
                                                 <button 
                                                   onClick={() => {
                                                     const newContent = [...editingData.content];
                                                     newContent[bIdx].items[tIdx].content = item.content.filter((_, i) => i !== nIdx);
                                                     setEditingData({...editingData, content: newContent});
                                                   }}
                                                   className="absolute -right-2 -top-2 bg-red-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] opacity-0 group-hover/nested:opacity-100 transition-all"
                                                 >
                                                   ×
                                                 </button>

                                                 {nestedBlock.type === 'text' && (
                                                   <textarea
                                                     value={nestedBlock.value}
                                                     onChange={(e) => {
                                                       const newContent = [...editingData.content];
                                                       newContent[bIdx].items[tIdx].content[nIdx].value = e.target.value;
                                                       setEditingData({...editingData, content: newContent});
                                                     }}
                                                     className="w-full bg-transparent border-none outline-none text-zinc-300 text-xs leading-relaxed resize-none overflow-hidden"
                                                     placeholder="Texto da aba..."
                                                     rows={nestedBlock.value.split('\n').length || 1}
                                                   />
                                                 )}

                                                 {nestedBlock.type === 'image' && (
                                                   <div className="space-y-2">
                                                      <input
                                                        value={nestedBlock.url}
                                                        onChange={(e) => {
                                                          const newContent = [...editingData.content];
                                                          newContent[bIdx].items[tIdx].content[nIdx].url = e.target.value;
                                                          setEditingData({...editingData, content: newContent});
                                                        }}
                                                        className="w-full bg-zinc-950/50 border border-zinc-800 rounded px-2 py-1 text-[10px] text-zinc-500 outline-none"
                                                        placeholder="Link da Imagem..."
                                                      />
                                                      {nestedBlock.url && <img src={nestedBlock.url} className="w-full h-auto rounded-lg max-h-40 object-contain" alt="nested preview" />}
                                                   </div>
                                                 )}
                                              </div>
                                            ))
                                          ) : (
                                            <div className="text-[10px] text-zinc-600 italic p-2 border border-zinc-800 rounded bg-black/20">
                                              Conteúdo de texto detectado. Clique em +Texto para converter ou começar a adicionar blocos.
                                            </div>
                                          )}
                                          
                                          <div className="flex gap-2">
                                             <button 
                                               onClick={() => {
                                                 const newContent = [...editingData.content];
                                                 if (!newContent[bIdx].items[tIdx].content) newContent[bIdx].items[tIdx].content = [];
                                                 newContent[bIdx].items[tIdx].content.push({ type: 'text', value: '' });
                                                 setEditingData({...editingData, content: newContent});
                                               }}
                                               className="bg-zinc-800 hover:bg-zinc-700 text-zinc-400 px-3 py-1 rounded text-[9px] font-black uppercase"
                                             >
                                               + Texto
                                             </button>
                                             <button 
                                               onClick={() => {
                                                 const newContent = [...editingData.content];
                                                 if (!newContent[bIdx].items[tIdx].content) newContent[bIdx].items[tIdx].content = [];
                                                 newContent[bIdx].items[tIdx].content.push({ type: 'image', url: '' });
                                                 setEditingData({...editingData, content: newContent});
                                               }}
                                               className="bg-zinc-800 hover:bg-zinc-700 text-zinc-400 px-3 py-1 rounded text-[9px] font-black uppercase"
                                             >
                                               + Imagem
                                             </button>
                                          </div>
                                       </div>
                                    </div>
                                  ))}
                                  <button 
                                    onClick={() => {
                                      const newContent = [...editingData.content];
                                      newContent[bIdx].items.push({ title: 'Nova Aba', content: '' });
                                      setEditingData({...editingData, content: newContent});
                                    }}
                                    className="w-full py-3 border-2 border-dashed border-zinc-800 rounded-2xl text-[10px] font-black text-zinc-600 hover:border-zinc-700 hover:text-zinc-400 transition-all uppercase"
                                  >
                                    + Adicionar Aba
                                  </button>
                               </div>
                             )}
                          </div>
                        ))}

                        <div className="flex gap-4 p-8 bg-zinc-900/50 rounded-[2.5rem] border border-dashed border-zinc-800 justify-center">
                           <button onClick={() => addBlock('text')} className="flex flex-col items-center gap-2 group">
                              <div className="w-12 h-12 bg-zinc-950 rounded-2xl flex items-center justify-center border border-zinc-800 group-hover:border-red-600 transition-all group-hover:scale-110">📝</div>
                              <span className="text-[8px] font-black uppercase text-zinc-600 group-hover:text-zinc-300 tracking-widest">Texto</span>
                           </button>
                           <button onClick={() => addBlock('image')} className="flex flex-col items-center gap-2 group">
                              <div className="w-12 h-12 bg-zinc-950 rounded-2xl flex items-center justify-center border border-zinc-800 group-hover:border-red-600 transition-all group-hover:scale-110">🖼️</div>
                              <span className="text-[8px] font-black uppercase text-zinc-600 group-hover:text-zinc-300 tracking-widest">Imagem</span>
                           </button>
                           <button onClick={() => addBlock('tabs')} className="flex flex-col items-center gap-2 group">
                              <div className="w-12 h-12 bg-zinc-950 rounded-2xl flex items-center justify-center border border-zinc-800 group-hover:border-red-600 transition-all group-hover:scale-110">📑</div>
                              <span className="text-[8px] font-black uppercase text-zinc-600 group-hover:text-zinc-300 tracking-widest">Abas</span>
                           </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                        {selectedEntry.content?.map((block, bIdx) => (
                           <div key={bIdx} className="animate-in fade-in slide-in-from-bottom-2" style={{ animationDelay: `${bIdx * 100}ms` }}>
                              {block.type === 'text' && (
                                <div className={`whitespace-pre-wrap ${
                                  block.size === 'Title' ? 'text-4xl font-black italic uppercase tracking-tighter text-white border-l-4 border-red-600 pl-6 my-8' : 
                                  block.size === 'Subtitle' ? 'text-2xl font-bold italic text-red-500/80 mb-4' : 'text-base leading-relaxed text-zinc-400 font-medium'
                                }`}>
                                  {formatText(block.value)}
                                </div>
                              )}

                              {block.type === 'image' && (
                                <div className="my-10 space-y-3">
                                  <div className={`rounded-[2.5rem] overflow-hidden border border-white/5 shadow-2xl bg-zinc-900/50 mx-auto ${
                                    block.size === 'small' ? 'max-w-xs' : 
                                    block.size === 'medium' ? 'max-w-md' : 
                                    block.size === 'large' ? 'max-w-2xl' : 'w-full'
                                  }`}>
                                     <img src={block.url} className="w-full h-auto max-h-[800px] object-contain" alt={block.caption} />
                                  </div>
                                  {block.caption && (
                                    <p className="text-center text-[10px] font-black uppercase italic tracking-[0.2em] text-zinc-600">{block.caption}</p>
                                  )}
                                </div>
                              )}

                              {block.type === 'tabs' && (
                                <ExpandableSections items={block.items} playSound={playSound} />
                              )}
                           </div>
                        ))}
                      </div>
                    )}
                 </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ExpandableSections({ items, playSound }) {
  const [openIdx, setOpenIdx] = useState(null);

  return (
    <div className="space-y-4 my-8">
      {items.map((item, idx) => (
        <div key={idx} className="rounded-3xl border border-white/5 overflow-hidden transition-all duration-300">
          <button
            onClick={() => {
              playSound('random_button');
              setOpenIdx(openIdx === idx ? null : idx);
            }}
            className={`w-full px-8 py-5 flex justify-between items-center transition-all ${openIdx === idx ? 'bg-red-600 text-white shadow-lg' : 'bg-zinc-900/50 text-zinc-400 hover:bg-zinc-900 hover:text-white'}`}
          >
            <span className="font-black uppercase text-xs tracking-widest italic">{item.title}</span>
            <span className={`transform transition-transform duration-300 font-black ${openIdx === idx ? 'rotate-180' : ''}`}>
              {openIdx === idx ? '−' : '+'}
            </span>
          </button>
          <div 
            className={`transition-all duration-500 ease-in-out overflow-hidden ${openIdx === idx ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}
          >
            <div className="p-8 bg-zinc-900/20 text-zinc-400 text-sm leading-relaxed font-medium border-t border-white/5 space-y-6">
              {Array.isArray(item.content) ? (
                item.content.map((nested, nIdx) => (
                  <div key={nIdx}>
                    {nested.type === 'text' && (
                      <div className="whitespace-pre-wrap">{formatText(nested.value)}</div>
                    )}
                    {nested.type === 'image' && (
                      <div className="rounded-2xl overflow-hidden border border-white/5 max-w-sm mx-auto my-4">
                        <img src={nested.url} className="w-full h-auto" alt="tab content" />
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="whitespace-pre-wrap">{formatText(item.content)}</div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Simple text formatter for bold, underline
function formatText(text) {
  if (!text) return "";
  
  // Basic markdown-ish formatting
  let parts = [text];
  
  // Bold: **text**
  const boldRegex = /\*\*(.*?)\*\*/g;
  // Underline: __text__
  const underlineRegex = /__(.*?)__/g;

  // This is a simplified version. For a real app, use a proper parser.
  // We'll just use dangerousSetInnerHTML for simplicity since it's an internal RPG tool
  // but let's try to be a bit safer.
  
  const html = text
    .replace(boldRegex, '<strong class="text-white font-black">$1</strong>')
    .replace(underlineRegex, '<u class="decoration-red-600/50 underline-offset-4">$1</u>');

  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
