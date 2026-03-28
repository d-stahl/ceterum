import { AxisKey } from './axes.ts';

// --- Shared types ---

export interface ControversyResolution {
  key: string;
  title: string;
  description: string;
  axisEffects: Partial<Record<AxisKey, number>>;
  factionPowerEffects: Partial<Record<string, number>>;
  followUpKey?: string;
}

export type ControversyType = 'vote' | 'clash' | 'endeavour' | 'schism';
export type ControversyCategory = 'military' | 'social' | 'economic' | 'political' | 'religious';

// --- Outcome types (used by Clash, Endeavour) ---

export interface ControversyOutcome {
  axisEffects: Partial<Record<AxisKey, number>>;
  factionPowerEffects: Partial<Record<string, number>>;
  followUpKey?: string;
}

// --- Type-specific configs ---

export interface ClashPersonalEffects {
  commitSuccess: { affinityBonus: number };      // affinity bonus with won factions
  commitFailure: { influenceLoss: number; affinityPenalty: number }; // influence lost + affinity penalty with won factions
  withdrawSuccess: {
    affinityPenalty: number;          // affinity penalty with won factions ("you held us back")
    globalAffinityPenalty?: number;   // affinity penalty with ALL factions ("coward!")
  };
  // withdrawFailure: no effect (stayed home, no blame)
}

export interface ClashConfig {
  thresholdPercent: number;  // e.g. 0.70 = 70% of total available faction power
  factionAmplifiers: Partial<Record<string, number>>;  // factionKey -> multiplier (2 = critical)
  successOutcome: ControversyOutcome & { victoryPoints: number };
  failureOutcome: ControversyOutcome;
  personalEffects?: ClashPersonalEffects;  // per-player effects scoped to won factions
}

export interface EndeavourConfig {
  difficultyPercent: number;  // threshold = sum(initial_influence) × this
  firstPlaceReward: number;   // max reward in VP equivalent, e.g. 2.5
  successOutcome: ControversyOutcome;
  failureOutcome: ControversyOutcome;
}

export interface SchismSide {
  key: string;
  title: string;
  description: string;
  axisEffects: Partial<Record<AxisKey, number>>;
  factionPowerEffects: Partial<Record<string, number>>;
  /** VP each team member gets if all support */
  supportVP: number;
  /** VP each saboteur gets if some (but not all) sabotage */
  betrayVP: number;
  /** VP each saboteur gets if ALL sabotage */
  allBetrayVP: number;
  /** VP each supporter loses if betrayed (0 = no penalty, negative = loss) */
  betrayedVP?: number;
  followUpKey?: string;
}

export interface SchismConfig {
  sides: [SchismSide, SchismSide];
}

// --- Controversy ---

interface ControversyBase {
  key: string;
  title: string;
  category: ControversyCategory;
  flavor: string;
  illustration: string;
}

export interface VoteControversy extends ControversyBase {
  type: 'vote';
  resolutions: [ControversyResolution, ControversyResolution, ControversyResolution];
}

export interface ClashControversy extends ControversyBase {
  type: 'clash';
  clashConfig: ClashConfig;
}

export interface EndeavourControversy extends ControversyBase {
  type: 'endeavour';
  endeavourConfig: EndeavourConfig;
}

export interface SchismControversy extends ControversyBase {
  type: 'schism';
  schismConfig: SchismConfig;
}

export type Controversy = VoteControversy | ClashControversy | EndeavourControversy | SchismControversy;

/** Type guard for vote controversies */
export function isVoteControversy(c: Controversy): c is VoteControversy {
  return c.type === 'vote';
}

