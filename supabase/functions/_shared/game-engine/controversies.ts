import { AxisKey } from './axes.ts';

export interface ControversyResolution {
  key: string;
  title: string;
  description: string;
  axisEffects: Partial<Record<AxisKey, number>>;
  factionPowerEffects: Partial<Record<string, number>>;
  followUpKey?: string;
}

export interface Controversy {
  key: string;
  title: string;
  category: 'military' | 'social' | 'economic' | 'political' | 'religious';
  flavor: string;
  illustration: string;
  resolutions: [ControversyResolution, ControversyResolution, ControversyResolution];
}

export type ControversyCategory = Controversy['category'];

export const CATEGORY_LABELS: Record<ControversyCategory, string> = {
  military: 'Military',
  social: 'Social',
  economic: 'Economic',
  political: 'Political',
  religious: 'Religious',
};

export const CATEGORY_COLORS: Record<ControversyCategory, string> = {
  military: '#e53935',
  social: '#7cb342',
  economic: '#ffa726',
  political: '#5c6bc0',
  religious: '#ab47bc',
};

export const CONTROVERSIES: Controversy[] = [
  // === MILITARY & FOREIGN POLICY ===
  {
    key: 'carthaginian_menace',
    title: 'The Carthaginian Menace',
    category: 'military',
    illustration: 'carthage_fleet',
    flavor:
      "Carthage's growing naval power threatens Roman trade and her allies in Sicily. The question is no longer whether conflict is coming — but whether Rome chooses its moment or waits for Carthage to choose.",
    resolutions: [
      {
        key: 'military_campaign',
        title: 'Military Campaign',
        description: 'Dispatch legions and fleet to strike Carthage before she grows stronger.',
        axisEffects: { expansion: 1, militarism: 1 },
        factionPowerEffects: { legiones: 1, nautae: 1, mercatores: 1, provinciales: -1 },
      },
      {
        key: 'economic_pressure',
        title: 'Economic Pressure',
        description:
          'Impose trade sanctions and strengthen coastal defenses. Let commerce do what swords need not.',
        axisEffects: { commerce: 1, expansion: -1 },
        factionPowerEffects: { mercatores: 1, nautae: 1 },
      },
      {
        key: 'diplomatic_accord',
        title: 'Diplomatic Accord',
        description:
          'Negotiate a treaty that recognizes spheres of influence. Peace is profitable.',
        axisEffects: { militarism: -1 },
        factionPowerEffects: { mercatores: 1, nautae: 1, legiones: -1 },
      },
    ],
  },
  {
    key: 'gallic_incursion',
    title: 'The Gallic Incursion',
    category: 'military',
    illustration: 'gallic_raiders',
    flavor:
      'Gallic tribes have crossed the Alps and are raiding through northern Italy. Cities burn and refugees flood south toward Rome. The Senate cannot agree on whether to meet them in the field or wait behind walls.',
    resolutions: [
      {
        key: 'punitive_expedition',
        title: 'Punitive Expedition',
        description: 'Send the legions north to crush the raiders and push them back beyond the mountains.',
        axisEffects: { militarism: 1, expansion: 1 },
        factionPowerEffects: { legiones: 1, agricolae: 1 },
      },
      {
        key: 'defensive_fortifications',
        title: 'Defensive Fortifications',
        description: 'Build walls and strengthen the northern frontier. Let them raid emptiness.',
        axisEffects: { centralization: 1, expansion: -1 },
        factionPowerEffects: { fabri: 2, legiones: 1 },
      },
      {
        key: 'tribal_settlement',
        title: 'Tribal Settlement',
        description:
          'Offer the Gauls land in sparsely populated regions in exchange for peace and service.',
        axisEffects: { expansion: -1, militarism: -1 },
        factionPowerEffects: { provinciales: 1, agricolae: -1, legiones: -1 },
      },
    ],
  },
  {
    key: 'pontic_alliance',
    title: 'The Pontic Alliance',
    category: 'military',
    illustration: 'eastern_king',
    flavor:
      'The King of Pontus offers a formal alliance against a common eastern enemy. The opportunity could open eastern trade routes and extend Roman influence — or drag the Republic into foreign wars it did not choose.',
    resolutions: [
      {
        key: 'accept_alliance',
        title: 'Accept Alliance',
        description: 'Join forces on equal terms and expand Roman influence eastward.',
        axisEffects: { expansion: 1, militarism: -1 },
        factionPowerEffects: { mercatores: 1, nautae: 1 },
      },
      {
        key: 'demand_submission',
        title: 'Demand Submission',
        description: "Accept only if Pontus acknowledges Roman supremacy. Allies must know their place.",
        axisEffects: { centralization: 1, expansion: 1 },
        factionPowerEffects: { optimates: 1, legiones: 1 },
      },
      {
        key: 'reject_alliance',
        title: 'Reject Alliance',
        description: "Rome needs no eastern entanglements. The Republic's strength lies in its focus.",
        axisEffects: { expansion: -1, tradition: 1 },
        factionPowerEffects: { optimates: 1, pontifices: 1, mercatores: -1 },
      },
    ],
  },
  {
    key: 'greek_colonies',
    title: 'The Greek Colonies',
    category: 'military',
    illustration: 'greek_city',
    flavor:
      'The Greek cities of southern Italy seek Roman protection against Samnite and Lucanian raiders. Accepting means war; refusing means losing influence over the most prosperous coast in Italy.',
    resolutions: [
      {
        key: 'full_annexation',
        title: 'Full Annexation',
        description: "Bring them into the Republic as Roman territory. Their wealth becomes Rome's wealth.",
        axisEffects: { centralization: 1, expansion: 1 },
        factionPowerEffects: { optimates: 1, mercatores: 1 },
      },
      {
        key: 'protected_alliance',
        title: 'Protected Alliance',
        description: 'Defend them militarily while respecting their autonomy and customs.',
        axisEffects: { militarism: -1, expansion: -1 },
        factionPowerEffects: { nautae: 1, mercatores: 1, provinciales: 1 },
      },
      {
        key: 'withdraw_support',
        title: 'Withdraw Support',
        description: "Rome cannot be everyone's protector. Let the south settle its own affairs.",
        axisEffects: { expansion: -1 },
        factionPowerEffects: { agricolae: 1, provinciales: -1, legiones: -1 },
      },
    ],
  },

  // === SOCIAL & CLASS ===
  {
    key: 'agrarian_question',
    title: 'The Agrarian Question',
    category: 'social',
    illustration: 'roman_fields',
    flavor:
      'Wealthy patricians have illegally occupied vast tracts of public land for generations. The landless poor flood into Rome while the countryside empties of the smallholders who once filled the legions.',
    resolutions: [
      {
        key: 'land_redistribution',
        title: 'Land Redistribution',
        description: 'Seize excess public land and divide it among landless citizens.',
        axisEffects: { patrician: -1, commerce: -1 },
        factionPowerEffects: { plebeii: 1, agricolae: 1, optimates: -1 },
      },
      {
        key: 'regulated_ownership',
        title: 'Regulated Ownership',
        description: 'Cap individual land holdings but compensate current occupants fairly.',
        axisEffects: { tradition: -1 },
        factionPowerEffects: { fabri: 1, mercatores: 1 },
      },
      {
        key: 'protect_property_rights',
        title: 'Protect Property Rights',
        description: 'Existing occupation reflects legitimate investment. Focus on other solutions.',
        axisEffects: { patrician: 1, tradition: 1 },
        factionPowerEffects: { optimates: 1, agricolae: -1 },
      },
    ],
  },
  {
    key: 'slave_uprising',
    title: 'The Slave Uprising',
    category: 'social',
    illustration: 'slave_revolt',
    flavor:
      'A massive revolt has broken out in the south, with tens of thousands of slaves under arms. Every week of delay strengthens the rebels and emboldens others. Every atrocity hardens opinion.',
    resolutions: [
      {
        key: 'military_suppression',
        title: 'Military Suppression',
        description: 'Crush the revolt with overwhelming force. Make an example that will not be forgotten.',
        axisEffects: { militarism: 1, patrician: 1 },
        factionPowerEffects: { legiones: 1, optimates: 1, servi: -1 },
      },
      {
        key: 'conditional_reform',
        title: 'Conditional Reform',
        description:
          'Suppress the revolt, but promise improved conditions and legal paths to manumission.',
        axisEffects: { tradition: -1, patrician: -1 },
        factionPowerEffects: { servi: 1, fabri: 1, optimates: -1 },
      },
      {
        key: 'negotiated_surrender',
        title: 'Negotiated Surrender',
        description: 'Offer freedom to rebels who lay down arms and surrender their leaders.',
        axisEffects: { patrician: -2 },
        factionPowerEffects: { servi: 2, plebeii: 1, legiones: -1, optimates: -1 },
      },
    ],
  },
  {
    key: 'italian_allies',
    title: 'The Italian Allies',
    category: 'social',
    illustration: 'allied_soldiers',
    flavor:
      "Rome's Italian allies fight and die in her legions but are denied citizenship. They pay taxes, furnish troops, and obey Roman law — but cannot vote, hold office, or access the courts as citizens.",
    resolutions: [
      {
        key: 'full_enfranchisement',
        title: 'Full Enfranchisement',
        description: 'Grant citizenship to all Italian allies immediately and without condition.',
        axisEffects: { patrician: -2, centralization: 1 },
        factionPowerEffects: { provinciales: 2, plebeii: 1, optimates: -1 },
      },
      {
        key: 'gradual_integration',
        title: 'Gradual Integration',
        description:
          'Offer a path to citizenship over time through military service and demonstrated loyalty.',
        axisEffects: { patrician: -1, tradition: -1 },
        factionPowerEffects: { legiones: 1, fabri: 1, provinciales: 1 },
      },
      {
        key: 'firm_refusal',
        title: 'Firm Refusal',
        description: "Rome's privileges belong to Romans. The allies knew the terms when they joined.",
        axisEffects: { patrician: 1, tradition: 1 },
        factionPowerEffects: { optimates: 1, pontifices: 1, provinciales: -2 },
      },
    ],
  },
  {
    key: 'debt_crisis',
    title: 'The Debt Crisis',
    category: 'social',
    illustration: 'debt_bondage',
    flavor:
      'Debt bondage has reduced thousands of citizens to near-slavery. Creditors grow rich while debtors lose farms, freedom, and dignity. The line between citizen and slave grows harder to see.',
    resolutions: [
      {
        key: 'debt_cancellation',
        title: 'Debt Cancellation',
        description: 'Wipe out existing debts and forbid debt bondage henceforth.',
        axisEffects: { patrician: -1, tradition: -1 },
        factionPowerEffects: { plebeii: 2, servi: 1, mercatores: -1, optimates: -1 },
      },
      {
        key: 'interest_caps',
        title: 'Interest Caps',
        description: 'Limit interest rates and regulate lending practices going forward.',
        axisEffects: { tradition: -1 },
        factionPowerEffects: { fabri: 1, mercatores: 1, plebeii: 1 },
      },
      {
        key: 'enforce_contracts',
        title: 'Enforce Contracts',
        description:
          'Debts are sacred obligations. Relief destroys credit, commerce, and the rule of law.',
        axisEffects: { patrician: 1, tradition: 1, commerce: 1 },
        factionPowerEffects: { optimates: 1, mercatores: 1, plebeii: -1 },
      },
    ],
  },

  // === ECONOMIC ===
  {
    key: 'grain_dole',
    title: 'The Grain Dole',
    category: 'economic',
    illustration: 'grain_market',
    flavor:
      'Grain prices have soared beyond what the urban poor can afford. Riots break out weekly. The question of state-subsidized grain can no longer be deferred with speeches about self-reliance.',
    resolutions: [
      {
        key: 'state_grain_dole',
        title: 'State Grain Dole',
        description: 'Establish regular free or heavily subsidized grain for all citizens.',
        axisEffects: { patrician: -1, centralization: 1 },
        factionPowerEffects: { plebeii: 2, fabri: 1, agricolae: -1 },
      },
      {
        key: 'emergency_reserves',
        title: 'Emergency Reserves',
        description:
          'Build state grain stockpiles to stabilize prices in crises only. Not a permanent dole.',
        axisEffects: { centralization: 1 },
        factionPowerEffects: { agricolae: 1, mercatores: 1 },
      },
      {
        key: 'market_prices',
        title: 'Market Prices',
        description: 'State interference destroys incentive. Let the market find its own level.',
        axisEffects: { commerce: 1 },
        factionPowerEffects: { mercatores: 1, agricolae: 1, plebeii: -1 },
      },
    ],
  },
  {
    key: 'pirate_menace',
    title: 'The Pirate Menace',
    category: 'economic',
    illustration: 'pirate_ships',
    flavor:
      'Mediterranean pirates have grown so bold they raid Italian ports and hold grain ships to ransom. Trade is collapsing, the city goes hungry, and the admirals argue about whose jurisdiction the problem falls under.',
    resolutions: [
      {
        key: 'naval_campaign',
        title: 'Naval Campaign',
        description: 'Grant a commander extraordinary powers to sweep the seas clean.',
        axisEffects: { militarism: 1, commerce: 1, centralization: 1 },
        factionPowerEffects: { nautae: 1, legiones: 1, mercatores: 1, optimates: -1 },
      },
      {
        key: 'diplomatic_pardon',
        title: 'Diplomatic Pardon',
        description: 'Offer pirates land, amnesty, and resettlement in exchange for surrender.',
        axisEffects: { militarism: -1, expansion: -1 },
        factionPowerEffects: { provinciales: 1, agricolae: 1, nautae: -1 },
      },
      {
        key: 'merchant_convoys',
        title: 'Merchant Convoys',
        description: 'Fund state-organized convoy escorts. Protect the trade without a crusade.',
        axisEffects: { commerce: 1 },
        factionPowerEffects: { mercatores: 1, nautae: 1 },
      },
    ],
  },
  {
    key: 'tax_contracts',
    title: 'The Tax Contracts',
    category: 'economic',
    illustration: 'tax_collectors',
    flavor:
      "Publicani — private tax contractors — are bleeding the provinces dry, then bribing officials to look away. The treasury grows fat while conquered peoples seethe and Rome's reputation for justice crumbles.",
    resolutions: [
      {
        key: 'state_tax_collection',
        title: 'State Tax Collection',
        description:
          "End the contract system. Rome's officials collect taxes directly and are accountable to Rome.",
        axisEffects: { centralization: 1, patrician: -1 },
        factionPowerEffects: { provinciales: 1, plebeii: 1, mercatores: -1 },
      },
      {
        key: 'regulated_contracts',
        title: 'Regulated Contracts',
        description:
          'Keep the publicani but create oversight boards and provincial appeals processes.',
        axisEffects: { tradition: -1 },
        factionPowerEffects: { mercatores: 1, fabri: 1, provinciales: 1 },
      },
      {
        key: 'free_market_contracts',
        title: 'Free Market Contracts',
        description: 'Competition between contractors keeps prices honest. Regulation only stifles enterprise.',
        axisEffects: { commerce: 1, patrician: 1 },
        factionPowerEffects: { mercatores: 1, optimates: 1, provinciales: -1 },
      },
    ],
  },
  {
    key: 'sumptuary_question',
    title: 'The Sumptuary Question',
    category: 'economic',
    illustration: 'roman_banquet',
    flavor:
      'Banquets lasting three days, gold-threaded togas, gems from every corner of the empire — while citizens starve two streets away. The censors demand action. The wealthy demand freedom. Everyone demands something.',
    resolutions: [
      {
        key: 'sumptuary_laws',
        title: 'Sumptuary Laws',
        description:
          'Legally limit spending on banquets, dress, and luxury goods. Rome must show discipline.',
        axisEffects: { tradition: 1, centralization: 1 },
        factionPowerEffects: { pontifices: 1, plebeii: 1, optimates: -1, mercatores: -1 },
      },
      {
        key: 'luxury_tax',
        title: 'Luxury Tax',
        description: 'Tax luxury imports and redistribute proceeds to public works and grain.',
        axisEffects: { tradition: -1, commerce: -1 },
        factionPowerEffects: { fabri: 1, plebeii: 1, mercatores: -1 },
      },
      {
        key: 'no_restriction',
        title: 'No Restriction',
        description:
          "A man's right to enjoy his wealth is sacred. The Republic was built on property rights.",
        axisEffects: { patrician: 1, commerce: 1 },
        factionPowerEffects: { optimates: 1, mercatores: 1, plebeii: -1 },
      },
    ],
  },

  // === POLITICAL & CONSTITUTIONAL ===
  {
    key: 'tribunes_veto',
    title: "The Tribune's Veto",
    category: 'political',
    illustration: 'roman_assembly',
    flavor:
      'A tribune has used the veto to block every bill for six months, paralyzing the Republic. His enemies call it tyranny; his supporters call it the last check against aristocratic domination. Both are right.',
    resolutions: [
      {
        key: 'restrict_veto',
        title: 'Restrict the Veto',
        description:
          'Limit tribunician veto to cases directly and demonstrably affecting citizen welfare.',
        axisEffects: { centralization: 1, patrician: 1 },
        factionPowerEffects: { optimates: 1, pontifices: 1, plebeii: -1 },
      },
      {
        key: 'defend_veto',
        title: 'Defend the Veto',
        description:
          "The tribune's power is sacrosanct. Any restriction sets a precedent that will be exploited.",
        axisEffects: { patrician: -1, expansion: -1 },
        factionPowerEffects: { plebeii: 1, fabri: 1, servi: 1 },
      },
      {
        key: 'reform_assembly',
        title: 'Reform the Assembly',
        description:
          'Restructure the voting assemblies to reduce deadlock and better reflect the population.',
        axisEffects: { tradition: -1, patrician: -1 },
        factionPowerEffects: { fabri: 1, mercatores: 1, optimates: -1 },
      },
    ],
  },
  {
    key: 'emergency_powers',
    title: 'The Emergency Powers',
    category: 'political',
    illustration: 'roman_dictator',
    flavor:
      "A military crisis demands swift decisions that the Senate's deliberation cannot provide in time. Some call for a dictator; others fear what six months of absolute power — and the precedent it sets — might ultimately cost the Republic.",
    resolutions: [
      {
        key: 'appoint_dictator',
        title: 'Appoint a Dictator',
        description: 'Grant one man absolute but constitutionally limited temporary power.',
        axisEffects: { centralization: 2, tradition: 1 },
        factionPowerEffects: { legiones: 1, optimates: 1, plebeii: -1 },
      },
      {
        key: 'expanded_consular_authority',
        title: 'Expanded Consular Authority',
        description: 'Allow the consuls to act without Senate approval for the duration of the crisis.',
        axisEffects: { centralization: 1, tradition: -1 },
        factionPowerEffects: { optimates: 1, legiones: 1 },
      },
      {
        key: 'senate_consensus',
        title: 'Senate Consensus',
        description:
          'Govern through deliberation despite the slowness. The Republic was not built in a day.',
        axisEffects: { expansion: -1, tradition: 1 },
        factionPowerEffects: { optimates: 1, pontifices: 1, legiones: -1 },
      },
    ],
  },
  {
    key: 'electoral_corruption',
    title: 'The Electoral Corruption',
    category: 'political',
    illustration: 'roman_election',
    flavor:
      'Vote-buying has become so brazen that candidates openly publish their price lists. The elections are a performance. Even reformers must bribe to compete, which tells you something about the reformers.',
    resolutions: [
      {
        key: 'anti_corruption_laws',
        title: 'Anti-Corruption Laws',
        description:
          'Introduce strict bribery penalties and independent oversight of elections.',
        axisEffects: { tradition: -1, patrician: -1 },
        factionPowerEffects: { plebeii: 1, fabri: 1, optimates: -1 },
      },
      {
        key: 'electoral_redistribution',
        title: 'Electoral Redistribution',
        description: 'Change the assembly structure to weight votes more equally across classes.',
        axisEffects: { patrician: -2, tradition: -1 },
        factionPowerEffects: { plebeii: 2, optimates: -1, mercatores: -1 },
      },
      {
        key: 'accept_reality',
        title: 'Accept Reality',
        description: 'Bribery is the oil that makes the machine run. Virtue-signaling solves nothing.',
        axisEffects: { patrician: 1, tradition: 1 },
        factionPowerEffects: { optimates: 1, mercatores: 1, plebeii: -1 },
      },
    ],
  },
  {
    key: 'governors_excesses',
    title: "The Governor's Excesses",
    category: 'political',
    illustration: 'provincial_governor',
    flavor:
      "A provincial governor has enriched himself spectacularly at the province's expense — extortion, theft, judicial murder. He returns to Rome a hero with veteran legions loyal only to him. The Senate weighs gratitude against principle.",
    resolutions: [
      {
        key: 'trial_and_punishment',
        title: 'Trial and Punishment',
        description:
          'Bring him to justice. No man is above the law, regardless of his victories.',
        axisEffects: { patrician: -1, centralization: 1 },
        factionPowerEffects: { provinciales: 1, plebeii: 1, legiones: -1, optimates: -1 },
      },
      {
        key: 'senate_discipline',
        title: 'Senate Discipline',
        description: 'Let the Senate handle it internally. Public spectacles only embolden enemies.',
        axisEffects: { patrician: 1, tradition: 1 },
        factionPowerEffects: { optimates: 1, legiones: 1 },
      },
      {
        key: 'pardon_and_reform',
        title: 'Pardon and Reform',
        description:
          'Pardon him for past service but institute new accountability for future governors.',
        axisEffects: { tradition: -1 },
        factionPowerEffects: { provinciales: 1, mercatores: 1, optimates: -1 },
      },
    ],
  },

  // === RELIGIOUS & CULTURAL ===
  {
    key: 'foreign_cults',
    title: 'The Foreign Cults',
    category: 'religious',
    illustration: 'eastern_temple',
    flavor:
      'Eastern mystery religions — Isis, Bacchus, Mithras — spread like wildfire through the city. The old priesthoods are alarmed. The people are captivated. The merchants who imported the goods also imported the gods.',
    resolutions: [
      {
        key: 'suppress_cults',
        title: 'Suppress the Cults',
        description: 'Ban foreign religious practices. Rome needs Roman gods.',
        axisEffects: { tradition: 1, centralization: 1 },
        factionPowerEffects: { pontifices: 1, optimates: 1, provinciales: -1 },
      },
      {
        key: 'regulated_tolerance',
        title: 'Regulated Tolerance',
        description: 'Allow foreign worship in designated areas under civic oversight.',
        axisEffects: { tradition: -1, expansion: -1 },
        factionPowerEffects: { provinciales: 1, mercatores: 1, fabri: 1 },
      },
      {
        key: 'open_syncretism',
        title: 'Open Syncretism',
        description: 'Formally incorporate the foreign gods into the Roman pantheon.',
        axisEffects: { tradition: -2, patrician: -1 },
        factionPowerEffects: { provinciales: 1, plebeii: 1, pontifices: -1 },
      },
    ],
  },
  {
    key: 'pontificate_election',
    title: 'The Pontificate Election',
    category: 'religious',
    illustration: 'roman_priests',
    flavor:
      'The position of Pontifex Maximus has fallen vacant. The great families expect to choose among themselves as they always have. But this is an age of reform, and the people have noticed how useful the highest priest can be.',
    resolutions: [
      {
        key: 'popular_election',
        title: 'Popular Election',
        description: 'Let the citizen assemblies vote for the chief priest. The gods belong to all Rome.',
        axisEffects: { patrician: -1, tradition: -1 },
        factionPowerEffects: { plebeii: 1, pontifices: -1, optimates: -1 },
      },
      {
        key: 'senate_appointment',
        title: 'Senate Appointment',
        description: 'Maintain the traditional aristocratic selection of the highest priest.',
        axisEffects: { patrician: 1, tradition: 1 },
        factionPowerEffects: { optimates: 1, pontifices: 1 },
      },
      {
        key: 'merit_based_selection',
        title: 'Merit-Based Selection',
        description:
          'Reform the selection to choose the most learned and pious candidate, regardless of birth.',
        axisEffects: { tradition: -1, centralization: 1 },
        factionPowerEffects: { pontifices: 1, fabri: 1 },
      },
    ],
  },
  {
    key: 'censors_report',
    title: "The Censors' Report",
    category: 'religious',
    illustration: 'roman_censors',
    flavor:
      'The censors have issued a scathing report: luxury, irreligion, and foreign influence have corrupted Roman manners. They demand action — or so the report claims. Their political enemies see a weapon, not a diagnosis.',
    resolutions: [
      {
        key: 'strict_enforcement',
        title: 'Strict Enforcement',
        description:
          'Enforce moral laws, expel compromised senators, and restore the discipline of the ancestors.',
        axisEffects: { tradition: 1, patrician: 1 },
        factionPowerEffects: { pontifices: 1, optimates: 1, plebeii: -1, mercatores: -1 },
      },
      {
        key: 'selective_reform',
        title: 'Selective Reform',
        description: 'Update Roman moral standards to reflect the modern, cosmopolitan Republic.',
        axisEffects: { tradition: -1, patrician: -1 },
        factionPowerEffects: { fabri: 1, mercatores: 1 },
      },
      {
        key: 'dismiss_report',
        title: 'Dismiss the Report',
        description: 'The censors are political actors pursuing vendettas. Disregard their findings entirely.',
        axisEffects: { tradition: -1, expansion: -1 },
        factionPowerEffects: { plebeii: 1, mercatores: 1, pontifices: -1 },
      },
    ],
  },
  {
    key: 'sibylline_oracle',
    title: 'The Sibylline Oracle',
    category: 'religious',
    illustration: 'sibylline_books',
    flavor:
      "The keepers of the Sibylline Books have consulted them in secret and emerged pale. Their prescription: extraordinary public rites, massive expenditure, and the importation of a foreign god. Rome's fate, they say, hangs in the balance. It always does.",
    resolutions: [
      {
        key: 'fulfill_oracle',
        title: 'Fulfill the Oracle',
        description: 'The Sibylline Books have never been wrong. Spend what must be spent.',
        axisEffects: { tradition: 1, centralization: 1 },
        factionPowerEffects: { pontifices: 2, optimates: 1, fabri: 1 },
      },
      {
        key: 'reinterpret_oracle',
        title: 'Reinterpret the Oracle',
        description: 'The Books speak in symbols. A simpler, cheaper ceremony satisfies their spirit.',
        axisEffects: { tradition: -1 },
        factionPowerEffects: { pontifices: -1, fabri: 1 },
      },
      {
        key: 'reject_oracle',
        title: 'Reject the Oracle',
        description: 'Rome was not built on omens. This is priestcraft and politics, nothing more.',
        axisEffects: { tradition: -1, militarism: 1 },
        factionPowerEffects: { pontifices: -1, legiones: 1, plebeii: 1 },
      },
    ],
  },
];

export const CONTROVERSY_MAP: Record<string, Controversy> = Object.fromEntries(
  CONTROVERSIES.map((c) => [c.key, c])
);

export const ROOT_CONTROVERSY_KEYS: string[] = CONTROVERSIES.map((c) => c.key);
