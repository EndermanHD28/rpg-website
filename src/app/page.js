"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function Home() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check if user is logged in
  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
      setLoading(false);
    };
    checkUser();
  }, []);

  const login = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: { redirectTo: window.location.origin }
    });
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  if (loading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white text-2xl animate-pulse">Carregando RPG...</div>;

  // IF NOT LOGGED IN, SHOW LOGIN SCREEN
  if (!user) {
    return (
      <main className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <h1 className="text-5xl font-bold mb-8 text-yellow-500 text-center">RPG Companion</h1>
        <button 
          onClick={login}
          className="bg-[#5865F2] hover:bg-[#4752C4] text-white px-8 py-4 rounded-lg font-bold text-xl transition-all shadow-lg"
        >
          Entrar com Discord
        </button>
      </main>
    );
  }

  // CHECK IF MASTER (.enderu)
  // Discord stores the username in user_metadata
  const isMaster = user.user_metadata.preferred_username === ".enderu";

  return (
    <main className="min-h-screen bg-slate-900 text-white p-8">
      <header className="flex justify-between items-center mb-12 border-b border-slate-700 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-yellow-500">RPG SYSTEM</h1>
          <p className="text-sm text-gray-400">Logado como: {user.user_metadata.full_name}</p>
        </div>
        <button onClick={logout} className="text-xs text-red-400 underline">Sair</button>
      </header>

      {isMaster ? (
        <div className="bg-red-900/20 border-2 border-red-500 p-6 rounded-xl">
          <h2 className="text-3xl font-bold text-red-500 mb-4">Mestre Dashboard</h2>
          <p>Você está em modo Admin. Aqui você verá as fichas dos jogadores e pedidos de aprovação.</p>
          {/* We will build the Approval List here next! */}
        </div>
      ) : (
        <div className="bg-blue-900/20 border-2 border-blue-500 p-6 rounded-xl">
          <h2 className="text-3xl font-bold text-blue-400 mb-4">Ficha de Personagem</h2>
          <p>Bem-vindo, Jogador. Suas estatísticas aparecerão aqui.</p>
          {/* We will build the Character Sheet here next! */}
        </div>
      )}
    </main>
  );
}