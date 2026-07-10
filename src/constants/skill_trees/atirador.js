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
      cost: 3,
      requirements: { precision: 8, concentration: 7 },
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
      id: 'atirador_critical_0',
      name: 'Acerto Vital',
      cost: 1,
      requirements: { precision: 11, concentration: 8 },
      pos: { x: -140, y: -100 }, // O "Cabo" do garfo
      isActivatable: true,
      parent: 'atirador_initial',
      flavor: 'Rota: Mira Perfeita.',
      effect: '**-Habilidade Ativa-**\nQuando você roletar um **Dado de Acerto** com uma **Arma de Fogo** que seja um **Crítico**: se o golpe sucedir, você pode aumentar o **Dano Final** em **50%**.',
      logic: {}
    },
    {
      id: 'atirador_critical_1',
      name: 'Longa Distância',
      cost: 1,
      requirements: { precision: 14 },
      pos: { x: -280, y: -160 }, // Dente 1 do garfo (Esquerda)
      parent: 'atirador_critical_0',
      flavor: 'Identidade desconhecida.',
      effect: 'Bloqueado.',
      logic: {}
    },
    {
      id: 'atirador_critical_2',
      name: 'Mira Estabilizada',
      cost: 2,
      requirements: { concentration: 12 },
      pos: { x: -100, y: -240 }, // Dente 2 do garfo (Direita/Cima)
      parent: 'atirador_critical_0',
      flavor: 'Identidade desconhecida.',
      effect: 'Bloqueado.',
      logic: {}
    },
    {
      id: 'atirador_critical_3',
      name: 'Projétil Magnético',
      cost: 1,
      requirements: { precision: 16 },
      pos: { x: -420, y: -200 }, // Extensão do dente 1
      parent: 'atirador_critical_1',
      flavor: 'Identidade desconhecida.',
      effect: 'Bloqueado.',
      logic: {}
    },
    {
      id: 'atirador_critical_active',
      name: '????',
      isActivatable: true,
      cost: 2,
      requirements: { precision: 18 },
      pos: { x: -250, y: -360 }, // Ponto de encontro visual no topo
      parent: 'atirador_critical_2',
      flavor: 'Habilidade de elite.',
      effect: 'Bloqueado.',
      logic: {}
    },

    // --- ROTA SUPERIOR DIREITA: O RAIO DE brute_powerIDADE (Zigue-zague) ---
    {
      id: 'atirador_brute_power_0',
      name: 'Saque Veloz',
      cost: 1,
      requirements: { precision: 9, brute_powerity: 8 },
      pos: { x: 150, y: -80 }, 
      isActivatable: true,
      parent: 'atirador_initial',
      flavor: 'Rota: Disparos Ágeis.',
      effect: '**-Habilidade Ativa-**\nAo realizar o seu primeiro **disparo** (ou sucessão de disparos) em um combate com um **Revólver** ou **Pistola**, você pode multiplicar o **Dado de Acerto** por **1,5x**.',
      logic: {}
    },
    {
      id: 'atirador_brute_power_1',
      name: 'Passos Curtos',
      cost: 1,
      requirements: { brute_powerity: 12 },
      pos: { x: 300, y: -60 }, // "Zigue" para a direita
      parent: 'atirador_brute_power_0',
      flavor: 'Identidade desconhecida.',
      effect: 'Bloqueado.',
      logic: {}
    },
    {
      id: 'atirador_brute_power_2',
      name: 'Recarga em Movimento',
      cost: 2,
      requirements: { concentration: 10 },
      pos: { x: 200, y: -180 }, // "Zague" voltando pro centro
      parent: 'atirador_brute_power_1',
      flavor: 'Identidade desconhecida.',
      effect: 'Bloqueado.',
      logic: {}
    },
    {
      id: 'atirador_brute_power_3',
      name: 'Fogo Cruzado',
      cost: 1,
      requirements: { brute_powerity: 15 },
      pos: { x: 380, y: -220 }, // Outro "Zigue"
      parent: 'atirador_brute_power_2',
      flavor: 'Identidade desconhecida.',
      effect: 'Bloqueado.',
      logic: {}
    },
    {
      id: 'atirador_brute_power_active',
      name: '????',
      isActivatable: true,
      cost: 2,
      requirements: { brute_powerity: 18 },
      pos: { x: 320, y: -380 }, 
      parent: 'atirador_brute_power_3',
      flavor: 'Habilidade de elite.',
      effect: 'Bloqueado.',
      logic: {}
    },

    // --- ROTA INFERIOR: A ÂNCORA TÁTICA ---
    {
      id: 'atirador_tactical_0',
      name: 'Sentido Aguçado',
      cost: 1,
      requirements: { intelligence: 10 },
      pos: { x: 0, y: 160 }, // Hub central da âncora
      parent: 'atirador_initial',
      flavor: 'Rota: Atirador Tático.',
      effect: 'Para cada **0,5%** de **Inteligência** após **8%**, aumente o **Dado de Acerto** em **3%** (Máximo: **+15%**).',
      logic: {
        passiveBuffs: {
          statAmount: 0.5, // Em porcentagem
          stat: 'intelligence',
          threshold: 8, // Em porcentagem
          base: 0.03, // Em decimal
          maxBuff: 0.15, // Em decimal
          target: 'acertoDice'
        }
      }
    },
    {
      id: 'atirador_tactical_1',
      name: 'Armadilhas Leves',
      cost: 1,
      requirements: { intelligence: 12 },
      pos: { x: -160, y: 260 }, // Perna esquerda
      parent: 'atirador_tactical_0',
      flavor: 'Identidade desconhecida.',
      effect: 'Bloqueado.',
      logic: {}
    },
    {
      id: 'atirador_tactical_2',
      name: 'Camuflagem Urbana',
      cost: 1,
      requirements: { brute_powerity: 11 },
      pos: { x: 160, y: 260 }, // Perna direita
      parent: 'atirador_tactical_0',
      flavor: 'Identidade desconhecida.',
      effect: 'Bloqueado.',
      logic: {}
    },
    {
      id: 'atirador_tactical_3',
      name: 'Pólvora Quimicamente Alterada',
      cost: 2,
      requirements: { intelligence: 15 },
      pos: { x: -300, y: 350 }, // Extensão da perna esquerda
      parent: 'atirador_tactical_1',
      flavor: 'Identidade desconhecida.',
      effect: 'Bloqueado.',
      logic: {}
    },
    {
      id: 'atirador_tactical_4',
      name: 'Sinalizador tático',
      cost: 1,
      requirements: { concentration: 14 },
      pos: { x: 300, y: 350 }, // Extensão da perna direita
      parent: 'atirador_tactical_2',
      flavor: 'Identidade desconhecida.',
      effect: 'Bloqueado.',
      logic: {}
    },
    {
      id: 'atirador_tactical_active',
      name: '????',
      isActivatable: true,
      cost: 2,
      requirements: { intelligence: 18 },
      pos: { x: 0, y: 480 }, // Fundo da âncora
      parent: 'atirador_tactical_3', // Conectado a um lado só para quebrar a simetria de requisitos
      flavor: 'Habilidade de elite.',
      effect: 'Bloqueado.',
      logic: {}
    },
  ]
};