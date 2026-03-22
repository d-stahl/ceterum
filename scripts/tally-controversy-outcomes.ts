#!/usr/bin/env npx tsx
/**
 * Tally all controversy outcome effects (policy axes + faction power)
 * across all defined controversies and their possible outcomes.
 *
 * Usage: npx tsx scripts/tally-controversy-outcomes.ts
 * Run from app/ directory.
 */

import { ALL_CONTROVERSIES, Controversy } from '../mobile/lib/game-engine/controversies';
import { AXIS_KEYS, AXIS_LABELS, AxisKey } from '../mobile/lib/game-engine/axes';
import { FACTIONS } from '../mobile/lib/game-engine/factions';

// ─── Collect all outcomes ───────────────────────────────────────────────────

interface Outcome {
  controversyKey: string;
  label: string; // e.g. "pirate_menace / Blockade (vote resolution)"
  axisEffects: Partial<Record<AxisKey, number>>;
  factionPowerEffects: Partial<Record<string, number>>;
}

const outcomes: Outcome[] = [];

for (const c of ALL_CONTROVERSIES) {
  switch (c.type) {
    case 'vote':
      for (const r of c.resolutions) {
        outcomes.push({
          controversyKey: c.key,
          label: `${c.key} / ${r.title} (vote)`,
          axisEffects: r.axisEffects,
          factionPowerEffects: r.factionPowerEffects,
        });
      }
      break;

    case 'clash':
      outcomes.push({
        controversyKey: c.key,
        label: `${c.key} / success (clash)`,
        axisEffects: c.clashConfig.successOutcome.axisEffects,
        factionPowerEffects: c.clashConfig.successOutcome.factionPowerEffects,
      });
      outcomes.push({
        controversyKey: c.key,
        label: `${c.key} / failure (clash)`,
        axisEffects: c.clashConfig.failureOutcome.axisEffects,
        factionPowerEffects: c.clashConfig.failureOutcome.factionPowerEffects,
      });
      break;

    case 'endeavour':
      outcomes.push({
        controversyKey: c.key,
        label: `${c.key} / success (endeavour)`,
        axisEffects: c.endeavourConfig.successOutcome.axisEffects,
        factionPowerEffects: c.endeavourConfig.successOutcome.factionPowerEffects,
      });
      outcomes.push({
        controversyKey: c.key,
        label: `${c.key} / failure (endeavour)`,
        axisEffects: c.endeavourConfig.failureOutcome.axisEffects,
        factionPowerEffects: c.endeavourConfig.failureOutcome.factionPowerEffects,
      });
      break;

    case 'schism':
      for (const side of c.schismConfig.sides) {
        outcomes.push({
          controversyKey: c.key,
          label: `${c.key} / ${side.title} (schism)`,
          axisEffects: side.axisEffects,
          factionPowerEffects: side.factionPowerEffects,
        });
      }
      break;
  }
}

// ─── Tally effects ──────────────────────────────────────────────────────────

interface EffectTally {
  name: string;
  key: string;
  count: number;       // outcomes that affect this
  values: number[];    // all effect values
  buckets: Record<string, number>; // "<-2", "-2", "-1", "+1", "+2", ">+2"
  sum: number;
}

function createTally(name: string, key: string): EffectTally {
  return {
    name, key, count: 0, values: [], sum: 0,
    buckets: { '<-2': 0, '-2': 0, '-1': 0, '+1': 0, '+2': 0, '>+2': 0 },
  };
}

function addValue(tally: EffectTally, value: number) {
  tally.count++;
  tally.values.push(value);
  tally.sum += value;

  if (value < -2) tally.buckets['<-2']++;
  else if (value === -2) tally.buckets['-2']++;
  else if (value === -1) tally.buckets['-1']++;
  else if (value === 1) tally.buckets['+1']++;
  else if (value === 2) tally.buckets['+2']++;
  else if (value > 2) tally.buckets['>+2']++;
  // value === 0 is not counted (shouldn't appear, but skip if it does)
}

// Policy tallies
const policyTallies: Record<string, EffectTally> = {};
for (const axis of AXIS_KEYS) {
  const label = AXIS_LABELS[axis];
  policyTallies[axis] = createTally(`${label.positive} ↔ ${label.negative}`, axis);
}

// Faction tallies
const factionTallies: Record<string, EffectTally> = {};
for (const f of FACTIONS) {
  factionTallies[f.key] = createTally(`${f.displayName} (${f.latinName})`, f.key);
}

