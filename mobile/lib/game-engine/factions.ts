import { AxisPreferences } from './axes';

export interface FactionDefinition {
  key: string;
  displayName: string;
  latinName: string;
  description: string;
  defaultPreferences: AxisPreferences;
  defaultPower: number;
}

export const FACTIONS: FactionDefinition[] = [
  {
    key: 'legiones',
    displayName: 'The Veterans',
    latinName: 'Legiones',
    description: 'Retired soldiers who served Rome\'s legions',
    defaultPower: 3,
    defaultPreferences: {
      centralization: 1, expansion: 2, commerce: 0,
      patrician: -1, tradition: 1, militarism: 2,
    },
  },
  {
    key: 'mercatores',
    displayName: 'The Merchants',
    latinName: 'Mercatores',
    description: 'Traders and urban commerce guilds',
    defaultPower: 3,
    defaultPreferences: {
      centralization: -1, expansion: 1, commerce: 2,
      patrician: 0, tradition: -1, militarism: -1,
    },
  },
  {
    key: 'plebeii',
    displayName: 'The Plebs',
    latinName: 'Plebeii',
    description: 'The common citizens of Rome',
    defaultPower: 3,
    defaultPreferences: {
      centralization: 0, expansion: -1, commerce: -1,
      patrician: -2, tradition: -1, militarism: 0,
    },
  },
  {
    key: 'optimates',
    displayName: 'The Patricians',
    latinName: 'Optimates',
    description: 'The old money nobility of Rome',
    defaultPower: 3,
    defaultPreferences: {
      centralization: 2, expansion: 0, commerce: -1,
      patrician: 2, tradition: 2, militarism: 0,
    },
  },
  {
    key: 'pontifices',
    displayName: 'The Priests',
    latinName: 'Pontifices',
    description: 'The religious establishment',
    defaultPower: 3,
    defaultPreferences: {
      centralization: 1, expansion: 0, commerce: -1,
      patrician: 1, tradition: 2, militarism: -1,
    },
  },
  {
    key: 'agricolae',
    displayName: 'The Farmers',
    latinName: 'Agricolae',
    description: 'Rural landowners and laborers',
    defaultPower: 3,
    defaultPreferences: {
      centralization: -2, expansion: -1, commerce: -2,
      patrician: -1, tradition: 1, militarism: 0,
    },
  },
  {
    key: 'servi',
    displayName: 'The Slaves',
    latinName: 'Servi',
    description: 'The unfree laborers of Rome',
    defaultPower: 3,
    defaultPreferences: {
      centralization: 0, expansion: -1, commerce: 0,
      patrician: -2, tradition: -2, militarism: -1,
    },
  },
  {
    key: 'nautae',
    displayName: 'The Seafarers',
    latinName: 'Nautae',
    description: 'The navy and maritime traders',
    defaultPower: 3,
    defaultPreferences: {
      centralization: -1, expansion: 2, commerce: 2,
      patrician: 0, tradition: -1, militarism: 1,
    },
  },
  {
    key: 'fabri',
    displayName: 'The Craftsmen',
    latinName: 'Fabri',
    description: 'Urban artisans and builders',
    defaultPower: 3,
    defaultPreferences: {
      centralization: 0, expansion: 0, commerce: 1,
      patrician: -1, tradition: -1, militarism: -1,
    },
  },
  {
    key: 'provinciales',
    displayName: 'The Provincials',
    latinName: 'Provinciales',
    description: 'Subjects of Rome\'s conquered territories',
    defaultPower: 3,
    defaultPreferences: {
      centralization: -2, expansion: -1, commerce: 1,
      patrician: -2, tradition: -1, militarism: -2,
    },
  },
];
