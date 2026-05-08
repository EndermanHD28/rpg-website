"use client";
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { TooltipWrapper } from './UIElements';

export default function InvestigationTab({ user, isMaster, showToast, playSound }) {
  const [cards, setCards] = useState([]);
  const [pins, setPins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pinningFrom, setPinningFrom] = useState(null);
  const [maxCards, setMaxCards] = useState(20);
  
  // Interaction State
  const [draggingCard, setDraggingCard] = useState(null);
  const [selectedCardIds, setSelectedCardIds] = useState([]);
  const [isPanning, setIsPanning] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionBox, setSelectionBox] = useState(null);
  const [editingCardId, setEditingCardId] = useState(null);
  
  // View State
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  
  // Internal Refs
  const containerRef = useRef(null);
  const textareaRefs = useRef({});
  const titleRefs = useRef({});
  const draggingCardRef = useRef(null);
  const selectedCardIdsRef = useRef([]);
  const mouseOffset = useRef({ x: 0, y: 0 });

  useEffect(() => { draggingCardRef.current = draggingCard; }, [draggingCard]);
  useEffect(() => { selectedCardIdsRef.current = selectedCardIds; }, [selectedCardIds]);

  // Constants
  const BOARD_WIDTH = 5200;
  const BOARD_HEIGHT = 3400;
  const BOARD_CENTER_X = BOARD_WIDTH / 2;
  const BOARD_CENTER_Y = BOARD_HEIGHT / 2;
  const SVG_PADDING = 5000;

  // Auto-resize textareas and titles
  useEffect(() => {
    cards.forEach(card => {
      // Content Resize
      const el = textareaRefs.current[card.id];
      if (el) {
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 400) + 'px'; // ~25 lines max visual
      }
      // Title Resize
      const titleEl = titleRefs.current[card.id];
      if (titleEl) {
          titleEl.style.height = 'auto';
          titleEl.style.height = titleEl.scrollHeight + 'px';
      }
    });
  }, [cards, zoom, editingCardId]);

  // Initial Pan to Center
  useEffect(() => {
    if (containerRef.current && !loading) {
        const rect = containerRef.current.getBoundingClientRect();
        setPan({
            x: rect.width / 2 - BOARD_CENTER_X,
            y: rect.height / 2 - BOARD_CENTER_Y
        });
    }
  }, [loading]);

  // Fetch and Realtime Data
  useEffect(() => {
    const fetchData = async () => {
      const { data: cardsData } = await supabase.from('investigation_cards').select('*');
      const { data: pinsData } = await supabase.from('investigation_pins').select('*');
      const { data: globalData } = await supabase.from('global').select('investigation_max_cards').eq('id', 1).maybeSingle();
      
      setCards(cardsData || []);
      setPins(pinsData || []);
      if (globalData?.investigation_max_cards) setMaxCards(globalData.investigation_max_cards);
      setLoading(false);
    };

    fetchData();

    const channel = supabase.channel('investigation_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'investigation_cards' }, (payload) => {
        if (payload.eventType === 'INSERT') {
            setCards(prev => {
                if (prev.find(c => c.id === payload.new.id)) return prev;
                return [...prev, payload.new];
            });
        } else if (payload.eventType === 'UPDATE') {
            if (draggingCardRef.current && payload.new.id === draggingCardRef.current.id) return;
            if (selectedCardIdsRef.current.includes(payload.new.id)) return;
            setCards(prev => prev.map(c => c.id === payload.new.id ? payload.new : c));
        } else if (payload.eventType === 'DELETE') {
            setCards(prev => prev.filter(c => c.id === payload.old.id));
            setSelectedCardIds(prev => prev.filter(id => id !== payload.old.id));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'investigation_pins' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setPins(prev => {
            if (prev.find(p => p.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });
        } else if (payload.eventType === 'DELETE') {
          setPins(prev => prev.filter(p => p.id === payload.old.id));
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'global' }, (payload) => {
          if (payload.new.investigation_max_cards !== undefined) {
              setMaxCards(payload.new.investigation_max_cards);
          }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const updateMaxCards = async (val) => {
      const num = parseInt(val);
      if (isNaN(num)) return;
      setMaxCards(num);
      await supabase.from('global').update({ investigation_max_cards: num }).eq('id', 1);
  };

  const handleCreateCard = async () => {
    if (!user) return;
    if (cards.length >= maxCards) {
      showToast(`Limite de ${maxCards} cards atingido no quadro.`);
      playSound('error');
      return;
    }
    const { data, error } = await supabase.from('investigation_cards').insert({
      player_id: user.id,
      title: 'Nova Evidência',
      content: '',
      x_pos: BOARD_CENTER_X - 100,
      y_pos: BOARD_CENTER_Y - 75
    }).select().single();
    if (error) showToast("Erro ao criar card.");
    else {
      if (data) {
          setCards(prev => [...prev, data]);
          setEditingCardId(data.id);
      }
      playSound('random_button');
    }
  };

  const updateCardPositions = async (updates) => {
    if (updates.length === 0) return;
    await Promise.all(updates.map(u => 
      supabase.from('investigation_cards').update({ x_pos: u.x_pos, y_pos: u.y_pos }).eq('id', u.id)
    ));
  };

  const updateCardContent = async (id, title, content) => {
    await supabase.from('investigation_cards').update({ title, content }).eq('id', id);
  };

  const handleDeleteCard = async (id) => {
    const { error } = await supabase.from('investigation_cards').delete().eq('id', id);
    if (error) showToast("Erro ao deletar card.");
    else {
      setCards(prev => prev.filter(c => c.id !== id));
      setPins(prev => prev.filter(p => p.from_card_id !== id && p.to_card_id !== id));
    }
  };

  const togglePin = async (cardId) => {
    if (!pinningFrom) {
      setPinningFrom(cardId);
      showToast("Modo de Fixação: Clique em outro card para conectar.");
    } else {
      if (pinningFrom === cardId) {
        setPinningFrom(null);
        return;
      }
      const exists = pins.some(p => 
        (p.from_card_id === pinningFrom && p.to_card_id === cardId) ||
        (p.from_card_id === cardId && p.to_card_id === pinningFrom)
      );
      if (exists) {
        const pinToDelete = pins.find(p => 
          (p.from_card_id === pinningFrom && p.to_card_id === cardId) ||
          (p.from_card_id === cardId && p.to_card_id === pinningFrom)
        );
        const { error } = await supabase.from('investigation_pins').delete().eq('id', pinToDelete.id);
        if (!error) setPins(prev => prev.filter(p => p.id !== pinToDelete.id));
      } else {
        const { data, error } = await supabase.from('investigation_pins').insert({
          from_card_id: pinningFrom,
          to_card_id: cardId
        }).select().single();
        if (!error && data) setPins(prev => [...prev, data]);
      }
      setPinningFrom(null);
    }
  };

  const onMouseDown = (e) => {
    const containerRect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - containerRect.left;
    const mouseY = e.clientY - containerRect.top;

    const clickedCardElement = e.target.closest('.investigation-card');
    if (clickedCardElement) {
      const cardId = clickedCardElement.dataset.id;
      const card = cards.find(c => c.id === cardId);
      
      if (e.target.closest('.pin-button') || e.target.closest('.delete-button') || e.target.closest('.edit-button')) return;

      const isTopBar = e.target.closest('.card-top-bar');
      const isShiftOrCtrl = e.shiftKey || e.metaKey || e.ctrlKey;
      
      if (isShiftOrCtrl) {
          setSelectedCardIds(prev => {
              if (prev.includes(cardId)) return prev.filter(id => id !== cardId);
              return [...prev, cardId];
          });
      } else {
          if (editingCardId === cardId) {
              if (!isTopBar) return;
          } else {
              setEditingCardId(null);
              if (!selectedCardIds.includes(cardId)) {
                  setSelectedCardIds([cardId]);
              }
          }
      }

      setDraggingCard(card);
      mouseOffset.current = { x: mouseX / zoom - card.x_pos, y: mouseY / zoom - card.y_pos };
      return;
    }

    // Board Interaction (Panning while pinning now possible)
    if (!pinningFrom) setEditingCardId(null);
    
    if (e.button === 1 || (e.button === 0 && (e.spaceKey || e.altKey))) {
        setIsPanning(true);
        mouseOffset.current = { x: mouseX - pan.x, y: mouseY - pan.y };
    } else if (e.button === 0) {
        if (e.shiftKey || e.metaKey || e.ctrlKey) {
            setIsSelecting(true);
            const boardX = (mouseX - pan.x) / zoom;
            const boardY = (mouseY - pan.y) / zoom;
            setSelectionBox({ x1: boardX, y1: boardY, x2: boardX, y2: boardY });
        } else {
            setIsPanning(true);
            mouseOffset.current = { x: mouseX - pan.x, y: mouseY - pan.y };
            if (!pinningFrom) setSelectedCardIds([]);
        }
    }
  };

  const onMouseMove = (e) => {
    const containerRect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - containerRect.left;
    const mouseY = e.clientY - containerRect.top;

    if (draggingCard) {
      const currentX = mouseX / zoom - mouseOffset.current.x;
      const currentY = mouseY / zoom - mouseOffset.current.y;
      const dx = currentX - draggingCardRef.current.x_pos;
      const dy = currentY - draggingCardRef.current.y_pos;
      if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
          setCards(prev => prev.map(c => {
            if (selectedCardIdsRef.current.includes(c.id)) {
              let nx = c.x_pos + dx;
              let ny = c.y_pos + dy;
              nx = Math.max(0, Math.min(nx, BOARD_WIDTH - 208));
              ny = Math.max(0, Math.min(ny, BOARD_HEIGHT - 100));
              return { ...c, x_pos: nx, y_pos: ny };
            }
            return c;
          }));
          draggingCardRef.current = { ...draggingCardRef.current, x_pos: currentX, y_pos: currentY };
      }
    } else if (isPanning) {
      const nx = mouseX - mouseOffset.current.x;
      const ny = mouseY - mouseOffset.current.y;
      const margin = 200;
      const minX = containerRect.width - (BOARD_WIDTH * zoom) - margin;
      const maxX = margin;
      const minY = containerRect.height - (BOARD_HEIGHT * zoom) - margin;
      const maxY = margin;
      setPan({ x: Math.max(minX, Math.min(maxX, nx)), y: Math.max(minY, Math.min(maxY, ny)) });
    } else if (isSelecting) {
      const boardX = (mouseX - pan.x) / zoom;
      const boardY = (mouseY - pan.y) / zoom;
      setSelectionBox(prev => ({ ...prev, x2: boardX, y2: boardY }));
      const xMin = Math.min(selectionBox.x1, boardX);
      const xMax = Math.max(selectionBox.x1, boardX);
      const yMin = Math.min(selectionBox.y1, boardY);
      const yMax = Math.max(selectionBox.y1, boardY);
      const inBox = cards.filter(c => {
          const cardWidth = 208;
          const cardHeight = 150;
          return c.x_pos < xMax && c.x_pos + cardWidth > xMin &&
                 c.y_pos < yMax && c.y_pos + cardHeight > yMin;
      }).map(c => c.id);
      setSelectedCardIds(inBox);
    }
  };

  const onMouseUp = () => {
    if (draggingCard) {
      const movedCards = cards.filter(c => selectedCardIds.includes(c.id));
      updateCardPositions(movedCards.map(c => ({ id: c.id, x_pos: c.x_pos, y_pos: c.y_pos })));
      setDraggingCard(null);
    }
    setIsPanning(false);
    setIsSelecting(false);
    setSelectionBox(null);
  };

  const onDoubleClick = (e) => {
      const clickedCardElement = e.target.closest('.investigation-card');
      if (clickedCardElement) {
          if (e.target.closest('.pin-button')) return;
          const cardId = clickedCardElement.dataset.id;
          const card = cards.find(c => c.id === cardId);
          if (card.player_id === user?.id || isMaster) {
            setEditingCardId(cardId);
          }
      }
  };

  const onWheel = (e) => {
    e.preventDefault();
    const containerRect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - containerRect.left;
    const mouseY = e.clientY - containerRect.top;
    const zoomSpeed = 0.001;
    const delta = -e.deltaY;
    const newZoom = Math.max(0.25, Math.min(1.4, zoom + delta * zoomSpeed));
    const zoomRatio = newZoom / zoom;
    let nx = mouseX - (mouseX - pan.x) * zoomRatio;
    let ny = mouseY - (mouseY - pan.y) * zoomRatio;
    const margin = 200;
    const minX = containerRect.width - (BOARD_WIDTH * newZoom) - margin;
    const maxX = margin;
    const minY = containerRect.height - (BOARD_HEIGHT * newZoom) - margin;
    const maxY = margin;
    setPan({ x: Math.max(minX, Math.min(maxX, nx)), y: Math.max(minY, Math.min(maxY, ny)) });
    setZoom(newZoom);
  };

  const renderLines = () => {
    return pins.map(pin => {
      const from = cards.find(c => c.id === pin.from_card_id);
      const to = cards.find(c => c.id === pin.to_card_id);
      if (!from || !to) return null;
      const x1 = from.x_pos + 104 + SVG_PADDING;
      const y1 = from.y_pos + 10 + SVG_PADDING;
      const x2 = to.x_pos + 104 + SVG_PADDING;
      const y2 = to.y_pos + 10 + SVG_PADDING;
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2 + 50;
      return (
        <path
          key={pin.id}
          d={`M ${x1} ${y1} Q ${midX} ${midY} ${x2} ${y2}`}
          stroke="rgba(220, 38, 38, 0.8)"
          strokeWidth={2.5 / zoom}
          fill="none"
          className="pointer-events-none"
        />
      );
    });
  };

  if (loading) return <div className="p-8 text-zinc-500 font-black italic uppercase">Carregando Quadro...</div>;

  return (
    <div className="h-full flex flex-col p-8 overflow-hidden bg-zinc-950 select-none">
      <style>{`
        .pin-active-ring {
            box-shadow: 0 0 0 4px rgba(220, 38, 38, 0.6);
            animation: custom-pulse-slow 4s infinite;
        }
        @keyframes custom-pulse-slow {
            0% { box-shadow: 0 0 0 0px rgba(220, 38, 38, 0.8); }
            100% { box-shadow: 0 0 0 20px rgba(220, 38, 38, 0); }
        }
      `}</style>
      <div className="flex justify-between items-center mb-8 bg-zinc-950/80 p-6 rounded-2xl border border-zinc-800 backdrop-blur-sm z-10">
        <div>
          <h2 className="text-4xl font-black italic text-red-600 uppercase tracking-tighter">Investigação</h2>
          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mt-1">
            Dois Cliques para Editar • SHIFT + Arrastar para selecionar
          </p>
        </div>
        <div className="flex gap-4 items-center">
            {isMaster && (
                <div className="flex items-center gap-2 bg-zinc-900 px-4 py-2 rounded-full border border-zinc-800">
                    <span className="text-[9px] font-black text-zinc-500 uppercase">Máx Cards:</span>
                    <input 
                        type="number" 
                        value={maxCards} 
                        onChange={(e) => updateMaxCards(e.target.value)}
                        className="bg-transparent border-none text-white font-black w-8 text-center outline-none text-xs"
                    />
                </div>
            )}
            <button onClick={() => { 
                const rect = containerRef.current.getBoundingClientRect();
                setZoom(1); 
                setPan({ x: rect.width / 2 - BOARD_CENTER_X, y: rect.height / 2 - BOARD_CENTER_Y }); 
            }} className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 py-3 rounded-full font-black uppercase text-[10px] transition-all">Reset View</button>
            <button
                onClick={handleCreateCard}
                className="bg-red-600 hover:bg-red-500 text-white px-8 py-3 rounded-full font-black uppercase text-xs transition-all shadow-lg"
            >
                + Adicionar Card
            </button>
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
        onDoubleClick={onDoubleClick}
      >
        <div 
            style={{ 
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: '0 0',
                width: BOARD_WIDTH,
                height: BOARD_HEIGHT,
                backgroundImage: 'url("https://www.transparenttextures.com/patterns/cork-board.png")',
                backgroundColor: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.1)'
            }}
            className="absolute inset-0 pointer-events-none"
        >
            <svg className="absolute pointer-events-none z-[100]" style={{ width: SVG_PADDING * 2, height: SVG_PADDING * 2, top: -SVG_PADDING, left: -SVG_PADDING }}>
                {renderLines()}
            </svg>

            {cards.map(card => {
                const isSelected = selectedCardIds.includes(card.id);
                const isEditing = editingCardId === card.id;
                const showSelectionVisual = isSelected && (selectedCardIds.length > 1 || isSelecting);

                return (
                    <div
                        key={card.id}
                        data-id={card.id}
                        style={{ 
                            left: card.x_pos, 
                            top: card.y_pos,
                            zIndex: (draggingCard?.id === card.id || isSelected) ? 50 : 10,
                            cursor: pinningFrom ? 'crosshair' : (draggingCard ? 'grabbing' : 'grab')
                        }}
                        className={`investigation-card absolute w-52 bg-zinc-100 p-4 shadow-xl border-t-8 border-red-900/20 group pointer-events-auto transition-[box-shadow,background-color,filter,ring] duration-200
                            ${pinningFrom === card.id ? 'ring-4 ring-red-600' : ''}
                            ${showSelectionVisual ? 'ring-[6px] ring-blue-500/80 shadow-blue-500/40 brightness-[0.85] !bg-blue-50' : ''}`}
                    >
                        <div className="card-top-bar absolute -top-8 left-0 right-0 h-13 cursor-grab active:cursor-grabbing z-30" />

                        {isEditing && (
                            <div className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none z-50">
                                <span className="text-white text-[10px] font-black uppercase italic animate-pulse tracking-widest bg-red-600/80 px-3 py-1 rounded-full shadow-lg">
                                    Editando...
                                </span>
                            </div>
                        )}

                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-40">
                            <button
                                onClick={(e) => { e.stopPropagation(); togglePin(card.id); }}
                                className={`pin-button w-6 h-6 rounded-full border-2 border-zinc-400 flex items-center justify-center transition-all ${pinningFrom === card.id ? 'bg-red-600 border-red-400 pin-active-ring scale-110' : 'bg-red-800 hover:scale-110'}`}
                            >
                                <div className="w-1.5 h-1.5 bg-white rounded-full shadow-inner" />
                            </button>
                        </div>

                        <div className={`space-y-3 pt-2 relative z-20 ${isEditing ? 'select-text' : 'pointer-events-none select-none'}`}>
                            <textarea
                                ref={el => titleRefs.current[card.id] = el}
                                value={card.title}
                                readOnly={!isEditing}
                                rows="1"
                                onChange={(e) => {
                                    const val = e.target.value;
                                    const lines = val.split('\n').length;
                                    if (lines <= 3) {
                                        setCards(prev => prev.map(c => c.id === card.id ? { ...c, title: val } : c));
                                    }
                                }}
                                onBlur={() => { updateCardContent(card.id, card.title, card.content); }}
                                placeholder="Título..."
                                className={`w-full bg-transparent border-none text-zinc-900 font-black uppercase text-[12px] outline-none placeholder:text-zinc-400 resize-none overflow-hidden ${isEditing ? 'cursor-text' : 'cursor-inherit'}`}
                            />
                            <textarea
                                ref={el => textareaRefs.current[card.id] = el}
                                value={card.content}
                                readOnly={!isEditing}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    const lines = val.split('\n').length;
                                    if (lines <= 25) {
                                        setCards(prev => prev.map(c => c.id === card.id ? { ...c, content: val } : c));
                                    }
                                }}
                                onBlur={() => { updateCardContent(card.id, card.title, card.content); }}
                                placeholder="Escreva aqui..."
                                className={`w-full bg-transparent border-none text-zinc-700 font-bold text-[10px] leading-tight outline-none resize-none placeholder:text-zinc-300 overflow-hidden ${isEditing ? 'cursor-text' : 'cursor-inherit'}`}
                            />
                        </div>

                        {(card.player_id === user?.id || isMaster) && (
                            <div className="absolute -bottom-2 -right-2 flex gap-1 z-40">
                                {!isEditing && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setEditingCardId(card.id); }}
                                        className="edit-button w-6 h-6 bg-zinc-800 hover:bg-blue-600 text-white rounded-full flex items-center justify-center text-[10px] transition-all shadow-lg opacity-0 group-hover:opacity-100"
                                    >
                                        ✎
                                    </button>
                                )}
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDeleteCard(card.id); }}
                                    className="delete-button w-6 h-6 bg-zinc-800 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-[10px] transition-all shadow-lg opacity-0 group-hover:opacity-100"
                                >
                                    ×
                                </button>
                            </div>
                        )}
                        
                        <div className="absolute -bottom-1 left-4 right-4 h-[1px] bg-zinc-300 opacity-30" />
                        <div className="mt-4 text-[8px] text-zinc-400 font-bold italic uppercase flex justify-between items-center border-t border-zinc-200 pt-2 pointer-events-none">
                            <span>{card.player_id === user?.id ? 'VOCÊ' : 'OUTRO'}</span>
                            <span>ID: {card.id.slice(0, 4)}</span>
                        </div>
                    </div>
                );
            })}

            {isSelecting && selectionBox && (
                <div 
                    className="absolute border border-blue-500 bg-blue-500/10 pointer-events-none"
                    style={{
                        left: Math.min(selectionBox.x1, selectionBox.x2),
                        top: Math.min(selectionBox.y1, selectionBox.y2),
                        width: Math.abs(selectionBox.x2 - selectionBox.x1),
                        height: Math.abs(selectionBox.y2 - selectionBox.y1),
                        zIndex: 1000
                    }}
                />
            )}
        </div>
      </div>
    </div>
  );
}
