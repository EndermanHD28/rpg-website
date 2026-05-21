/*
  ⚠️ EFFECTS RULE
  All status effects MUST be defined in src/constants/gameData.js (EFFECTS export).
  Skills must NOT construct effect objects inline — use addEffect() from the postRoll context instead.
  Example: addEffect('target', 'electrification', 2)
*/
export const artista = {
  name: "Artista",
  skills: [
    {
      id: 'artista_initial',
      name: 'Glória Artística',
      cost: 1,
      requirements: { charisma: 10 },
      pos: { x: 0, y: -100 },
      flavor: 'Cada movimento é uma performance.',
      effect: 'Ganha **+10%** de **Sorte** em combates assistidos.'
    },
    {
      id: 'artista_exhibicionist_0',
      name: 'Golpe Estilizado',
      cost: 2,
      requirements: { agility: 12, charisma: 12 },
      pos: { x: -100, y: -200 },
      parent: 'artista_initial',
      flavor: 'Um ataque tão belo quanto mortal.',
      effect: 'Seu próximo ataque tem **+15%** de chance de Crítico.'
    }
  ]
};
