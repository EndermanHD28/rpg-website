"use client";
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export default function ReportsTab({ user, isMaster, showToast, playSound }) {
  const [reports, setReports] = useState([]);
  const [activeReport, setActiveReport] = useState(null);
  const [editingReport, setEditingReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const descriptionRef = useRef(null);
  const [descFontSize, setDescFontSize] = useState(18);
  const [isTruncated, setIsTruncated] = useState(false);

  // Fetch reports
  useEffect(() => {
    if (!user) return; // Prevent fetching for unauthenticated users

    const fetchReports = async () => {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (!error) setReports(data);
      setLoading(false);
    };

    fetchReports();

    // Realtime subscription
    const channel = supabase.channel('reports_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setReports(prev => {
            if (prev.some(r => r.id === payload.new.id)) return prev;
            return [payload.new, ...prev];
          });
        } else if (payload.eventType === 'UPDATE') {
          setReports(prev => prev.map(r => r.id === payload.new.id ? payload.new : r));
          
          setActiveReport(prev => {
            if (prev && prev.id === payload.new.id) {
               return payload.new;
            }
            return prev;
          });
        } else if (payload.eventType === 'DELETE') {
          setReports(prev => prev.filter(r => r.id !== payload.old.id));
          setActiveReport(prev => (prev && prev.id === payload.old.id) ? null : prev);
          setEditingReport(prev => (prev && prev.id === payload.old.id) ? null : prev);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleCreateNew = async () => {
    const lastReport = reports[0];
    if (lastReport && lastReport.status !== 'accepted' && !isMaster) {
      showToast("Você só pode criar um novo relatório se o anterior foi aceito.");
      return;
    }

    const newReport = {
      mission_date: "",
      author_name: "",
      unit_id: "",
      mission_id: "",
      description: "",
      status: 'draft',
      editing_by: user?.id,
      author_id: user?.id,
      payment_amount: ""
    };

    const { data, error } = await supabase.from('reports').insert(newReport).select().single();
    if (error) {
      showToast("Erro ao criar relatório.");
    } else {
      setActiveReport(data);
      setEditingReport(data);
      playSound?.('tab_change');
    }
  };

  const startEditing = async (report) => {
    if (report.editing_by && report.editing_by !== user?.id) {
      showToast("Outro jogador já está editando.");
      return;
    }

    const updatedReport = { ...report, editing_by: user?.id };
    setEditingReport(updatedReport);
    setActiveReport(updatedReport);

    const { error } = await supabase
      .from('reports')
      .update({ editing_by: user?.id })
      .eq('id', report.id);

    if (error) {
      console.error("Error starting edit:", error);
      showToast("Erro ao iniciar edição.");
      setEditingReport(null);
    } else {
      playSound?.('tab_change');
    }
  };

  const updateField = async (field, value) => {
    if (!editingReport) return;
    if (field === 'description' && value.length > 2500) return;
    const updated = { ...editingReport, [field]: value };
    setEditingReport(updated);
    setActiveReport(updated);
    await supabase.from('reports').update({ [field]: value }).eq('id', editingReport.id);
  };

  const handleStopEditing = async (mode) => {
    if (!editingReport) return;
    const reportId = editingReport.id;

    if (mode === 'discard') {
      const { error } = await supabase.from('reports').delete().eq('id', reportId);
      if (!error) {
        showToast("Relatório descartado.");
        setActiveReport(null);
      }
    } else if (mode === 'stop') {
      const { error } = await supabase.from('reports').update({ editing_by: null }).eq('id', reportId);
      if (!error) {
        showToast("Edição pausada.");
      }
    } else if (mode === 'finalize') {
      const { error } = await supabase.from('reports').update({ editing_by: null, status: 'pending' }).eq('id', reportId);
      if (!error) {
        showToast("Enviado para aprovação!");
      }
    }
    setEditingReport(null);
  };

  const handleAcceptReject = async (reportId, status) => {
    if (status === 'rejected') {
      const { error } = await supabase.from('reports').update({ status: 'rejected' }).eq('id', reportId);
      if (!error) {
        showToast("Relatório rejeitado.");
      }
    } else {
      const { error } = await supabase.from('reports').update({ 
        status: 'accepted',
        payment_amount: activeReport.payment_amount || "0,00"
      }).eq('id', reportId);
      if (!error) showToast("Relatório aprovado!");
    }
  };

  const updatePayment = async (val) => {
    setActiveReport(prev => ({ ...prev, payment_amount: val }));
    await supabase.from('reports').update({ payment_amount: val }).eq('id', activeReport.id);
  };

  const handleDeleteReport = async (reportId) => {
    const { error } = await supabase.from('reports').delete().eq('id', reportId);
    if (!error) {
      showToast("Relatório deletado permanentemente.");
      if (activeReport?.id === reportId) setActiveReport(null);
    } else {
      showToast("Erro ao deletar relatório.");
    }
  };

  const playerTextClass = "font-serif text-[18px] text-zinc-800 tracking-tight leading-relaxed break-words";
  const handwrittenBtnClass = "text-xs font-black uppercase tracking-widest hover:scale-105 transition-all opacity-70 hover:opacity-100 underline decoration-2 underline-offset-4";

  const isEditingThis = editingReport && activeReport && editingReport.id === activeReport.id;

  useEffect(() => {
    if (!activeReport?.description || isEditingThis) {
      setDescFontSize(18);
      setIsTruncated(false);
      return;
    }
    
    const checkOverflow = () => {
      const el = descriptionRef.current;
      if (!el) return;
      
      // Available height inside the box
      const targetHeight = 580;
      
      // Reset for accurate measurement
      el.style.fontSize = '18px';
      el.style.maxHeight = 'none';
      
      let currentHeight = el.scrollHeight;
      
      if (currentHeight <= targetHeight) {
        setDescFontSize(18);
        setIsTruncated(false);
        el.style.maxHeight = `${targetHeight}px`;
        return;
      }

      // Shrink until it fits or reaches 12px
      let size = 18;
      while (currentHeight > targetHeight && size > 12) {
        size -= 0.5;
        el.style.fontSize = `${size}px`;
        currentHeight = el.scrollHeight;
      }
      
      setDescFontSize(size);
      setIsTruncated(currentHeight > targetHeight);
      el.style.maxHeight = `${targetHeight}px`;
    };

    const timer = setTimeout(checkOverflow, 200);
    return () => clearTimeout(timer);
  }, [activeReport?.description, isEditingThis]);

  return (
    <div className="p-8 max-w-[1280px] mx-auto space-y-8 h-full">
      <div className="flex justify-between items-center bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800 shrink-0">
        <div>
          <h2 className="text-3xl font-black italic text-white uppercase tracking-tighter text-shadow-glow">Relatórios de Missão</h2>
          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mt-1">Registros Oficiais do Governo</p>
        </div>
        {!editingReport && (
          <button
            onClick={handleCreateNew}
            className="bg-red-600 text-white px-6 py-2 rounded-full font-black uppercase text-xs hover:scale-105 transition-all shadow-lg border-b-2 border-red-900"
          >
            + Novo Relatório
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 min-h-0 flex-1 overflow-hidden">
        <div className="space-y-4 flex flex-col h-full overflow-hidden">
          <h3 className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-2 shrink-0">Arquivos Recentes</h3>
          <div className="space-y-2 overflow-y-auto pr-2 custom-scrollbar flex-1">
            {loading ? (
              <div className="p-4 text-[10px] font-black text-zinc-600 uppercase tracking-widest animate-pulse">
                Carregando Arquivos...
              </div>
            ) : (
              <div className="space-y-2 animate-in fade-in slide-in-from-left-4 duration-500">
                {reports.map(r => (
                  <div
                    key={r.id}
                    onClick={() => !editingReport && setActiveReport(r)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer group ${
                      activeReport?.id === r.id 
                        ? 'bg-zinc-800 border-zinc-700 text-white' 
                        : 'bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                    } ${editingReport && editingReport.id !== r.id ? 'opacity-50' : ''}`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-[10px] font-black font-mono">{r.mission_id || 'MIS-XXXX'}</span>
                      <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${
                        r.status === 'accepted' ? 'bg-green-500/20 text-green-500' :
                        r.status === 'rejected' ? 'bg-red-500/20 text-red-500' :
                        'bg-yellow-500/20 text-yellow-500'
                      }`}>
                        {r.status === 'accepted' ? 'Aprovado' : r.status === 'rejected' ? 'Rejeitado' : r.status === 'draft' ? 'Rascunho' : 'Pendente'}
                      </span>
                    </div>
                    <p className="text-xs font-black uppercase text-white truncate">{r.mission_date || 'Data não definida'}</p>
                    <div className="mt-2 space-y-1">
                      <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest leading-none">
                        Relator: <span className="text-zinc-300">{r.author_name || 'Desconhecido'}</span>
                      </p>
                      <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest leading-none">
                        Unidade: <span className="text-zinc-300">{r.unit_id || 'N/A'}</span>
                      </p>
                    </div>
                    {r.editing_by && r.editing_by !== user?.id && (
                      <p className="text-[9px] italic mt-2 animate-pulse text-red-500 font-bold uppercase tracking-widest">
                        [ Jogador escrevendo... ]
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 h-full overflow-y-auto custom-scrollbar pr-4">
          {activeReport ? (
            <div className="bg-[#f4f1ea] text-zinc-900 p-12 shadow-2xl relative min-h-[950px] border-8 border-double border-zinc-300 flex flex-col mb-8">
              <div className="text-center space-y-2 mb-12 border-b-2 border-zinc-400 pb-8 shrink-0">
                <div className="w-16 h-16 border-4 border-zinc-900 mx-auto mb-4 flex items-center justify-center">
                  <span className="font-black text-2xl">PJB</span>
                </div>
                <h1 className="text-2xl font-serif font-black uppercase tracking-widest">Relatório de Operação de Campo</h1>
                <p className="text-xs font-serif font-bold italic text-zinc-600">Confidencial - Nível de Acesso 4</p>
              </div>

              <div className="font-serif space-y-8 text-sm flex-1">
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="border-b border-zinc-400 pb-1">
                      <label className="text-[10px] font-black uppercase text-zinc-500 block mb-1">Data da Missão</label>
                      {isEditingThis ? (
                        <input type="text" value={editingReport.mission_date} onChange={(e) => updateField('mission_date', e.target.value)} className={`w-full bg-transparent outline-none ${playerTextClass}`} placeholder="" />
                      ) : (
                        <p className={`${playerTextClass} min-h-[1.5rem]`}>{activeReport.mission_date || ""}</p>
                      )}
                    </div>
                    <div className="border-b border-zinc-400 pb-1">
                      <label className="text-[10px] font-black uppercase text-zinc-500 block mb-1">ID da Operação</label>
                      {isEditingThis ? (
                        <input type="text" value={editingReport.mission_id} onChange={(e) => updateField('mission_id', e.target.value)} className={`w-full bg-transparent outline-none ${playerTextClass}`} placeholder="" />
                      ) : (
                        <p className={`${playerTextClass} min-h-[1.5rem]`}>{activeReport.mission_id || ""}</p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-6">
                    <div className="border-b border-zinc-400 pb-1">
                      <label className="text-[10px] font-black uppercase text-zinc-500 block mb-1">Relator</label>
                      {isEditingThis ? (
                        <input type="text" value={editingReport.author_name} onChange={(e) => updateField('author_name', e.target.value)} className={`w-full bg-transparent outline-none ${playerTextClass}`} placeholder="" />
                      ) : (
                        <p className={`${playerTextClass} min-h-[1.5rem]`}>{activeReport.author_name || ""}</p>
                      )}
                    </div>
                    <div className="border-b border-zinc-400 pb-1">
                      <label className="text-[10px] font-black uppercase text-zinc-500 block mb-1">Unidade Participante</label>
                      {isEditingThis ? (
                        <input type="text" value={editingReport.unit_id} onChange={(e) => updateField('unit_id', e.target.value)} className={`w-full bg-transparent outline-none ${playerTextClass}`} placeholder="" />
                      ) : (
                        <p className={`${playerTextClass} min-h-[1.5rem]`}>{activeReport.unit_id || ""}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 mt-8">
                  <label className="text-[10px] font-black uppercase text-zinc-500 block mb-2">Descrição Breve dos Eventos</label>
                  <div className="relative min-h-[600px] bg-white/20 p-4 rounded border border-zinc-200">
                    {isEditingThis ? (
                      <textarea 
                        maxLength={2500}
                        value={editingReport.description} 
                        onChange={(e) => updateField('description', e.target.value)} 
                        className={`w-full bg-transparent outline-none min-h-[600px] resize-none ${playerTextClass}`} 
                        style={{ fontSize: '18px' }}
                        placeholder="" 
                      />
                    ) : (
                      <div className="min-h-[560px]">
                        <p 
                          ref={descriptionRef}
                          className={`${playerTextClass} whitespace-pre-wrap break-words overflow-hidden m-0 p-0`}
                          style={{ fontSize: `${descFontSize}px`, maxHeight: '580px' }}
                        >
                          {activeReport.description || ""}
                          {isTruncated && " ..."}
                        </p>
                      </div>
                    )}
                  </div>
                  {activeReport.status !== 'accepted' && (
                    <div className="text-[10px] text-right text-zinc-500 font-mono mt-1 font-bold">
                      {activeReport.description?.length || 0} / 2500 CARACTERES
                    </div>
                  )}
                </div>

                <div className="mt-12 pt-8 border-t border-zinc-400 flex justify-between items-end">
                   <div className="space-y-4">
                      <div className="border-b border-zinc-400 pb-1 min-w-[200px]">
                        <label className="text-[10px] font-black uppercase text-zinc-500 block mb-1">Pagamento Autorizado (USD)</label>
                        {isMaster && activeReport.status === 'pending' ? (
                          <div className="flex items-center gap-2">
                             <span className={playerTextClass}>$</span>
                             <input 
                                type="text" 
                                value={activeReport.payment_amount || ""} 
                                onChange={(e) => updatePayment(e.target.value)} 
                                className={`w-full bg-transparent outline-none ${playerTextClass}`} 
                                placeholder=""
                             />
                          </div>
                        ) : (
                          <p className={`${playerTextClass} min-h-[1.5rem]`}>$ {activeReport.payment_amount || ""}</p>
                        )}
                      </div>
                   </div>
                   <div className="text-right italic text-[10px] font-serif text-zinc-400 space-y-0.5">
                    <p>Omitir informações é considerado crime de traição sob o código 44-B.</p>
                    <p>Propriedade governamental. Destruição proibida.</p>
                  </div>
                </div>
              </div>

              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.03] pointer-events-none rotate-[-45deg] z-0">
                <span className="text-[12rem] font-black whitespace-nowrap">CLASSIFICADO</span>
              </div>

              <div className="mt-12 flex justify-between items-center gap-8 z-20 shrink-0">
                <div className="flex gap-4">
                  {isMaster && (
                    <button 
                      onClick={() => {
                        if (window.confirm("Deseja deletar este relatório permanentemente?")) {
                          handleDeleteReport(activeReport.id);
                        }
                      }} 
                      className={`${handwrittenBtnClass} text-red-600 underline-offset-8 decoration-red-600`}
                    >
                      Deletar Registro
                    </button>
                  )}
                </div>

                <div className="flex gap-8 items-center">
                  {isEditingThis ? (
                    <>
                      <button onClick={() => handleStopEditing('discard')} className={handwrittenBtnClass}>Descartar</button>
                      <button onClick={() => handleStopEditing('stop')} className={handwrittenBtnClass}>Parar edição</button>
                      <button onClick={() => handleStopEditing('finalize')} className={handwrittenBtnClass}>Finalizar</button>
                    </>
                  ) : (
                    <>
                      {!activeReport.editing_by && (isMaster || activeReport.status === 'draft' || activeReport.status === 'rejected') && (
                        <button onClick={() => startEditing(activeReport)} className={handwrittenBtnClass}>Editar Documento</button>
                      )}
                      {isMaster && activeReport.status === 'pending' && (
                        <div className="flex gap-6 items-center">
                          <button onClick={() => handleAcceptReject(activeReport.id, 'rejected')} className={handwrittenBtnClass}>Rejeitar</button>
                          <button onClick={() => handleAcceptReject(activeReport.id, 'accepted')} className={handwrittenBtnClass}>Aprovar</button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-zinc-700 border-2 border-dashed border-zinc-900 rounded-[40px] p-20 text-center space-y-4">
              <div className="text-6xl opacity-20">📂</div>
              <div>
                <h3 className="text-xl font-black uppercase italic">Nenhum arquivo selecionado</h3>
                <p className="text-xs font-bold text-zinc-600 uppercase tracking-widest mt-1">Selecione um documento na lista à esquerda</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
