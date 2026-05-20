export const infiltrador = {
  name: "Infiltrador",
  skills: [
    {
      id: 'infiltrador_0',
      name: 'Passos Silenciosos',
      cost: 1,
      requirements: { agility: 8, intelligence: 8 },
      pos: { x: 0, y: -100 },
      flavor: 'Invisível como uma sombra.',
      effect: 'Aumenta sua chance de passar despercebido em **+20%**.',
      logic: {
        // This is a utility skill, we can add more logic types as needed
        stealth_boost: 0.20
      }
    }
  ]
};
