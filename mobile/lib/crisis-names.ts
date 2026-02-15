const PREFIXES = [
  'The', 'The Second', 'The Third', 'The Great', 'The Lesser',
];

const ORIGINS = [
  'Lusitanian', 'Capuan', 'Bithynian', 'Ptolemaic', 'Seleucid',
  'Numidian', 'Cilician', 'Sardinian', 'Sicilian', 'Illyrian',
  'Dalmatian', 'Thracian', 'Pannonian', 'Mauretanian', 'Galatian',
  'Cretan', 'Cypriot', 'Lycian', 'Celtiberian', 'Aquitanian',
  'Ostian', 'Campanian', 'Etruscan', 'Sabine', 'Samnite',
];

const CRISIS_TYPES = [
  'Question', 'Crisis', 'Conspiracy', 'Upheaval', 'Affair',
  'Succession', 'Embargo', 'Rebellion', 'Incident', 'Dispute',
  'Schism', 'Insurrection', 'Ultimatum', 'Standoff', 'Debacle',
];

function randomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

export function generateCrisisName(): string {
  return `${randomElement(PREFIXES)} ${randomElement(ORIGINS)} ${randomElement(CRISIS_TYPES)}`;
}
