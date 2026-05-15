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
  const [isEditor, setIsEditor] = useState(false);
  const [almanaqueEditors, setAlmanaqueEditors] = useState("");
  const [openInMenu, setOpenInMenu] = useState(null); // { bIdx, nIdx } or { bIdx }
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOverTab, setDragOverTab] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const broadcastRef = useRef(null);
  const isRemoteUpdate = useRef(false);

  // Fetch data
  const fetchEntries = async () => {
    setLoading(true);
    
    // Check if user is an editor
    const { data: globalData } = await supabase.from('global').select('almanaque_editors').eq('id', 1).single();
    let currentIsEditor = isMaster;
    
    if (globalData) {
      const editorsList = Array.isArray(globalData.almanaque_editors) ? globalData.almanaque_editors : [];
      setAlmanaqueEditors(editorsList.join(", "));

      if (isMaster) {
        currentIsEditor = true;
      } else if (user) {
        // Fetch discord username of current user
        const { data: userData } = await supabase.from('characters').select('discord_username').eq('id', user.id).single();
        if (userData && editorsList.includes(userData.discord_username)) {
          currentIsEditor = true;
        } else {
          currentIsEditor = false;
        }
      }
    }
    setIsEditor(currentIsEditor);

    let query = supabase.from('almanaque_entries').select('*').order('order_index', { ascending: true });
    const { data, error } = await query;
    
    if (error) {
      showToast("Erro ao carregar o Almanaque.");
    } else {
      if (!currentIsEditor) {
        // If not an editor, filter to show only public entries
        setEntries(data?.filter(e => e.is_public) || []);
      } else {
        // Master and Editors see everything
        setEntries(data || []);
      }
    }
    setLoading(false);
  };

  const updateAlmanaqueEditors = async () => {
    playSound('random_button');
    const editorsArray = almanaqueEditors.split(',').map(s => s.trim()).filter(s => s !== "");
    
    const { data: existing } = await supabase.from('global').select('id').eq('id', 1).maybeSingle();
    
    let updateOp;
    if (!existing) {
      updateOp = supabase.from('global').insert({
        id: 1,
        almanaque_editors: editorsArray
      });
    } else {
      updateOp = supabase.from('global')
        .update({ almanaque_editors: editorsArray })
        .eq('id', 1);
    }

    const { error } = await updateOp;

    if (!error) {
      showToast("Editores do Almanaque atualizados!");
    } else {
      console.error("Update almanaque editors error:", error);
      showToast(`Erro ao atualizar editores: ${error.message}`);
    }
  };

  useEffect(() => {
    fetchEntries();

    const channel = supabase.channel('almanaque_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'almanaque_entries' }, () => {
        fetchEntries();
      })
      .subscribe();

    const globalChannel = supabase.channel('global_changes_almanaque')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'global', filter: 'id=eq.1' }, () => {
        fetchEntries();
      })
      .subscribe();

    // Collaborative editing channel
    const collabChannel = supabase.channel('almanaque_collab')
      .on('broadcast', { event: 'editing' }, ({ payload }) => {
        if (!payload) return;
        const { id, data, senderId } = payload;
        if (senderId === user?.id) return;

        isRemoteUpdate.current = true;
        
        // If we are editing the same entry, update editingData
        setEditingData(prev => {
           if (prev && prev.id === id) {
             return { ...data };
           }
           return prev;
        });

        // If we are viewing the same entry, update selectedEntry
        setSelectedEntry(prev => {
          if (prev && prev.id === id) {
            return { ...data };
          }
          return prev;
        });

        setTimeout(() => { isRemoteUpdate.current = false; }, 100);
      })
      .subscribe();
      
    broadcastRef.current = collabChannel;

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(globalChannel);
      supabase.removeChannel(collabChannel);
    };
  }, [isMaster, user?.id]);

  // Broadcast changes when editingData changes
  useEffect(() => {
    if (editingData && !isRemoteUpdate.current && broadcastRef.current) {
      broadcastRef.current.send({
        type: 'broadcast',
        event: 'editing',
        payload: {
          id: editingData.id,
          data: editingData,
          senderId: user?.id
        }
      });
    }
  }, [editingData]);

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

  const addBlock = (type, parentArray = null) => {
    const newBlock = type === 'text' ? { type: 'text', value: '', size: 'normal' } :
                     type === 'image' ? { type: 'image', url: '', caption: '', size: 'medium' } :
                     type === 'tabs' ? { type: 'tabs', items: [{ title: 'Nova Aba', content: [] }] } : null;
    
    if (parentArray && Array.isArray(parentArray)) {
      parentArray.push(newBlock);
      setEditingData({ ...editingData });
    } else {
      setEditingData({ ...editingData, content: [...(editingData.content || []), newBlock] });
    }
  };

  const moveBlock = (arr, from, to) => {
    if (to < 0 || to >= arr.length) return;
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    setEditingData({ ...editingData });
  };

  const moveBlockToTab = (fromArr, fromIdx, targetTabItem) => {
    if (!Array.isArray(targetTabItem.content)) targetTabItem.content = [];
    const [moved] = fromArr.splice(fromIdx, 1);
    targetTabItem.content.push(moved);
    setOpenInMenu(null);
    setEditingData({ ...editingData });
  };

  const moveBlockOutOfTab = (fromArr, fromIdx, toArr) => {
    const [moved] = fromArr.splice(fromIdx, 1);
    toArr.push(moved);
    setEditingData({ ...editingData });
  };

  const moveTabToTab = (fromArr, fromIdx, targetTabItem) => {
    if (!Array.isArray(targetTabItem.content)) targetTabItem.content = [];
    const [moved] = fromArr.splice(fromIdx, 1);
    targetTabItem.content.push({ type: 'tabs', items: [moved] });
    setOpenInMenu(null);
    setEditingData({ ...editingData });
  };

  const handleDragStart = (e, block, idx, parentArray) => {
    setDraggedItem({ block, idx, parentArray });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, targetId = null) => {
    e.preventDefault();
    if (targetId) setDragOverTab(targetId);
  };

  const handleDrop = (e, targetArray, targetTabItem = null, targetIdx = null) => {
    e.preventDefault();
    setDragOverTab(null);
    setDragOverIdx(null);
    if (!draggedItem || !Array.isArray(targetArray)) return;

    const { idx: fromIdx, parentArray: fromArray } = draggedItem;
    if (!Array.isArray(fromArray) || fromIdx < 0 || fromIdx >= fromArray.length) return;

    const [moved] = fromArray.splice(fromIdx, 1);
    if (!moved) {
      setEditingData({ ...editingData });
      setDraggedItem(null);
      return;
    }

    // Case 1: Dropping into a tab
    if (targetTabItem) {
      if (!Array.isArray(targetTabItem.content)) targetTabItem.content = [];
      targetTabItem.content.push(moved);
    } 
    // Case 2: Dropping onto the root container (not on a specific block)
    else if (targetIdx === null) {
      targetArray.push(moved);
    }
    // Case 3: Dropping onto a specific block (reordering)
    else {
      targetArray.splice(targetIdx, 0, moved);
    }

    setEditingData({ ...editingData });
    setDraggedItem(null);
  };

  const renderAddBlockButtons = (targetArray, isNested = false) => (
    <div className={`flex gap-4 p-6 bg-zinc-900/50 rounded-[2.5rem] border border-dashed border-zinc-800 justify-center ${isNested ? 'p-4 rounded-2xl gap-2' : ''}`}>
       <button onClick={() => addBlock('text', targetArray)} className="flex flex-col items-center gap-2 group/btn">
          <div className={`${isNested ? 'w-10 h-10' : 'w-12 h-12'} bg-zinc-950 rounded-2xl flex items-center justify-center border border-zinc-800 group-hover/btn:border-red-600 transition-all group-hover/btn:scale-110`}>📝</div>
          <span className={`${isNested ? 'text-[7px]' : 'text-[8px]'} font-black uppercase text-zinc-600 group-hover/btn:text-zinc-300 tracking-widest`}>Texto</span>
       </button>
       <button onClick={() => addBlock('image', targetArray)} className="flex flex-col items-center gap-2 group/btn">
          <div className={`${isNested ? 'w-10 h-10' : 'w-12 h-12'} bg-zinc-950 rounded-2xl flex items-center justify-center border border-zinc-800 group-hover/btn:border-red-600 transition-all group-hover/btn:scale-110`}>🖼️</div>
          <span className={`${isNested ? 'text-[7px]' : 'text-[8px]'} font-black uppercase text-zinc-600 group-hover/btn:text-zinc-300 tracking-widest`}>Imagem</span>
       </button>
       <button onClick={() => addBlock('tabs', targetArray)} className="flex flex-col items-center gap-2 group/btn">
          <div className={`${isNested ? 'w-10 h-10' : 'w-12 h-12'} bg-zinc-950 rounded-2xl flex items-center justify-center border border-zinc-800 group-hover/btn:border-red-600 transition-all group-hover/btn:scale-110`}>📑</div>
          <span className={`${isNested ? 'text-[7px]' : 'text-[8px]'} font-black uppercase text-zinc-600 group-hover/btn:text-zinc-300 tracking-widest`}>Abas</span>
       </button>
    </div>
  );

  const renderBlockEditor = (block, idx, parentArray, isNested = false) => {
    if (!block) return null;
    const blockId = `${isNested ? 'nested' : 'root'}-${idx}`;
    return (
      <div 
        key={idx} 
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (draggedItem && draggedItem.block !== block) {
            setDragOverIdx(blockId);
          }
        }}
        onDragLeave={() => setDragOverIdx(null)}
        onDrop={(e) => {
          e.stopPropagation();
          handleDrop(e, parentArray, null, idx);
        }}
        className={`relative group/block p-6 rounded-3xl border transition-all ${
          draggedItem?.block === block ? 'opacity-40 border-dashed border-zinc-500 scale-[0.98] bg-white/5' : 
          dragOverIdx === blockId ? 'border-red-600 bg-red-600/10 scale-[1.02] shadow-[0_0_20px_rgba(220,38,38,0.1)] z-10' : 'border-white/5 bg-white/5'
        }`}
      >
        <div className="absolute -left-3 top-1/2 -translate-y-1/2 opacity-0 group-hover/block:opacity-100 transition-all flex flex-col gap-1 z-20">
          <div 
            draggable 
            onDragStart={(e) => handleDragStart(e, block, idx, parentArray)}
            onDragEnd={() => { setDraggedItem(null); setDragOverIdx(null); }}
            className="bg-zinc-700 p-1.5 rounded cursor-grab active:cursor-grabbing hover:bg-red-600 text-[10px] flex items-center justify-center shadow-lg border border-white/10"
            title="Segure para arrastar e soltar em uma aba ou fora dela"
          >
            ⣿
          </div>
          <button onClick={() => moveBlock(parentArray, idx, idx - 1)} className="bg-zinc-800 p-1 rounded hover:bg-red-600 text-[10px]">▲</button>
          <button onClick={() => moveBlock(parentArray, idx, idx + 1)} className="bg-zinc-800 p-1 rounded hover:bg-red-600 text-[10px]">▼</button>
        </div>

        <button 
          onClick={() => {
            parentArray.splice(idx, 1);
            setEditingData({...editingData});
          }}
          className="absolute -right-3 -top-3 bg-red-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs opacity-0 group-hover/block:opacity-100 transition-all z-10"
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
                    block.size = s;
                    setEditingData({...editingData});
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
                block.value = e.target.value;
                setEditingData({...editingData});
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
                    block.size = s;
                    setEditingData({...editingData});
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
                block.url = e.target.value;
                setEditingData({...editingData});
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
                block.caption = e.target.value;
                setEditingData({...editingData});
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
              <div 
                key={tIdx} 
                onDragOver={(e) => handleDragOver(e, `${idx}-${tIdx}`)}
                onDragLeave={() => setDragOverTab(null)}
                onDrop={(e) => handleDrop(e, item.content, item)}
                className={`p-6 rounded-2xl border transition-all space-y-4 ${dragOverTab === `${idx}-${tIdx}` ? 'bg-red-600/20 border-red-600 shadow-lg scale-[1.01]' : 'bg-black/40 border-white/5'}`}
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3 w-1/2">
                    <div 
                      draggable 
                      onDragStart={(e) => handleDragStart(e, item, tIdx, block.items)}
                      onDragEnd={() => { setDraggedItem(null); setDragOverIdx(null); }}
                      className="bg-zinc-800 p-1.5 rounded cursor-grab active:cursor-grabbing hover:bg-red-600 text-[8px] flex items-center justify-center border border-white/5"
                      title="Segure para reordenar esta aba"
                    >
                      ⣿
                    </div>
                    <input 
                      value={item.title}
                      onChange={(e) => {
                        item.title = e.target.value;
                        setEditingData({...editingData});
                      }}
                      className="bg-transparent border-none text-sm font-black uppercase text-zinc-300 outline-none w-full"
                      placeholder="Título da Aba"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => moveBlock(block.items, tIdx, tIdx - 1)} className="text-zinc-600 hover:text-white text-[10px]">▲</button>
                    <button onClick={() => moveBlock(block.items, tIdx, tIdx + 1)} className="text-zinc-600 hover:text-white text-[10px]">▼</button>
                    <button 
                      onClick={() => {
                        block.items.splice(tIdx, 1);
                        setEditingData({...editingData});
                      }}
                      className="text-red-900 hover:text-red-600 text-xs font-black uppercase tracking-widest ml-4"
                    >
                      Remover Aba
                    </button>
                  </div>
                </div>
                
                <div className="space-y-4 pt-4 border-t border-white/5">
                  {!Array.isArray(item.content) && (
                    <div className="text-[10px] text-zinc-600 italic p-2 border border-zinc-800 rounded bg-black/20 mb-4">
                      Conteúdo antigo detectado. Adicione novos blocos para converter.
                    </div>
                  )}
                  {Array.isArray(item.content) && item.content.map((nestedBlock, nIdx) => (
                    renderBlockEditor(nestedBlock, nIdx, item.content, true)
                  ))}
                  
                  {renderAddBlockButtons(item.content, true)}
                </div>
              </div>
            ))}
            <button 
              onClick={() => {
                block.items.push({ title: 'Nova Aba', content: [] });
                setEditingData({...editingData});
              }}
              className="w-full py-3 border-2 border-dashed border-zinc-800 rounded-2xl text-[10px] font-black text-zinc-600 hover:border-zinc-700 hover:text-zinc-400 transition-all uppercase"
            >
              + Adicionar Aba
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col p-8 bg-zinc-950 overflow-hidden relative" onClick={() => setOpenInMenu(null)}>
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
          
          {isEditor && (
            <button
              onClick={handleCreate}
              className="bg-red-600 hover:bg-red-500 text-white px-6 py-2.5 rounded-full font-black uppercase text-[10px] transition-all shadow-lg active:scale-95 flex items-center gap-2"
            >
              <span>+</span> Novo Registro
            </button>
          )}
        </div>
      </div>

      {isMaster && (
        <div className="mb-8 bg-zinc-900/50 p-6 rounded-[2rem] border border-zinc-800 backdrop-blur-sm animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest italic">Gerenciar Editores do Almanaque</h4>
                <p className="text-zinc-500 text-[9px] font-bold uppercase mt-1">Permita que jogadores editem o Almanaque usando seus nomes do Discord.</p>
              </div>
              <button
                onClick={updateAlmanaqueEditors}
                className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-full font-black uppercase text-[9px] transition-all shadow-lg active:scale-95"
              >
                Salvar Editores
              </button>
            </div>
            <textarea
              value={almanaqueEditors}
              onChange={(e) => setAlmanaqueEditors(e.target.value)}
              placeholder="username1, username2..."
              className="w-full bg-black/40 border border-zinc-800 rounded-2xl p-4 text-xs text-white outline-none focus:border-blue-500/50 h-20 resize-none font-mono"
            />
            <p className="text-[8px] text-zinc-600 italic">Separe os nomes por vírgula. O mestre sempre tem permissão.</p>
          </div>
        </div>
      )}

      <div className="flex-1 flex gap-8 overflow-hidden">
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
                {!entry.is_public && isEditor && (
                   <span className="absolute top-2 right-4 text-[8px] font-black text-yellow-500/50 uppercase tracking-tighter">Privado</span>
                )}
                <h3 className={`font-black uppercase text-sm tracking-tight transition-colors ${selectedEntry?.id === entry.id ? 'text-red-500' : 'text-zinc-200 group-hover:text-white'}`}>{entry.title}</h3>
                <p className="text-[10px] text-zinc-500 font-medium line-clamp-2 mt-1 leading-relaxed">{entry.description || "Sem descrição."}</p>
                {selectedEntry?.id === entry.id && ( <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-600" /> )}
              </div>
            ))
          )}
        </div>

        <div className="flex-1 bg-zinc-900/30 rounded-[2rem] border border-zinc-900/50 overflow-hidden flex flex-col relative animate-in fade-in slide-in-from-right-4 duration-700">
          {!selectedEntry && !editingData ? (
            <div className="flex-1 flex items-center justify-center text-zinc-800 flex-col gap-4">
               <div className="text-6xl grayscale opacity-10">📖</div>
               <p className="font-black italic uppercase text-xs tracking-[0.2em]">Selecione um registro para ler</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              <div className="p-8 border-b border-white/5 flex justify-between items-start bg-zinc-900/20">
                <div className="flex-1">
                   {isEditing ? (
                     <div className="space-y-4" onClick={(e) => e.stopPropagation()}>
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
                              <input type="checkbox" checked={editingData.is_public} onChange={(e) => setEditingData({...editingData, is_public: e.target.checked})} className="hidden" />
                              <div className={`w-10 h-5 rounded-full p-1 transition-all ${editingData.is_public ? 'bg-green-600' : 'bg-zinc-800'}`}>
                                 <div className={`w-3 h-3 bg-white rounded-full transition-all ${editingData.is_public ? 'translate-x-5' : 'translate-x-0'}`} />
                              </div>
                              <span className="text-[10px] font-black uppercase text-zinc-500 group-hover:text-zinc-300 transition-colors">{editingData.is_public ? 'Público' : 'Privado'}</span>
                           </label>
                        </div>
                     </div>
                   ) : (
                     <>
                        <div className="flex items-center gap-3 mb-2">
                           <h3 className="text-5xl font-black italic text-red-600 uppercase tracking-tighter">{selectedEntry.title}</h3>
                           {!selectedEntry.is_public && ( <span className="px-2 py-0.5 bg-yellow-500/10 border border-yellow-500/30 text-yellow-500 text-[8px] font-black uppercase rounded tracking-widest">Privado</span> )}
                        </div>
                        <p className="text-zinc-500 font-medium italic text-sm max-w-2xl">{selectedEntry.description}</p>
                     </>
                   )}
                </div>

                {isEditor && (
                  <div className="flex gap-2 shrink-0 ml-4">
                    {isEditing ? (
                      <>
                        <button onClick={handleSave} className="bg-green-600 hover:bg-green-500 text-white px-6 py-2 rounded-full font-black uppercase text-[10px] transition-all shadow-lg active:scale-95">Salvar</button>
                        <button onClick={() => { setIsEditing(false); if (!selectedEntry) setEditingData(null); }} className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-6 py-2 rounded-full font-black uppercase text-[10px] transition-all">Cancelar</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => { setEditingData(selectedEntry); setIsEditing(true); }} className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-full font-black uppercase text-[10px] transition-all flex items-center gap-2 border border-white/5"><span>✎</span> Editar</button>
                        <button onClick={() => handleDelete(selectedEntry.id)} className="bg-zinc-950 hover:bg-red-950 text-red-900 hover:text-red-500 px-4 py-2 rounded-full font-black uppercase text-[10px] transition-all border border-red-900/20">Excluir</button>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-10 bg-zinc-950/20" onClick={(e) => { e.stopPropagation(); setOpenInMenu(null); }}>
                 <div className="max-w-4xl mx-auto space-y-8 pb-20">
                    {isEditing ? (
                      <div 
                        className={`space-y-6 min-h-[400px] transition-all rounded-3xl p-4 ${draggedItem && draggedItem.parentArray !== editingData.content ? 'bg-white/5 border-2 border-dashed border-zinc-800' : ''}`}
                        onDragOver={(e) => handleDragOver(e)}
                        onDrop={(e) => handleDrop(e, editingData.content)}
                      >
                        {editingData.content?.map((block, bIdx) => (
                          renderBlockEditor(block, bIdx, editingData.content)
                        ))}
                        {renderAddBlockButtons(editingData.content)}
                        {draggedItem && draggedItem.parentArray !== editingData.content && (
                          <div className="text-center py-4 text-[10px] font-black uppercase text-zinc-600 animate-pulse">
                            Solte aqui para mover para fora da aba
                          </div>
                        )}
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
                                  {block.caption && ( <p className="text-center text-[10px] font-black uppercase italic tracking-[0.2em] text-zinc-600">{block.caption}</p> )}
                                </div>
                              )}
                              {block.type === 'tabs' && ( <ExpandableSections items={block.items} playSound={playSound} /> )}
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
          <div className={`transition-all duration-500 ease-in-out overflow-hidden ${openIdx === idx ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'}`}>
            <div className="p-8 bg-zinc-900/20 text-zinc-400 text-sm leading-relaxed font-medium border-t border-white/5 space-y-6">
              {Array.isArray(item.content) ? (
                item.content.map((nested, nIdx) => (
                  <div key={nIdx}>
                    {nested.type === 'text' && (
                      <div className={`whitespace-pre-wrap ${
                        nested.size === 'Title' ? 'text-2xl font-black italic uppercase tracking-tighter text-white border-l-3 border-red-600 pl-4 my-4' : 
                        nested.size === 'Subtitle' ? 'text-lg font-bold italic text-red-500/80 mb-2' : ''
                      }`}>
                        {formatText(nested.value)}
                      </div>
                    )}
                    {nested.type === 'image' && (
                      <div className="my-6 space-y-2">
                        <div className={`rounded-2xl overflow-hidden border border-white/5 mx-auto ${
                          nested.size === 'small' ? 'max-w-xs' : 
                          nested.size === 'medium' ? 'max-w-md' : 
                          nested.size === 'large' ? 'max-w-xl' : 'w-full'
                        }`}>
                          <img src={nested.url} className="w-full h-auto" alt={nested.caption} />
                        </div>
                        {nested.caption && ( <p className="text-center text-[9px] font-black uppercase italic text-zinc-600">{nested.caption}</p> )}
                      </div>
                    )}
                    {nested.type === 'tabs' && (
                      <ExpandableSections items={nested.items} playSound={playSound} />
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

function formatText(text) {
  if (!text) return "";
  const boldRegex = /\*\*(.*?)\*\*/g;
  const underlineRegex = /__(.*?)__/g;
  const html = text
    .replace(underlineRegex, '<u class="decoration-gray-200 text-white/80 underline-offset-4 decoration-2">$1</u>')
    .replace(boldRegex, '<strong class="text-white font-black">$1</strong>');
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
