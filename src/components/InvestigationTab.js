"use client";
import { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import { supabase } from '../lib/supabase';
import { TooltipWrapper } from './UIElements';

export default function InvestigationTab({ user, isMaster, showToast, playSound }) {
  const [categories, setCategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
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
  const [isExporting, setIsExporting] = useState(false);

  // Category Management State
  const [isManagingCategories, setIsManagingCategories] = useState(false);
  
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
      // Description Resize (for images)
      const descEl = textareaRefs.current[`desc-${card.id}`];
      if (descEl) {
        descEl.style.height = 'auto';
        descEl.style.height = Math.min(descEl.scrollHeight, 300) + 'px';
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
      // Fetch Categories
      const { data: catsData } = await supabase
        .from('investigation_categories')
        .select('*')
        .order('display_order', { ascending: true });
      
      const cats = catsData || [];
      setCategories(cats);
      
      // Default selection to first category or 'Default'
      if (cats.length > 0) {
        setSelectedCategoryId(cats[0].id);
        setMaxCards(cats[0].max_cards || 20);
      }

      const { data: cardsData } = await supabase.from('investigation_cards').select('*');
      const { data: pinsData } = await supabase.from('investigation_pins').select('*');
      
      setCards(cardsData || []);
      setPins(pinsData || []);
      setLoading(false);
    };

    fetchData();

    const channel = supabase.channel('investigation_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'investigation_categories' }, (payload) => {
          if (payload.eventType === 'INSERT') {
              setCategories(prev => [...prev, payload.new].sort((a, b) => a.display_order - b.display_order));
          } else if (payload.eventType === 'UPDATE') {
              setCategories(prev => prev.map(c => String(c.id) === String(payload.new.id) ? payload.new : c).sort((a, b) => a.display_order - b.display_order));
              if (String(selectedCategoryId) === String(payload.new.id)) {
                  setMaxCards(payload.new.max_cards);
              }
          } else if (payload.eventType === 'DELETE') {
              setCategories(prev => prev.filter(c => String(c.id) !== String(payload.old.id)));
              if (String(selectedCategoryId) === String(payload.old.id)) {
                  setSelectedCategoryId(null);
              }
          }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'investigation_cards' }, (payload) => {
        if (payload.eventType === 'INSERT') {
            setCards(prev => {
                if (prev.find(c => String(c.id) === String(payload.new.id))) return prev;
                return [...prev, payload.new];
            });
        } else if (payload.eventType === 'UPDATE') {
            const isDragging = !!draggingCardRef.current;
            const isSelected = selectedCardIdsRef.current.includes(payload.new.id);
            const isEditing = String(editingCardIdRef.current) === String(payload.new.id);
            
            // Only skip update if the current user is the one actively dragging THIS card
            if ((isDragging && isSelected && String(draggingCardRef.current?.id) === String(payload.new.id)) || isEditing) return;
            
            setCards(prev => prev.map(c => String(c.id) === String(payload.new.id) ? { ...c, ...payload.new } : c));
        } else if (payload.eventType === 'DELETE') {
            setCards(prev => prev.filter(c => String(c.id) !== String(payload.old.id)));
            setSelectedCardIds(prev => prev.filter(id => String(id) !== String(payload.old.id)));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'investigation_pins' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setPins(prev => {
            if (prev.find(p => String(p.id) === String(payload.new.id))) return prev;
            return [...prev, payload.new];
          });
        } else if (payload.eventType === 'DELETE') {
          setPins(prev => prev.filter(p => String(p.id) !== String(payload.old.id)));
        }
      })
      .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
              console.log("Investigation Realtime Subscribed");
          }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const currentCategoryCards = cards.filter(c => c.category_id === selectedCategoryId);

  const updateMaxCards = async (catId, val) => {
      const num = parseInt(val) || 0;
      setCategories(prev => prev.map(c => c.id === catId ? { ...c, max_cards: num } : c));
      if (catId === selectedCategoryId) setMaxCards(num);
      await supabase.from('investigation_categories').update({ max_cards: num }).eq('id', catId);
  };

  const handleCreateCategory = async () => {
    const newCat = {
        name: 'Nova Categoria',
        max_cards: 20,
        display_order: categories.length
    };
    const { data } = await supabase.from('investigation_categories').insert(newCat).select().single();
    if (data) {
        setCategories(prev => [...prev, data].sort((a, b) => a.display_order - b.display_order));
        setSelectedCategoryId(data.id);
        setMaxCards(data.max_cards);
    }
  };

  const handleDeleteCategory = async (id) => {
      if (categories.length <= 1) {
          showToast("Você não pode deletar a última categoria.");
          return;
      }
      if (confirm("Tem certeza? Todos os cards desta categoria serão deletados.")) {
          setCategories(prev => prev.filter(c => c.id !== id));
          if (selectedCategoryId === id) {
              const remaining = categories.filter(c => c.id !== id);
              setSelectedCategoryId(remaining[0]?.id);
              setMaxCards(remaining[0]?.max_cards || 20);
          }
          await supabase.from('investigation_categories').delete().eq('id', id);
      }
  };

  const handleMoveCategory = async (id, direction) => {
      const idx = categories.findIndex(c => c.id === id);
      if (direction === 'up' && idx > 0) {
          const newCats = [...categories];
          const other = newCats[idx - 1];
          const tempOrder = other.display_order;
          other.display_order = newCats[idx].display_order;
          newCats[idx].display_order = tempOrder;
          setCategories(newCats.sort((a, b) => a.display_order - b.display_order));

          await Promise.all([
              supabase.from('investigation_categories').update({ display_order: other.display_order }).eq('id', other.id),
              supabase.from('investigation_categories').update({ display_order: tempOrder }).eq('id', id)
          ]);
      } else if (direction === 'down' && idx < categories.length - 1) {
          const newCats = [...categories];
          const other = newCats[idx + 1];
          const tempOrder = other.display_order;
          other.display_order = newCats[idx].display_order;
          newCats[idx].display_order = tempOrder;
          setCategories(newCats.sort((a, b) => a.display_order - b.display_order));

          await Promise.all([
              supabase.from('investigation_categories').update({ display_order: other.display_order }).eq('id', other.id),
              supabase.from('investigation_categories').update({ display_order: tempOrder }).eq('id', id)
          ]);
      }
  };

  const handleCreateCard = async (type = 'text') => {
    if (!selectedCategoryId) {
        showToast("Selecione ou crie uma categoria primeiro.");
        return;
    }
    if (currentCategoryCards.length >= maxCards) {
      showToast(`Limite de ${maxCards} cards atingido nesta categoria.`);
      playSound('error');
      return;
    }

    const containerRect = containerRef.current.getBoundingClientRect();
    const vx = containerRect.width / 2;
    const vy = containerRect.height / 2;

    const bx = (vx - pan.x) / zoom;
    const by = (vy - pan.y) / zoom;

    const cardWidth = 208;
    const cardHeight = type === 'image' ? 200 : 150;

    let cx = bx - cardWidth / 2;
    let cy = by - cardHeight / 2;

    cx = Math.max(0, Math.min(cx, BOARD_WIDTH - cardWidth));
    cy = Math.max(0, Math.min(cy, BOARD_HEIGHT - cardHeight));

    const newCardBase = {
      title: type === 'image' ? '' : 'Nova Evidência',
      content: '',
      description: '',
      x_pos: cx,
      y_pos: cy,
      type: type,
      category_id: selectedCategoryId,
      image_url: type === 'image' ? '' : null,
      image_scale: type === 'image' ? 1.3 : 1.0
    };

    const tempId = 'temp-' + Date.now();
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

  const updateCardContent = async (id, title, content, imageUrl, imageScale, description) => {
    const updates = {};
    if (title !== undefined) updates.title = title;
    if (content !== undefined) updates.content = content;
    if (imageUrl !== undefined) updates.image_url = imageUrl;
    if (imageScale !== undefined) updates.image_scale = imageScale;
    if (description !== undefined) updates.description = description;
    
    const { error } = await supabase.from('investigation_cards').update(updates).eq('id', id);
    if (error) showToast("Erro ao salvar alterações.");
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
      if (String(fromId) === String(cardId)) return;

      const exists = pins.find(p => 
        (String(p.from_card_id) === String(fromId) && String(p.to_card_id) === String(cardId)) ||
        (String(p.from_card_id) === String(cardId) && String(p.to_card_id) === String(fromId))
      );

      if (exists) {
        // Optimistic Delete
        setPins(prev => prev.filter(p => String(p.id) !== String(exists.id)));
        const { error } = await supabase.from('investigation_pins').delete().match({ id: exists.id });
        if (error) {
            showToast("Erro ao remover conexão.");
            // Rollback
            setPins(prev => [...prev, exists]);
        }
      } else {
        // Optimistic Insert
        const tempId = 'temp-' + Date.now();
        const newPin = { id: tempId, from_card_id: fromId, to_card_id: cardId };
        setPins(prev => [...prev, newPin]);
        
        const { data, error } = await supabase.from('investigation_pins').insert({
          from_card_id: fromId,
          to_card_id: cardId
        }).select().single();

        if (error) {
            showToast("Erro ao criar conexão.");
            setPins(prev => prev.filter(p => String(p.id) !== String(tempId)));
        } else if (data) {
            setPins(prev => prev.map(p => String(p.id) === String(tempId) ? data : p));
        }
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

      if (editingCardId && editingCardId !== cardId) {
          const oldCard = cards.find(c => c.id === editingCardId);
          if (oldCard) updateCardContent(oldCard.id, oldCard.title, oldCard.content, oldCard.image_url, oldCard.image_scale, oldCard.description);
      }

      const isTopBar = e.target.closest('.card-top-bar');
      const isShiftOrCtrl = e.shiftKey || e.metaKey || e.ctrlKey;
      
      if (isShiftOrCtrl) {
          setSelectedCardIds(prev => prev.includes(cardId) ? prev.filter(id => id !== cardId) : [...prev, cardId]);
      } else {
          if (editingCardId !== cardId) {
              setEditingCardId(null);
              if (!selectedCardIds.includes(cardId)) setSelectedCardIds([cardId]);
          } else if (!isTopBar) return;
      }

      setDraggingCard(card);
      mouseOffset.current = { x: mouseX / zoom - card.x_pos, y: mouseY / zoom - card.y_pos };
      return;
    }

    if (editingCardId && !pinningFrom) {
        const card = cards.find(c => c.id === editingCardId);
        if (card) updateCardContent(card.id, card.title, card.content, card.image_url, card.image_scale, card.description);
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
      if (editingCardId) {
          const card = cards.find(c => c.id === editingCardId);
          if (card) updateCardContent(card.id, card.title, card.content, card.image_url, card.image_scale, card.description);
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
      const inBox = currentCategoryCards.filter(c => {
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
          setEditingCardId(clickedCardElement.dataset.id);
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

  const handleExportPNG = async () => {
    if (!containerRef.current || isExporting) return;
    
    setIsExporting(true);
    showToast("Preparando exportação... Aguarde.");
    playSound('random_button');

    try {
      // Find the element to capture (the actual board content)
      const boardElement = containerRef.current.querySelector('div[style*="transform"]');
      if (!boardElement) throw new Error("Board element not found");

      // Calculate bounds of visible cards in current category
      if (currentCategoryCards.length === 0) {
        showToast("Nenhum card para exportar nesta categoria.");
        setIsExporting(false);
        return;
      }

      let minX = BOARD_WIDTH, minY = BOARD_HEIGHT, maxX = 0, maxY = 0;
      currentCategoryCards.forEach(c => {
        const isImage = c.type === 'image';
        const cardScale = isImage ? (c.image_scale || 1.3) : 1.0;
        const cardWidth = 208 * cardScale;
        const cardHeight = isImage ? (200 * cardScale) : 150; // Approximated max height for text

        minX = Math.min(minX, c.x_pos);
        minY = Math.min(minY, c.y_pos);
        maxX = Math.max(maxX, c.x_pos + cardWidth);
        maxY = Math.max(maxY, c.y_pos + cardHeight);
      });

      // Add padding
      const padding = 100;
      minX = Math.max(0, minX - padding);
      minY = Math.max(0, minY - padding);
      maxX = Math.min(BOARD_WIDTH, maxX + padding);
      maxY = Math.min(BOARD_HEIGHT, maxY + padding);

      const width = maxX - minX;
      const height = maxY - minY;

      // Temporary styles for export
      const originalTransform = boardElement.style.transform;
      const originalWidth = boardElement.style.width;
      const originalHeight = boardElement.style.height;

      // Reset transform and set specific size for capture
      boardElement.style.transform = `translate(${-minX}px, ${-minY}px) scale(1)`;
      boardElement.style.width = `${BOARD_WIDTH}px`;
      boardElement.style.height = `${BOARD_HEIGHT}px`;

      const canvas = await html2canvas(boardElement, {
        backgroundColor: '#09090b', // zinc-950
        width: width,
        height: height,
        scale: 2, // High quality
        useCORS: true,
        allowTaint: true,
        logging: false,
        onclone: (clonedDoc) => {
          // Hide UI elements that shouldn't be in the export
          const clonedBoard = clonedDoc.querySelector('div[style*="transform"]');
          if (clonedBoard) {
            clonedBoard.querySelectorAll('.pin-button, .edit-button, .delete-button, .card-top-bar').forEach(el => {
              el.style.display = 'none';
            });
            // Ensure cards have proper background for export
            clonedBoard.querySelectorAll('.investigation-card').forEach(card => {
              card.style.boxShadow = '0 10px 15px -3px rgb(0 0 0 / 0.1)';
            });
          }
        }
      });

      // Restore original styles
      boardElement.style.transform = originalTransform;
      boardElement.style.width = originalWidth;
      boardElement.style.height = originalHeight;

      // Download
      const categoryName = categories.find(c => c.id === selectedCategoryId)?.name || 'Investigacao';
      const link = document.createElement('a');
      link.download = `Investigacao_${categoryName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      
      showToast("Exportação concluída!");
      playSound('celebration');
    } catch (err) {
      console.error("Export error:", err);
      showToast("Erro ao exportar imagem.");
      playSound('error');
    } finally {
      setIsExporting(false);
    }
  };

  const renderLines = () => {
    return pins.map(pin => {
      const from = currentCategoryCards.find(c => String(c.id) === String(pin.from_card_id));
      const to = currentCategoryCards.find(c => String(c.id) === String(pin.to_card_id));
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

  if (loading && categories.length === 0) return null;

  return (
    <div className="h-full flex flex-col p-8 overflow-hidden bg-zinc-950 select-none relative">
      <style>{`
        .pin-active-ring {
            box-shadow: 0 0 0 4px rgba(220, 38, 38, 0.6);
            animation: custom-pulse-slow 4s infinite;
        }
        @keyframes custom-pulse-slow {
            0% { box-shadow: 0 0 0 0px rgba(220, 38, 38, 0.8); }
            100% { box-shadow: 0 0 0 20px rgba(220, 38, 38, 0); }
        }
        .investigation-fade-out {
            animation: investigation-fade-out 1s forwards;
        }
        @keyframes investigation-fade-out {
            from { opacity: 1; }
            to { opacity: 0; pointer-events: none; }
        }
      `}</style>

      {/* Global Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 z-[200] bg-black flex items-center justify-center">
            <div className="text-center space-y-4">
                <div className="text-4xl animate-pulse text-red-600 font-black italic uppercase tracking-tighter">Sincronizando Arquivos...</div>
                <div className="w-48 h-1 bg-zinc-900 mx-auto rounded-full overflow-hidden">
                    <div className="h-full bg-red-600 animate-[loading-bar_2s_infinite_ease-in-out]" style={{ width: '40%' }}></div>
                </div>
            </div>
            <style>{`
                @keyframes loading-bar {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(250%); }
                }
            `}</style>
        </div>
      )}

      <div className={`flex justify-between items-center mb-8 bg-zinc-950/80 p-6 rounded-2xl border border-zinc-800 backdrop-blur-sm z-10 transition-opacity duration-1000 ${loading ? 'opacity-0' : 'opacity-100'}`}>
        <div className="flex items-center gap-6">
          <div className="min-w-[200px]">
            <h2 className="text-4xl font-black italic text-red-600 uppercase tracking-tighter">Investigação</h2>
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mt-1">
              {currentCategoryCards.length} / {maxCards} Cards • Shift + Clique para Selecionar
            </p>
          </div>
          
          <div className="h-12 w-[1px] bg-zinc-800" />

          {/* Category Dropdown */}
          <div className="flex flex-col gap-1 min-w-[200px]">
            <span className="text-[9px] font-black text-zinc-500 uppercase px-2">Caso / Categoria</span>
            <div className="flex items-center gap-2">
                <select 
                    value={selectedCategoryId || ''}
                    onChange={(e) => {
                        const cat = categories.find(c => c.id === e.target.value);
                        setSelectedCategoryId(e.target.value);
                        setMaxCards(cat?.max_cards || 20);
                        setSelectedCardIds([]);
                    }}
                    className="bg-zinc-900 border border-zinc-800 text-white font-black uppercase text-xs rounded-full px-4 py-2 outline-none focus:ring-1 focus:ring-red-600 appearance-none cursor-pointer pr-10 w-full"
                    style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0\' stroke=\'white\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '12px' }}
                >
                    {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                </select>
                {isMaster && (
                    <button 
                        onClick={() => setIsManagingCategories(!isManagingCategories)}
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shrink-0 ${isManagingCategories ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}
                    >
                        ⚙️
                    </button>
                )}
            </div>
          </div>
        </div>

        <div className="flex gap-4 items-center">
            <button
                onClick={handleExportPNG}
                disabled={isExporting}
                className={`bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 py-3 rounded-full font-black uppercase text-[10px] transition-all flex items-center gap-2 ${isExporting ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
                {isExporting ? (
                    <>
                        <div className="w-3 h-3 border-2 border-zinc-500 border-t-white rounded-full animate-spin" />
                        Exportando...
                    </>
                ) : (
                    <>
                        <span>📸</span>
                        Baixar PNG
                    </>
                )}
            </button>
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

      {/* Category Manager Modal-ish */}
      {isManagingCategories && isMaster && (
          <div className="absolute top-36 left-8 bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-2xl z-[100] w-80 animate-in fade-in slide-in-from-top-4 duration-200">
              <div className="flex justify-between items-center mb-4">
                  <h3 className="text-white font-black uppercase text-xs italic tracking-widest">Gerenciar Categorias</h3>
                  <button onClick={() => setIsManagingCategories(false)} className="text-zinc-500 hover:text-white font-black">×</button>
              </div>
              <div className="space-y-3 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                  {categories.map((cat, idx) => (
                      <div key={cat.id} className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 space-y-2">
                          <div className="flex items-center gap-2">
                              <input 
                                  value={cat.name}
                                  onChange={async (e) => {
                                      const val = e.target.value;
                                      setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, name: val } : c));
                                      await supabase.from('investigation_categories').update({ name: val }).eq('id', cat.id);
                                  }}
                                  className="bg-transparent border-none text-white font-bold text-[11px] outline-none w-full"
                              />
                              <div className="flex gap-1">
                                  <button onClick={() => handleMoveCategory(cat.id, 'up')} className="text-[10px] bg-zinc-800 px-1 rounded hover:bg-zinc-700 opacity-50 hover:opacity-100">▲</button>
                                  <button onClick={() => handleMoveCategory(cat.id, 'down')} className="text-[10px] bg-zinc-800 px-1 rounded hover:bg-zinc-700 opacity-50 hover:opacity-100">▼</button>
                              </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-[9px] font-black text-zinc-600 uppercase">Máx:</span>
                                <input 
                                    type="number"
                                    value={cat.max_cards}
                                    onChange={(e) => updateMaxCards(cat.id, e.target.value)}
                                    className="bg-zinc-900 border-none text-zinc-400 font-bold text-[10px] w-8 text-center rounded"
                                />
                            </div>
                            <button onClick={() => handleDeleteCategory(cat.id)} className="text-[9px] font-black text-red-900 hover:text-red-500 uppercase tracking-tighter transition-colors">Deletar</button>
                          </div>
                      </div>
                  ))}
              </div>
              <button 
                  onClick={handleCreateCategory}
                  className="w-full mt-4 bg-red-600/20 hover:bg-red-600/40 text-red-500 border border-red-600/30 py-2 rounded-xl text-[10px] font-black uppercase transition-all"
              >
                  + Nova Categoria
              </button>
          </div>
      )}

      <div 
        ref={containerRef}
        className={`flex-1 relative border-4 border-zinc-900 rounded-[40px] bg-black overflow-hidden cursor-grab active:cursor-grabbing transition-opacity duration-1000 ${loading ? 'opacity-0' : 'opacity-100'}`}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onWheel={onWheel}
        onDoubleClick={onDoubleClick}
        style={{ backfaceVisibility: 'hidden', transform: 'translateZ(0)' }}
      >
        <div 
            style={{ 
                transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
                transformOrigin: '0 0',
                width: BOARD_WIDTH,
                height: BOARD_HEIGHT,
                backgroundColor: '#09090b', // zinc-950
                border: '2px solid rgba(255,255,255,0.1)',
                borderRadius: '40px',
                willChange: 'transform'
            }}
            className="absolute inset-0 pointer-events-none"
        >
            <svg className="absolute pointer-events-none z-[100]" style={{ width: SVG_PADDING * 2, height: SVG_PADDING * 2, top: -SVG_PADDING, left: -SVG_PADDING }}>
                {renderLines()}
            </svg>

            {currentCategoryCards.map(card => {
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
                                                setCards(prev => prev.map(c => c.id === card.id ? { ...c, image_scale: roundedScale } : c));
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
                                    onBlur={() => { updateCardContent(card.id, card.title, card.content, card.image_url, card.image_scale, card.description); }}
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
                                                        updateCardContent(card.id, card.title, card.content, card.image_url, card.image_scale, card.description);
                                                        setEditingCardId(null);
                                                    }
                                                }}
                                                onBlur={() => { updateCardContent(card.id, card.title, card.content, card.image_url, card.image_scale, card.description); }}
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
                                                    maxHeight: 'calc(208px * 2 * 2)',
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
                                    {(isEditing || card.description) && (
                                        <textarea
                                            ref={el => textareaRefs.current[`desc-${card.id}`] = el}
                                            value={card.description || ''}
                                            readOnly={!isEditing}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setCards(prev => prev.map(c => c.id === card.id ? { ...c, description: val } : c));
                                            }}
                                            onBlur={() => { updateCardContent(card.id, card.title, card.content, card.image_url, card.image_scale, card.description); }}
                                            placeholder="Descrição (opcional)..."
                                            className={`w-full bg-transparent border-none text-zinc-700 font-bold text-[10px] leading-tight outline-none resize-none placeholder:text-zinc-300 overflow-hidden ${isEditing ? 'cursor-text' : 'cursor-inherit'}`}
                                        />
                                    )}
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
                                    onBlur={() => { updateCardContent(card.id, card.title, card.content, card.image_url, card.image_scale, card.description); }}
                                    placeholder="Escreva aqui..."
                                    className={`w-full bg-transparent border-none text-zinc-700 font-bold text-[10px] leading-tight outline-none resize-none placeholder:text-zinc-300 overflow-hidden ${isEditing ? 'cursor-text' : 'cursor-inherit'}`}
                                />
                            )}
                        </div>

                        {(isMaster || true) && (
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