export const CONTROVERSIES: Controversy[] = [
  // === MILITARY & FOREIGN POLICY ===
  {
    key: 'carthaginian_menace',
    title: 'The Carthaginian Menace',
    type: 'vote',
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
        factionPowerEffects: { legiones: 1, nautae: 1, mercatores: 1, provinciales: -1, servi: -1 },
        followUpKey: 'hannibals_crossing',
      },
      {
        key: 'economic_pressure',
        title: 'Economic Pressure',
        description:
          'Impose trade sanctions and strengthen coastal defenses. Let commerce do what swords need not.',
        axisEffects: { commerce: 1, expansion: -1 },
        factionPowerEffects: { mercatores: 1, nautae: 1 },
        followUpKey: 'blockade_lines',
      },
      {
        key: 'diplomatic_accord',
        title: 'Diplomatic Accord',
        description:
          'Negotiate a treaty that recognizes spheres of influence. Peace is profitable.',
        axisEffects: { militarism: -1 },
        factionPowerEffects: { mercatores: 1, nautae: 1, legiones: -1, milites: -1 },
        followUpKey: 'peace_of_carthage',
      },
    ],
  },
  {
    key: 'gallic_incursion',
    title: 'The Gallic Incursion',
    type: 'vote',
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
        factionPowerEffects: { legiones: 1, fabri: -1, servi: -1 },
        followUpKey: 'alpine_campaign',
      },
      {
        key: 'defensive_fortifications',
        title: 'Defensive Fortifications',
        description: 'Build walls and strengthen the northern frontier. Let them raid emptiness.',
        axisEffects: { expansion: -1 },
        factionPowerEffects: { fabri: 1, legiones: 1 },
        followUpKey: 'garrison_mutiny',
      },
      {
        key: 'tribal_settlement',
        title: 'Tribal Settlement',
        description:
          'Offer the Gauls land in sparsely populated regions in exchange for peace and service.',
        axisEffects: { expansion: -1, militarism: -1 },
        factionPowerEffects: { provinciales: 1, agricolae: -1, legiones: -1, milites: -1 },
        followUpKey: 'settled_tribes',
      },
    ],
  },
  {
    key: 'pontic_alliance',
    title: 'The Pontic Alliance',
    type: 'vote',
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
        factionPowerEffects: { milites: 1, nautae: 1 },
        followUpKey: 'eastern_garrison',
      },
      {
        key: 'demand_submission',
        title: 'Demand Submission',
        description: "Accept only if Pontus acknowledges Roman supremacy. Allies must know their place.",
        axisEffects: { centralization: 1, expansion: 1 },
        factionPowerEffects: { optimates: 1, legiones: 1, fabri: -1 },
        followUpKey: 'pontic_defiance',
      },
      {
        key: 'reject_alliance',
        title: 'Reject Alliance',
        description: "Rome needs no eastern entanglements. The Republic's strength lies in its focus.",
        axisEffects: { expansion: -1 },
        factionPowerEffects: { optimates: 1, pontifices: 1, mercatores: -1, milites: -1 },
        followUpKey: 'eastern_outposts',
      },
    ],
  },
  {
    key: 'egyptian_question',
    title: 'The Egyptian Question',
    type: 'vote',
    category: 'economic',
    illustration: 'greek_city',
    flavor:
      "Egypt has fallen into Rome's sphere — its pharaoh a puppet, its granaries overflowing, its ports the gateway to the riches of India and Arabia. The Senate must decide what to do with the most valuable territory on earth. Every option makes someone fabulously wealthy and someone else furious.",
    resolutions: [
      {
        key: 'royal_province',
        title: 'Royal Province',
        description: 'Annex Egypt outright. Its grain, its ports, and its taxes belong to the Roman people.',
        axisEffects: { expansion: 1, commerce: 1 },
        factionPowerEffects: { nautae: 1, mercatores: 1, optimates: -1 },
        followUpKey: 'red_sea_expedition',
      },
      {
        key: 'client_kingdom',
        title: 'Client Kingdom',
        description: 'Install a friendly king who rules in name while Rome rules in fact. Cheaper than a province, and someone else handles the revolts.',
        axisEffects: { tradition: -1, militarism: -1 },
        factionPowerEffects: { provinciales: 1, pontifices: -1, legiones: -1 },
        followUpKey: 'monsoon_fleet',
      },
      {
        key: 'free_trade_port',
        title: 'Free Trade Port',
        description: 'Declare Alexandria an open port. Let every merchant in the Mediterranean compete for the eastern trade.',
        axisEffects: { patrician: -1, commerce: 1 },
        factionPowerEffects: { mercatores: 1, nautae: 1, agricolae: -1 },
        followUpKey: 'merchant_princes',
      },
    ],
  },

  // === SOCIAL & CLASS ===
  {
    key: 'agrarian_question',
    title: 'The Agrarian Question',
    type: 'vote',
    category: 'social',
    illustration: 'roman_fields',
    flavor:
      'Wealthy patricians have illegally occupied vast tracts of public land for generations. The landless poor flood into Rome while the countryside empties of the smallholders who once filled the legions.',
    resolutions: [
      {
        key: 'land_redistribution',
        title: 'Land Redistribution',
        description: 'Seize excess public land and divide it among landless citizens.',
        axisEffects: { commerce: -1 },
        factionPowerEffects: { fabri: -1, agricolae: 1, optimates: -1 },
        followUpKey: 'veteran_colonies',
      },
      {
        key: 'regulated_ownership',
        title: 'Regulated Ownership',
        description: 'Cap individual land holdings but compensate current occupants fairly.',
        axisEffects: {},
        factionPowerEffects: { fabri: 1, milites: 1 },
        followUpKey: 'land_surveyors',
      },
      {
        key: 'protect_property_rights',
        title: 'Protect Property Rights',
        description: 'Existing occupation reflects legitimate investment. Focus on other solutions.',
        axisEffects: { patrician: 1, tradition: 1 },
        factionPowerEffects: { optimates: 1, agricolae: -1 },
        followUpKey: 'tenant_revolt',
      },
    ],
  },
  {
    key: 'slave_uprising',
    title: 'The Slave Uprising',
    type: 'vote',
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
        factionPowerEffects: { legiones: 1, milites: 1, servi: -1 },
        followUpKey: 'plantation_siege',
      },
      {
        key: 'conditional_reform',
        title: 'Conditional Reform',
        description:
          'Suppress the revolt, but promise improved conditions and legal paths to manumission.',
        axisEffects: { patrician: -1 },
        factionPowerEffects: { servi: 1, fabri: 1, optimates: -1 },
        followUpKey: 'manumission_registry',
      },
      {
        key: 'negotiated_surrender',
        title: 'Negotiated Surrender',
        description: 'Offer freedom to rebels who lay down arms and surrender their leaders.',
        axisEffects: { patrician: -2 },
        factionPowerEffects: { servi: 2, plebeii: 1, legiones: -1, optimates: -1 },
        followUpKey: 'freedman_question',
      },
    ],
  },
  {
    key: 'italian_allies',
    title: 'The Italian Allies',
    type: 'vote',
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
        followUpKey: 'assembly_crisis',
      },
      {
        key: 'gradual_integration',
        title: 'Gradual Integration',
        description:
          'Offer a path to citizenship over time through military service and demonstrated loyalty.',
        axisEffects: { patrician: -1 },
        factionPowerEffects: { legiones: 1, fabri: 1, provinciales: 1 },
        followUpKey: 'loyalty_campaigns',
      },
      {
        key: 'firm_refusal',
        title: 'Firm Refusal',
        description: "Rome's privileges belong to Romans. The allies knew the terms when they joined.",
        axisEffects: { patrician: 1, tradition: 1 },
        factionPowerEffects: { optimates: 1, pontifices: 1, provinciales: -2, servi: -1 },
        followUpKey: 'social_war',
      },
    ],
  },
  {
    key: 'debt_crisis',
    title: 'The Debt Crisis',
    type: 'vote',
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
        factionPowerEffects: { plebeii: 1, servi: 1, mercatores: -1, optimates: -1 },
        followUpKey: 'creditors_revolt',
      },
      {
        key: 'interest_caps',
        title: 'Interest Caps',
        description: 'Limit interest rates and regulate lending practices going forward.',
        axisEffects: {},
        factionPowerEffects: { milites: 1, servi: 1 },
        followUpKey: 'debt_courts',
      },
      {
        key: 'enforce_contracts',
        title: 'Enforce Contracts',
        description:
          'Debts are sacred obligations. Relief destroys credit, commerce, and the rule of law.',
        axisEffects: { patrician: 1, tradition: 1, commerce: 1 },
        factionPowerEffects: { optimates: 1, fabri: -1, plebeii: -1 },
        followUpKey: 'debtors_march',
      },
    ],
  },

  // === ECONOMIC ===
  {
    key: 'grain_dole',
    title: 'The Grain Dole',
    type: 'vote',
    category: 'economic',
    illustration: 'grain_market',
    flavor:
      'Grain prices have soared beyond what the urban poor can afford. Riots break out weekly. The question of state-subsidized grain can no longer be deferred with speeches about self-reliance.',
    resolutions: [
      {
        key: 'state_grain_dole',
        title: 'State Grain Dole',
        description: 'Establish regular free or heavily subsidized grain for all citizens.',
        axisEffects: { centralization: 1 },
        factionPowerEffects: { plebeii: 2, fabri: 1, agricolae: -1 },
        followUpKey: 'grain_fleet',
      },
      {
        key: 'emergency_reserves',
        title: 'Emergency Reserves',
        description:
          'Build state grain stockpiles to stabilize prices in crises only. Not a permanent dole.',
        axisEffects: { centralization: 1 },
        factionPowerEffects: { agricolae: 1, milites: 1 },
        followUpKey: 'stockpile_scandal',
      },
      {
        key: 'market_prices',
        title: 'Market Prices',
        description: 'State interference destroys incentive. Let the market find its own level.',
        axisEffects: { commerce: 1 },
        factionPowerEffects: { mercatores: 1, agricolae: 1, plebeii: -1 },
        followUpKey: 'bread_war',
      },
    ],
  },
  {
    key: 'pirate_menace',
    title: 'The Pirate Menace',
    type: 'vote',
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
        followUpKey: 'purging_the_mediterranean',
      },
      {
        key: 'diplomatic_pardon',
        title: 'Diplomatic Pardon',
        description: 'Offer pirates land, amnesty, and resettlement in exchange for surrender.',
        axisEffects: { militarism: -1, expansion: -1 },
        factionPowerEffects: { provinciales: 1, agricolae: 1, nautae: -1, milites: -1 },
        followUpKey: 'pirate_settlements',
      },
      {
        key: 'merchant_convoys',
        title: 'Merchant Convoys',
        description: 'Fund state-organized convoy escorts. Protect the trade without a crusade.',
        axisEffects: { commerce: 1 },
        factionPowerEffects: { mercatores: 1, nautae: 1 },
        followUpKey: 'outfitting_convoy_fleet',
      },
    ],
  },
  {
    key: 'tax_contracts',
    title: 'The Tax Contracts',
    type: 'vote',
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
        axisEffects: { centralization: 1 },
        factionPowerEffects: { provinciales: 1, plebeii: 1, mercatores: -1 },
        followUpKey: 'provincial_audit',
      },
      {
        key: 'regulated_contracts',
        title: 'Regulated Contracts',
        description:
          'Keep the publicani but create oversight boards and provincial appeals processes.',
        axisEffects: { centralization: -1 },
        factionPowerEffects: { mercatores: 1, provinciales: 1 },
        followUpKey: 'oversight_tribunal',
      },
      {
        key: 'free_market_contracts',
        title: 'Free Market Contracts',
        description: 'Competition between contractors keeps prices honest. Regulation only stifles enterprise.',
        axisEffects: { commerce: 1, patrician: 1 },
        factionPowerEffects: { mercatores: 1, optimates: 1, provinciales: -1 },
        followUpKey: 'tax_census',
      },
    ],
  },
  {
    key: 'sumptuary_question',
    title: 'The Sumptuary Question',
    type: 'vote',
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
        axisEffects: { centralization: 1 },
        factionPowerEffects: { pontifices: 1, optimates: -1, mercatores: -1, servi: -1 },
        followUpKey: 'fashion_wars',
      },
      {
        key: 'luxury_tax',
        title: 'Luxury Tax',
        description: 'Tax luxury imports and redistribute proceeds to public works and grain.',
        axisEffects: { commerce: -1 },
        factionPowerEffects: { fabri: 1, plebeii: 1, mercatores: -1 },
        followUpKey: 'smugglers_war',
      },
      {
        key: 'no_restriction',
        title: 'No Restriction',
        description:
          "A man's right to enjoy his wealth is sacred. The Republic was built on property rights.",
        axisEffects: { patrician: 1, commerce: 1 },
        factionPowerEffects: { optimates: 1, mercatores: 1, plebeii: -1 },
        followUpKey: 'luxury_fleet',
      },
    ],
  },

  // === POLITICAL & CONSTITUTIONAL ===
  {
    key: 'tribunes_veto',
    title: "The Tribune's Veto",
    type: 'vote',
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
        factionPowerEffects: { optimates: 1, pontifices: 1 },
        followUpKey: 'forum_standoff',
      },
      {
        key: 'defend_veto',
        title: 'Defend the Veto',
        description:
          "The tribune's power is sacrosanct. Any restriction sets a precedent that will be exploited.",
        axisEffects: { centralization: -1 },
        factionPowerEffects: { plebeii: 1, milites: 1, servi: 1 },
        followUpKey: 'tribunes_coalition',
      },
      {
        key: 'reform_assembly',
        title: 'Reform the Assembly',
        description:
          'Restructure the voting assemblies to reduce deadlock and better reflect the population.',
        axisEffects: { tradition: -1, patrician: -1 },
        factionPowerEffects: { fabri: 1, milites: 1, optimates: -1 },
        followUpKey: 'assembly_reform',
      },
    ],
  },
  {
    key: 'emergency_powers',
    title: 'The Emergency Powers',
    type: 'vote',
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
        factionPowerEffects: { legiones: 1, optimates: 1 },
        followUpKey: 'dictators_reckoning',
      },
      {
        key: 'expanded_consular_authority',
        title: 'Expanded Consular Authority',
        description: 'Allow the consuls to act without Senate approval for the duration of the crisis.',
        axisEffects: { centralization: 1 },
        factionPowerEffects: { milites: 1, legiones: 1, fabri: -1 },
        followUpKey: 'consular_crisis',
      },
      {
        key: 'senate_consensus',
        title: 'Senate Consensus',
        description:
          'Govern through deliberation despite the slowness. The Republic was not built in a day.',
        axisEffects: { expansion: -1 },
        factionPowerEffects: { optimates: 1, pontifices: 1, legiones: -1, milites: -1 },
        followUpKey: 'delayed_response',
      },
    ],
  },
  {
    key: 'electoral_corruption',
    title: 'The Electoral Corruption',
    type: 'vote',
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
        followUpKey: 'election_inspectors',
      },
      {
        key: 'electoral_redistribution',
        title: 'Electoral Redistribution',
        description: 'Change the assembly structure to weight votes more equally across classes.',
        axisEffects: { patrician: -1, tradition: -1 },
        factionPowerEffects: { plebeii: 1, optimates: -1, mercatores: -1 },
        followUpKey: 'voting_riots',
      },
      {
        key: 'accept_reality',
        title: 'Accept Reality',
        description: 'Bribery is the oil that makes the machine run. Virtue-signaling solves nothing.',
        axisEffects: { patrician: 1, tradition: 1 },
        factionPowerEffects: { servi: 1, mercatores: 1, plebeii: -1 },
        followUpKey: 'patronage_networks',
      },
    ],
  },
  {
    key: 'governors_excesses',
    title: "The Governor's Excesses",
    type: 'vote',
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
        axisEffects: { centralization: 1 },
        factionPowerEffects: { provinciales: 1, plebeii: 1, legiones: -1, optimates: -1 },
        followUpKey: 'governors_trial',
      },
      {
        key: 'senate_discipline',
        title: 'Senate Discipline',
        description: 'Let the Senate handle it internally. Public spectacles only embolden enemies.',
        axisEffects: { patrician: 1, tradition: 1 },
        factionPowerEffects: { milites: 1, legiones: 1 },
        followUpKey: 'provincial_reform',
      },
      {
        key: 'pardon_and_reform',
        title: 'Pardon and Reform',
        description:
          'Pardon him for past service but institute new accountability for future governors.',
        axisEffects: {},
        factionPowerEffects: { provinciales: 1, servi: 1, optimates: -1 },
        followUpKey: 'returning_legions',
      },
    ],
  },

  // === RELIGIOUS & CULTURAL ===
  {
    key: 'foreign_cults',
    title: 'The Foreign Cults',
    type: 'vote',
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
        followUpKey: 'temple_purge',
      },
      {
        key: 'regulated_tolerance',
        title: 'Regulated Tolerance',
        description: 'Allow foreign worship in designated areas under civic oversight.',
        axisEffects: { tradition: -1, centralization: -1 },
        factionPowerEffects: { provinciales: 1 },
        followUpKey: 'licensing_board',
      },
      {
        key: 'open_syncretism',
        title: 'Open Syncretism',
        description: 'Formally incorporate the foreign gods into the Roman pantheon.',
        axisEffects: { tradition: -2 },
        factionPowerEffects: { provinciales: 1, plebeii: 1, pontifices: -1 },
        followUpKey: 'sacred_calendar',
      },
    ],
  },
  {
    key: 'pontificate_election',
    title: 'The Pontificate Election',
    type: 'vote',
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
        followUpKey: 'sacred_games',
      },
      {
        key: 'senate_appointment',
        title: 'Senate Appointment',
        description: 'Maintain the traditional aristocratic selection of the highest priest.',
        axisEffects: { patrician: 1, tradition: 1 },
        factionPowerEffects: { optimates: 1, pontifices: 1 },
        followUpKey: 'augurs_authority',
      },
      {
        key: 'merit_based_selection',
        title: 'Merit-Based Selection',
        description:
          'Reform the selection to choose the most learned and pious candidate, regardless of birth.',
        axisEffects: { tradition: -1 },
        factionPowerEffects: { pontifices: 1 },
        followUpKey: 'temple_restoration',
      },
    ],
  },
  {
    key: 'censors_report',
    title: "The Censors' Report",
    type: 'vote',
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
        factionPowerEffects: { pontifices: 1, milites: 1, plebeii: -1, mercatores: -1, servi: -1 },
        followUpKey: 'moral_courts',
      },
      {
        key: 'selective_reform',
        title: 'Selective Reform',
        description: 'Update Roman moral standards to reflect the modern, cosmopolitan Republic.',
        axisEffects: { tradition: -1 },
        factionPowerEffects: { provinciales: 1, mercatores: 1 },
        followUpKey: 'cultural_commission',
      },
      {
        key: 'dismiss_report',
        title: 'Dismiss the Report',
        description: 'The censors are political actors pursuing vendettas. Disregard their findings entirely.',
        axisEffects: { expansion: -1 },
        factionPowerEffects: { plebeii: 1, servi: 1, pontifices: -1 },
        followUpKey: 'censors_revenge',
      },
    ],
  },
  {
    key: 'sibylline_oracle',
    title: 'The Sibylline Oracle',
    type: 'vote',
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
        factionPowerEffects: { pontifices: 2, servi: 1, fabri: 1 },
        followUpKey: 'sacred_festival',
      },
      {
        key: 'reinterpret_oracle',
        title: 'Reinterpret the Oracle',
        description: 'The Books speak in symbols. A simpler, cheaper ceremony satisfies their spirit.',
        axisEffects: {},
        factionPowerEffects: { pontifices: -1, fabri: 1 },
        followUpKey: 'priestly_schism',
      },
      {
        key: 'reject_oracle',
        title: 'Reject the Oracle',
        description: 'Rome was not built on omens. This is priestcraft and politics, nothing more.',
        axisEffects: { militarism: 1 },
        factionPowerEffects: { pontifices: -1, legiones: 1 },
        followUpKey: 'oracles_curse',
      },
    ],
  },
];

// === FOLLOW-UP CONTROVERSIES ===

