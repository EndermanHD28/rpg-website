export const assaltante = {
  name: "Assaltante",
  skills: [{
      id: 'assaltante_0',
      name: 'Obcecado Pela Pólvora',
      cost: 3,
      requirements: { precision: 8, concentration: 6 },
      pos: { x: 0, y: 0 },
      flavor: 'Disparos em prol do orgulho.',
      effect: 'Aumenta o Dano de **Escopetas** e **Metralhadoras** em **+10%**.\nLibera a Árvore de Habilidades do **Assaltante**.',
      logic: {
        damage_boosts: [
          { amount: 0.10, condition: { type: 'weapon_subtype', value: 'Escopeta' } },
          { amount: 0.10, condition: { type: 'weapon_subtype', value: 'Metralhadora' } }
        ]
      }
    },
  ]
};
