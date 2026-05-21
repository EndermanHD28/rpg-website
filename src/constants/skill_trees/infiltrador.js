/*
  ⚠️ EFFECTS RULE
  All status effects MUST be defined in src/constants/gameData.js (EFFECTS export).
*/
export const infiltrador = {
  name: "Infiltrador",
  boardMultiplier: { x: 1, y: 1 },
  skills: [
    {
      id: 'infiltrador_initial',
      name: 'Faca nas Costas',
      cost: 3,
      requirements: { agility: 8, intelligence: 8 },
      pos: { x: 0, y: 0 }, // Centralizado agora
      flavor: 'Invisível como uma sombra.',
      effect: 'Atacar inimigos **Distraídos** aumenta o **Dano Final** em **25%**.\nLibera a Árvore de Habilidades do **Infiltrador**.',
      logic: {}
    },

    // --- ROTA SUPERIOR ESQUERDA: O CRESCENTE DAS SOMBRAS ---
    {
      id: 'infiltrador_sombra_0',
      name: 'Passos de Veludo',
      cost: 1,
      requirements: { agility: 10 },
      pos: { x: -140, y: -80 }, 
      parent: 'infiltrador_initial',
      flavor: 'O silêncio é seu melhor amigo.',
      effect: 'Identidade desconhecida.',
      logic: {}
    },
    {
      id: 'infiltrador_sombra_1',
      name: 'Manto de Escuridão',
      cost: 1,
      requirements: { intelligence: 10 },
      pos: { x: -280, y: -140 }, 
      parent: 'infiltrador_sombra_0',
      flavor: 'Mesclando-se ao nada.',
      effect: 'Identidade desconhecida.',
      logic: {}
    },
    {
      id: 'infiltrador_sombra_2',
      name: 'Ventriloquismo',
      cost: 1,
      requirements: { intelligence: 12 },
      pos: { x: -380, y: -250 }, 
      parent: 'infiltrador_sombra_1',
      flavor: 'Uma voz no escuro para distrair a presa.',
      effect: 'Identidade desconhecida.',
      logic: {}
    },
    {
      id: 'infiltrador_sombra_3',
      name: 'Golpe Fantasmagórico',
      cost: 2,
      requirements: { agility: 14 },
      pos: { x: -250, y: -350 }, 
      parent: 'infiltrador_sombra_2',
      flavor: 'Atinja antes mesmo de ser notado.',
      effect: 'Identidade desconhecida.',
      logic: {}
    },
    {
      id: 'infiltrador_sombra_active',
      name: '????',
      isActivatable: true,
      cost: 2,
      requirements: { agility: 16, intelligence: 14 },
      pos: { x: -100, y: -420 }, 
      parent: 'infiltrador_sombra_3',
      flavor: 'Habilidade de elite.',
      effect: 'Bloqueado.',
      logic: {}
    },

    // --- ROTA SUPERIOR DIREITA: O FRAGMENTO ÁGIL (ZIGUE-ZAGUE) ---
    {
      id: 'infiltrador_agil_0',
      name: 'Reflexos de Lince',
      cost: 1,
      requirements: { agility: 10 },
      pos: { x: 140, y: -80 },
      parent: 'infiltrador_initial',
      flavor: 'Desvie antes que eles pensem em atacar.',
      effect: 'Identidade desconhecida.',
      logic: {}
    },
    {
      id: 'infiltrador_agil_1',
      name: 'Dança das Lâminas',
      cost: 1,
      requirements: { agility: 12 },
      pos: { x: 300, y: -40 }, 
      parent: 'infiltrador_agil_0',
      flavor: 'Um turbilhão de aço.',
      effect: 'Identidade desconhecida.',
      logic: {}
    },
    {
      id: 'infiltrador_agil_2',
      name: 'Ponto de Pressão',
      cost: 2,
      requirements: { precision: 12 },
      pos: { x: 220, y: -200 }, 
      parent: 'infiltrador_agil_1',
      flavor: 'Um toque basta se for no lugar certo.',
      effect: 'Identidade desconhecida.',
      logic: {}
    },
    {
      id: 'infiltrador_agil_satelite',
      name: 'Acrobatismo',
      cost: 1,
      requirements: { agility: 13 },
      pos: { x: 420, y: -140 }, 
      parent: 'infiltrador_agil_1',
      flavor: 'O chão é apenas uma sugestão.',
      effect: 'Identidade desconhecida.',
      logic: {}
    },
    {
      id: 'infiltrador_agil_3',
      name: 'Carrasco Veloz',
      cost: 1,
      requirements: { agility: 15 },
      pos: { x: 380, y: -300 }, 
      parent: 'infiltrador_agil_2',
      flavor: 'A execução é apenas um detalhe.',
      effect: 'Identidade desconhecida.',
      logic: {}
    },
    {
      id: 'infiltrador_agil_active',
      name: '????',
      isActivatable: true,
      cost: 2,
      requirements: { agility: 18 },
      pos: { x: 280, y: -450 },
      parent: 'infiltrador_agil_3',
      flavor: 'Habilidade de elite.',
      effect: 'Bloqueado.',
      logic: {}
    },

    // --- ROTA INFERIOR: O TRIDENTE DE SABOTAGEM ---
    {
      id: 'infiltrador_veneno_0',
      name: 'Estudioso de Toxinas',
      cost: 1,
      requirements: { intelligence: 10 },
      pos: { x: 0, y: 150 }, 
      parent: 'infiltrador_initial',
      flavor: 'O sangue deles ferverá.',
      effect: 'Identidade desconhecida.',
      logic: {}
    },
    {
      id: 'infiltrador_veneno_1',
      name: 'Lâmina Infectada',
      cost: 1,
      requirements: { intelligence: 11 },
      pos: { x: -160, y: 250 }, 
      parent: 'infiltrador_veneno_0',
      flavor: 'Cada corte é uma sentença de morte.',
      effect: 'Identidade desconhecida.',
      logic: {}
    },
    {
      id: 'infiltrador_veneno_2',
      name: 'Bombas de Efeito',
      cost: 1,
      requirements: { intelligence: 11 },
      pos: { x: 160, y: 250 }, 
      parent: 'infiltrador_veneno_0',
      flavor: 'Caos engarrafado.',
      effect: 'Identidade desconhecida.',
      logic: {}
    },
    {
      id: 'infiltrador_veneno_3',
      name: 'Sabotador de Sistemas',
      cost: 2,
      requirements: { intelligence: 13 },
      pos: { x: 0, y: 350 }, 
      parent: 'infiltrador_veneno_0',
      flavor: 'A tecnologia deles agora trabalha para mim.',
      effect: 'Identidade desconhecida.',
      logic: {}
    },
    {
      id: 'infiltrador_veneno_side',
      name: 'Gases Debilitantes',
      cost: 1,
      requirements: { intelligence: 14 },
      pos: { x: -300, y: 320 }, 
      parent: 'infiltrador_veneno_1',
      flavor: 'Respirar tornou-se um erro fatal.',
      effect: 'Identidade desconhecida.',
      logic: {}
    },
    {
      id: 'infiltrador_veneno_active',
      name: '????',
      isActivatable: true,
      cost: 2,
      requirements: { intelligence: 16 },
      pos: { x: 0, y: 500 },
      parent: 'infiltrador_veneno_3',
      flavor: 'Habilidade de elite.',
      effect: 'Bloqueado.',
      logic: {}
    },

    // --- SKILLS EXTRA / CONEXÕES DISTANTES ---
    {
      id: 'infiltrador_util_0',
      name: 'Batedor Solitário',
      cost: 2,
      requirements: { agility: 12, intelligence: 12 },
      pos: { x: 450, y: 100 }, 
      parent: 'infiltrador_initial',
      flavor: 'Sobrevivência acima de tudo.',
      effect: 'Identidade desconhecida.',
      logic: {}
    },
    {
      id: 'infiltrador_util_1',
      name: 'Olho do Furacão',
      cost: 2,
      requirements: { concentration: 15 },
      pos: { x: -450, y: 100 }, 
      parent: 'infiltrador_initial',
      flavor: 'Paciência é a virtude do carrasco.',
      effect: 'Identidade desconhecida.',
      logic: {}
    }
  ]
};