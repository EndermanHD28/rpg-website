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
      requirements: { agility: 8, intelligence: 6 },
      pos: { x: 0, y: 0 }, // Centralizado agora
      flavor: 'Invisível como uma sombra.',
      effect: 'A primeira vez que atacar um inimigo **Distraído** você pode aumentar o **Dano Final** em **25%**.\nLibera a Árvore de Habilidades do **Infiltrador**.',
      logic: {}
    },

    // --- ROTA SUPERIOR ESQUERDA: O CRESCENTE DAS SOMBRAS ---
    {
      id: 'infiltrador_direct_fighter_0',
      name: 'Ataque Imprevisível',
      cost: 1,
      requirements: { agility: 10 },
      pos: { x: -140, y: -80 }, 
      parent: 'infiltrador_initial',
      flavor: 'Rota: Atacar Disfarçadamente.',
      effect: 'Ao rolar um **Dado de Acerto Crítico**, você pode realizar um **Ataque de Arremesso** em adição ao golpe (você ainda precisará rolar um **Dado de Acerto**).',
      logic: {}
    },
    {
      id: 'infiltrador_direct_fighter_1',
      name: 'Manto de Escuridão',
      cost: 1,
      requirements: { intelligence: 10 },
      pos: { x: -280, y: -140 }, 
      parent: 'infiltrador_direct_fighter_0',
      flavor: 'Mesclando-se ao nada.',
      effect: 'Identidade desconhecida.',
      logic: {}
    },
    {
      id: 'infiltrador_direct_fighter_2',
      name: 'Ventriloquismo',
      cost: 1,
      requirements: { intelligence: 12 },
      pos: { x: -380, y: -250 }, 
      parent: 'infiltrador_direct_fighter_1',
      flavor: 'Uma voz no escuro para distrair a presa.',
      effect: 'Identidade desconhecida.',
      logic: {}
    },
    {
      id: 'infiltrador_direct_fighter_3',
      name: 'Golpe Fantasmagórico',
      cost: 2,
      requirements: { agility: 14 },
      pos: { x: -250, y: -350 }, 
      parent: 'infiltrador_direct_fighter_2',
      flavor: 'Atinja antes mesmo de ser notado.',
      effect: 'Identidade desconhecida.',
      logic: {}
    },
    {
      id: 'infiltrador_direct_fighter_active',
      name: '????',
      isActivatable: true,
      cost: 2,
      requirements: { agility: 16, intelligence: 14 },
      pos: { x: -100, y: -420 }, 
      parent: 'infiltrador_direct_fighter_3',
      flavor: 'Habilidade de elite.',
      effect: 'Bloqueado.',
      logic: {}
    },

    // --- ROTA SUPERIOR DIREITA: O FRAGMENTO ÁGIL (ZIGUE-ZAGUE) ---
    {
      id: 'infiltrador_agile_0',
      name: 'Silêncio Mortífero',
      cost: 1,
      requirements: { agility: 9, concentration: 8 },
      pos: { x: 140, y: -80 },
      parent: 'infiltrador_initial',
      flavor: 'Rota: Ferro e Fogo.',
      effect: 'Aumente o **Dano Final** de **Lâminas Curtas** e **Pistolas** em **+5%**.',
      
      logic: {
        damage_boosts: [
          { amount: 0.05, condition: { type: 'weapon_subtype', value: 'Lâmina Curta' } },          
          { amount: 0.05, condition: { type: 'weapon_subtype', value: 'Pistola' } }
        ],
      }
    },
    {
      id: 'infiltrador_agile_1',
      name: 'Dança das Lâminas',
      cost: 1,
      requirements: { agility: 12 },
      pos: { x: 300, y: -40 }, 
      parent: 'infiltrador_agile_0',
      flavor: 'Um turbilhão de aço.',
      effect: 'Identidade desconhecida.',
      logic: {}
    },
    {
      id: 'infiltrador_agile_2',
      name: 'Ponto de Pressão',
      cost: 2,
      requirements: { precision: 12 },
      pos: { x: 220, y: -200 }, 
      parent: 'infiltrador_agile_1',
      flavor: 'Um toque basta se for no lugar certo.',
      effect: 'Identidade desconhecida.',
      logic: {}
    },
    {
      id: 'infiltrador_agile_satelite',
      name: 'Acrobatismo',
      cost: 1,
      requirements: { agility: 13 },
      pos: { x: 420, y: -140 }, 
      parent: 'infiltrador_agile_1',
      flavor: 'O chão é apenas uma sugestão.',
      effect: 'Identidade desconhecida.',
      logic: {}
    },
    {
      id: 'infiltrador_agile_3',
      name: 'Carrasco Veloz',
      cost: 1,
      requirements: { agility: 15 },
      pos: { x: 380, y: -300 }, 
      parent: 'infiltrador_agile_2',
      flavor: 'A execução é apenas um detalhe.',
      effect: 'Identidade desconhecida.',
      logic: {}
    },
    {
      id: 'infiltrador_agile_active',
      name: '????',
      isActivatable: true,
      cost: 2,
      requirements: { agility: 18 },
      pos: { x: 280, y: -450 },
      parent: 'infiltrador_agile_3',
      flavor: 'Habilidade de elite.',
      effect: 'Bloqueado.',
      logic: {}
    },

    // --- ROTA INFERIOR: O TRIDENTE DE SABOTAGEM ---
    {
      id: 'infiltrador_shadow_0',
      name: 'Vulto Habilidoso',
      cost: 1,
      requirements: { concentration: 8, intelligence: 7 },
      pos: { x: 0, y: 150 }, 
      parent: 'infiltrador_initial',
      flavor: 'Rota: Furtador Invisível.',
      effect: 'Ao esgueirar-se, você pode aumentar o **Dado de Sucesso** em **+4**.',
      logic: {}
    },
    {
      id: 'infiltrador_shadow_1',
      name: 'Lâmina Infectada',
      cost: 1,
      requirements: { intelligence: 11 },
      pos: { x: -160, y: 250 }, 
      parent: 'infiltrador_shadow_0',
      flavor: 'Cada corte é uma sentença de morte.',
      effect: 'Identidade desconhecida.',
      logic: {}
    },
    {
      id: 'infiltrador_shadow_2',
      name: 'Bombas de Efeito',
      cost: 1,
      requirements: { intelligence: 11 },
      pos: { x: 160, y: 250 }, 
      parent: 'infiltrador_shadow_0',
      flavor: 'Caos engarrafado.',
      effect: 'Identidade desconhecida.',
      logic: {}
    },
    {
      id: 'infiltrador_shadow_3',
      name: 'Sabotador de Sistemas',
      cost: 2,
      requirements: { intelligence: 13 },
      pos: { x: 0, y: 300 }, 
      parent: 'infiltrador_shadow_0',
      flavor: 'A tecnologia deles agora trabalha para mim.',
      effect: 'Identidade desconhecida.',
      logic: {}
    },
    {
      id: 'infiltrador_shadow_side',
      name: 'Gases Debilitantes',
      cost: 1,
      requirements: { intelligence: 14 },
      pos: { x: -300, y: 320 }, 
      parent: 'infiltrador_shadow_1',
      flavor: 'Respirar tornou-se um erro fatal.',
      effect: 'Identidade desconhecida.',
      logic: {}
    },
    {
      id: 'infiltrador_shadow_active',
      name: '????',
      isActivatable: true,
      cost: 2,
      requirements: { intelligence: 16 },
      pos: { x: 0, y: 450 },
      parent: 'infiltrador_shadow_3',
      flavor: 'Habilidade de elite.',
      effect: 'Bloqueado.',
      logic: {}
    },

    // --- SKILLS EXTRA / CONEXÕES DISTANTES ---
    {
      id: 'infiltrador_monster_0',
      name: 'As Sombras Atacam!',
      cost: 2,
      requirements: { concentration: 15, agility: 12 },
      pos: { x: 200, y: 100 },
      type: 'epic',
      requiredClass: 'Infiltrador',
      parent: 'infiltrador_initial',
      flavor: 'Rota: Monstro das Sombras',
      effect: 'A primeira vez que atacar um inimigo **Distraído** com uma **Lâmina Curta**: caso a **Vitalidade** do alvo seja igual ou menor que **40%**, você pode **nocauteá-lo** instantaneamente.',
      logic: {}
    },
    {
      id: 'infiltrador_monster_1',
      name: 'Batedor Solitário',
      cost: 2,
      requirements: { agility: 18, intelligence: 11 },
      pos: { x: 400, y: 100 }, 
      parent: 'infiltrador_monster_0',
      flavor: 'Sobrevivência acima de tudo.',
      effect: 'Ao nocautear ou finalizar um inimigo **Distraído**, **silence-o** (não é necessário rolar o **Dado de Sucesso**).',
      logic: {}
    }
  ]
};