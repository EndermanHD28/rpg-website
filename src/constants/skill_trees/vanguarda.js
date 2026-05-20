export const vanguarda = {
  name: "Vanguarda",
  boardMultiplier: { x: 1, y: 1.5 },
  skills: [

    // Attack and Resist route

    {
      id: 'vanguarda_initial',
      name: 'Pelo Fio da Lâmina',
      cost: 3,
      requirements: { resistance: 7, strength: 7 },
      pos: { x: 0, y: 0 },
      flavor: 'Um guerreiro de grande destreza.',
      effect: 'Aumenta sua **Resistência** e **Força** em **+10%**.\nLibera a Árvore de Habilidades da **Vanguarda**.',
      logic: {
        stat_boosts: [
          { stat: 'resistance', amount: 0.10 },
          { stat: 'strength', amount: 0.10 }
        ]
      }
    },
    {
      id: 'vanguarda_resistance_0',
      name: 'Músculos de Aço I',
      cost: 1,
      requirements: { resistance: 7, aptitude: 6 },
      pos: { x: -60, y: -140 },
      parent: 'vanguarda_initial',
      flavor: 'Rota: Atacar e Resistir.',
      effect: 'Aumenta sua **Resistência** em **+5%**.',
      logic: {
        stat_boosts: [
          { stat: 'resistance', amount: 0.05 }
        ]
      }
    },
    {
      id: 'vanguarda_resistance_1',
      name: 'Postura Defensiva I',
      cost: 1,
      requirements: { aptitude: 10, resistance: 9 },
      pos: { x: -60, y: -240 },
      parent: 'vanguarda_resistance_0',
      flavor: 'Um escudo humano inabalável.',
      effect: 'Aumenta sua **Aptidão** em **+7%**.',
      logic: {
        stat_boosts: [
          { stat: 'aptitude', amount: 0.07 }
        ]
      }
    },
    {
      id: 'vanguarda_resistance_2',
      name: 'Músculos de Aço II',
      cost: 2,
      requirements: { resistance: 12, aptitude: 10 },
      pos: { x: -170, y: -140 },
      parent: 'vanguarda_resistance_0',
      flavor: 'Um escudo humano inabalável.',
      effect: 'Aumenta sua **Resistência** em **+5%**.',
      logic: {
        stat_boosts: [
          { stat: 'resistance', amount: 0.05 }
        ]
      }
    },
    {
      id: 'vanguarda_resistance_3',
      name: 'Postura Defensiva II',
      cost: 2,
      requirements: { aptitude: 15, resistance: 11 },
      pos: { x: -190, y: -240 },
      parent: 'vanguarda_resistance_1',
      flavor: 'Um escudo humano inabalável.',
      effect: 'Aumenta sua **Aptidão** em **+7%**.',
      logic: {
        stat_boosts: [
          { stat: 'aptitude', amount: 0.07 }
        ]
      }
    },
    {
      id: 'vanguarda_resistance_4',
      name: 'Inabalável',
      cost: 2,
      requirements: { aptitude: 16, resistance: 16 },
      pos: { x: -290, y: -350 },
      parent: 'vanguarda_resistance_3',
      flavor: 'Nada pode te derrubar.',
      effect: 'Reduz o **Dano de Postura** recebido em **20%** se a Vida for igual ou maior que **80%**.',
      logic: {
        posture_damage_received_boosts: [
          { amount: -0.20, condition: { type: 'min_hp_pct', value: 80 } }
        ]
      }
    },
    {
      id: 'vanguarda_resistance_5',
      name: 'Postura Agressiva I',
      cost: 1,
      requirements: { aptitude: 16, resistance: 16 },
      pos: { x: -160, y: -360 },
      parent: 'vanguarda_resistance_1',
      flavor: 'Tudo você pode derrubar.',
      effect: 'Se a **Postura** for igual ou maior que **50%**, cause **+7%** de **Dano Final** com **Armas Brancas**.',
      logic: {
        
      }
    },
    {
      id: 'vanguarda_resistance_6',
      name: 'Postura Agressiva II',
      cost: 1,
      requirements: { aptitude: 16, resistance: 16 },
      pos: { x: -110, y: -460 },
      parent: 'vanguarda_resistance_5',
      flavor: 'Tudo você pode derrubar.',
      effect: 'Se a **Postura** for igual ou maior que **50%**, cause **+7%** de **Dano Final** com **Armas Brancas**.',
      logic: {
        
      }
    },
    {
      id: 'vanguarda_resistance_7',
      name: 'Postura Agressiva III',
      cost: 1,
      requirements: { aptitude: 16, resistance: 16 },
      pos: { x: -60, y: -560 },
      parent: 'vanguarda_resistance_6',
      flavor: 'Tudo você pode derrubar.',
      effect: 'Se a **Postura** for igual ou maior que **50%**, cause **+7%** de **Dano Final** com **Armas Brancas**.',
      logic: {
        
      }
    },


    // Nulify and Counter Attack Route

    {
      id: 'vanguarda_counter_0',
      name: 'À Prova de Balas I',
      cost: 2,
      requirements: { resistance: 8, agility: 6 },
      pos: { x: 100, y: -100 },
      parent: 'vanguarda_initial',
      flavor: 'Rota: Anular e Revidar.',
      effect: 'Reduz o **Dano Final** recebido de **Armas de Fogo** em **15%**.',
      logic: {
        damage_received_boosts: [
          { amount: -0.15, condition: { type: 'weapon_category', value: 'Arma de Fogo' } }
        ]
      }
    },

    {
      id: 'vanguarda_counter_1',
      name: 'À Prova de Balas II',
      cost: 1,
      requirements: { resistance: 7, agility: 6 },
      pos: { x: 200, y: -100 },
      parent: 'vanguarda_counter_0',
      flavor: 'Disparos não me ferem.',
      effect: 'Reduz o **Dano Final** recebido de **Armas de Fogo** em **10%**.',
      logic: {
        damage_received_boosts: [
          { amount: -0.10, condition: { type: 'weapon_category', value: 'Arma de Fogo' } }
        ]
      }
    },

    {
      id: 'vanguarda_counter_2',
      name: 'À Prova de Balas III',
      cost: 1,
      requirements: { resistance: 7, agility: 6 },
      pos: { x: 300, y: -100 },
      parent: 'vanguarda_counter_1',
      flavor: 'Disparos não me ferem.',
      effect: 'Reduz o **Dano Final** recebido de **Armas de Fogo** em **10%**.',
      logic: {
        damage_received_boosts: [
          { amount: -0.1, condition: { type: 'weapon_category', value: 'Arma de Fogo' } }
        ]
      }
    },

    {
      id: 'vanguarda_counter_3',
      name: 'À Prova de Balas IV',
      cost: 2,
      requirements: { resistance: 7, agility: 6 },
      pos: { x: 400, y: -100 },
      parent: 'vanguarda_counter_2',
      flavor: 'Disparos não me ferem.',
      effect: 'Reduz o **Dano Final** recebido de **Armas de Fogo** em **10%**.',
      logic: {
        damage_received_boosts: [
          { amount: -0.1, condition: { type: 'weapon_category', value: 'Arma de Fogo' } }
        ]
      }
    },

    {
      id: 'vanguarda_counter_4',
      name: 'Desarmar',
      type: 'active',
      cost: 1,
      requirements: { strength: 13, agility: 9 },
      pos: { x: 200, y: 0 },
      parent: 'vanguarda_counter_0',
      flavor: 'Acerto certeiro!',
      effect: '**Uma vez por combate**, você pode realizar um ataque físico com uma **Arma Branca**: Se o Dado de Acerto for um Crítico, **Desarme** o alvo.',
      logic: {
        needsTarget: true,
        diceExpr: '1d{acerto}'
      }
    },

    {
      id: 'vanguarda_counter_5',
      name: 'Desarmar e Revidar',
      type: 'epic',
      cost: 2,
      requirements: { strength: 17, agility: 11 },
      pos: { x: 300, y: 0 },
      parent: 'vanguarda_counter_4',
      flavor: 'Chutaremos seus corpos!',
      effect: '**Uma vez por combate**, Ao **Desarmar** um alvo, você pode imediatamente atacá-lo (sem gastar turnos).',
      logic: {
      }
    }


  ]
};
