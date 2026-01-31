export function calculateDerivedStats(char) {
  // Presence: Sum of physical stats
  const presence = char.strength + char.resistance + char.aptitude + char.agility + char.concentration;
  
  // Posture: (Resistance * 0.25) + Aptitude
  const posture = (char.resistance * 0.25) + char.aptitude;
  
  // Life: (Strength + Resistance) * 4
  const life = (char.strength + char.resistance) * 4;

  // Percentage stats (Cap at 100%)
  const calcPerc = (val) => Math.min((val / presence) * 100, 100).toFixed(1);

  return {
    presence,
    posture,
    life,
    intelligencePerc: calcPerc(char.intelligence),
    charismaPerc: calcPerc(char.charisma),
    luckPerc: calcPerc(char.luck)
  };
}