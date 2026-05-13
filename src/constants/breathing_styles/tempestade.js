export const tempestade = {
  name: "Tempestade",
  boardMultiplier: { x: 1, y: 1 },
  skills: [
    { 
      id: 'skill_0', 
      name: 'Névoa Inicial', 
      cost: 0, 
      requirements: { concentration: 6, resistance: 5 }, 
      pos: { x: 0, y: -100 }, 
      skillLogic: {
        startingFocus: 25,
        maxFocus: 75,
        extraMaxFocusPerLevel: 5,
        eachXFocusMultiplyDamage: 5,
        damageMultiplierPerXFocus: 0.01,
      },
      flavor: 'O início de uma tempestade começa com a névoa.', 
      effect: 'Receba a barra de **Foco**. O valor máximo inicial será **75** (**+5** por Nível). A cada **5** de Foco, cause **+1%** de Dano Final.\nInicie cada combate com **25 de Foco**.' 
    },
    { 
      id: 'skill_1a', 
      name: 'Primeira Forma: Vento Cortante', 
      cost: 1, 
      requirements: { agility: 12, aptitude: 8 }, 
      pos: { x: -100, y: -180 }, 
      parent: 'skill_0', 
      flavor: 'O movimento do vento parece cortar como uma navalha.', 
      effect: '**35 de Foco**: Imediatamente ataque um inimigo (com seu Dado de Acerto padrão) e, se sucedir, cause **⚡_Eletrificação** por **2 Turnos** (também rolete o Dado de Dano). A cada Nível, o Dado de Acerto nesta Habilidade recebe **+2**.' 
    },
    { 
      id: 'skill_1b', 
      name: 'Acúmulo Estático', 
      cost: 1, 
      requirements: { concentration: 7 }, 
      pos: { x: 100, y: -180 }, 
      parent: 'skill_0', 
      flavor: 'A energia elétrica começa a se acumular.', 
      effect: 'Receba o **Dado de Foco**. Rolete **1d10+15** (**+3** por Nível) e ganhe **Foco** igual ao resultado.' 
    },
    { 
      id: 'skill_2a', 
      name: 'Furacão Elétrico', 
      cost: 2, 
      requirements: { concentration: 14, intelligence: 13, resistance: 12 }, 
      pos: { x: 0, y: -250 }, 
      parent: 'skill_1a', 
      flavor: 'Calma absoluta no centro do caos.', 
      effect: '**30 de Foco**: Sua Dopamina e Adrenalina são produzidas em excesso e convertidas em Eletricidade. Receba **⚡_Eletrificação** por **3 Turnos**.\nEnquanto estiver em **⚡_Eletrificação**, **Dados de Dano** que tenham você como alvo são reduzidos em **15%**, e seus **Dados de Dano** aumentam em **25%** (**+3%** por Nível).' 
    },
    { 
      id: 'skill_2c', 
      name: 'Segunda Forma: Trovão Distante', 
      cost: 1, 
      requirements: { agility: 13, concentration: 9 }, 
      pos: { x: 200, y: -250 }, 
      parent: 'skill_1b', 
      flavor: 'Um som que ecoa antes do impacto.', 
      effect: '**25 de Foco**: Imediatamente ataque um inimigo (com seu Dado de Acerto padrão) e, se sucedir, aumente o **Dado de Dano** em **15%** (**+2%** por Nível).' 
    },
    { 
      id: 'skill_2b', 
      name: 'Despertar Corrosivo', 
      cost: 2, 
      requirements: { strength: 15, resistance: 13, concentration: 11 }, 
      pos: { x: -150, y: 50 }, 
      parent: 'skill_1a', 
      flavor: 'O clima se umidece e se corrói ao seu redor.', 
      effect: 'Quando um golpe reduzir sua **Vida a 0**, rolete **1d20** (Sucesso: **12+**) e, se sucedir, **cancele-o** e eleve seu **Foco** até o máximo, mas receba **⚡_Eletrificação** por **3 Turnos**.' 
    },
    { 
      id: 'skill_3a', 
      name: 'Quarta Forma: Tempestade Devastadora', 
      cost: 3, 
      requirements: { strength: 18, concentration: 16, resistance: 15, aptitude: 12, precision: 8 }, 
      pos: { x: -50, y: 150 }, 
      parent: 'skill_2b', 
      flavor: 'O ápice da ira dos céus.', 
      effect: '**75 de Foco**: Imediatamente ataque um inimigo (com seu Dado de Acerto padrão) com uma **Arma Branca** e, se sucedir, aumente o **Dado de Acerto** em **+8** (**+3** por Nível); cause **⚡_Eletrificação_Avançada** por **2 Turnos** (também rolete o Dado de Dano, mas aumente-o em **1,5x**).' 
    },
    { 
      id: 'skill_2d', 
      name: 'Terceira Forma: Relâmpago Vertical', 
      cost: 2, 
      requirements: { concentration: 12, agility: 7, intelligence: 6 }, 
      pos: { x: 50, y: 50 }, 
      parent: 'skill_1b', 
      flavor: 'Um ataque vindo de cima com velocidade extrema.', 
      effect: '**40 de Foco**: Imediatamente ataque um inimigo (com seu Dado de Acerto padrão) com uma **Arma Branca** e, se sucedir, adicione a sua **Concentração** aumentada em **+30%** (**+5%** por Nível) ao **Dado de Dano**.' 
    },
    { 
      id: 'skill_3b', 
      name: 'Chuva Torrencial', 
      cost: 2, 
      requirements: { aptitude: 5 }, 
      pos: { x: 150, y: 150 }, 
      parent: 'skill_2d', 
      flavor: 'Uma sequência incessante de golpes.', 
      effect: 'Permite realizar um **ataque extra** se o primeiro ataque atingir o alvo.' 
    },
  ]
};
