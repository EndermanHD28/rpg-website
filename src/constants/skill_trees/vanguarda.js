/*
  ⚠️ EFFECTS RULE
  All status effects MUST be defined in src/constants/gameData.js (EFFECTS export).
*/
export const vanguarda = {
  name: "Vanguarda",
  boardMultiplier: { x: 1, y: 1.5 },
  skills: [

    // --- ROTA 1: ATACAR E RESISTIR (Superior Esquerda) ---

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
        stat_boosts: [{ stat: 'resistance', amount: 0.05 }]
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
        stat_boosts: [{ stat: 'aptitude', amount: 0.07 }]
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
      effect: 'Aumenta sua **Resistência** em **+7%**.',
      logic: {
        stat_boosts: [{ stat: 'resistance', amount: 0.07 }]
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
      effect: 'Aumenta sua **Aptidão** em **+10%**.',
      logic: {
        stat_boosts: [{ stat: 'aptitude', amount: 0.1 }]
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
    // NOVO SATÉLITE DE RESISTÊNCIA
    {
      id: 'vanguarda_resistance_peak',
      name: 'Bastião Inquebrável',
      cost: 2,
      requirements: { resistance: 18 },
      pos: { x: -420, y: -250 }, // Fora do eixo principal
      parent: 'vanguarda_resistance_2',
      flavor: 'Uma montanha não se move.',
      effect: 'Identidade desconhecida.',
      logic: {}
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
      logic: {}
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
      logic: {}
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
      logic: {}
    },

    // --- ROTA 2: ANULAR E REVIDAR (Superior Direita) ---

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
      pos: { x: 220, y: -120 }, // Leve ajuste de respiro
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
      pos: { x: 340, y: -120 },
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
      pos: { x: 460, y: -120 },
      parent: 'vanguarda_counter_2',
      flavor: 'Disparos não me ferem.',
      effect: 'Reduz o **Dano Final** recebido de **Armas de Fogo** em **10%**.',
      logic: {
        damage_received_boosts: [
          { amount: -0.1, condition: { type: 'weapon_category', value: 'Arma de Fogo' } }
        ]
      }
    },
    // NOVO SATÉLITE DE CONTRA-ATAQUE
    {
      id: 'vanguarda_counter_reflect',
      name: 'Reflexo de Lâmina',
      cost: 2,
      requirements: { agility: 12 },
      pos: { x: 400, y: -240 }, // Sobe em relação à linha de balas
      parent: 'vanguarda_counter_2',
      flavor: 'Devolvendo o presente.',
      effect: 'Identidade desconhecida.',
      logic: {}
    },

    {
      id: 'vanguarda_counter_4',
      name: 'Desarmar',
      isActivatable: true,
      cost: 1,
      requirements: { strength: 13, agility: 9 },
      pos: { x: 220, y: 10 },
      parent: 'vanguarda_counter_0',
      flavor: 'Acerto certeiro!',
      effect: '**-Habilidade Ativa-**\n**Uma vez por combate**, você pode realizar um ataque físico com uma **Arma Branca**: Se o Dado de Acerto for um Crítico, **Desarme** o alvo.',
      logic: {
        needsTarget: true,
        diceExpr: '1d{acerto}',
        postRoll: async ({ addEffect, result, targetChar, showToast }) => {
          if (result.status === 'Crítico' && targetChar) {
            await addEffect('target', 'disarmed', 2);
            showToast?.(`${targetChar.char_name || targetChar.name} foi Desarmado!`);
          }
        }
      }
    },
    {
      id: 'vanguarda_counter_5',
      name: 'Desarmar e Revidar',
      isActivatable: true,
      type: 'epic',
      cost: 2,
      requirements: { strength: 17, agility: 11 },
      pos: { x: 360, y: 20 },
      parent: 'vanguarda_counter_4',
      flavor: 'Chutaremos seus corpos!',
      effect: '**-Habilidade Ativa-**\n**Uma vez por combate**, Ao **Desarmar** um alvo, você pode imediatamente atacá-lo (sem gastar turnos).',
      logic: {}
    },

    // --- ROTA 3: ESMAGAR E CONTROLAR (Inferior - NOVA) ---

    {
      id: 'vanguarda_heavy_0',
      name: 'Peso do Julgamento',
      cost: 2,
      requirements: { strength: 10 },
      pos: { x: 0, y: 180 }, // Desce preenchendo o vazio
      parent: 'vanguarda_initial',
      flavor: 'Cada golpe racha o solo.',
      effect: 'Aumenta o **Dano Final** de **Armas Pesadas** em **+10%**.',
      logic: {}
    },
    {
      id: 'vanguarda_heavy_1',
      name: 'Impacto Sísmico',
      cost: 1,
      requirements: { strength: 12 },
      pos: { x: -140, y: 300 }, // Perna esquerda da âncora
      parent: 'vanguarda_heavy_0',
      flavor: 'Faça a terra tremer.',
      effect: 'Identidade desconhecida.',
      logic: {}
    },
    {
      id: 'vanguarda_heavy_2',
      name: 'Onda de Choque',
      cost: 1,
      requirements: { resistance: 10 },
      pos: { x: 140, y: 300 }, // Perna direita da âncora
      parent: 'vanguarda_heavy_0',
      flavor: 'O ar se expande com a força do golpe.',
      effect: 'Identidade desconhecida.',
      logic: {}
    },
    {
      id: 'vanguarda_heavy_3',
      name: 'Quebra-Crânios',
      cost: 2,
      requirements: { strength: 15 },
      pos: { x: -250, y: 420 }, // Extensão da perna esquerda
      parent: 'vanguarda_heavy_1',
      flavor: 'Armaduras são inúteis contra o peso bruto.',
      effect: 'Identidade desconhecida.',
      logic: {}
    },
    {
      id: 'vanguarda_heavy_active',
      name: '????',
      isActivatable: true,
      cost: 2,
      requirements: { strength: 18, resistance: 14 },
      pos: { x: 0, y: 550 }, // Fundo da âncora (Coração do controle)
      parent: 'vanguarda_heavy_2',
      flavor: 'O mundo para quando você decide.',
      effect: 'Bloqueado.',
      logic: {}
    }
  ]
};