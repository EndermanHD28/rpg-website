"use client";
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export default function NotificationSystem({ user, isActingAsMaster, showToast }) {
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const [message, setMessage] = useState('');
  const [title, setTitle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // all, important, unread, hidden
  const [expandedId, setExpandedId] = useState(null);
  const [isImportant, setIsImportant] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasImportantUnread, setHasImportantUnread] = useState(false);
  const panelRef = useRef(null);

  const handleClose = () => {
    setIsAnimatingOut(true);
    // De-select any text when closing or retracting
    window.getSelection()?.removeAllRanges();
    setTimeout(() => {
      setIsOpen(false);
      setIsAnimatingOut(false);
      setExpandedId(null);
    }, 300); // Match animation duration
  };

  const handleToggle = () => {
    if (isOpen) {
      handleClose();
    } else {
      setIsOpen(true);
    }
  };

  const handleRetract = (e) => {
    if (e) e.stopPropagation();
    window.getSelection()?.removeAllRanges();
    setExpandedId(null);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        if (isOpen && !isAnimatingOut) handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, isAnimatingOut]);

  useEffect(() => {
    fetchNotifications();

    const channel = supabase.channel('notifications_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const newNotif = payload.new;
          setNotifications(prev => [newNotif, ...prev]);

          // Show warning for important notifications
          if (newNotif.is_important && !isActingAsMaster) {
            const truncatedContent = newNotif.content.length > 50
              ? newNotif.content.substring(0, 50) + "..."
              : newNotif.content;
            showToast(`⚠️ NOTIFICAÇÃO IMPORTANTE: ${truncatedContent}`);
          }
        } else if (payload.eventType === 'UPDATE') {
          setNotifications(prev => prev.map(n => n.id === payload.new.id ? payload.new : n));
        } else if (payload.eventType === 'DELETE') {
          setNotifications(prev => prev.filter(n => n.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isActingAsMaster]);

  useEffect(() => {
    if (!user) return;

    // Filter out notifications deleted by this user
    const visibleNotifications = notifications.filter(n => !n.deleted_by?.includes(user.id));

    // Count unread (not in read_by)
    const unread = visibleNotifications.filter(n => !n.read_by?.includes(user.id));
    setUnreadCount(unread.length);

    // Check for important unread
    setHasImportantUnread(unread.some(n => n.is_important));
  }, [notifications, user]);

  const fetchNotifications = async () => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) setNotifications(data);
  };

  const sendNotification = async () => {
    if (!message.trim()) return;

    const { error } = await supabase
      .from('notifications')
      .insert({
        title: title.trim() || null,
        content: message,
        is_important: isImportant,
        master_id: user.id
      });

    if (!error) {
      setMessage('');
      setTitle('');
      setIsImportant(false);
      showToast("Notificação enviada!");
    }
  };

  const markAsRead = async (id) => {
    const notification = notifications.find(n => n.id === id);
    if (!notification || notification.read_by?.includes(user.id)) return;

    const newReadBy = [...(notification.read_by || []), user.id];
    await supabase
      .from('notifications')
      .update({ read_by: newReadBy })
      .eq('id', id);
  };

  const deleteNotification = async (id) => {
    const notification = notifications.find(n => n.id === id);
    if (!notification) return;

    if (activeTab === 'hidden') {
        // Restore action
        const newDeletedBy = (notification.deleted_by || []).filter(uid => uid !== user.id);
        await supabase
          .from('notifications')
          .update({ deleted_by: newDeletedBy })
          .eq('id', id);
        return;
    }

    if (isActingAsMaster) {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id);
      if (!error) showToast("Notificação removida!");
    } else {
      const newDeletedBy = [...(notification.deleted_by || []), user.id];
      await supabase
        .from('notifications')
        .update({ deleted_by: newDeletedBy })
        .eq('id', id);
    }
  };

  const formatNotificationDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const itemDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (itemDate.getTime() === today.getTime()) {
      return `Hoje às ${timeStr}`;
    } else if (itemDate.getTime() === yesterday.getTime()) {
      return `Ontem às ${timeStr}`;
    } else {
      return `${date.toLocaleDateString('pt-BR')} ${timeStr}`;
    }
  };

  const formatContent = (text) => {
    if (!text) return null;
    
    // Replace *word* with bold and _word_ with outline
    const parts = text.split(/(\*[^\*]+\*|_[^_]+_)/g);
    
    return parts.map((part, index) => {
      if (part.startsWith('*') && part.endsWith('*')) {
        return <strong key={index} className="font-black text-white">{part.slice(1, -1)}</strong>;
      }
      if (part.startsWith('_') && part.endsWith('_')) {
        return <span key={index} className="text-white border-b border-white/30">{part.slice(1, -1)}</span>;
      }
      return part;
    });
  };

  return (
    <div className="fixed top-8 right-8 z-[200] flex flex-col items-end gap-3" ref={panelRef}>
      {/* Main Notification Button */}
      <button
        onClick={handleToggle}
        className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-500 shadow-2xl group relative bg-zinc-900 border border-white/10 hover:border-zinc-100 cursor-pointer hover:scale-110 active:scale-95`}
      >
        {/* A BOLA DE BRILHO */}
        {hasImportantUnread && !isActingAsMaster && (
          <div className="absolute inset-0 rounded-full notif-alarm-glow" />
        )}

        <span className={`text-xl z-10 transition-all duration-500 ${hasImportantUnread && !isActingAsMaster ? 'scale-110 opacity-80' : 'opacity-40 group-hover:opacity-100 group-hover:scale-110'}`}>
          🔔
        </span>

        {unreadCount > 0 && !isActingAsMaster && (
          <div className="absolute -top-1 -right-1 z-20 bg-zinc-100 text-zinc-900 text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-lg transition-transform group-hover:scale-125 group-hover:-translate-y-1 group-hover:translate-x-1">
            {unreadCount}
          </div>
        )}
      </button>

      {/* Notification List Panel */}
      {isOpen && (
        <div className={`bg-zinc-900 border border-zinc-800 p-5 rounded-2xl shadow-2xl w-[400px] mt-2 flex flex-col gap-5 ${isAnimatingOut ? 'animate-out fade-out slide-out-to-top-4 duration-300' : 'animate-in fade-in slide-in-from-top-4 duration-300'}`}>
          {isActingAsMaster ? (
            <div className="flex flex-col gap-4 border-b border-zinc-800 pb-5">
              <p className="text-[13px] font-black text-zinc-500 uppercase">Enviar Notificação</p>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Título (opcional)..."
                className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-red-600 transition-colors"
              />
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Digite a mensagem..."
                className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-red-600 transition-colors h-24 resize-none"
              />
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setIsImportant(!isImportant)}
                  className={`px-4 py-2 rounded text-[11px] font-black uppercase transition-all ${isImportant ? 'bg-red-600/50 text-white shadow-[0_0_10px_rgba(220,38,38,0.2)]' : 'bg-zinc-800 text-zinc-500'}`}
                >
                  {isImportant ? 'IMPORTANTE' : 'BÁSICA'}
                </button>
                <button
                  onClick={sendNotification}
                  className="bg-white text-black text-[11px] font-black uppercase px-5 py-2 rounded hover:bg-zinc-200 transition-colors"
                >
                  ENVIAR
                </button>
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-3 border-b border-zinc-800/50 pb-3">
              <p className="text-[16px] font-black text-zinc-500 uppercase">Notificações</p>
              
              <div className="flex gap-1.5 mb-1.5">
                {[
                  { id: 'all', label: 'Todas' },
                  { id: 'unread', label: 'Não Lidas' },
                  { id: 'important', label: 'Importantes' },
                  { id: 'hidden', label: 'Ocultas' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setExpandedId(null);
                    }}
                    className={`flex-1 py-1.5 text-[10px] font-black uppercase rounded transition-all ${
                      activeTab === tab.id ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="relative group/search">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setExpandedId(null);
                  }}
                  placeholder="Pesquisar..."
                  className="w-full bg-black/50 border border-zinc-800 rounded-lg px-8 py-2 text-[12px] text-white outline-none focus:border-zinc-600 focus:bg-black transition-all"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] opacity-30 group-focus-within/search:opacity-60">🔍</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 max-h-[450px] overflow-y-auto pr-1 custom-scrollbar">
              <div className="flex flex-col gap-2">
                {(() => {
                  const filtered = notifications
                    .filter(n => {
                      const isDeleted = n.deleted_by?.includes(user.id);
                      const isRead = n.read_by?.includes(user.id);
                      
                      if (activeTab === 'hidden') return isDeleted;
                      if (isDeleted) return false;
                      if (activeTab === 'unread') return !isRead;
                      if (activeTab === 'important') return n.is_important;
                      return true;
                    })
                    .filter(n => {
                      if (!searchQuery.trim()) return true;
                      const query = searchQuery.toLowerCase().replace(/\s/g, '');
                      const contentMatch = n.content.toLowerCase().replace(/\s/g, '').includes(query);
                      const titleMatch = n.title?.toLowerCase().replace(/\s/g, '').includes(query);
                      return contentMatch || titleMatch;
                    })
                    .sort((a, b) => {
                      const aRead = a.read_by?.includes(user.id);
                      const bRead = b.read_by?.includes(user.id);
                      if (aRead !== bRead) return aRead ? 1 : -1;
                      return new Date(b.created_at) - new Date(a.created_at);
                    });

                  if (filtered.length === 0) {
                    return (
                      <p className="text-[11px] text-zinc-600 italic py-5 text-center">Nenhuma notificação</p>
                    );
                  }

                  return filtered.map(n => {
                    const isRead = n.read_by?.includes(user.id);
                    const isExpanded = expandedId === n.id;
                    return (
                      <div
                        key={n.id}
                        onClick={() => {
                          if (!isExpanded) {
                            setExpandedId(n.id);
                            if (!isRead && !isActingAsMaster) markAsRead(n.id);
                          }
                        }}
                        className={`p-3 rounded-xl border transition-all duration-300 animate-in slide-in-from-right-4 fade-in zoom-in-95 group/item
                              ${isExpanded
                            ? 'border-zinc-700 bg-black/60 opacity-100 shadow-xl cursor-default'
                            : isRead
                              ? 'border-zinc-800/50 bg-black/40 opacity-60 hover:opacity-100 hover:bg-black/60 hover:border-zinc-700 cursor-pointer'
                              : n.is_important
                                ? 'border-red-900/30 bg-red-950/10 hover:bg-red-950/20 cursor-pointer'
                                : 'border-zinc-700/50 bg-black/60 hover:bg-black/80 cursor-pointer'
                          } 
                              flex flex-col gap-2`}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex flex-col gap-1 w-full">
                            {n.is_important && (
                              <span className={`text-[7px] font-black uppercase tracking-widest ${isRead && !isExpanded ? 'text-zinc-600' : 'text-red-500'}`}>
                                IMPORTANTE
                              </span>
                            )}
                            {n.title && (
                              <div className="flex flex-col gap-1 mb-1">
                                <h4 className={`text-[14px] font-bold transition-colors w-fit ${isExpanded ? 'text-zinc-300 cursor-text' : isRead ? 'text-zinc-500 group-hover/item:text-zinc-300' : 'text-zinc-300'}`}>
                                  {n.title}
                                </h4>
                                {isExpanded && <div className="h-px w-full bg-zinc-700/50" />}
                              </div>
                            )}
                            <div className={`text-[11px] leading-relaxed transition-all whitespace-pre-wrap break-words overflow-wrap-anywhere 
                              ${(isRead && !isExpanded) ? 'text-zinc-500 group-hover/item:text-zinc-100' : 'text-zinc-100'} 
                              border border-transparent rounded-lg
                              ${isExpanded ? 'mt-2 mb-6 p-3 !border-white/10 bg-black/20' : 'select-none line-clamp-3 overflow-hidden text-ellipsis'}`}>
                              <span className={isExpanded ? 'select-text cursor-text' : ''}>
                                {formatContent(n.content)}
                              </span>
                            </div>
                          </div>
                          {!isActingAsMaster && !isRead && !isExpanded && (
                            <span className="text-[10px] bg-white text-black px-1.5 rounded-full font-black animate-pulse flex-shrink-0">
                              !
                            </span>
                          )}
                        </div>
                        <div className="flex justify-between items-center mt-1">
                          <span className="text-[11px] text-zinc-600 font-mono">
                            {formatNotificationDate(n.created_at)}
                          </span>
                          <div className={`flex gap-2 transition-opacity ${isExpanded ? 'opacity-100' : 'opacity-0 group-hover/item:opacity-100'}`}>
                            {isExpanded ? (
                              <button
                                onClick={handleRetract}
                                className="text-[10px] font-black text-zinc-400 hover:text-white uppercase transition-colors"
                              >
                                Retrair
                              </button>
                            ) : (
                                !isActingAsMaster && !isRead && (
                                <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      markAsRead(n.id);
                                    }}
                                    className="text-[10px] font-black text-zinc-400 hover:text-white uppercase transition-colors"
                                >
                                    Marcar como Lida
                                </button>
                                )
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteNotification(n.id);
                              }}
                              className="text-[10px] font-black text-zinc-600 hover:text-red-500 uppercase transition-colors"
                            >
                              {activeTab === 'hidden' ? 'Restaurar' : (isActingAsMaster ? 'Apagar' : 'Ocultar')}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .notif-alarm-glow {
          pointer-events: none;
          /* Vermelho mais sóbrio (dark crimson) em vez de vermelho vivo */
          background: radial-gradient(circle, rgba(153, 27, 27, 0.8) 0%, rgba(153, 27, 27, 0.4) 40%, rgba(153, 27, 27, 0) 70%);
          animation: critical-glow 8s infinite ease-out;
          z-index: 0;
        }

        @keyframes critical-glow {
          /* Primeira Batida */
          0% {
            transform: scale(0.8);
            opacity: 0;
          }
          5% {
            opacity: 1; /* Agora começa bem visível */
          }
          15% {
            transform: scale(2.2);
            opacity: 0;
            filter: blur(4px);
          }
          
          /* Pausa */
          16% {
            transform: scale(0.8);
            opacity: 0;
          }

          /* Segunda Batida */
          20% {
            transform: scale(0.8);
            opacity: 0;
          }
          25% {
            opacity: 0.8;
          }
          35% {
            transform: scale(1.8);
            opacity: 0;
            filter: blur(6px);
          }

          /* Cooldown (do 36% ao 100% - Silêncio) */
          36%, 100% {
            transform: scale(0.8);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
