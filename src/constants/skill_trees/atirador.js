/*
  ⚠️ EFFECTS RULE
  All status effects MUST be defined in src/constants/gameData.js (EFFECTS export).
*/
export const atirador = {
  name: "Atirador",
  boardMultiplier: { x: 0.8, y: 1.1 },
  skills: [
    {
      id: 'atirador_initial',
      name: 'Foco no Alvo',
      cost: 1,
      requirements: { precision: 10 },
      pos: { x: 0, y: 0 },
      flavor: 'Um tiro, uma morte.',
      effect: 'Aumenta seu **Dado de Acerto** com armas de fogo em **+10%**.\nLibera a Árvore de Habilidades do **Atirador**.',
      logic: {
        dice_boosts: [
          { type: 'acerto', amount: 0.10, condition: { type: 'weapon_category', value: 'Arma de Fogo' } }
        ]
      }
    },

    // --- ROTA SUPERIOR ESQUERDA: O GARFO DE PRECISÃO ---
    {
      id: 'atirador_precisao_0',
      name: 'Olhar de Águia',
      cost: 1,
      requirements: { precision: 12 },
      pos: { x: -140, y: -100 }, // O "Cabo" do garfo
      parent: 'atirador_initial',
      flavor: 'Identidade desconhecida.',
      effect: 'Bloqueado.',
      logic: {}
    },
    {
      id: 'atirador_precisao_1',
      name: 'Longa Distância',
      cost: 1,
      requirements: { precision: 14 },
      pos: { x: -280, y: -160 }, // Dente 1 do garfo (Esquerda)
      parent: 'atirador_precisao_0',
      flavor: 'Identidade desconhecida.',
      effect: 'Bloqueado.',
      logic: {}
    },
    {
      id: 'atirador_precisao_2',
      name: 'Mira Estabilizada',
      cost: 2,
      requirements: { concentration: 12 },
      pos: { x: -100, y: -240 }, // Dente 2 do garfo (Direita/Cima)
      parent: 'atirador_precisao_0',
      flavor: 'Identidade desconhecida.',
      effect: 'Bloqueado.',
      logic: {}
    },
    {
      id: 'atirador_precisao_3',
      name: 'Projétil Magnético',
      cost: 1,
      requirements: { precision: 16 },
      pos: { x: -420, y: -200 }, // Extensão do dente 1
      parent: 'atirador_precisao_1',
      flavor: 'Identidade desconhecida.',
      effect: 'Bloqueado.',
      logic: {}
    },
    {
      id: 'atirador_precisao_active',
      name: '????',
      isActivatable: true,
      cost: 2,
      requirements: { precision: 18 },
      pos: { x: -250, y: -360 }, // Ponto de encontro visual no topo
      parent: 'atirador_precisao_2',
      flavor: 'Habilidade de elite.',
      effect: 'Bloqueado.',
      logic: {}
    },

    // --- ROTA SUPERIOR DIREITA: O RAIO DE AGILIDADE (Zigue-zague) ---
    {
      id: 'atirador_agil_0',
      name: 'Saque Veloz',
      cost: 1,
      requirements: { agility: 10 },
      pos: { x: 150, y: -80 }, 
      parent: 'atirador_initial',
      flavor: 'Identidade desconhecida.',
      effect: 'Bloqueado.',
      logic: {}
    },
    {
      id: 'atirador_agil_1',
      name: 'Passos Curtos',
      cost: 1,
      requirements: { agility: 12 },
      pos: { x: 300, y: -40 }, // "Zigue" para a direita
      parent: 'atirador_agil_0',
      flavor: 'Identidade desconhecida.',
      effect: 'Bloqueado.',
      logic: {}
    },
    {
      id: 'atirador_agil_2',
      name: 'Recarga em Movimento',
      cost: 2,
      requirements: { concentration: 10 },
      pos: { x: 200, y: -180 }, // "Zague" voltando pro centro
      parent: 'atirador_agil_1',
      flavor: 'Identidade desconhecida.',
      effect: 'Bloqueado.',
      logic: {}
    },
    {
      id: 'atirador_agil_3',
      name: 'Fogo Cruzado',
      cost: 1,
      requirements: { agility: 15 },
      pos: { x: 380, y: -220 }, // Outro "Zigue"
      parent: 'atirador_agil_2',
      flavor: 'Identidade desconhecida.',
      effect: 'Bloqueado.',
      logic: {}
    },
    {
      id: 'atirador_agil_active',
      name: '????',
      isActivatable: true,
      cost: 2,
      requirements: { agility: 18 },
      pos: { x: 320, y: -380 }, 
      parent: 'atirador_agil_3',
      flavor: 'Habilidade de elite.',
      effect: 'Bloqueado.',
      logic: {}
    },

    // --- ROTA INFERIOR: A ÂNCORA TÁTICA ---
    {
      id: 'atirador_tatico_0',
      name: 'Sentido Aguçado',
      cost: 1,
      requirements: { intelligence: 10 },
      pos: { x: 0, y: 160 }, // Hub central da âncora
      parent: 'atirador_initial',
      flavor: 'Identidade desconhecida.',
      effect: 'Bloqueado.',
      logic: {}
    },
    {
      id: 'atirador_tatico_1',
      name: 'Armadilhas Leves',
      cost: 1,
      requirements: { intelligence: 12 },
      pos: { x: -160, y: 260 }, // Perna esquerda
      parent: 'atirador_tatico_0',
      flavor: 'Identidade desconhecida.',
      effect: 'Bloqueado.',
      logic: {}
    },
    {
      id: 'atirador_tatico_2',
      name: 'Camuflagem Urbana',
      cost: 1,
      requirements: { agility: 11 },
      pos: { x: 160, y: 260 }, // Perna direita
      parent: 'atirador_tatico_0',
      flavor: 'Identidade desconhecida.',
      effect: 'Bloqueado.',
      logic: {}
    },
    {
      id: 'atirador_tatico_3',
      name: 'Pólvora Quimicamente Alterada',
      cost: 2,
      requirements: { intelligence: 15 },
      pos: { x: -300, y: 350 }, // Extensão da perna esquerda
      parent: 'atirador_tatico_1',
      flavor: 'Identidade desconhecida.',
      effect: 'Bloqueado.',
      logic: {}
    },
    {
      id: 'atirador_tatico_4',
      name: 'Sinalizador tático',
      cost: 1,
      requirements: { concentration: 14 },
      pos: { x: 300, y: 350 }, // Extensão da perna direita
      parent: 'atirador_tatico_2',
      flavor: 'Identidade desconhecida.',
      effect: 'Bloqueado.',
      logic: {}
    },
    {
      id: 'atirador_tatico_active',
      name: '????',
      isActivatable: true,
      cost: 2,
      requirements: { intelligence: 18 },
      pos: { x: 0, y: 480 }, // Fundo da âncora
      parent: 'atirador_tatico_3', // Conectado a um lado só para quebrar a simetria de requisitos
      flavor: 'Habilidade de elite.',
      effect: 'Bloqueado.',
      logic: {}
    },

    // --- SKILL ÉPICA FINAL (CONVERGÊNCIA) ---
    // Colocada em um lugar de destaque, mas sem conexão direta com as rotas
    // (O jogador verá os requisitos altos e saberá que é o objetivo final)
    {
      id: 'atirador_master_epic',
      name: 'O Último Suspiro',
      type: 'epic',
      cost: 5,
      requirements: { precision: 25, agility: 20, intelligence: 18 },
      pos: { x: 500, y: 0 }, // Totalmente isolada à direita
      parent: 'atirador_initial', 
      flavor: 'A lenda que nunca erra.',
      effect: 'Bloqueado.',
      logic: {}
    }
  ]
};