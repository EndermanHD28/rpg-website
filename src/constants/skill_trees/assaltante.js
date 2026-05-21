/*
  ⚠️ EFFECTS RULE
  All status effects MUST be defined in src/constants/gameData.js (EFFECTS export).
  Skills must NOT construct effect objects inline — use addEffect() from the postRoll context instead.
  Example: addEffect('target', 'electrification', 2)
*/
export const assaltante = {
  name: "Assaltante",
  skills: [
    {
      id: 'assaltante_initial',
      name: 'Obcecado Pela Pólvora',
      cost: 3,
      requirements: { precision: 8, concentration: 6 },
      pos: { x: 0, y: 0 },
      flavor: 'Disparos em prol do orgulho.',
      effect: 'Aumenta o **Dano Final** de **Escopetas** e **Metralhadoras** em **+10%**.\nLibera a Árvore de Habilidades do **Assaltante**.',
      logic: {
        damage_boosts: [
          { amount: 0.10, condition: { type: 'weapon_subtype', value: 'Escopeta' } },
          { amount: 0.10, condition: { type: 'weapon_subtype', value: 'Metralhadora' } }
        ]
      }
    },

    {
      id: 'assaltante_machine_guns_0',
      name: 'Disparos e Mais Disparos!',
      cost: 1,
      requirements: { precision: 10, concentration: 7 },
      pos: { x: -70, y: -110 },
      parent: 'assaltante_initial',
      flavor: 'Excentricidade nas Balas!',
      effect: 'Aumenta o **Dano Final** de **Metralhadoras** em **+5%**\nAumenta o **Dano Final** de **Submetralhadoras** em **+3%**.',
      logic: {
        damage_boosts: [
          { amount: 0.05, condition: { type: 'weapon_subtype', value: 'Metralhadora' } },
          { amount: 0.03, condition: { type: 'weapon_subtype', value: 'Submetralhadora' } }
        ]
      }
    },



  ]
};
