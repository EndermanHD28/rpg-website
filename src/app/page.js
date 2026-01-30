"use client";
import { useState } from 'react';

export default function Home() {
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(false);

  const lootTable = [
    { name: "Rusty Sword", rarity: "Common" },
    { name: "Health Potion", rarity: "Common" },
    { name: "Glowing Ember", rarity: "Rare" },
    { name: "Dragon Scale", rarity: "Legendary" },
  ];

  const openChest = () => {
    setLoading(true);
    // Simulate "rolling" for loot
    setTimeout(() => {
      const randomItem = lootTable[Math.floor(Math.random() * lootTable.length)];
      setItem(randomItem);
      setLoading(false);
    }, 1000);
  };

  return (
    <main className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold mb-8 text-yellow-500">RPG Loot Room</h1>
      
      <div className="bg-slate-800 p-10 rounded-xl border-2 border-yellow-600 shadow-2xl text-center min-w-[300px]">
        {item ? (
          <div className="mb-6 animate-bounce">
            <p className="text-sm uppercase tracking-widest text-gray-400">{item.rarity}</p>
            <h2 className="text-3xl font-bold">{item.name}</h2>
          </div>
        ) : (
          <div className="mb-6 text-6xl">📦</div>
        )}

        <button 
          onClick={openChest}
          disabled={loading}
          className="bg-yellow-600 hover:bg-yellow-500 transition-colors px-6 py-3 rounded-full font-bold disabled:bg-gray-600"
        >
          {loading ? "Opening..." : "OPEN CHEST"}
        </button>
      </div>

      {item && (
        <button 
          onClick={() => setItem(null)} 
          className="mt-8 text-sm underline text-gray-400"
        >
          Reset Chest
        </button>
      )}
    </main>
  );
}