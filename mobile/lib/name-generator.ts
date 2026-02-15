const PRAENOMINA = [
  'Gaius', 'Lucius', 'Marcus', 'Titus', 'Quintus',
  'Publius', 'Gnaeus', 'Aulus', 'Spurius', 'Decimus',
  'Servius', 'Appius', 'Manius', 'Tiberius', 'Numerius',
  'Vibius', 'Cassia', 'Livia', 'Cornelia', 'Flavia',
];

const COGNOMINA = [
  'Severus', 'Felix', 'Maximus', 'Crassus', 'Rufus',
  'Longus', 'Pulcher', 'Nerva', 'Balbus', 'Corvus',
  'Lepidus', 'Brutus', 'Scaevola', 'Cato', 'Naso',
  'Lentulus', 'Priscus', 'Silanus', 'Varro', 'Cursor',
];

const ROMAN_NUMERALS = [
  '', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
];

function randomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

export function generateBaseName(): string {
  return `${randomElement(PRAENOMINA)} ${randomElement(COGNOMINA)}`;
}

export async function generateUniqueName(
  existingNames: string[]
): Promise<string> {
  const baseName = generateBaseName();

  // Count how many times this base name already exists
  const count = existingNames.filter(
    (name) => name === baseName || name.startsWith(baseName + ' ')
  ).length;

  if (count === 0) {
    return baseName;
  }

  const numeral = ROMAN_NUMERALS[count];
  if (numeral) {
    return `${baseName} ${numeral}`;
  }

  // Extremely unlikely: more than 10 collisions. Just append random digits.
  return `${baseName} ${count + 1}`;
}