for (const outcome of outcomes) {
  for (const [axis, value] of Object.entries(outcome.axisEffects)) {
    if (value && value !== 0 && policyTallies[axis]) {
      addValue(policyTallies[axis], value);
    }
  }
  for (const [faction, value] of Object.entries(outcome.factionPowerEffects)) {
    if (value && value !== 0) {
      if (!factionTallies[faction]) {
        // Unknown faction — create ad-hoc tally
        factionTallies[faction] = createTally(faction, faction);
      }
      addValue(factionTallies[faction], value);
    }
  }
}

// ─── Output ─────────────────────────────────────────────────────────────────

function printTally(tally: EffectTally) {
  console.log(`## ${tally.name}`);
  console.log(`  Affecting outcomes: ${tally.count}`);
  console.log(`  <-2 outcomes: ${tally.buckets['<-2']}`);
  console.log(`  -2  outcomes: ${tally.buckets['-2']}`);
  console.log(`  -1  outcomes: ${tally.buckets['-1']}`);
  console.log(`  +1  outcomes: ${tally.buckets['+1']}`);
  console.log(`  +2  outcomes: ${tally.buckets['+2']}`);
  console.log(`  >+2 outcomes: ${tally.buckets['>+2']}`);
  const sign = tally.sum > 0 ? '+' : '';
  console.log(`  Sum: ${sign}${tally.sum}`);
  console.log();
}

console.log(`Total controversies: ${ALL_CONTROVERSIES.length}`);
console.log(`Total outcomes: ${outcomes.length}`);
console.log();

console.log('# Policy Effects');
console.log();
for (const axis of AXIS_KEYS) {
  printTally(policyTallies[axis]);
}

console.log('# Faction Power Effects');
console.log();
for (const f of FACTIONS) {
  if (factionTallies[f.key]) {
    printTally(factionTallies[f.key]);
  }
}
// Print any unknown factions
for (const [key, tally] of Object.entries(factionTallies)) {
  if (!FACTIONS.find(f => f.key === key)) {
    printTally(tally);
  }
}

// ─── Warnings ───────────────────────────────────────────────────────────────

const warnings: string[] = [];
const numOutcomes = outcomes.length;

function checkTally(tally: EffectTally, kind: 'policy' | 'faction') {
  // Any individual effect |value| > 2
  for (const v of tally.values) {
    if (Math.abs(v) > 2) {
      warnings.push(`${kind} "${tally.name}": has an effect with |value| = ${Math.abs(v)} (>2)`);
      break; // only warn once per tally
    }
  }

  // |effect| == 2 frequency check
  const count2 = tally.buckets['-2'] + tally.buckets['+2'];
  if (kind === 'policy') {
    const threshold = Math.ceil(numOutcomes * 0.01);
    if (count2 > threshold) {
      warnings.push(`${kind} "${tally.name}": ${count2} outcomes with |effect|=2 (threshold: ${threshold}, 1% of ${numOutcomes})`);
    }
  } else {
    const threshold = Math.ceil(numOutcomes * 0.05);
    if (count2 > threshold) {
      warnings.push(`${kind} "${tally.name}": ${count2} outcomes with |effect|=2 (threshold: ${threshold}, 5% of ${numOutcomes})`);
    }
  }

  // |sum| > 1
  if (Math.abs(tally.sum) > 1) {
    const sign = tally.sum > 0 ? '+' : '';
    warnings.push(`${kind} "${tally.name}": |sum| = ${Math.abs(tally.sum)} (${sign}${tally.sum}) exceeds ±1`);
  }
}

// Check all policy tallies
const policyCounts = AXIS_KEYS.map(a => policyTallies[a].count);
const maxPolicyCount = Math.max(...policyCounts);
for (const axis of AXIS_KEYS) {
  checkTally(policyTallies[axis], 'policy');
  if (policyTallies[axis].count < maxPolicyCount * 0.9) {
    warnings.push(`policy "${policyTallies[axis].name}": only ${policyTallies[axis].count} affecting outcomes (< 90% of max ${maxPolicyCount})`);
  }
}

// Check all faction tallies
const factionCounts = FACTIONS.map(f => factionTallies[f.key]?.count ?? 0);
const maxFactionCount = Math.max(...factionCounts);
for (const f of FACTIONS) {
  const tally = factionTallies[f.key];
  if (!tally || tally.count === 0) {
    warnings.push(`faction "${f.displayName} (${f.latinName})": NO affecting outcomes at all`);
    continue;
  }
  checkTally(tally, 'faction');
  if (tally.count < maxFactionCount * 0.9) {
    warnings.push(`faction "${tally.name}": only ${tally.count} affecting outcomes (< 90% of max ${maxFactionCount})`);
  }
}

if (warnings.length > 0) {
  console.log('# WARNINGS');
  console.log();
  for (const w of warnings) {
    console.log(`  ⚠  ${w}`);
  }
  console.log();
} else {
  console.log('# No warnings — all checks passed!');
  console.log();
}