export const FOLLOW_UP_CONTROVERSIES: Controversy[] = [
  // --- Pirate Menace follow-ups ---
  {
    key: 'purging_the_mediterranean',
    title: 'Purging the Mediterranean',
    type: 'clash',
    category: 'military',
    illustration: 'purging_the_mediterranean',
    flavor:
      "The Senate has spoken: Rome will sweep the seas clean. But a naval campaign of this scale demands every faction's commitment. The pirates are entrenched across a thousand islands and hidden coves. Half-measures will only scatter them — total victory requires total support.",
    clashConfig: {
      thresholdPercent: 0.70,
      factionAmplifiers: { nautae: 2, milites: 2 },
      successOutcome: {
        axisEffects: { expansion: 1, militarism: 1 },
        factionPowerEffects: { nautae: 1 },
        victoryPoints: 3,
      },
      failureOutcome: {
        axisEffects: { militarism: -1, commerce: -1 },
        factionPowerEffects: { nautae: -1 },
      },
      personalEffects: {
        commitSuccess: { affinityBonus: 1 },
        commitFailure: { influenceLoss: 10, affinityPenalty: -2 },
        withdrawSuccess: { affinityPenalty: -1, globalAffinityPenalty: -2 },
      },
    },
  },
  {
    key: 'pirate_settlements',
    title: 'The Pirate Settlements',
    type: 'schism',
    category: 'social',
    illustration: 'pirates_and_farmers_schism',
    flavor:
      "The pardoned pirates are settling on Italian coastland as promised. But the locals are furious — these men burned their ships and murdered their kin not two seasons ago. Tensions boil over into riots. The Senate must decide: honour its word to cold-blooded killers, or break a solemn promise of the Roman people.",
    schismConfig: {
      sides: [
        {
          key: 'honour_accord',
          title: 'Honour the Accord',
          description: 'Stand by the Senate\'s promise. The settlements stay. Rome\'s word must mean something.',
          axisEffects: { tradition: -1 },
          factionPowerEffects: { agricolae: -1, nautae: -1 },
          supportVP: 1.5,
          betrayVP: 0.5,
          allBetrayVP: 0.5,
        },
        {
          key: 'break_promise',
          title: 'Break the Promise',
          description: 'Drive the pirates from the land. They are murderers, not settlers, and Rome owes them nothing.',
          axisEffects: { militarism: 1 },
          factionPowerEffects: { legiones: 1, agricolae: 1 },
          supportVP: 1.5,
          betrayVP: 0.5,
          allBetrayVP: 0.5,
        },
      ],
    },
  },
  {
    key: 'outfitting_convoy_fleet',
    title: 'Outfitting the Convoy Fleet',
    type: 'endeavour',
    category: 'economic',
    illustration: 'outfitting_the_fleet',
    flavor:
      "The Senate authorized convoy escorts — on paper. Now someone has to actually build the ships, hire the crews, and chart the routes. The treasury is thin and the merchants are impatient. If the convoys sail undermanned, they'll be easy prey. If they never sail at all, Rome's trade collapses.",
    endeavourConfig: {
      difficultyPercent: 0.50,
      firstPlaceReward: 2.5,
      successOutcome: {
        axisEffects: { commerce: 1 },
        factionPowerEffects: { mercatores: 1, nautae: 1 },
      },
      failureOutcome: {
        axisEffects: { commerce: -1 },
        factionPowerEffects: { mercatores: -1, nautae: -1 },
      },
    },
  },
  // --- Italian Allies follow-ups ---
  {
    key: 'assembly_crisis',
    title: 'The Assembly Crisis',
    type: 'schism',
    category: 'political',
    illustration: 'crowded_assembly',
    flavor:
      'The new citizens have arrived — all of them, all at once. The tribal assemblies are in chaos. Old Romans who once commanded a comfortable majority now find themselves outvoted by men who spoke Oscan last year. A faction demands the new citizens be confined to a handful of overflow tribes where their votes count for almost nothing.',
    schismConfig: {
      sides: [
        {
          key: 'restrict_tribes',
          title: 'Restrict the New Tribes',
          description: 'Confine new citizens to four overflow tribes. They have citizenship — but not equal power.',
          axisEffects: { centralization: -1, patrician: 1 },
          factionPowerEffects: { optimates: 1, plebeii: 1, provinciales: -2 },
          supportVP: 2.5,
          betrayVP: 1.5,
          allBetrayVP: 0.5,
          betrayedVP: -1,
        },
        {
          key: 'equal_distribution',
          title: 'Equal Tribal Distribution',
          description: 'Distribute new citizens equally across all thirty-five tribes. A citizen is a citizen.',
          axisEffects: { centralization: -1, expansion: 1 },
          factionPowerEffects: { provinciales: 1, plebeii: -1, optimates: -1 },
          supportVP: 2.5,
          betrayVP: 1.5,
          allBetrayVP: 0.5,
          betrayedVP: -1,
        },
      ],
    },
  },
  {
    key: 'loyalty_campaigns',
    title: 'The Loyalty Campaigns',
    type: 'endeavour',
    category: 'military',
    illustration: 'allied_legions_marching',
    flavor:
      "The Senate's promise is clear: citizenship through service. Allied communities across Italy are mustering their young men for joint campaigns on the frontier. But Rome has set the bar high — these are not token patrols. If the campaigns succeed, a generation of allies will have earned their place in the Republic with blood. If they fail, the whole integration program will be branded a mistake.",
    endeavourConfig: {
      difficultyPercent: 0.55,
      firstPlaceReward: 3,
      successOutcome: {
        axisEffects: { expansion: 1, militarism: 1 },
        factionPowerEffects: { milites: 1, legiones: 1, agricolae: -1 },
      },
      failureOutcome: {
        axisEffects: { centralization: -1 },
        factionPowerEffects: { provinciales: -1, nautae: -1, plebeii: -1 },
      },
    },
  },
  {
    key: 'social_war',
    title: 'The Social War',
    type: 'clash',
    category: 'military',
    illustration: 'italian_battlefield',
    flavor:
      "The allies have taken up arms. From Picenum to Campania, communities that furnished Rome's best soldiers now turn those skills against her. The rebels fight with Roman training, Roman discipline, and Roman fury. Coastal allies blockade the ports. Fields burn across the peninsula. This is not a foreign war — it is a civil one, and it will be decided by commitment, not cleverness.",
    clashConfig: {
      thresholdPercent: 0.65,
      factionAmplifiers: { legiones: 2, milites: 2 },
      successOutcome: {
        axisEffects: { militarism: 1, centralization: -1 },
        factionPowerEffects: { legiones: 1, milites: 1, agricolae: -1 },
        victoryPoints: 2.5,
      },
      failureOutcome: {
        axisEffects: { commerce: -1, expansion: -1 },
        factionPowerEffects: { nautae: -1, mercatores: -1, plebeii: -1 },
      },
      personalEffects: {
        commitSuccess: { affinityBonus: 1 },
        commitFailure: { influenceLoss: 10, affinityPenalty: -2 },
        withdrawSuccess: { affinityPenalty: -2, globalAffinityPenalty: -1 },
      },
    },
  },
  // --- Emergency Powers follow-ups ---
  {
    key: 'dictators_reckoning',
    title: "The Dictator's Reckoning",
    type: 'clash',
    category: 'political',
    illustration: 'dictator_defiant',
    flavor:
      "The dictator has served his purpose — but his veterans crowd the forum and his edicts keep coming. He shows no sign of laying down power. The Senate must rally enough support to force him out, or the Republic dies in committee. This is not a battle of legions but of legitimacy: can Rome's institutions outlast one man's ambition?",
    clashConfig: {
      thresholdPercent: 0.60,
      factionAmplifiers: { optimates: 2, plebeii: 2 },
      successOutcome: {
        axisEffects: { centralization: -2 },
        factionPowerEffects: { optimates: 1, legiones: -1, plebeii: -1 },
        victoryPoints: 2,
      },
      failureOutcome: {
        axisEffects: { militarism: 1, commerce: -1 },
        factionPowerEffects: { legiones: 1, pontifices: -1, plebeii: -2 },
      },
      personalEffects: {
        commitSuccess: { affinityBonus: 1 },
        commitFailure: { influenceLoss: 8, affinityPenalty: -2 },
        withdrawSuccess: { affinityPenalty: -1, globalAffinityPenalty: -2 },
      },
    },
  },
  {
    key: 'consular_crisis',
    title: 'The Consular Crisis',
    type: 'schism',
    category: 'political',
    illustration: 'dueling_consuls',
    flavor:
      "The two consuls, drunk on unchecked power, now disagree on everything. Rome has two would-be tyrants pulling the state in opposite directions. Veterans loyal to each consul brawl in the streets. Markets close as merchants flee the uncertainty. The Senate must choose: strip their powers and face the legions' anger, or let them compete and hope the Republic survives their rivalry.",
    schismConfig: {
      sides: [
        {
          key: 'strip_powers',
          title: 'Strip Their Powers',
          description: 'Revoke emergency authority. Return command to the Senate where it belongs.',
          axisEffects: { centralization: -1, militarism: -1 },
          factionPowerEffects: { pontifices: 1, legiones: -1, milites: -1 },
          supportVP: 2.7,
          betrayVP: 1.6,
          allBetrayVP: 0.5,
          betrayedVP: -1.5,
        },
        {
          key: 'let_them_compete',
          title: 'Let Them Compete',
          description: 'The consuls will check each other. Rome has survived worse than two ambitious men.',
          axisEffects: { commerce: -1 },
          factionPowerEffects: { mercatores: 1, pontifices: -1, plebeii: -1 },
          supportVP: 2.7,
          betrayVP: 1.6,
          allBetrayVP: 0.5,
          betrayedVP: -1.5,
        },
      ],
    },
  },
  {
    key: 'delayed_response',
    title: 'The Delayed Response',
    type: 'endeavour',
    category: 'military',
    illustration: 'burning_frontier_town',
    flavor:
      "The crisis the Senate spent months debating has worsened into catastrophe. Frontier towns burn, refugees flood south, and the legions that should have marched weeks ago are still waiting for authorization. Now everyone must contribute to an emergency response — civilian engineers, merchant ships, temple treasuries — but it may already be too late. The question is not whether Rome can win, but whether enough can be salvaged to call it survival.",
    endeavourConfig: {
      difficultyPercent: 0.60,
      firstPlaceReward: 3.5,
      successOutcome: {
        axisEffects: { militarism: -1 },
        factionPowerEffects: { fabri: 1, plebeii: 1, legiones: -1 },
      },
      failureOutcome: {
        axisEffects: { centralization: -1, commerce: -1 },
        factionPowerEffects: { nautae: -1, pontifices: -1, milites: -1 },
      },
    },
  },
  // --- Grain Dole follow-ups ---
  {
    key: 'grain_fleet',
    title: 'The Grain Fleet',
    type: 'endeavour',
    category: 'economic',
    illustration: 'grain_ships_at_ostia',
    flavor:
      "The Senate's promise of subsidized grain means nothing without the ships to carry it. Egypt's harvests rot on the docks of Alexandria while Rome's poor riot for bread. Organizing a fleet of this scale — buying hulls, hiring crews, negotiating with Egyptian officials — requires an unprecedented civilian mobilization. Every faction wants a piece of the contract.",
    endeavourConfig: {
      difficultyPercent: 0.55,
      firstPlaceReward: 3,
      successOutcome: {
        axisEffects: { expansion: 1 },
        factionPowerEffects: { agricolae: 1, nautae: 1, fabri: -1 },
      },
      failureOutcome: {
        axisEffects: { centralization: -1, militarism: -1 },
        factionPowerEffects: { plebeii: -1, mercatores: -1, milites: -1 },
      },
    },
  },
  {
    key: 'stockpile_scandal',
    title: 'The Stockpile Scandal',
    type: 'vote',
    category: 'economic',
    illustration: 'empty_granary',
    flavor:
      "The emergency grain reserves that were supposed to protect Rome through winter are nearly empty. An audit reveals the stockpiles were sold on the black market — the paperwork shows quantities that don't exist. Senators, merchants, and military quartermasters all point fingers at each other. Someone must be held accountable, but the method of justice will reshape who controls Rome's food supply.",
    resolutions: [
      {
        key: 'public_investigation',
        title: 'Public Investigation',
        description: 'Appoint tribunes to investigate openly. Let the people see who profited from their hunger.',
        axisEffects: { centralization: -1 },
        factionPowerEffects: { plebeii: 1, optimates: -1, mercatores: -1 },
      },
      {
        key: 'military_seizure',
        title: 'Military Seizure',
        description: 'Send soldiers to seize remaining stockpiles and arrest the quartermasters responsible.',
        axisEffects: { militarism: -1 },
        factionPowerEffects: { legiones: -1, agricolae: 1, fabri: -1 },
      },
      {
        key: 'emergency_purchase',
        title: 'Emergency Purchase',
        description: 'Buy replacement grain at whatever cost. The people cannot wait for justice.',
        axisEffects: { commerce: -1 },
        factionPowerEffects: { mercatores: 1, plebeii: -1, agricolae: -1 },
      },
    ],
  },
  {
    key: 'bread_war',
    title: 'The Bread War',
    type: 'clash',
    category: 'economic',
    illustration: 'market_riot',
    flavor:
      "Merchant cartels have cornered the grain market, hoarding supply to drive prices beyond what ordinary Romans can pay. When a baker is beaten to death for refusing to raise prices, the urban poor organize into armed bands. They march on the granaries, demanding the Senate enforce fair prices or they will do it themselves. The merchants hire thugs of their own. Blood runs in the Forum.",
    clashConfig: {
      thresholdPercent: 0.55,
      factionAmplifiers: { plebeii: 2, agricolae: 2 },
      successOutcome: {
        axisEffects: { centralization: -1 },
        factionPowerEffects: { agricolae: 1, plebeii: 1, mercatores: -1 },
        victoryPoints: 2,
      },
      failureOutcome: {
        axisEffects: { militarism: -1 },
        factionPowerEffects: { mercatores: 1, fabri: -1, plebeii: -1 },
      },
      personalEffects: {
        commitSuccess: { affinityBonus: 1 },
        commitFailure: { influenceLoss: 8, affinityPenalty: -2 },
        withdrawSuccess: { affinityPenalty: -1, globalAffinityPenalty: -1 },
      },
    },
  },
  // --- Tax Contracts follow-ups ---
  {
    key: 'provincial_audit',
    title: 'The Provincial Audit',
    type: 'schism',
    category: 'economic',
    illustration: 'auditors_in_province',
    flavor:
      "Rome's new state tax collectors have uncovered an uncomfortable truth: the provinces are far wealthier than anyone in the Senate realized. Entire estates, mines, and harbors went untaxed for decades under the old system. The audit team faces a choice — report every denarius and watch provincial elites revolt, or negotiate quiet settlements that keep the peace but leave fortunes hidden. Both paths reshape who holds power in Rome's expanding world.",
    schismConfig: {
      sides: [
        {
          key: 'full_disclosure',
          title: 'Full Disclosure',
          description: 'Report every denarius. Rome deserves to know the true wealth of her provinces.',
          axisEffects: { commerce: 1 },
          factionPowerEffects: { provinciales: -1, pontifices: -1, mercatores: 1 },
          supportVP: 2,
          betrayVP: 1,
          allBetrayVP: 0.5,
        },
        {
          key: 'quiet_settlement',
          title: 'Quiet Settlement',
          description: 'Negotiate privately. Provincial goodwill is worth more than a few extra talents of silver.',
          axisEffects: { expansion: 1 },
          factionPowerEffects: { mercatores: -2, provinciales: 1, pontifices: -1 },
          supportVP: 2,
          betrayVP: 1,
          allBetrayVP: 0.5,
        },
      ],
    },
  },
  {
    key: 'oversight_tribunal',
    title: 'The Oversight Tribunal',
    type: 'vote',
    category: 'economic',
    illustration: 'tribunal_chamber',
    flavor:
      "The new regulatory boards meant to oversee the publicani need judges — but who watches the watchmen? Senators want their own kind in charge, provincial delegates demand representation, and the priesthood argues that sacred law should govern disputes over wealth taken from temple lands. The composition of these tribunals will determine whether regulation means accountability or merely a new form of patronage.",
    resolutions: [
      {
        key: 'senatorial_panel',
        title: 'Senatorial Panel',
        description: 'Staff the boards with senators. Only Rome\'s best can judge Rome\'s interests.',
        axisEffects: { expansion: -1, commerce: 1 },
        factionPowerEffects: { pontifices: 1, provinciales: -1, optimates: 1 },
      },
      {
        key: 'provincial_delegates',
        title: 'Provincial Delegates',
        description: 'Give the provinces a seat at the table. They bear the burden — they deserve a voice.',
        axisEffects: { expansion: 1 },
        factionPowerEffects: { provinciales: 1, mercatores: -1, pontifices: -1 },
      },
      {
        key: 'temple_arbitration',
        title: 'Temple Arbitration',
        description: 'Sacred law transcends politics. Let the priests adjudicate disputes over wealth and fairness.',
        axisEffects: { commerce: -1 },
        factionPowerEffects: { pontifices: 1, mercatores: -1, provinciales: -1 },
      },
    ],
  },
  {
    key: 'tax_census',
    title: 'The Tax Census',
    type: 'endeavour',
    category: 'economic',
    illustration: 'census_expedition',
    flavor:
      "Without regulation, Rome does not even know what the provinces are worth. Grain fields, silver mines, timber forests, fishing fleets — all taxed by guesswork and bribery. A massive census expedition is proposed: surveyors, scribes, and engineers fanning out across every province to catalog Rome's true wealth. The publicani will fight it, the provinces will hide what they can, and the whole enterprise may collapse under its own ambition. But if it succeeds, Rome will finally understand what she rules.",
    endeavourConfig: {
      difficultyPercent: 0.55,
      firstPlaceReward: 3,
      successOutcome: {
        axisEffects: { expansion: 1, commerce: 1 },
        factionPowerEffects: { provinciales: -1, pontifices: -1, fabri: 1 },
      },
      failureOutcome: {
        axisEffects: { expansion: -1, commerce: -1 },
        factionPowerEffects: { mercatores: 1, provinciales: 1, pontifices: 1 },
      },
    },
  },
  // --- Agrarian Question follow-ups ---
  {
    key: 'veteran_colonies',
    title: 'The Veteran Colonies',
    type: 'vote',
    category: 'social',
    illustration: 'veteran_settlement',
    flavor:
      "The land has been redistributed — on paper. But thousands of military veterans now demand their promised plots, and there is not enough good land to go around. Coastal estates, frontier wilderness, or cramped urban lots — each option creates winners and losers. The veterans who fought for Rome's glory now threaten to tear it apart over where they'll plant their olive trees.",
    resolutions: [
      {
        key: 'coastal_settlements',
        title: 'Coastal Settlements',
        description: 'Settle veterans along the coast, reviving ancestral farming and fishing communities.',
        axisEffects: { tradition: 1, patrician: -1 },
        factionPowerEffects: { nautae: -1, agricolae: 1, servi: -1 },
      },
      {
        key: 'frontier_garrisons',
        title: 'Frontier Garrisons',
        description: 'Plant military colonies on the borders. Farmers by day, soldiers by need.',
        axisEffects: { militarism: 1 },
        factionPowerEffects: { agricolae: 1, servi: -1, nautae: -1 },
      },
      {
        key: 'urban_integration',
        title: 'Urban Integration',
        description: 'Settle veterans in the cities with trade apprenticeships. Rome needs craftsmen, not more farmers.',
        axisEffects: { tradition: -1, militarism: -1 },
        factionPowerEffects: { servi: 1, nautae: 1, agricolae: -1 },
      },
    ],
  },
  {
    key: 'land_surveyors',
    title: 'The Land Surveyors',
    type: 'clash',
    category: 'social',
    illustration: 'surveyor_ambush',
    flavor:
      "Implementing the new ownership caps requires surveying every estate in Italy — measuring boundaries, verifying titles, cataloguing holdings that powerful families have claimed for generations. The surveyors set out with their groma instruments and wax tablets, only to find roads blocked, boundary stones mysteriously moved, and hired thugs waiting at estate gates. The landowners will not surrender their excess quietly.",
    clashConfig: {
      thresholdPercent: 0.55,
      factionAmplifiers: { agricolae: 2, servi: 2 },
      successOutcome: {
        axisEffects: { militarism: 1 },
        factionPowerEffects: { agricolae: 1, servi: -1, nautae: 1 },
        victoryPoints: 2.5,
      },
      failureOutcome: {
        axisEffects: { tradition: 1 },
        factionPowerEffects: { agricolae: -1, servi: 1, nautae: -1 },
      },
      personalEffects: {
        commitSuccess: { affinityBonus: 1 },
        commitFailure: { influenceLoss: 8, affinityPenalty: -2 },
        withdrawSuccess: { affinityPenalty: -1, globalAffinityPenalty: -1 },
      },
    },
  },
  {
    key: 'tenant_revolt',
    title: 'The Tenant Revolt',
    type: 'schism',
    category: 'social',
    illustration: 'tenant_barricade',
    flavor:
      "With property rights firmly protected, the great estates grow ever larger — and their tenant farmers grow ever more desperate. Rents rise, evictions multiply, and finally the tenants organize. They barricade granaries, refuse to harvest, and demand the Senate hear their grievances. The landowners call for troops. The Senate Leader's team is caught between justice and order, and not everyone on the team agrees which matters more.",
    schismConfig: {
      sides: [
        {
          key: 'support_tenants',
          title: 'Support Tenants',
          description: 'Stand with the farmers. Their cause is just, even if their methods are desperate.',
          axisEffects: { patrician: -1, militarism: -1 },
          factionPowerEffects: { agricolae: 1, servi: 1, nautae: -1 },
          supportVP: 2.3,
          betrayVP: 1.2,
          allBetrayVP: 0.5,
          betrayedVP: -0.5,
        },
        {
          key: 'support_landowners',
          title: 'Support Landowners',
          description: 'Property rights are the foundation of the Republic. Without order, there is nothing.',
          axisEffects: { tradition: 1, patrician: 1 },
          factionPowerEffects: { servi: -1, nautae: 1, agricolae: -1 },
          supportVP: 2.3,
          betrayVP: 1.2,
          allBetrayVP: 0.5,
          betrayedVP: -0.5,
        },
      ],
    },
  },
  // --- Gallic Incursion follow-ups ---
  {
    key: 'alpine_campaign',
    title: 'The Alpine Campaign',
    type: 'clash',
    category: 'military',
    illustration: 'alpine_campaign',
    flavor:
      "The punitive expedition has been authorized, but the Alps are no place for a casual march. Snow-choked passes, hostile terrain, and Gallic warriors who know every ridge and ravine await the legions. Success means crushing the raiders in their own homeland. Failure means a frozen disaster that will echo through the Senate for a generation.",
    clashConfig: {
      thresholdPercent: 0.65,
      factionAmplifiers: { milites: 2, legiones: 2 },
      successOutcome: {
        axisEffects: { expansion: 1 },
        factionPowerEffects: { milites: 1, legiones: -1, fabri: -1 },
        victoryPoints: 2.5,
      },
      failureOutcome: {
        axisEffects: { tradition: 1 },
        factionPowerEffects: { agricolae: 1, milites: -1, provinciales: -1 },
      },
      personalEffects: {
        commitSuccess: { affinityBonus: 1 },
        commitFailure: { influenceLoss: 10, affinityPenalty: -2 },
        withdrawSuccess: { affinityPenalty: -1, globalAffinityPenalty: -1 },
      },
    },
  },
  {
    key: 'garrison_mutiny',
    title: 'The Garrison Mutiny',
    type: 'schism',
    category: 'military',
    illustration: 'garrison_mutiny',
    flavor:
      "The northern fortifications are built, but the garrisons are restless. Months of cold, bad food, and no glory have taken their toll. Half the officers want to consolidate into fewer, stronger forts. The other half insist every watchtower must be held or the entire line is worthless. The Senate Leader's team is split — and the Gauls are watching.",
    schismConfig: {
      sides: [
        {
          key: 'consolidate_forts',
          title: 'Consolidate Forts',
          description: 'Pull back to fewer, stronger positions. The overextended line is bleeding us dry.',
          axisEffects: { commerce: 1 },
          factionPowerEffects: { fabri: 1, milites: -1, mercatores: -1 },
          supportVP: 2,
          betrayVP: 1,
          allBetrayVP: 0.5,
        },
        {
          key: 'hold_every_fort',
          title: 'Hold Every Fort',
          description: 'Abandoning any position invites attack. Hold the line, no matter the cost.',
          axisEffects: { militarism: 1 },
          factionPowerEffects: { legiones: 1, servi: -1, fabri: -1 },
          supportVP: 2,
          betrayVP: 1,
          allBetrayVP: 0.5,
        },
      ],
    },
  },
  {
    key: 'settled_tribes',
    title: 'The Settled Tribes',
    type: 'vote',
    category: 'social',
    illustration: 'settled_tribes',
    flavor:
      "The Gallic settlers have been on Roman land for a season now. Some are learning Latin and trading at local markets. Others keep to themselves, armed and sullen. The Senate must decide the terms of their permanent status — and every answer creates new problems.",
    resolutions: [
      {
        key: 'full_integration',
        title: 'Full Integration',
        description: 'Grant them citizenship and distribute them among existing communities. Make them Roman.',
        axisEffects: { patrician: -1 },
        factionPowerEffects: { provinciales: 1, nautae: -1, milites: -1 },
      },
      {
        key: 'labor_conscription',
        title: 'Labor Conscription',
        description: 'Put them to work on roads, aqueducts, and mines. They owe Rome for the land they stand on.',
        axisEffects: { expansion: -1 },
        factionPowerEffects: { agricolae: -1, servi: 1, fabri: -1 },
      },
      {
        key: 'buffer_settlements',
        title: 'Buffer Settlements',
        description: 'Settle them along the frontier as a living shield. Let barbarians fight barbarians.',
        axisEffects: { tradition: -1 },
        factionPowerEffects: { agricolae: -1, nautae: 1, plebeii: -1 },
      },
    ],
  },
  // --- Slave Uprising follow-ups ---
  {
    key: 'plantation_siege',
    title: 'The Plantation Siege',
    type: 'clash',
    category: 'social',
    illustration: 'plantation_siege',
    flavor:
      "The rebel slaves have fortified themselves inside the great southern plantations — the very estates that worked them half to death. They've turned farming tools into weapons and granaries into strongholds. The legions are assembling, but every senator knows: storming a fortified position costs blood, and these rebels have nothing left to lose.",
    clashConfig: {
      thresholdPercent: 0.60,
      factionAmplifiers: { milites: 2, legiones: 2 },
      successOutcome: {
        axisEffects: { militarism: 1 },
        factionPowerEffects: { servi: -1, milites: 1, legiones: -1 },
        victoryPoints: 2.5,
      },
      failureOutcome: {
        axisEffects: { tradition: -1 },
        factionPowerEffects: { servi: 1, fabri: -1, legiones: -1 },
      },
      personalEffects: {
        commitSuccess: { affinityBonus: 1 },
        commitFailure: { influenceLoss: 10, affinityPenalty: -2 },
        withdrawSuccess: { affinityPenalty: -1, globalAffinityPenalty: -1 },
      },
    },
  },
  {
    key: 'manumission_registry',
    title: 'The Manumission Registry',
    type: 'endeavour',
    category: 'social',
    illustration: 'manumission_registry',
    flavor:
      "The conditional reforms have been decreed, but someone must actually build the bureaucracy of freedom. Every manumission needs witnesses, records, and legal standing. The old slave markets resist. The freedmen's associations demand speed. And the treasury wonders who is paying for all these clerks.",
    endeavourConfig: {
      difficultyPercent: 0.50,
      firstPlaceReward: 2.5,
      successOutcome: {
        axisEffects: { commerce: 1 },
        factionPowerEffects: { servi: 1, fabri: 1, mercatores: -1 },
      },
      failureOutcome: {
        axisEffects: { expansion: -1 },
        factionPowerEffects: { servi: -1, agricolae: -1, provinciales: -1 },
      },
    },
  },
  {
    key: 'freedman_question',
    title: 'The Freedman Question',
    type: 'vote',
    category: 'political',
    illustration: 'freedman_question',
    flavor:
      "The surrendered rebels have laid down their arms as promised. Now comes the harder question: what are they? Free men without rights? Citizens without property? The Senate must define the status of thousands of former slaves — and every definition has consequences for the Republic's social order.",
    resolutions: [
      {
        key: 'full_citizenship',
        title: 'Full Citizenship',
        description: 'They fought, they surrendered, they earned it. Grant full civic rights to all freedmen.',
        axisEffects: { patrician: -1 },
        factionPowerEffects: { servi: 1, milites: -1, optimates: -1 },
      },
      {
        key: 'limited_rights',
        title: 'Limited Rights',
        description: 'Freedom, yes. Voting and office? Not yet. Let them prove themselves over a generation.',
        axisEffects: { tradition: 1, patrician: 1 },
        factionPowerEffects: { agricolae: -1, servi: -1, fabri: -1 },
      },
      {
        key: 'labor_colonies',
        title: 'Labor Colonies',
        description: 'Settle them in distant colonies where their labor serves the Republic. Freedom with a purpose.',
        axisEffects: { commerce: -1 },
        factionPowerEffects: { milites: -1, servi: -1, nautae: -1 },
      },
    ],
  },
  // --- Foreign Cults follow-ups ---
  {
    key: 'temple_purge',
    title: 'The Temple Purge',
    type: 'schism',
    category: 'religious',
    illustration: 'temple_purge',
    flavor:
      "The ban on foreign cults has been decreed, but enforcement is another matter. Hundreds of shrines, temples, and sacred groves must be dealt with — and they are not empty. The Senate Leader's team must decide: seize the considerable wealth these temples have accumulated, or simply seal them and let the gods sort it out. Not everyone on the team agrees.",
    schismConfig: {
      sides: [
        {
          key: 'confiscate_wealth',
          title: 'Confiscate Wealth',
          description: 'The treasury needs every denarius. Strip the temples bare.',
          axisEffects: { commerce: -1 },
          factionPowerEffects: { pontifices: -1, milites: 1, fabri: -1 },
          supportVP: 2,
          betrayVP: 1,
          allBetrayVP: 0.5,
        },
        {
          key: 'seal_and_forget',
          title: 'Seal and Forget',
          description: 'Board them up. The gods — any gods — are not to be robbed. Let the shrines rot in peace.',
          axisEffects: { tradition: 1 },
          factionPowerEffects: { agricolae: 1, plebeii: -1, milites: -1 },
          supportVP: 2,
          betrayVP: 1,
          allBetrayVP: 0.5,
        },
      ],
    },
  },
  {
    key: 'licensing_board',
    title: 'The Licensing Board',
    type: 'endeavour',
    category: 'religious',
    illustration: 'licensing_board',
    flavor:
      "Regulated tolerance sounds reasonable in a Senate speech. In practice, it means creating a bureaucracy to decide which gods are acceptable and which are not. The priests want veto power. The merchants want their eastern business contacts left alone. And the foreign communities want to know: who licenses the licensers?",
    endeavourConfig: {
      difficultyPercent: 0.60,
      firstPlaceReward: 3.5,
      successOutcome: {
        axisEffects: { tradition: -1 },
        factionPowerEffects: { fabri: 1, servi: -1, provinciales: -1 },
      },
      failureOutcome: {
        axisEffects: { patrician: 1 },
        factionPowerEffects: { agricolae: -1, pontifices: -1, plebeii: 1 },
      },
    },
  },
  {
    key: 'sacred_calendar',
    title: 'The Sacred Calendar',
    type: 'vote',
    category: 'religious',
    illustration: 'sacred_calendar',
    flavor:
      "Open syncretism has been embraced in principle, but the calendar is finite. Every new festival means a day when courts close, markets shut, and soldiers feast instead of drill. The priests are drowning in scheduling conflicts. The practical question of which gods get which days has become the most contentious debate in Rome.",
    resolutions: [
      {
        key: 'merge_calendars',
        title: 'Merge Calendars',
        description: 'Combine Roman and foreign festivals where the gods overlap. Isis-Ceres, Mithras-Sol — close enough.',
        axisEffects: { expansion: 1 },
        factionPowerEffects: { provinciales: 1, servi: -1, pontifices: -1 },
      },
      {
        key: 'separate_calendars',
        title: 'Separate Calendars',
        description: 'Let each community keep its own calendar. Rome need not impose a single sacred rhythm.',
        axisEffects: { militarism: -1 },
        factionPowerEffects: { milites: -1, fabri: -1, nautae: 1 },
      },
      {
        key: 'adopt_select_festivals',
        title: 'Adopt Select Festivals',
        description: 'Cherry-pick the most popular foreign holidays. The people want Saturnalia twice, not a theological debate.',
        axisEffects: { tradition: -1 },
        factionPowerEffects: { agricolae: -1, provinciales: -1, servi: 1 },
      },
    ],
  },
  // --- Governor's Excesses follow-ups ---
  {
    key: 'governors_trial',
    title: "The Governor's Trial",
    type: 'schism',
    category: 'political',
    illustration: 'governors_trial',
    flavor:
      "The governor has been dragged before a tribunal, but the Senate Leader's team cannot agree on the sentence. His crimes are clear — but so is his military record. Half the team wants to make an example that will terrify every future governor. The other half argues that public reparations to the province will do more good than a Roman spectacle of punishment.",
    schismConfig: {
      sides: [
        {
          key: 'harsh_sentence',
          title: 'Harsh Sentence',
          description: 'Exile, confiscation, and public disgrace. Let every governor know the price of corruption.',
          axisEffects: { expansion: -1 },
          factionPowerEffects: { legiones: -1, provinciales: -1, milites: 1 },
          supportVP: 2,
          betrayVP: 1,
          allBetrayVP: 0.5,
        },
        {
          key: 'public_reparations',
          title: 'Public Reparations',
          description: 'Force him to fund the rebuilding of what he destroyed. Let the province heal, not just Rome.',
          axisEffects: { commerce: 1 },
          factionPowerEffects: { mercatores: -1, agricolae: 1, provinciales: -1 },
          supportVP: 2,
          betrayVP: 1,
          allBetrayVP: 0.5,
        },
      ],
    },
  },
  {
    key: 'provincial_reform',
    title: 'The Provincial Reform',
    type: 'endeavour',
    category: 'political',
    illustration: 'provincial_reform',
    flavor:
      "The Senate has decided to handle the governor's case internally — but now demands structural reform to prevent a repeat. Someone must draft new oversight rules, create provincial inspectorates, and convince the provinces that Rome is serious this time. The optimates resist any limit on senatorial prerogative. The provinces have heard promises before.",
    endeavourConfig: {
      difficultyPercent: 0.55,
      firstPlaceReward: 3,
      successOutcome: {
        axisEffects: { tradition: -1 },
        factionPowerEffects: { fabri: -1, provinciales: 1, milites: -1 },
      },
      failureOutcome: {
        axisEffects: { patrician: 1 },
        factionPowerEffects: { servi: -1, nautae: -1, plebeii: -1 },
      },
    },
  },
  {
    key: 'returning_legions',
    title: 'The Returning Legions',
    type: 'clash',
    category: 'political',
    illustration: 'returning_legions',
    flavor:
      "The pardoned governor has been sent home, but his legions are another matter. Twenty thousand veterans march toward Rome, loyal to their commander and expecting rewards. The Senate must either satisfy them or face them. Disbanding an army that doesn't want to disband requires commitment from every faction — and nerve.",
    clashConfig: {
      thresholdPercent: 0.60,
      factionAmplifiers: { legiones: 2, milites: 2 },
      successOutcome: {
        axisEffects: { patrician: -1 },
        factionPowerEffects: { legiones: -1, milites: -1, provinciales: -1 },
        victoryPoints: 2.5,
      },
      failureOutcome: {
        axisEffects: { commerce: -1 },
        factionPowerEffects: { agricolae: -1, legiones: -1, plebeii: 1 },
      },
      personalEffects: {
        commitSuccess: { affinityBonus: 1 },
        commitFailure: { influenceLoss: 10, affinityPenalty: -2 },
        withdrawSuccess: { affinityPenalty: -2, globalAffinityPenalty: -1 },
      },
    },
  },
  // --- Pontificate Election follow-ups ---
  {
    key: 'sacred_games',
    title: 'The Sacred Games',
    type: 'clash',
    category: 'religious',
    illustration: 'sacred_games',
    flavor:
      "The people's pontifex has been elected — and he intends to prove the gods favor the common man. He has proclaimed the most lavish sacred games in a generation: chariot races, athletic contests, theatrical performances, and animal hunts. But sacred games on this scale require every faction to contribute resources, athletes, and funds. If Rome commits fully, the games will be magnificent — a sign of divine approval. If support falters, the new pontifex will be humiliated and the gods, perhaps, offended.",
    clashConfig: {
      thresholdPercent: 0.60,
      factionAmplifiers: { pontifices: 2, legiones: 2 },
      successOutcome: {
        axisEffects: { militarism: 1 },
        factionPowerEffects: { pontifices: 1, legiones: 1, fabri: -1 },
        victoryPoints: 2.5,
      },
      failureOutcome: {
        axisEffects: { centralization: -1 },
        factionPowerEffects: { pontifices: -1, legiones: -1, plebeii: 1 },
      },
      personalEffects: {
        commitSuccess: { affinityBonus: 1 },
        commitFailure: { influenceLoss: 10, affinityPenalty: -2 },
        withdrawSuccess: { affinityPenalty: -1, globalAffinityPenalty: -1 },
      },
    },
  },
  {
    key: 'temple_restoration',
    title: 'The Temple Restoration',
    type: 'endeavour',
    category: 'religious',
    illustration: 'temple_restoration',
    flavor:
      "The new pontifex, chosen for merit rather than birth, has surveyed Rome's temples and found half of them crumbling. He proposes a vast restoration program — not just repairs, but a statement that the Republic still honors its gods. The project requires architects, laborers, and enormous quantities of marble. If it succeeds, the restored temples will stand for centuries. If it fails, Rome will have half-finished scaffolding and a pontifex who promised more than he could deliver.",
    endeavourConfig: {
      difficultyPercent: 0.55,
      firstPlaceReward: 3,
      successOutcome: {
        axisEffects: { centralization: 1 },
        factionPowerEffects: { fabri: 1, pontifices: 1, servi: -1 },
      },
      failureOutcome: {
        axisEffects: { expansion: -1 },
        factionPowerEffects: { fabri: -1, pontifices: -1, legiones: 1 },
      },
    },
  },
  {
    key: 'augurs_authority',
    title: "The Augurs' Authority",
    type: 'schism',
    category: 'religious',
    illustration: 'augurs_authority',
    flavor:
      "The Senate-appointed pontifex has consolidated his position — and now turns to a question that has simmered for decades: who controls the auguries before military campaigns? The generals say the auspices are theirs to take in the field. The priests say the gods speak through proper channels, not sword-wielding amateurs. The Senate Leader's team is split between those who would give the augurs veto power over military action and those who see that as a recipe for paralysis.",
    schismConfig: {
      sides: [
        {
          key: 'military_auguries',
          title: 'Military Auguries',
          description: 'Generals take their own auspices. The gods speak to men of action, not men of ritual.',
          axisEffects: { militarism: 1 },
          factionPowerEffects: { legiones: 1, pontifices: -1, fabri: -1 },
          supportVP: 2,
          betrayVP: 1,
          allBetrayVP: 0.5,
        },
        {
          key: 'civic_authority',
          title: 'Civic Authority',
          description: 'The augurs must approve all major undertakings. The gods will not be rushed or ignored.',
          axisEffects: { centralization: 1 },
          factionPowerEffects: { optimates: 1, pontifices: 1, plebeii: -1 },
          supportVP: 2,
          betrayVP: 1,
          allBetrayVP: 0.5,
        },
      ],
    },
  },
  // --- Carthaginian Menace follow-ups ---
  {
    key: 'hannibals_crossing',
    title: "Hannibal's Crossing",
    type: 'clash',
    category: 'military',
    illustration: 'hannibals_crossing',
    flavor:
      "Rome struck first — but Carthage has answered. A Carthaginian army has crossed the Alps with war elephants and is ravaging the Po Valley. Italian allies waver. The legions sent to intercept have been outmaneuvered twice. This is no border skirmish — it is an existential threat on Roman soil. Every faction must commit everything to stop the advance, or the next battle will be fought within sight of Rome's walls.",
    clashConfig: {
      thresholdPercent: 0.75,
      factionAmplifiers: { legiones: 2, fabri: 2 },
      successOutcome: {
        axisEffects: { expansion: 1 },
        factionPowerEffects: { legiones: 1, fabri: 1, milites: -1 },
        victoryPoints: 3,
      },
      failureOutcome: {
        axisEffects: { militarism: -1, expansion: -1 },
        factionPowerEffects: { legiones: -1, optimates: 1, pontifices: -1 },
      },
      personalEffects: {
        commitSuccess: { affinityBonus: 1 },
        commitFailure: { influenceLoss: 20, affinityPenalty: -3 },
        withdrawSuccess: { affinityPenalty: -2, globalAffinityPenalty: -2 },
      },
    },
  },
  {
    key: 'blockade_lines',
    title: 'The Blockade Lines',
    type: 'endeavour',
    category: 'military',
    illustration: 'blockade_lines',
    flavor:
      "Economic pressure requires infrastructure — and Rome's is lacking. The Senate has authorized a chain of fortified watchtowers along the African coast, supply depots on Sicily, and patrol fleets to intercept Carthaginian shipping. It is the largest engineering project outside Italy in Roman history. The craftsmen and legionaries must work together in hostile territory, racing to complete the network before Carthage finds a way around it.",
    endeavourConfig: {
      difficultyPercent: 0.60,
      firstPlaceReward: 3,
      successOutcome: {
        axisEffects: { expansion: 1 },
        factionPowerEffects: { fabri: 1, legiones: 1, servi: -1 },
      },
      failureOutcome: {
        axisEffects: { centralization: -1 },
        factionPowerEffects: { fabri: -1, legiones: -1, optimates: 1 },
      },
    },
  },
  {
    key: 'peace_of_carthage',
    title: 'The Peace of Carthage',
    type: 'schism',
    category: 'military',
    illustration: 'peace_of_carthage',
    flavor:
      "The diplomatic accord has been signed, but its terms are deliberately vague — and the Senate Leader's team must now decide what Rome actually demands. Half the team wants to impose crushing terms that will prevent Carthage from ever threatening Rome again: disarmament, indemnities, territorial concessions. The other half argues that a humiliated Carthage is a desperate Carthage, and generous terms will make a more reliable neighbor.",
    schismConfig: {
      sides: [
        {
          key: 'harsh_terms',
          title: 'Harsh Terms',
          description: 'Disarm them, tax them, take their colonies. They started this — Rome finishes it.',
          axisEffects: { militarism: 1 },
          factionPowerEffects: { legiones: 1, pontifices: 1, optimates: -1 },
          supportVP: 2,
          betrayVP: 1,
          allBetrayVP: 0.5,
        },
        {
          key: 'generous_peace',
          title: 'Generous Peace',
          description: 'A fair peace lasts longer than a forced one. Leave them their dignity and their walls.',
          axisEffects: { centralization: -1 },
          factionPowerEffects: { pontifices: 1, fabri: 1, legiones: -1 },
          supportVP: 2,
          betrayVP: 1,
          allBetrayVP: 0.5,
        },
      ],
    },
  },
  // --- Egyptian Question follow-ups ---
  {
    key: 'red_sea_expedition',
    title: 'The Red Sea Expedition',
    type: 'clash',
    category: 'military',
    illustration: 'red_sea_expedition',
    flavor:
      "Egypt is Rome's, and with it the Red Sea ports — on paper. In practice, the coastal tribes and desert raiders who have controlled these harbors for centuries see no reason to stop. Every ship bound for India must run a gauntlet of piracy and extortion. The Senate has authorized a military expedition to secure the route, but the Red Sea is not the Mediterranean. The heat kills as surely as the enemy.",
    clashConfig: {
      thresholdPercent: 0.65,
      factionAmplifiers: { nautae: 2, milites: 2 },
      successOutcome: {
        axisEffects: { expansion: 1 },
        factionPowerEffects: { nautae: 1, milites: -1, provinciales: -1 },
        victoryPoints: 2.5,
      },
      failureOutcome: {
        axisEffects: { commerce: -1 },
        factionPowerEffects: { mercatores: -1, nautae: -1, legiones: 1 },
      },
      personalEffects: {
        commitSuccess: { affinityBonus: 1 },
        commitFailure: { influenceLoss: 10, affinityPenalty: -2 },
        withdrawSuccess: { affinityPenalty: -1, globalAffinityPenalty: -1 },
      },
    },
  },
  {
    key: 'monsoon_fleet',
    title: 'The Monsoon Fleet',
    type: 'endeavour',
    category: 'economic',
    illustration: 'monsoon_fleet',
    flavor:
      "The client king's Egyptian sailors know a secret: the winds of the Indian Ocean reverse with the seasons. Catch the monsoon right and a fleet can reach India in weeks. Miss it and you wait six months or die trying. The Senate has authorized the construction of a trade fleet — but the ships must be built, crews trained, and the whole venture launched before the winds turn. Fortunes will be made or drowned.",
    endeavourConfig: {
      difficultyPercent: 0.55,
      firstPlaceReward: 3,
      successOutcome: {
        axisEffects: { commerce: 1 },
        factionPowerEffects: { mercatores: 1, nautae: 1, fabri: -1 },
      },
      failureOutcome: {
        axisEffects: { expansion: -1 },
        factionPowerEffects: { nautae: -1, servi: -1, agricolae: 1 },
      },
    },
  },
  {
    key: 'merchant_princes',
    title: 'The Merchant Princes',
    type: 'schism',
    category: 'economic',
    illustration: 'merchant_princes',
    flavor:
      "The eastern trade has made certain merchants richer than senators — richer, some whisper, than the treasury itself. They build palaces, fund private fleets, and buy influence openly. The old aristocracy is appalled. The plebs are envious. The Senate Leader's team is divided: tax this obscene wealth before it corrupts the Republic, or let the merchants reinvest and grow the pie for everyone?",
    schismConfig: {
      sides: [
        {
          key: 'tax_the_wealth',
          title: 'Tax the Wealth',
          description: 'No citizen should rival the state. Tax the eastern profits before they buy the Republic.',
          axisEffects: { patrician: -1 },
          factionPowerEffects: { mercatores: -1, plebeii: 1, fabri: 1 },
          supportVP: 2,
          betrayVP: 1,
          allBetrayVP: 0.5,
        },
        {
          key: 'let_them_invest',
          title: 'Let Them Invest',
          description: 'Their wealth flows through the whole economy. Tax them and you tax everyone.',
          axisEffects: { commerce: 1 },
          factionPowerEffects: { mercatores: 1, agricolae: -1, servi: -1 },
          supportVP: 2,
          betrayVP: 1,
          allBetrayVP: 0.5,
        },
      ],
    },
  },

  // ── Pontic Alliance follow-ups ──

  {
    key: 'eastern_garrison',
    title: 'The Eastern Garrison',
    type: 'vote',
    category: 'military',
    illustration: 'eastern_garrison',
    flavor:
      'The alliance is struck, but who commands the joint garrison? Roman officers demand sole authority; Pontic generals insist on shared command. The troops on the ground just want clear orders before the enemy arrives.',
    resolutions: [
      {
        key: 'shared_command',
        title: 'Shared Command',
        description: 'Split command between Roman and Pontic officers. Equality builds trust.',
        axisEffects: { centralization: 1 },
        factionPowerEffects: { milites: 1, agricolae: 1, optimates: -1 },
      },
      {
        key: 'roman_officers_only',
        title: 'Roman Officers Only',
        description: 'Roman legions answer to Roman commanders. There is no negotiation on this point.',
        axisEffects: { patrician: 1 },
        factionPowerEffects: { servi: 1, fabri: 1, nautae: -1 },
      },
      {
        key: 'seasonal_rotation',
        title: 'Seasonal Rotation',
        description: 'Alternate command each season. Neither side dominates, neither side trusts fully.',
        axisEffects: { militarism: -1 },
        factionPowerEffects: { agricolae: 1, pontifices: 1, plebeii: -1 },
      },
    ],
  },
  {
    key: 'pontic_defiance',
    title: 'The Pontic Defiance',
    type: 'clash',
    category: 'military',
    illustration: 'pontic_defiance',
    flavor:
      "Rome demanded submission and the King of Pontus responded with defiance — massing troops on the border and sending envoys to Rome's enemies. The legions must march east, but the campaign will stretch supply lines to breaking point.",
    clashConfig: {
      thresholdPercent: 0.60,
      factionAmplifiers: { milites: 1.5, legiones: 1.5 },
      successOutcome: {
        axisEffects: { expansion: 1 },
        factionPowerEffects: { milites: 1, mercatores: -1, nautae: -1 },
        victoryPoints: 2.5,
      },
      failureOutcome: {
        axisEffects: { centralization: -1 },
        factionPowerEffects: { servi: 1, optimates: 1, fabri: -1 },
      },
      personalEffects: {
        commitSuccess: { affinityBonus: 1 },
        commitFailure: { influenceLoss: 10, affinityPenalty: -2 },
        withdrawSuccess: { affinityPenalty: -1, globalAffinityPenalty: -1 },
      },
    },
  },
  {
    key: 'eastern_outposts',
    title: 'The Eastern Outposts',
    type: 'endeavour',
    category: 'military',
    illustration: 'eastern_outposts',
    flavor:
      'With the alliance rejected, Rome must secure its eastern frontier alone. A chain of fortified trading posts could anchor Roman presence — but building them in hostile territory will cost dearly in gold and lives.',
    endeavourConfig: {
      difficultyPercent: 0.55,
      firstPlaceReward: 3,
      successOutcome: {
        axisEffects: { commerce: -1 },
        factionPowerEffects: { agricolae: 1, mercatores: 1, provinciales: -1 },
      },
      failureOutcome: {
        axisEffects: { tradition: 1 },
        factionPowerEffects: { plebeii: -1, provinciales: 1, pontifices: -1 },
      },
    },
  },

  // ── Debt Crisis follow-ups ──

  {
    key: 'creditors_revolt',
    title: "The Creditors' Revolt",
    type: 'vote',
    category: 'social',
    illustration: 'creditors_revolt',
    flavor:
      'The debt cancellation has thrown the credit markets into chaos. Lenders refuse to extend new loans, wealthy families hide assets abroad, and the banking houses of the Forum threaten to close their doors permanently. Someone must pay the price of mercy.',
    resolutions: [
      {
        key: 'seize_assets',
        title: 'Seize Assets',
        description: 'Confiscate hidden wealth and redistribute it. The creditors had their chance.',
        axisEffects: { centralization: 1 },
        factionPowerEffects: { servi: 1, optimates: -1, plebeii: -1 },
      },
      {
        key: 'partial_compensation',
        title: 'Partial Compensation',
        description: 'Offer state bonds to creditors for a portion of their losses. Expensive, but stabilizing.',
        axisEffects: { commerce: -1 },
        factionPowerEffects: { milites: 1, optimates: 1, mercatores: -1 },
      },
      {
        key: 'public_arbitration',
        title: 'Public Arbitration',
        description: 'Establish courts where creditors and debtors negotiate case by case. Slow but fair.',
        axisEffects: { patrician: 1 },
        factionPowerEffects: { servi: 1, fabri: -1, mercatores: 1 },
      },
    ],
  },
  {
    key: 'debt_courts',
    title: 'The Debt Courts',
    type: 'endeavour',
    category: 'social',
    illustration: 'debt_courts',
    flavor:
      'The interest caps have created a patchwork of enforcement. Provincial courts interpret the rules differently, lenders find creative loopholes, and debtors still suffer. A unified debt court system could bring order — if anyone can agree on the rules.',
    endeavourConfig: {
      difficultyPercent: 0.50,
      firstPlaceReward: 2.5,
      successOutcome: {
        axisEffects: { tradition: 1 },
        factionPowerEffects: { servi: 1, pontifices: 1, nautae: -1 },
      },
      failureOutcome: {
        axisEffects: { commerce: 1 },
        factionPowerEffects: { optimates: 1, pontifices: -1, agricolae: -1 },
      },
    },
  },
  {
    key: 'debtors_march',
    title: "The Debtors' March",
    type: 'schism',
    category: 'social',
    illustration: 'debtors_march',
    flavor:
      "Despite the Senate's decision to enforce contracts, thousands of debtors have organized a march on the Forum. They demand relief. The Senate Leader's team must decide: join the march to channel its energy, or stand with the courts and risk being swept aside.",
    schismConfig: {
      sides: [
        {
          key: 'march_on_forum',
          title: 'March on the Forum',
          description: 'Join the debtors. Their cause is just, and their numbers are a political weapon.',
          axisEffects: { tradition: -1 },
          factionPowerEffects: { milites: 1, plebeii: 1, nautae: -1 },
          supportVP: 2,
          betrayVP: 1,
          allBetrayVP: 0.5,
        },
        {
          key: 'respect_the_courts',
          title: 'Respect the Courts',
          description: 'The law must hold. If mobs can override the courts, no contract is safe.',
          axisEffects: { expansion: 1 },
          factionPowerEffects: { agricolae: 1, servi: -1, milites: -1 },
          supportVP: 2,
          betrayVP: 1,
          allBetrayVP: 0.5,
        },
      ],
    },
  },

  // ── Sumptuary Question follow-ups ──

  {
    key: 'fashion_wars',
    title: 'The Fashion Wars',
    type: 'vote',
    category: 'economic',
    illustration: 'fashion_wars',
    flavor:
      'The sumptuary laws have been passed — and immediately become the most broken laws in Rome. Wealthy matrons hide silk under wool cloaks, merchants relabel eastern spices as "medicinal herbs," and the censors cannot tell genuine austerity from elaborate deception. Enforcement has become a farce.',
    resolutions: [
      {
        key: 'enforce_strictly',
        title: 'Enforce Strictly',
        description: 'Hire inspectors, impose fines, make examples. The law means nothing if it is not enforced.',
        axisEffects: { centralization: 1 },
        factionPowerEffects: { servi: 1, mercatores: -1, optimates: -1 },
      },
      {
        key: 'exempt_veterans',
        title: 'Exempt Veterans',
        description: 'Those who served Rome deserve to enjoy its fruits. Exempt military veterans from all restrictions.',
        axisEffects: { militarism: -1 },
        factionPowerEffects: { milites: 1, fabri: 1, nautae: 1 },
      },
      {
        key: 'public_shaming_lists',
        title: 'Public Shaming Lists',
        description: 'Post the names of violators in the Forum. Let social pressure do what law cannot.',
        axisEffects: { tradition: 1 },
        factionPowerEffects: { pontifices: 1, agricolae: 1, plebeii: -1 },
      },
    ],
  },
  {
    key: 'luxury_fleet',
    title: 'The Luxury Fleet',
    type: 'schism',
    category: 'economic',
    illustration: 'luxury_fleet',
    flavor:
      "With no restrictions on luxury, the demand for eastern goods has exploded. Merchant fleets race to supply Rome's appetite, but the imports are draining silver from the treasury. The Senate Leader's team is split: should Rome tax the imports to slow the bleeding, or embrace the open market and let trade flow freely?",
    schismConfig: {
      sides: [
        {
          key: 'tax_imports',
          title: 'Tax Imports',
          description: 'A modest tariff protects Roman craftsmen and fills the treasury. The merchants will adapt.',
          axisEffects: { commerce: -1 },
          factionPowerEffects: { nautae: -1, provinciales: 1, fabri: 1 },
          supportVP: 2,
          betrayVP: 1,
          allBetrayVP: 0.5,
        },
        {
          key: 'open_markets',
          title: 'Open Markets',
          description: 'Tariffs breed corruption and smuggling. Let the market decide what Rome needs.',
          axisEffects: { expansion: 1 },
          factionPowerEffects: { mercatores: 1, provinciales: -1, plebeii: 1 },
          supportVP: 2,
          betrayVP: 1,
          allBetrayVP: 0.5,
        },
      ],
    },
  },
  {
    key: 'smugglers_war',
    title: "The Smugglers' War",
    type: 'clash',
    category: 'economic',
    illustration: 'smugglers_war',
    flavor:
      'The luxury tax has created a thriving black market. Smuggling rings operate openly in the ports, bribing officials and undercutting legitimate merchants. A naval crackdown could restore order — but the smugglers are well-armed, well-connected, and willing to fight.',
    clashConfig: {
      thresholdPercent: 0.60,
      factionAmplifiers: { nautae: 1.5, mercatores: 1.5 },
      successOutcome: {
        axisEffects: { patrician: 1 },
        factionPowerEffects: { milites: 1, servi: 1, pontifices: -1 },
        victoryPoints: 2.5,
      },
      failureOutcome: {
        axisEffects: { expansion: -1 },
        factionPowerEffects: { nautae: 1, agricolae: 1, milites: -1 },
      },
      personalEffects: {
        commitSuccess: { affinityBonus: 1 },
        commitFailure: { influenceLoss: 10, affinityPenalty: -2 },
        withdrawSuccess: { affinityPenalty: -1, globalAffinityPenalty: -1 },
      },
    },
  },

  // ── Tribune's Veto follow-ups ──

  {
    key: 'forum_standoff',
    title: 'The Forum Standoff',
    type: 'clash',
    category: 'political',
    illustration: 'forum_standoff',
    flavor:
      'The restricted tribunes have rallied their supporters for a mass demonstration in the Forum. Armed partisans on both sides turn a political protest into a powder keg. The Senate must either back down or send in the urban cohorts — and risk the first political bloodshed in a generation.',
    clashConfig: {
      thresholdPercent: 0.60,
      factionAmplifiers: { plebeii: 1.5, optimates: 1.5 },
      successOutcome: {
        axisEffects: { centralization: 1 },
        factionPowerEffects: { milites: 1, agricolae: -1, plebeii: -1 },
        victoryPoints: 2.5,
      },
      failureOutcome: {
        axisEffects: { militarism: -1 },
        factionPowerEffects: { servi: -1, nautae: 1, provinciales: 1 },
      },
      personalEffects: {
        commitSuccess: { affinityBonus: 1 },
        commitFailure: { influenceLoss: 10, affinityPenalty: -2 },
        withdrawSuccess: { affinityPenalty: -1, globalAffinityPenalty: -1 },
      },
    },
  },
  {
    key: 'assembly_reform',
    title: 'The Assembly Reform',
    type: 'endeavour',
    category: 'political',
    illustration: 'assembly_reform',
    flavor:
      'The reformed assemblies exist on paper, but implementing them requires new voting procedures, redrawn tribal boundaries, and a massive administrative effort. Traditional interests resist every change while reformers demand faster progress. Building democracy is harder than declaring it.',
    endeavourConfig: {
      difficultyPercent: 0.60,
      firstPlaceReward: 3,
      successOutcome: {
        axisEffects: { patrician: -1 },
        factionPowerEffects: { optimates: 1, pontifices: 1, milites: -1 },
      },
      failureOutcome: {
        axisEffects: { expansion: -1 },
        factionPowerEffects: { servi: -1, fabri: -1, mercatores: 1 },
      },
    },
  },
  {
    key: 'tribunes_coalition',
    title: "The Tribune's Coalition",
    type: 'schism',
    category: 'political',
    illustration: 'tribunes_coalition',
    flavor:
      "The veto stands, and the tribune has become the most powerful man in Rome. Now other tribunes want in on the action. A coalition of tribunes could reshape the Republic — but should they expand their collective power, or hold the line and keep the veto a defensive weapon? The Senate Leader's team is divided.",
    schismConfig: {
      sides: [
        {
          key: 'expand_powers',
          title: 'Expand Powers',
          description: 'A united tribunate can initiate legislation, not just block it. True reform requires offense.',
          axisEffects: { centralization: -1 },
          factionPowerEffects: { agricolae: -1, pontifices: -1, milites: -1 },
          supportVP: 2,
          betrayVP: 1,
          allBetrayVP: 0.5,
        },
        {
          key: 'hold_the_line',
          title: 'Hold the Line',
          description: 'The veto is a shield, not a sword. Expanding power invites the same abuse we fought against.',
          axisEffects: { militarism: 1 },
          factionPowerEffects: { optimates: -1, mercatores: -1, provinciales: -1 },
          supportVP: 2,
          betrayVP: 1,
          allBetrayVP: 0.5,
        },
      ],
    },
  },

  // ── Electoral Corruption follow-ups ──

  {
    key: 'election_inspectors',
    title: 'The Election Inspectors',
    type: 'endeavour',
    category: 'political',
    illustration: 'election_inspectors',
    flavor:
      'The anti-corruption laws exist on paper, but enforcing them requires an independent inspectorate — recruitment, training, jurisdiction. Every powerful family in Rome has reason to see it fail.',
    endeavourConfig: {
      difficultyPercent: 0.55,
      firstPlaceReward: 3,
      successOutcome: {
        axisEffects: { centralization: 1 },
        factionPowerEffects: { provinciales: 1, optimates: -1, agricolae: 1 },
      },
      failureOutcome: {
        axisEffects: { expansion: -1 },
        factionPowerEffects: { nautae: 1, legiones: -1, provinciales: -1 },
      },
    },
  },
  {
    key: 'voting_riots',
    title: 'The Voting Riots',
    type: 'clash',
    category: 'political',
    illustration: 'voting_riots',
    flavor:
      'The redistribution of voting power has provoked violent resistance. The old tribal structures are threatened, and those who profit from them are willing to bleed for it. The Senate must enforce its own law — or watch it die in the streets.',
    clashConfig: {
      thresholdPercent: 0.60,
      factionAmplifiers: { plebeii: 1.5, optimates: 1.5 },
      successOutcome: {
        axisEffects: { expansion: -1 },
        factionPowerEffects: { legiones: -1, nautae: 1, fabri: 1 },
        victoryPoints: 2.5,
      },
      failureOutcome: {
        axisEffects: { centralization: -1 },
        factionPowerEffects: { optimates: 1, provinciales: 1, nautae: -1, legiones: -1 },
      },
      personalEffects: {
        commitSuccess: { affinityBonus: 1 },
        commitFailure: { influenceLoss: 10, affinityPenalty: -2 },
        withdrawSuccess: { affinityPenalty: -1, globalAffinityPenalty: -1 },
      },
    },
  },
  {
    key: 'patronage_networks',
    title: 'The Patronage Networks',
    type: 'schism',
    category: 'political',
    illustration: 'patronage_networks',
    flavor:
      "With corruption accepted as the price of governance, patronage networks have crystallized into a shadow government. The Senate Leader's team is split: entrench them as institutions that can at least be regulated, or drag them into the light and let them wither.",
    schismConfig: {
      sides: [
        {
          key: 'entrench_networks',
          title: 'Entrench the Networks',
          description: 'Patronage is how Rome works. Formalize it, regulate it, and at least make it predictable.',
          axisEffects: { tradition: 1 },
          factionPowerEffects: { agricolae: -1, optimates: -1, provinciales: 1, nautae: 1 },
          supportVP: 2,
          betrayVP: 1,
          allBetrayVP: 0.5,
        },
        {
          key: 'expose_networks',
          title: 'Expose the Networks',
          description: 'Publish the patron lists. Let every citizen see who owns whom. Sunlight is the best disinfectant.',
          axisEffects: { tradition: -1 },
          factionPowerEffects: { legiones: 1, nautae: -1, provinciales: -1 },
          supportVP: 2,
          betrayVP: 1,
          allBetrayVP: 0.5,
        },
      ],
    },
  },

  // ── Censors' Report follow-ups ──

  {
    key: 'moral_courts',
    title: 'The Moral Courts',
    type: 'clash',
    category: 'religious',
    illustration: 'moral_courts',
    flavor:
      "The censors' moral purge has spawned special courts with sweeping powers. Senators face expulsion, merchants face ruin, and the accused are organizing resistance. The question is whether Rome has the stomach to judge itself.",
    clashConfig: {
      thresholdPercent: 0.60,
      factionAmplifiers: { pontifices: 1.5, milites: 1.5 },
      successOutcome: {
        axisEffects: { patrician: 1 },
        factionPowerEffects: { agricolae: 1, nautae: -1, pontifices: 1 },
        victoryPoints: 2.5,
      },
      failureOutcome: {
        axisEffects: { patrician: -1 },
        factionPowerEffects: { provinciales: 1, plebeii: 1, legiones: -1 },
      },
      personalEffects: {
        commitSuccess: { affinityBonus: 1 },
        commitFailure: { influenceLoss: 10, affinityPenalty: -2 },
        withdrawSuccess: { affinityPenalty: -1, globalAffinityPenalty: -1 },
      },
    },
  },
  {
    key: 'cultural_commission',
    title: 'The Cultural Commission',
    type: 'endeavour',
    category: 'religious',
    illustration: 'cultural_commission',
    flavor:
      'A commission tasked with updating Roman moral standards for a cosmopolitan age. They must navigate between preserving Roman identity and embracing what the empire has become — without satisfying anyone completely.',
    endeavourConfig: {
      difficultyPercent: 0.50,
      firstPlaceReward: 2.5,
      successOutcome: {
        axisEffects: { commerce: -1 },
        factionPowerEffects: { legiones: 1, provinciales: -1, servi: 1 },
      },
      failureOutcome: {
        axisEffects: { militarism: 1 },
        factionPowerEffects: { optimates: 1, milites: 1, servi: -1 },
      },
    },
  },
  {
    key: 'censors_revenge',
    title: "The Censors' Revenge",
    type: 'schism',
    category: 'religious',
    illustration: 'censors_revenge',
    flavor:
      "Humiliated by the Senate's dismissal, the censors have leaked their findings to the public. Scandals erupt across Rome. The Senate Leader's team must choose: exploit the chaos for political gain, or rally around the institution they just weakened.",
    schismConfig: {
      sides: [
        {
          key: 'weaponize_leaks',
          title: 'Weaponize the Leaks',
          description: 'Use the scandals to destroy political enemies. The censors handed us a weapon — it would be foolish not to swing it.',
          axisEffects: { militarism: -1 },
          factionPowerEffects: { legiones: -1, nautae: -1, provinciales: 1 },
          supportVP: 2,
          betrayVP: 1,
          allBetrayVP: 0.5,
        },
        {
          key: 'defend_senate',
          title: 'Defend the Senate',
          description: 'The Senate is flawed, but it is ours. Rally around the institution before the mob tears it apart.',
          axisEffects: { tradition: 1 },
          factionPowerEffects: { plebeii: -1, mercatores: -1, pontifices: 1 },
          supportVP: 2,
          betrayVP: 1,
          allBetrayVP: 0.5,
        },
      ],
    },
  },

  // ── Sibylline Oracle follow-ups ──

  {
    key: 'sacred_festival',
    title: 'The Sacred Festival',
    type: 'endeavour',
    category: 'religious',
    illustration: 'sacred_festival',
    flavor:
      "The Sibylline prescription demands the greatest sacred festival in living memory: sacrifices at every gate, games in the Circus, and — most controversially — the importation of a foreign goddess. The logistics are staggering, the expense ruinous, and the priests are fighting over every detail.",
    endeavourConfig: {
      difficultyPercent: 0.55,
      firstPlaceReward: 3,
      successOutcome: {
        axisEffects: { tradition: -1 },
        factionPowerEffects: { legiones: -1, agricolae: -1, nautae: 1 },
      },
      failureOutcome: {
        axisEffects: { centralization: 1 },
        factionPowerEffects: { nautae: -1, provinciales: -1, agricolae: 1 },
      },
    },
  },
  {
    key: 'priestly_schism',
    title: 'The Priestly Schism',
    type: 'schism',
    category: 'religious',
    illustration: 'priestly_schism',
    flavor:
      "The reinterpretation has split the priesthood. Literalists insist the Books mean what they say; reformers see symbols to be decoded. The theological dispute barely conceals a power struggle over who controls Rome's relationship with the divine.",
    schismConfig: {
      sides: [
        {
          key: 'literal_reading',
          title: 'Literal Reading',
          description: 'The Books are sacred text, not poetry. Their words are commands, and commands must be obeyed to the letter.',
          axisEffects: { patrician: -1 },
          factionPowerEffects: { legiones: 1, fabri: 1, pontifices: -1 },
          supportVP: 2,
          betrayVP: 1,
          allBetrayVP: 0.5,
        },
        {
          key: 'symbolic_reform',
          title: 'Symbolic Reform',
          description: 'The gods speak in metaphor. A flexible interpretation serves Rome better than rigid obedience to ancient riddles.',
          axisEffects: { centralization: -1 },
          factionPowerEffects: { milites: -1, servi: 1, optimates: -1 },
          supportVP: 2,
          betrayVP: 1,
          allBetrayVP: 0.5,
        },
      ],
    },
  },
  {
    key: 'oracles_curse',
    title: "The Oracle's Curse",
    type: 'clash',
    category: 'religious',
    illustration: 'oracles_curse',
    flavor:
      'After rejecting the oracle, a cascade of disasters — a bridge collapse, plague in the camps, a freak storm that sinks three grain ships — has terrified the populace. Coincidence, say the rationalists. Divine punishment, say the priests. The mob just wants someone to do something.',
    clashConfig: {
      thresholdPercent: 0.65,
      factionAmplifiers: { pontifices: 1.5, legiones: 1.5 },
      successOutcome: {
        axisEffects: { commerce: 1 },
        factionPowerEffects: { mercatores: 1, provinciales: -1, legiones: -1 },
        victoryPoints: 2.5,
      },
      failureOutcome: {
        axisEffects: { commerce: -1 },
        factionPowerEffects: { servi: -1, fabri: -1, pontifices: -1 },
      },
      personalEffects: {
        commitSuccess: { affinityBonus: 1 },
        commitFailure: { influenceLoss: 10, affinityPenalty: -2 },
        withdrawSuccess: { affinityPenalty: -1, globalAffinityPenalty: -1 },
      },
    },
  },
];

export const ALL_CONTROVERSIES: Controversy[] = [...CONTROVERSIES, ...FOLLOW_UP_CONTROVERSIES];

export const CONTROVERSY_MAP: Record<string, Controversy> = Object.fromEntries(
  ALL_CONTROVERSIES.map((c) => [c.key, c])
);

export const ROOT_CONTROVERSY_KEYS: string[] = CONTROVERSIES.map((c) => c.key);
