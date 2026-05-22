/*
  ⚠️ EFFECTS RULE
  All status effects MUST be defined in src/constants/gameData.js (EFFECTS export).
*/
export const assaltante = {
  name: "Assaltante",
  boardMultiplier: { x: 0.8, y: 1.25 },
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

    // --- ROTA INFERIOR: CHUVA DE BALAS (Metralhadoras / SMGs) ---
    // Esta rota desce e se espalha como se fosse o "coice" de uma arma automática.

    {
      id: 'assaltante_machine_guns_0',
      name: 'Disparos e Mais Disparos!',
      cost: 1,
      requirements: { precision: 10, concentration: 7 },
      pos: { x: -60, y: 120 }, // DESCE
      parent: 'assaltante_initial',
      flavor: 'Excentricidade nas Balas!',
      effect: 'Aumenta **Precisão** em **+3%**.\nAumenta o **Dano Final** de **Metralhadoras** e **Submetralhadoras** em **+3%**.',
      logic: {
        damage_boosts: [
          { amount: 0.03, condition: { type: 'weapon_subtype', value: 'Metralhadora' } },
          { amount: 0.03, condition: { type: 'weapon_subtype', value: 'Submetralhadora' } }
        ],
        stat_boosts: [
          { stat: 'precision', amount: 0.03 }
        ]
      }
    },
    {
      id: 'assaltante_mg_1',
      name: 'Cano Aquecido',
      cost: 1,
      requirements: { concentration: 9 },
      pos: { x: -180, y: 200 },
      parent: 'assaltante_machine_guns_0',
      flavor: 'O metal começa a cantar.',
      effect: 'Identidade desconhecida.',
      logic: {}
    },
    {
      id: 'assaltante_mg_2',
      name: 'Pente Estendido',
      cost: 2,
      requirements: { concentration: 12 },
      pos: { x: -100, y: 320 },
      parent: 'assaltante_mg_1',
      flavor: 'Nunca é munição o suficiente.',
      effect: 'Identidade desconhecida.',
      logic: {}
    },
    {
      id: 'assaltante_mg_side_1',
      name: 'Fogo de Supressão',
      cost: 1,
      requirements: { precision: 11 },
      pos: { x: -280, y: 150 }, // RAMIFICAÇÃO PARA O LADO
      parent: 'assaltante_mg_1',
      flavor: 'Mantenha a cabeça deles abaixada.',
      effect: 'Identidade desconhecida.',
      logic: {}
    },
    {
      id: 'assaltante_mg_active',
      name: '????',
      isActivatable: true,
      cost: 2,
      requirements: { concentration: 15 },
      pos: { x: -220, y: 400 },
      parent: 'assaltante_mg_2',
      flavor: 'Habilidade de elite.',
      effect: 'Bloqueado.',
      logic: {}
    },
    {
      id: 'assaltante_mg_epic',
      name: '????',
      type: 'epic',
      cost: 3,
      requirements: { precision: 20, concentration: 18 },
      pos: { x: -150, y: 550 }, // O FIM DA LINHA INFERIOR
      parent: 'assaltante_mg_active',
      flavor: 'Identidade desconhecida.',
      effect: 'Bloqueado.',
      logic: {}
    },

    // --- ROTA SUPERIOR ESQUERDA: CALIBRE PESADO (Escopetas) ---
    // Uma rota tortuosa e agressiva.

    {
      id: 'assaltante_shotguns_0',
      name: 'Finalizar de uma vez.',
      cost: 2,
      requirements: { precision: 9, strength: 7, resistance: 6},
      pos: { x: -140, y: -100 }, // SOBE ESQUERDA
      parent: 'assaltante_initial',
      flavor: 'Excentricidade nas Balas!',
      effect: 'Aumenta **Precisão** em **+5%**.\nAumenta o **Dano Final** de **Escopetas** em **+6%**.',
      logic: {
        damage_boosts: [
          { amount: 0.06, condition: { type: 'weapon_subtype', value: 'Escopeta' } }
        ],
        stat_boosts: [
          { stat: 'precision', amount: 0.05 }
        ]
      }
    },
    {
      id: 'assaltante_sg_1',
      name: 'Chumbo Grosso',
      cost: 1,
      requirements: { strength: 10 },
      pos: { x: -280, y: -140 },
      parent: 'assaltante_shotguns_0',
      flavor: 'Sinta o impacto.',
      effect: 'Identidade desconhecida.',
      logic: {}
    },
    {
      id: 'assaltante_sg_2',
      name: 'Arrombador',
      cost: 2,
      requirements: { strength: 13, resistance: 10 },
      pos: { x: -220, y: -260 },
      parent: 'assaltante_sg_1',
      flavor: 'Portas são apenas sugestões.',
      effect: 'Identidade desconhecida.',
      logic: {}
    },
    {
      id: 'assaltante_sg_side_1',
      name: 'Cano Serrado',
      cost: 1,
      requirements: { agility: 9 },
      pos: { x: -380, y: -200 }, // ISOLADO PARA A ESQUERDA
      parent: 'assaltante_sg_1',
      flavor: 'Portabilidade letal.',
      effect: 'Identidade desconhecida.',
      logic: {}
    },
    {
      id: 'assaltante_sg_active',
      name: '????',
      isActivatable: true,
      cost: 2,
      requirements: { strength: 16 },
      pos: { x: -350, y: -380 },
      parent: 'assaltante_sg_2',
      flavor: 'Pura brutalidade.',
      effect: 'Bloqueado.',
      logic: {}
    },
    {
      id: 'assaltante_sg_epic',
      name: '????',
      type: 'epic',
      cost: 4,
      requirements: { strength: 22, resistance: 18 },
      pos: { x: -480, y: -500 }, // FIM DA ROTA ESQUERDA
      parent: 'assaltante_sg_active',
      flavor: 'Identidade desconhecida.',
      effect: 'Bloqueado.',
      logic: {}
    },

    // --- ROTA SUPERIOR DIREITA: INFILTRADOR OPERACIONAL (Utilidades / Tático) ---
    // Uma rota em formato de "S" com satélites de utilitários.

    {
      id: 'assaltante_util_0',
      name: 'Saque Veloz',
      cost: 1,
      requirements: { agility: 8 },
      pos: { x: 120, y: -90 }, // SOBE DIREITA
      parent: 'assaltante_initial',
      flavor: 'A mão é mais rápida.',
      effect: 'Identidade desconhecida.',
      logic: {}
    },
    {
      id: 'assaltante_util_1',
      name: 'Bandoleira Tática',
      cost: 1,
      requirements: { agility: 10 },
      pos: { x: 220, y: -180 },
      parent: 'assaltante_util_0',
      flavor: 'Tudo ao alcance dos dedos.',
      effect: 'Identidade desconhecida.',
      logic: {}
    },
    {
      id: 'assaltante_util_sat_1',
      name: 'Mãos Leves',
      cost: 1,
      requirements: { agility: 11 },
      pos: { x: 340, y: -120 }, // SATÉLITE PARA FORA
      parent: 'assaltante_util_1',
      flavor: 'Recarga sob pressão.',
      effect: 'Identidade desconhecida.',
      logic: {}
    },
    {
      id: 'assaltante_util_2',
      name: 'Granadeiro de Assalto',
      cost: 2,
      requirements: { concentration: 11 },
      pos: { x: 180, y: -300 }, // CURVA DE VOLTA
      parent: 'assaltante_util_1',
      flavor: 'Explosões resolvem problemas.',
      effect: 'Identidade desconhecida.',
      logic: {}
    },
    {
      id: 'assaltante_util_3',
      name: 'Instinto de Sobrevivência',
      cost: 1,
      requirements: { resistance: 12 },
      pos: { x: 300, y: -380 },
      parent: 'assaltante_util_2',
      flavor: 'Correr é viver.',
      effect: 'Identidade desconhecida.',
      logic: {}
    },
    {
      id: 'assaltante_util_active',
      name: '????',
      isActivatable: true,
      cost: 2,
      requirements: { agility: 15, concentration: 15 },
      pos: { x: 250, y: -500 },
      parent: 'assaltante_util_3',
      flavor: 'Tática suprema.',
      effect: 'Bloqueado.',
      logic: {}
    },
    {
      id: 'assaltante_util_epic',
      name: '????',
      type: 'epic',
      cost: 3,
      requirements: { agility: 20 },
      pos: { x: 420, y: -550 }, // FIM DA ROTA DIREITA
      parent: 'assaltante_util_active',
      flavor: 'Identidade desconhecida.',
      effect: 'Bloqueado.',
      logic: {}
    },

    // --- ROTA SECRETA / BÔNUS (OPCIONAL) ---
    {
      id: 'assaltante_extra_1',
      name: 'Sede de Sangue',
      cost: 2,
      requirements: { strength: 12, agility: 12 },
      pos: { x: 180, y: 150 }, // Única que "cai" para o sudeste
      parent: 'assaltante_initial',
      flavor: 'O caos te alimenta.',
      effect: 'Identidade desconhecida.',
      logic: {}
    }
  ]
};