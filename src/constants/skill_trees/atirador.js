/*
  ⚠️ EFFECTS RULE
  All status effects MUST be defined in src/constants/gameData.js (EFFECTS export).
  Skills must NOT construct effect objects inline — use addEffect() from the postRoll context instead.
  Example: addEffect('target', 'electrification', 2)
*/
export const atirador = {
  name: "Atirador",
  skills: [
    {
      id: 'atirador_0',
      name: 'Foco no Alvo',
      cost: 1,
      requirements: { precision: 10 },
      pos: { x: 0, y: -100 },
      flavor: 'Um tiro, uma morte.',
      effect: 'Aumenta seu **Dado de Acerto** com armas de fogo em **+10%**.',
      logic: {
        dice_boosts: [
          { type: 'acerto', amount: 0.10, condition: { type: 'weapon_category', value: 'Arma de Fogo' } }
        ]
      }
    }
  ]
};
