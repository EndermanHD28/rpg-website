/*
  ⚠️ EFFECTS RULE
  All status effects MUST be defined in src/constants/gameData.js (EFFECTS export).
*/
export const artista = {
  name: "Artista",
  boardMultiplier: { x: 0.8, y: 1.1 },
  skills: [
    {
      id: 'artista_initial',
      name: 'Punho de Ferro',
      cost: 3,
      requirements: { resistance: 7, strength: 7 },
      pos: { x: 0, y: 0 },
      flavor: 'Um guerreiro de grande destreza!',
      effect: 'Aumenta o **Dano Final** de **Socos** e **Improviso** em **+20%**.\nLibera a Árvore de Habilidades do **Artista**.',
      logic: {
        damage_boosts: [
          { amount: 0.20, condition: { type: 'weapon_subtype', value: 'Soco / Improviso' } },
        ]
      }
    },

    // --- ROTA SUPERIOR ESQUERDA: O ESPETÁCULO (EXIBICIONISTA) ---
    // Segue um formato de espiral que envolve o ponto inicial.

    {
      id: 'artista_exhibicionist_0',
      name: 'Golpe Estilizado',
      cost: 2,
      requirements: { agility: 12, charisma: 10 },
      pos: { x: -140, y: -120 },
      parent: 'artista_initial',
      flavor: 'Rota: Exibicionista e Arrogante.',
      effect: 'Golpes de **Socos** e **Improviso** possuem o **Dobro** de chance de Crítico.'
    },
    {
      id: 'artista_show_1',
      name: 'Pirueta de Combate',
      cost: 1,
      requirements: { agility: 13 },
      pos: { x: -280, y: -60 }, // Começa a girar para baixo da 0
      parent: 'artista_exhibicionist_0',
      flavor: 'Eles aplaudem enquanto caem.',
      effect: 'Identidade desconhecida.',
      logic: {}
    },
    {
      id: 'artista_show_2',
      name: 'Provocação Teatral',
      cost: 1,
      requirements: { charisma: 12 },
      pos: { x: -350, y: -200 }, // Sobe e abre a espiral
      parent: 'artista_show_1',
      flavor: 'Fique bravo, fique descuidado.',
      effect: 'Identidade desconhecida.',
      logic: {}
    },
    {
      id: 'artista_show_3',
      name: 'Finalização Dramática',
      cost: 2,
      requirements: { agility: 15, charisma: 14 },
      pos: { x: -200, y: -320 }, // Fecha a curva por cima
      parent: 'artista_show_2',
      flavor: 'O grand finale.',
      effect: 'Identidade desconhecida.',
      logic: {}
    },
    {
      id: 'artista_show_active',
      name: '????',
      isActivatable: true,
      cost: 2,
      requirements: { charisma: 16 },
      pos: { x: -350, y: -450 }, // Ponto alto externo
      parent: 'artista_show_3',
      flavor: 'A ovação final.',
      effect: 'Bloqueado.',
      logic: {}
    },

    // --- ROTA SUPERIOR DIREITA: PUNHOS DE TITÃ (BRUTALIDADE) ---
    // Formato de Losango/Diamante para passar solidez.

    {
      id: 'artista_brutal_0',
      name: 'Postura de Boxeador',
      cost: 2,
      requirements: { strength: 10, agility: 10, resistance: 8 },
      pos: { x: 150, y: -100 }, 
      parent: 'artista_initial',
      flavor: 'Rota: Brutalizar.',
      isActivatable: true,
      effect: '**-Habilidade Ativa-**\n**Uma vez por combate**, caso um inimigo **próximo** realize um ataque com você como alvo, e seja roletado o **Dado de Dano**, rolete **1d20** (Sucesso: **9+**): imediatamente **Contra-ataque** usando **Socos** ou **Improviso**.',
      logic: {}
    },
    {
      id: 'artista_brutal_1',
      name: 'Punhos de Demolição',
      type: 'epic',
      cost: 3,
      requirements: { strength: 18, agility: 16, resistance: 12 },
      pos: { x: 300, y: -180 }, // Canto direito do losango
      parent: 'artista_brutal_0',
      flavor: 'Cada soco estraçalha.',
      isActivatable: true,
      blockedActivatable: ["artista_brutal_0"],
      effect: 'Substitui: **Postura de Boxeador**.\n**-Habilidade Ativa-**\n**Uma vez por combate**, caso um inimigo **próximo** realizaria um ataque com você como alvo, rolete **1d20** (Sucesso: **9+**): **Cancele** o ataque e realize imediatamente um **Contra-ataque Garantido** usando **Socos** ou **Improviso**. Caso falhe: o ataque torna-se **Garantido**.',
      logic: {}
    },
    {
      id: 'artista_brutal_2',
      name: 'Resistência de Ringue',
      cost: 1,
      requirements: { resistance: 12 },
      pos: { x: 150, y: -260 }, // Topo do losango
      parent: 'artista_brutal_0',
      flavor: 'Eu aguento mais que você.',
      effect: 'Identidade desconhecida.',
      logic: {}
    },
    {
      id: 'artista_brutal_side',
      name: 'Calejamento de Ferro',
      cost: 2,
      requirements: { resistance: 14 },
      pos: { x: 420, y: -100 }, // Satélite fora do losango
      parent: 'artista_brutal_1',
      flavor: 'Ossos mais duros que pedra.',
      effect: 'Identidade desconhecida.',
      logic: {}
    },
    {
      id: 'artista_brutal_active',
      name: '????',
      isActivatable: true,
      cost: 2,
      requirements: { strength: 16, resistance: 15 },
      pos: { x: 300, y: -350 }, // Acima do losango
      parent: 'artista_brutal_2',
      flavor: 'Nocaute técnico.',
      effect: 'Bloqueado.',
      logic: {}
    },

    // --- ROTA INFERIOR: VANDALISMO (IMPROVISO E QUEBRA DE ARMAS) ---
    // Formato de "Fratura" - linhas que se quebram e ramificam para baixo.

    {
      id: 'artista_vandalismo_0',
      name: 'Reciclagem Violenta',
      cost: 1,
      requirements: { strength: 11 },
      pos: { x: 0, y: 150 }, // Desce reto
      parent: 'artista_initial',
      flavor: 'Se quebrou, ainda serve para bater.',
      effect: 'Ao quebrar uma arma, você ganha **+15%** de Dano de Improviso no próximo ataque.',
      logic: {}
    },
    {
      id: 'artista_vandalismo_1',
      name: 'Estilhaços Mortais',
      cost: 1,
      requirements: { precision: 10 },
      pos: { x: -160, y: 280 }, // "Rachadura" para a esquerda
      parent: 'artista_vandalismo_0',
      flavor: 'Pedaços de madeira e metal voando.',
      effect: 'Identidade desconhecida.',
      logic: {}
    },
    {
      id: 'artista_vandalismo_2',
      name: 'Mestre do Improviso',
      cost: 2,
      requirements: { intelligence: 10 },
      pos: { x: 160, y: 280 }, // "Rachadura" para a direita
      parent: 'artista_vandalismo_0',
      flavor: 'Uma garrafa quebrada é uma espada na mão certa.',
      effect: 'Identidade desconhecida.',
      logic: {}
    },
    {
      id: 'artista_vandalismo_3',
      name: 'Desarmar por Destruição',
      cost: 1,
      requirements: { strength: 15 },
      pos: { x: -300, y: 380 }, // Extensão da rachadura esquerda
      parent: 'artista_vandalismo_1',
      flavor: 'Eu não tiro a arma de você, eu a transformo em lixo.',
      effect: 'Identidade desconhecida.',
      logic: {}
    },
    {
      id: 'artista_vandalismo_active',
      name: '????',
      isActivatable: true,
      cost: 2,
      requirements: { strength: 18 },
      pos: { x: 50, y: 450 }, // Volta para perto do centro no fundo
      parent: 'artista_vandalismo_2',
      flavor: 'Caos absoluto.',
      effect: 'Bloqueado.',
      logic: {}
    },

    // --- SKILL ÉPICA ---
    {
      id: 'artista_epic_master',
      name: 'Obra Prima do Caos',
      type: 'epic',
      cost: 5,
      requirements: { strength: 22, agility: 20, charisma: 18 },
      pos: { x: 500, y: 150 }, // Isolada lateralmente na altura da rota de vandalismo
      parent: 'artista_initial',
      flavor: 'A destruição é a única arte verdadeira.',
      effect: 'Bloqueado.',
      logic: {}
    }
  ]
};