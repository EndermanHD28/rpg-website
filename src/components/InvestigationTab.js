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
  const editingCardIdRef = useRef(null);
  const selectedCardIdsRef = useRef([]);
  const mouseOffset = useRef({ x: 0, y: 0 });

  useEffect(() => { draggingCardRef.current = draggingCard; }, [draggingCard]);
  useEffect(() => { editingCardIdRef.current = editingCardId; }, [editingCardId]);
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
            const isDragging = !!draggingCardRef.current;
            const isSelected = selectedCardIdsRef.current.includes(payload.new.id);
            const isEditing = String(editingCardIdRef.current) === String(payload.new.id);
            
            // Skip update if we are ACTIVELY interacting with this card to prevent jitter/reverting
            if ((isDragging && isSelected) || isEditing) return;
            
            setCards(prev => prev.map(c => String(c.id) === String(payload.new.id) ? { ...c, ...payload.new } : c));
        } else if (payload.eventType === 'DELETE') {
            setCards(prev => prev.filter(c => c.id !== payload.old.id));
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
          setPins(prev => prev.filter(p => p.id !== payload.old.id));
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

  const handleCreateCard = async (type = 'text') => {
    // if (!user) return; // Allow even if user is not yet loaded/logged in
    if (cards.length >= maxCards) {
      showToast(`Limite de ${maxCards} cards atingido no quadro.`);
      playSound('error');
      return;
    }

    const containerRect = containerRef.current.getBoundingClientRect();
    const vx = containerRect.width / 2;
    const vy = containerRect.height / 2;

    // Centro do board na visão atual do player
    const bx = (vx - pan.x) / zoom;
    const by = (vy - pan.y) / zoom;

    const cardWidth = 208;
    const cardHeight = type === 'image' ? 200 : 150;

    // Posição alvo centralizada
    let cx = bx - cardWidth / 2;
    let cy = by - cardHeight / 2;

    // Push para dentro dos limites do board
    cx = Math.max(0, Math.min(cx, BOARD_WIDTH - cardWidth));
    cy = Math.max(0, Math.min(cy, BOARD_HEIGHT - cardHeight));

    // Teleportar a tela para o novo card
    const newPanX = vx - (cx + cardWidth / 2) * zoom;
    const newPanY = vy - (cy + cardHeight / 2) * zoom;
    
    const margin = 200;
    const minX = containerRect.width - (BOARD_WIDTH * zoom) - margin;
    const maxX = margin;
    const minY = containerRect.height - (BOARD_HEIGHT * zoom) - margin;
    const maxY = margin;
    
    setPan({ 
        x: Math.max(minX, Math.min(maxX, newPanX)), 
        y: Math.max(minY, Math.min(maxY, newPanY)) 
    });

    // Adição otimista para ser instantâneo
    const tempId = 'temp-' + Date.now();
    const newCardBase = {
      title: type === 'image' ? '' : 'Nova Evidência',
      content: '',
      x_pos: cx,
      y_pos: cy,
      type: type,
      image_url: type === 'image' ? '' : null,
      image_scale: type === 'image' ? 1.3 : 1.0
    };

    // REMOVE player_id entirely from insert to see if it fixes the 409
    // It should be nullable in DB anyway
    // if (user?.id) newCardBase.player_id = user.id;

    setCards(prev => [...prev, { ...newCardBase, id: tempId }]);
    setEditingCardId(tempId);
    playSound('random_button');

    const { data, error } = await supabase.from('investigation_cards').insert([newCardBase]).select().single();

    if (error) {
        showToast("Erro ao criar card.");
        setCards(prev => prev.filter(c => c.id !== tempId));
        if (editingCardId === tempId) setEditingCardId(null);
    } else if (data) {
        setCards(prev => prev.map(c => c.id === tempId ? data : c));
        setEditingCardId(data.id);
    }
  };

  const updateCardPositions = async (updates) => {
    if (updates.length === 0) return;
    await Promise.all(updates.map(u => 
      supabase.from('investigation_cards').update({ x_pos: u.x_pos, y_pos: u.y_pos }).eq('id', u.id)
    ));
  };

  const updateCardContent = async (id, title, content, imageUrl, imageScale) => {
    // We update local state immediately for the user who edited,
    // and send only the changed fields to Supabase.
    const updates = {};
    if (title !== undefined) updates.title = title;
    if (content !== undefined) updates.content = content;
    if (imageUrl !== undefined) updates.image_url = imageUrl;
    if (imageScale !== undefined) updates.image_scale = imageScale;
    
    console.log('Pushing updates to Supabase:', id, updates);
    const { error } = await supabase.from('investigation_cards').update(updates).eq('id', id);
    if (error) {
        console.error('Error updating card:', error);
        showToast("Erro ao salvar alterações.");
    }
  };

  const updateCardScale = async (id, scale) => {
    await supabase.from('investigation_cards').update({ image_scale: scale }).eq('id', id);
  };

  const handleDeleteCard = async (id) => {
    await supabase.from('investigation_cards').delete().match({ id });
  };

  const togglePin = async (cardId) => {
    if (!pinningFrom) {
      setPinningFrom(cardId);
      showToast("Modo de Fixação: Clique em outro card para conectar.");
    } else {
      const fromId = pinningFrom;
      setPinningFrom(null);

      if (fromId === cardId) return;

      const exists = pins.find(p => 
        (p.from_card_id === fromId && p.to_card_id === cardId) ||
        (p.from_card_id === cardId && p.to_card_id === fromId)
      );

      if (exists) {
        await supabase.from('investigation_pins').delete().match({ id: exists.id });
      } else {
        await supabase.from('investigation_pins').insert({
          from_card_id: fromId,
          to_card_id: cardId
        });
      }
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

      // If we click a different card while editing, save the old one
      if (editingCardId && editingCardId !== cardId) {
          const oldCard = cards.find(c => c.id === editingCardId);
          if (oldCard) {
              updateCardContent(oldCard.id, oldCard.title, oldCard.content, oldCard.image_url);
          }
      }

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
    if (editingCardId && !pinningFrom) {
        const card = cards.find(c => c.id === editingCardId);
        if (card) {
            updateCardContent(card.id, card.title, card.content, card.image_url);
        }
        setEditingCardId(null);
    }
    
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
              const isImage = c.type === 'image';
              const cardScale = isImage ? (c.image_scale || 1.3) : 1.0;
              const currentCardWidth = 208 * cardScale;
              const currentCardHeight = isImage ? (200 * cardScale) : 100;
              nx = Math.max(0, Math.min(nx, BOARD_WIDTH - currentCardWidth));
              ny = Math.max(0, Math.min(ny, BOARD_HEIGHT - currentCardHeight));
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
      
      // If we were editing a card and started panning (clicked board), save and close
      if (editingCardId) {
          const card = cards.find(c => c.id === editingCardId);
          if (card) {
              updateCardContent(card.id, card.title, card.content, card.image_url);
          }
          setEditingCardId(null);
      }
    } else if (isSelecting) {
      const boardX = (mouseX - pan.x) / zoom;
      const boardY = (mouseY - pan.y) / zoom;
      setSelectionBox(prev => ({ ...prev, x2: boardX, y2: boardY }));
      const xMin = Math.min(selectionBox.x1, boardX);
      const xMax = Math.max(selectionBox.x1, boardX);
      const yMin = Math.min(selectionBox.y1, boardY);
      const yMax = Math.max(selectionBox.y1, boardY);
      const inBox = cards.filter(c => {
          const isImage = c.type === 'image';
          const cardScale = isImage ? (c.image_scale || 1.3) : 1.0;
          const cardWidth = 208 * cardScale;
          const cardHeight = isImage ? (200 * cardScale) : 150;
          return c.x_pos < xMax && c.x_pos + cardWidth > xMin &&
                 c.y_pos < yMax && c.y_pos + cardHeight > yMin;
      }).map(c => c.id);
      setSelectedCardIds(inBox);
    }
  };

  const onMouseUp = () => {
    if (draggingCard) {
      const movedCards = cards.filter(c => selectedCardIds.includes(c.id));
      // Only include id, x_pos, y_pos in updates to prevent overwriting other fields (like image_url)
      // with stale local data during a move.
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
          if (card.player_id === user?.id || isMaster || true) {
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

      const fromIsImage = from.type === 'image';
      const fromScale = fromIsImage ? (from.image_scale || 1.3) : 1.0;
      const fromWidth = 208 * fromScale;

      const toIsImage = to.type === 'image';
      const toScale = toIsImage ? (to.image_scale || 1.3) : 1.0;
      const toWidth = 208 * toScale;

      const x1 = from.x_pos + (fromWidth / 2) + SVG_PADDING;
      const y1 = from.y_pos + 10 + SVG_PADDING;
      const x2 = to.x_pos + (toWidth / 2) + SVG_PADDING;
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
                onClick={() => handleCreateCard('text')}
                className="bg-zinc-800 hover:bg-zinc-700 text-white px-6 py-3 rounded-full font-black uppercase text-[10px] transition-all shadow-lg"
            >
                + Card de Texto
            </button>
            <button
                onClick={() => handleCreateCard('image')}
                className="bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-full font-black uppercase text-[10px] transition-all shadow-lg"
            >
                + Adicionar Imagem
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
                const isImage = card.type === 'image';
                const cardScale = isImage ? (card.image_scale || 1.3) : 1.0;
                const baseWidth = 208;
                const actualWidth = baseWidth * cardScale;

                return (
                    <div
                        key={card.id}
                        data-id={card.id}
                        style={{ 
                            left: card.x_pos, 
                            top: card.y_pos,
                            width: actualWidth,
                            zIndex: (draggingCard?.id === card.id || isSelected) ? 50 : 10,
                            cursor: pinningFrom ? 'crosshair' : (draggingCard ? 'grabbing' : 'grab')
                        }}
                        className={`investigation-card absolute bg-zinc-100 ${isImage ? 'p-2' : 'p-4'} shadow-xl border-t-8 border-red-900/20 group pointer-events-auto transition-[box-shadow,background-color,filter,ring] duration-200
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

                        {isImage && isEditing && (
                            <div className="absolute top-2 left-2 z-50">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const newScale = card.image_scale >= 2 ? 0.75 : card.image_scale + 0.25;
                                                const roundedScale = Math.round(newScale * 100) / 100;
                                                // Optimistic update
                                                setCards(prev => prev.map(c => c.id === card.id ? { ...c, image_scale: roundedScale } : c));
                                                // Deferred update to Supabase
                                                updateCardScale(card.id, roundedScale);
                                            }}
                                            className="w-8 h-8 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg flex items-center justify-center text-[10px] font-black shadow-lg border border-zinc-600 transition-all active:scale-95"
                                            title="Resize Image"
                                        >
                                            {card.image_scale}x
                                        </button>
                            </div>
                        )}

                        <div className={`space-y-3 pt-2 relative z-20 ${isEditing ? 'select-text' : 'pointer-events-none select-none'}`}>
                            {(isEditing || !isImage || card.title) && (
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
                                    onBlur={() => { updateCardContent(card.id, card.title, card.content, card.image_url); }}
                                    placeholder={isImage ? "Título (opcional)..." : "Título..."}
                                    className={`w-full bg-transparent border-none text-zinc-900 font-black uppercase text-[12px] outline-none placeholder:text-zinc-400 resize-none overflow-hidden ${isEditing ? 'cursor-text' : 'cursor-inherit'}`}
                                />
                            )}

                            {isImage ? (
                                <div className="space-y-2">
                                    {isEditing && (
                                            <input
                                                type="text"
                                                value={card.image_url || ''}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setCards(prev => prev.map(c => c.id === card.id ? { ...c, image_url: val } : c));
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        updateCardContent(card.id, card.title, card.content, card.image_url);
                                                        setEditingCardId(null);
                                                    }
                                                }}
                                                onBlur={() => { updateCardContent(card.id, card.title, card.content, card.image_url); }}
                                                placeholder="Link da imagem (Imgur)..."
                                                className="w-full bg-zinc-200/50 border border-zinc-300 rounded px-2 py-1 text-[9px] font-bold text-zinc-800 outline-none placeholder:text-zinc-400"
                                            />
                                    )}
                                    <div 
                                        className="w-full bg-zinc-200 rounded overflow-hidden border border-zinc-900/10 relative group/img flex items-center justify-center p-0.5"
                                        style={{ minHeight: '80px' }}
                                    >
                                        {card.image_url ? (
                                            <img 
                                                src={card.image_url} 
                                                alt={card.title} 
                                                className="w-full h-auto object-contain transition-transform group-hover/img:scale-105"
                                                style={{ 
                                                    minWidth: '80px',
                                                    minHeight: '80px',
                                                    maxHeight: 'calc(208px * 2 * 2)', // Limit based on max card width ratio
                                                    aspectRatio: 'auto'
                                                }}
                                                onError={(e) => { e.target.src = 'https://via.placeholder.com/400x225?text=Erro+no+Link'; }}
                                            />
                                        ) : (
                                            <div className="w-full h-20 flex items-center justify-center text-zinc-400 text-[10px] font-black uppercase italic p-4 text-center">
                                                Sem Imagem
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
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
                                    onBlur={() => { updateCardContent(card.id, card.title, card.content, card.image_url); }}
                                    placeholder="Escreva aqui..."
                                    className={`w-full bg-transparent border-none text-zinc-700 font-bold text-[10px] leading-tight outline-none resize-none placeholder:text-zinc-300 overflow-hidden ${isEditing ? 'cursor-text' : 'cursor-inherit'}`}
                                />
                            )}
                        </div>

                        {(card.player_id === user?.id || isMaster || true) && (
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
                        
                        {!isImage && (
                            <>
                                <div className="absolute -bottom-1 left-4 right-4 h-[1px] bg-zinc-300 opacity-30" />
                                <div className="mt-4 text-[8px] text-zinc-400 font-bold italic uppercase flex justify-between items-center border-t border-zinc-200 pt-2 pointer-events-none">
                                    <span>{card.player_id === user?.id ? 'VOCÊ' : 'OUTRO'}</span>
                                    <span>ID: {card.id.slice(0, 4)}</span>
                                </div>
                            </>
                        )}
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
