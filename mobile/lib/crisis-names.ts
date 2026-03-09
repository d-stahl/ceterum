const PREFIXES = [
  'The', 'The Second', 'The Third', 'The Great', 'The Lesser',
  'The First', 'The Final', 'The Infamous', 'The Forgotten',
];

const ORIGINS = [
  'Lusitanian', 'Capuan', 'Bithynian', 'Ptolemaic', 'Seleucid',
  'Numidian', 'Cilician', 'Sardinian', 'Sicilian', 'Illyrian',
  'Dalmatian', 'Thracian', 'Pannonian', 'Mauretanian', 'Galatian',
  'Cretan', 'Cypriot', 'Lycian', 'Celtiberian', 'Aquitanian',
  'Ostian', 'Campanian', 'Etruscan', 'Sabine', 'Samnite',
  'Corinthian', 'Macedonian', 'Syrian', 'Cappadocian', 'Pontic',
  'Rhodian', 'Pergamene', 'Parthian', 'Iberian', 'Balearic',
  'Helvetian', 'Norican', 'Epirote', 'Thessalian', 'Punic',
  'Tyrian', 'Spartan', 'Athenian', 'Alexandrian', 'Carthaginian',
  'Brundisian', 'Neapolitan', 'Massilian', 'Tarentine', 'Antiochene',
];

const CRISIS_TYPES = [
  'Question', 'Crisis', 'Conspiracy', 'Upheaval', 'Affair',
  'Succession', 'Embargo', 'Rebellion', 'Incident', 'Dispute',
  'Schism', 'Insurrection', 'Ultimatum', 'Standoff', 'Debacle',
  'Scandal', 'Mutiny', 'Defection', 'Blockade', 'Accord',
  'Pact', 'Intrigue', 'Tribunal', 'Edict', 'Proclamation',
  'Secession', 'Reckoning', 'Gambit', 'Provocation', 'Impasse',
];

function randomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

export function generateCrisisName(): string {
  return `${randomElement(PREFIXES)} ${randomElement(ORIGINS)} ${randomElement(CRISIS_TYPES)}`;
}
