// Deno-compatible stub — keep in sync with mobile/lib/game-engine/balance.ts
export interface AxisPreferences {
  centralization: number;
  expansion: number;
  commerce: number;
  patrician: number;
  tradition: number;
  militarism: number;
}

export interface BalancedFaction {
  key: string;
  displayName: string;
  latinName: string;
  description: string;
  power: number;
  preferences: AxisPreferences;
}
