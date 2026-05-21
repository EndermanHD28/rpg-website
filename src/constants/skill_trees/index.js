/*
  ⚠️ EFFECTS RULE
  All status effects MUST be defined in src/constants/gameData.js (EFFECTS export).
  Skills must NOT construct effect objects inline — use addEffect() from the postRoll context instead.
  Example: addEffect('target', 'electrification', 2)
*/
import { vanguarda } from './vanguarda';
import { artista } from './artista';
import { assaltante } from './assaltante';
import { atirador } from './atirador';
import { infiltrador } from './infiltrador';

export const SKILL_TREES = {
  "Assaltante": assaltante,
  "Vanguarda": vanguarda,
  "Atirador": atirador,
  "Infiltrador": infiltrador,
  "Artista": artista
};
