import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Image, ImageSourcePropType, Animated, Pressable } from 'react-native';
import { Controversy, CONTROVERSY_MAP } from '../lib/game-engine/controversies';
import { AXIS_LABELS, AxisKey } from '../lib/game-engine/axes';
import { FACTIONS } from '../lib/game-engine/factions';
import { getFactionStance, FactionStance } from '../lib/game-engine/ruling';
import { getColorHex } from '../lib/player-colors';
import AgendaDots, { PlayerAgendaInfo } from './AgendaDots';
import { C, goldBg, parchmentBg, brownBg, CONTROVERSY_TYPE_COLORS, CONTROVERSY_TYPE_LABELS } from '../lib/theme';

// Static require map for controversy illustrations (add new images here as they become available)
export const ILLUSTRATION_MAP: Record<string, ImageSourcePropType> = {
  carthage_fleet: require('../assets/images/controversies/carthage_fleet.png'),
  gallic_raiders: require('../assets/images/controversies/gallic_raiders.png'),
  eastern_king: require('../assets/images/controversies/eastern_king.png'),
  greek_city: require('../assets/images/controversies/greek_city.png'),
  roman_fields: require('../assets/images/controversies/roman_fields.png'),
  slave_revolt: require('../assets/images/controversies/slave_revolt.png'),
  allied_soldiers: require('../assets/images/controversies/allied_soldiers.png'),
  debt_bondage: require('../assets/images/controversies/debt_bondage.png'),
  grain_market: require('../assets/images/controversies/grain_market.png'),
  pirate_ships: require('../assets/images/controversies/pirate_ships.png'),
  tax_collectors: require('../assets/images/controversies/tax_collectors.png'),
  roman_banquet: require('../assets/images/controversies/roman_banquet.png'),
  roman_assembly: require('../assets/images/controversies/roman_assembly.png'),
  roman_dictator: require('../assets/images/controversies/roman_dictator.png'),
  roman_election: require('../assets/images/controversies/roman_election.png'),
  provincial_governor: require('../assets/images/controversies/provincial_governor.png'),
  eastern_temple: require('../assets/images/controversies/eastern_temple.png'),
  roman_priests: require('../assets/images/controversies/roman_priests.png'),
  roman_censors: require('../assets/images/controversies/roman_censors.png'),
  sibylline_books: require('../assets/images/controversies/sibylline_books.png'),
  purging_the_mediterranean: require('../assets/images/controversies/purging_the_mediterranean.png'),
  pirates_and_farmers_schism: require('../assets/images/controversies/pirates_and_farmers_schism.png'),
  outfitting_the_fleet: require('../assets/images/controversies/outfitting_the_fleet.png'),
  allied_legions_marching: require('../assets/images/controversies/allied_legions_marching.png'),
  alpine_campaign: require('../assets/images/controversies/alpine_campaign.png'),
  assembly_reform: require('../assets/images/controversies/assembly_reform.png'),
  auditors_in_province: require('../assets/images/controversies/auditors_in_province.png'),
  augurs_authority: require('../assets/images/controversies/augurs_authority.png'),
  blockade_lines: require('../assets/images/controversies/blockade_lines.png'),
  burning_frontier_town: require('../assets/images/controversies/burning_frontier_town.png'),
  censors_revenge: require('../assets/images/controversies/censors_revenge.png'),
  census_expedition: require('../assets/images/controversies/census_expedition.png'),
  creditors_revolt: require('../assets/images/controversies/creditors_revolt.png'),
  crowded_assembly: require('../assets/images/controversies/crowded_assembly.png'),
  cultural_commission: require('../assets/images/controversies/cultural_commission.png'),
  debt_courts: require('../assets/images/controversies/debt_courts.png'),
  debtors_march: require('../assets/images/controversies/debtors_march.png'),
  dictator_defiant: require('../assets/images/controversies/dictator_defiant.png'),
  dueling_consuls: require('../assets/images/controversies/dueling_consuls.png'),
  eastern_garrison: require('../assets/images/controversies/eastern_garrison.png'),
  eastern_outposts: require('../assets/images/controversies/eastern_outposts.png'),
  election_inspectors: require('../assets/images/controversies/election_inspectors.png'),
  empty_granary: require('../assets/images/controversies/empty_granary.png'),
  fashion_wars: require('../assets/images/controversies/fashion_wars.png'),
  forum_standoff: require('../assets/images/controversies/forum_standoff.png'),
  freedman_question: require('../assets/images/controversies/freedman_question.png'),
  garrison_mutiny: require('../assets/images/controversies/garrison_mutiny.png'),
  governors_trial: require('../assets/images/controversies/governors_trial.png'),
  grain_ships_at_ostia: require('../assets/images/controversies/grain_ships_at_ostia.png'),
  hannibals_crossing: require('../assets/images/controversies/hannibals_crossing.png'),
  italian_battlefield: require('../assets/images/controversies/italian_battlefield.png'),
  licensing_board: require('../assets/images/controversies/licensing_board.png'),
  luxury_fleet: require('../assets/images/controversies/luxury_fleet.png'),
  manumission_registry: require('../assets/images/controversies/manumission_registry.png'),
  market_riot: require('../assets/images/controversies/market_riot.png'),
  merchant_princes: require('../assets/images/controversies/merchant_princes.png'),
  monsoon_fleet: require('../assets/images/controversies/monsoon_fleet.png'),
  moral_courts: require('../assets/images/controversies/moral_courts.png'),
  oracles_curse: require('../assets/images/controversies/oracles_curse.png'),
  patronage_networks: require('../assets/images/controversies/patronage_networks.png'),
  peace_of_carthage: require('../assets/images/controversies/peace_of_carthage.png'),
  plantation_siege: require('../assets/images/controversies/plantation_siege.png'),
  pontic_defiance: require('../assets/images/controversies/pontic_defiance.png'),
  priestly_schism: require('../assets/images/controversies/priestly_schism.png'),
  provincial_reform: require('../assets/images/controversies/provincial_reform.png'),
  red_sea_expedition: require('../assets/images/controversies/red_sea_expedition.png'),
  returning_legions: require('../assets/images/controversies/returning_legions.png'),
  sacred_calendar: require('../assets/images/controversies/sacred_calendar.png'),
  sacred_festival: require('../assets/images/controversies/sacred_festival.png'),
  sacred_games: require('../assets/images/controversies/sacred_games.png'),
  settled_tribes: require('../assets/images/controversies/settled_tribes.png'),
  smugglers_war: require('../assets/images/controversies/smugglers_war.png'),
  surveyor_ambush: require('../assets/images/controversies/surveyor_ambush.png'),
  temple_purge: require('../assets/images/controversies/temple_purge.png'),
  temple_restoration: require('../assets/images/controversies/temple_restoration.png'),
  tenant_barricade: require('../assets/images/controversies/tenant_barricade.png'),
  tribunal_chamber: require('../assets/images/controversies/tribunal_chamber.png'),
  tribunes_coalition: require('../assets/images/controversies/tribunes_coalition.png'),
  veteran_settlement: require('../assets/images/controversies/veteran_settlement.png'),
  voting_riots: require('../assets/images/controversies/voting_riots.png'),
};
const FALLBACK_ILLUSTRATION = require('../assets/images/controversies/roman_fields.png');

type FactionInfo = {
  key: string;
  displayName: string;
  power: number;
  preferences: Record<string, number>;
};

type ResolvedInfo = {
  winningResolutionKey: string;
  axisEffects: Record<string, number>;
  factionPowerEffects: Record<string, number>;
  axisBefore?: Record<string, number>;
  factionPowerBefore?: Record<string, number>;
};

type Props = {
  controversy: Controversy;
  activeFactionKeys: string[];
  isActive?: boolean;
  axisValues?: Record<string, number>;
  factionInfoMap?: Record<string, FactionInfo>;
  playerAgendas?: PlayerAgendaInfo[];
  resolvedInfo?: ResolvedInfo;
};


function effectSign(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

/** Compute each active faction's stance on a resolution's axis effects. */
export function getFactionStances(
  axisEffects: Partial<Record<string, number>>,
  activeFactionKeys: string[],
  factionInfoMap?: Record<string, FactionInfo>,
  axisValues?: Record<string, number>,
): { key: string; stance: FactionStance }[] {
  const result: { key: string; stance: FactionStance }[] = [];
  for (const fkey of activeFactionKeys) {
    const prefs = factionInfoMap?.[fkey]?.preferences
      ?? FACTIONS.find((f) => f.key === fkey)?.defaultPreferences;
    if (!prefs) continue;
    const stance = getFactionStance(
      axisEffects as Partial<Record<AxisKey, number>>,
      prefs as Partial<Record<AxisKey, number>>,
      (axisValues ?? {}) as Partial<Record<AxisKey, number>>,
    );
    result.push({ key: fkey, stance });
  }
  return result;
}

/** @deprecated Use getFactionStances instead */
export function getUpsetFactions(
  axisEffects: Partial<Record<string, number>>,
  activeFactionKeys: string[],
  factionInfoMap?: Record<string, FactionInfo>,
  axisValues?: Record<string, number>,
): string[] {
  return getFactionStances(axisEffects, activeFactionKeys, factionInfoMap, axisValues)
    .filter((f) => f.stance === 'opposed')
    .map((f) => f.key);
}

const NOTCH_POSITIONS = [0, 25, 50, 75, 100];

export function AxisEffectSlider({ axis, change, currentValue, playerAgendas }: {
  axis: string;
  change: number;
  currentValue: number;
  playerAgendas?: PlayerAgendaInfo[];
}) {
  const labels = AXIS_LABELS[axis as AxisKey];
  if (!labels) return null;

  const clamp = (v: number) => Math.max(0, Math.min(100, ((v + 2) / 4) * 100));
  const fromPct = clamp(currentValue);
  const toPct = clamp(currentValue + change);
  const linePct = { left: Math.min(fromPct, toPct), right: Math.max(fromPct, toPct) };
  const isPositive = change > 0;

  const hasAgendas = playerAgendas && playerAgendas.some((pa) => pa.agenda[axis] != null);

  return (
    <View style={[styles.axisEffect, hasAgendas && { marginBottom: 12 }]}>
      <Text style={styles.axisLabel}>{labels.negative} — {labels.positive}</Text>
      <View style={styles.axisSliderContainer}>
        <View style={styles.axisLine}>
          {NOTCH_POSITIONS.map((pct) => (
            <View key={pct} style={[styles.axisNotch, { left: `${pct}%` }]} />
          ))}
        </View>
        {/* Movement line between old and new position */}
        <View style={[
          styles.axisMovementLine,
          {
            left: `${linePct.left}%`,
            width: `${linePct.right - linePct.left}%`,
            backgroundColor: isPositive ? C.axisPositive : C.axisNegative,
          },
        ]} />
        {/* Old position marker (dimmed) */}
        <View style={[styles.axisMarker, { left: `${fromPct}%` }]}>
          <View style={[styles.axisMarkerTriangle, { borderTopColor: goldBg(0.35) }]} />
        </View>
        {/* New position marker (bright) */}
        <View style={[styles.axisMarker, { left: `${toPct}%` }]}>
          <View style={[styles.axisMarkerTriangle, { borderTopColor: C.accentGold }]} />
        </View>
        {hasAgendas && (
          <AgendaDots axis={axis} playerAgendas={playerAgendas!} clamp={clamp} />
        )}
      </View>
    </View>
  );
}

export function PowerEffectRow({ factionName, currentPower, change }: {
  factionName: string;
  currentPower: number;
  change: number;
}) {
  const newPower = Math.max(1, currentPower + change);
  const maxPips = 5;
  const isGain = change > 0;

  return (
    <View style={styles.powerEffect}>
      <View style={styles.powerEffectHeader}>
        <Text style={styles.powerFactionName}>{factionName}:</Text>
        {change === 0 ? (
          <Text style={[styles.powerChangeText, { opacity: 0.4 }]}>No change</Text>
        ) : (
          <Text style={[styles.powerChangeText, { color: isGain ? C.positive : C.negative }]}>
            {effectSign(change)} Power
          </Text>
        )}
      </View>
      <View style={styles.powerPipsRow}>
        {Array.from({ length: maxPips }, (_, i) => {
          const pipNum = i + 1;
          const wasFilledBefore = pipNum <= currentPower;
          const isFilledAfter = pipNum <= newPower;

          if (isGain && !wasFilledBefore && isFilledAfter) {
            return <PulsingPip key={i} color={C.positive} />;
          } else if (!isGain && wasFilledBefore && !isFilledAfter) {
            return <PulsingPip key={i} color={C.negative} />;
          } else {
            return (
              <View key={i} style={[
                styles.powerPip,
                isFilledAfter && styles.powerPipFilled,
              ]} />
            );
          }
        })}
      </View>
    </View>
  );
}

function PulsingPip({ color }: { color: string }) {
  const anim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.3, duration: 600, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  return (
    <Animated.View style={[
      styles.powerPip,
      { backgroundColor: color, borderColor: color, opacity: anim },
    ]} />
  );
}

export default function ControversyCard({
  controversy,
  activeFactionKeys,
  isActive = false,
  axisValues,
  factionInfoMap,
  playerAgendas,
  resolvedInfo,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const typeColor = CONTROVERSY_TYPE_COLORS[controversy.type] ?? C.gray;
  const illustrationSource = ILLUSTRATION_MAP[controversy.illustration] ?? FALLBACK_ILLUSTRATION;
  const isResolved = !!resolvedInfo;

  const isVote = controversy.type === 'vote';
  const winningResolution = isResolved && isVote
    ? controversy.resolutions.find((r) => r.key === resolvedInfo.winningResolutionKey)
    : null;

  return (
    <View style={[styles.card, isActive && styles.cardActive, isResolved && styles.cardResolved]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{controversy.title}</Text>
        <View style={[styles.categoryBadge, { backgroundColor: typeColor + '30', borderColor: typeColor + '60' }]}>
          <Text style={[styles.categoryText, { color: typeColor }]}>{CONTROVERSY_TYPE_LABELS[controversy.type] ?? controversy.type}</Text>
        </View>
      </View>

      {/* Illustration */}
      <Image source={illustrationSource} style={styles.illustration} resizeMode="cover" />

      {/* Flavor text */}
      <Text style={styles.flavor}>{controversy.flavor}</Text>

      {isResolved && winningResolution ? (
        <>
          {/* Enacted resolution label */}
          <Text style={styles.enactedLabel}>Enacted Resolution</Text>

          {/* Winning resolution card — uses stored applied effects */}
          <View style={styles.resolution}>
            <Text style={styles.resolutionTitle}>{winningResolution.title}</Text>
            <Text style={styles.resolutionDesc}>{winningResolution.description}</Text>

            {(() => {
              const axisKeys = Object.keys(resolvedInfo.axisEffects).filter((k) => resolvedInfo.axisEffects[k] !== 0);
              if (axisKeys.length === 0) return null;
              return (
                <View style={styles.effectsSection}>
                  <Text style={styles.effectsSectionLabel}>Policy Effects</Text>
                  {axisKeys.map((axis) => {
                    const change = resolvedInfo.axisEffects[axis] ?? 0;
                    const preResolutionVal = resolvedInfo.axisBefore?.[axis] ?? (axisValues?.[axis] ?? 0) - change;
                    return (
                      <AxisEffectSlider
                        key={axis}
                        axis={axis}
                        change={change}
                        currentValue={preResolutionVal}
                        playerAgendas={playerAgendas}
                      />
                    );
                  })}
                </View>
              );
            })()}

            {(() => {
              const factionKeys = Object.keys(resolvedInfo.factionPowerEffects).filter(
                (k) => activeFactionKeys.includes(k) && resolvedInfo.factionPowerEffects[k] !== 0
              );
              if (factionKeys.length === 0) return null;
              return (
                <View style={styles.effectsSection}>
                  <Text style={styles.effectsSectionLabel}>Power Effects</Text>
                  {factionKeys.map((fkey) => {
                    const change = resolvedInfo.factionPowerEffects[fkey] ?? 0;
                    const info = factionInfoMap?.[fkey];
                    const preResolutionPower = resolvedInfo.factionPowerBefore?.[fkey] ?? (info?.power ?? 3) - change;
                    return (
                      <PowerEffectRow
                        key={fkey}
                        factionName={info?.displayName ?? fkey}
                        currentPower={preResolutionPower}
                        change={change}
                      />
                    );
                  })}
                </View>
              );
            })()}
          </View>
        </>
      ) : (
        <>
          {/* Expand/collapse toggle */}
          <Pressable
            style={[styles.detailsButton, expanded && styles.detailsButtonActive]}
            onPress={() => setExpanded((v) => !v)}
          >
            <Text style={styles.detailsButtonText}>
              {expanded ? 'Hide Details' : 'Show Details'}
            </Text>
            <Text style={styles.detailsChevron}>{expanded ? '▴' : '▾'}</Text>
          </Pressable>

          {expanded && isVote && (
            <View style={styles.resolutionsSection}>
              {controversy.resolutions.map((r) => {
                const axisKeys = Object.keys(r.axisEffects) as string[];
                const factionKeys = Object.keys(r.factionPowerEffects).filter((k) =>
                  activeFactionKeys.includes(k)
                );

                return (
                  <View key={r.key} style={styles.resolution}>
                    <Text style={styles.resolutionTitle}>{r.title}</Text>
                    <Text style={styles.resolutionDesc}>{r.description}</Text>

                    {axisKeys.length > 0 && (
                      <View style={styles.effectsSection}>
                        <Text style={styles.effectsSectionLabel}>Policy Effects</Text>
                        {axisKeys.map((axis) => {
                          const change = r.axisEffects[axis as keyof typeof r.axisEffects] ?? 0;
                          const currentVal = axisValues?.[axis] ?? 0;
                          return (
                            <AxisEffectSlider
                              key={axis}
                              axis={axis}
                              change={change}
                              currentValue={currentVal}
                              playerAgendas={playerAgendas}
                            />
                          );
                        })}
                      </View>
                    )}

                    {factionKeys.length > 0 && (
                      <View style={styles.effectsSection}>
                        <Text style={styles.effectsSectionLabel}>Power Effects</Text>
                        {factionKeys.map((fkey) => {
                          const change = r.factionPowerEffects[fkey] ?? 0;
                          const info = factionInfoMap?.[fkey];
                          return (
                            <PowerEffectRow
                              key={fkey}
                              factionName={info?.displayName ?? fkey}
                              currentPower={info?.power ?? 3}
                              change={change}
                            />
                          );
                        })}
                      </View>
                    )}

                    {(() => {
                      const stances = getFactionStances(r.axisEffects, activeFactionKeys, factionInfoMap, axisValues);
                      const hasStances = stances.some((s) => s.stance !== 'neutral');
                      if (!hasStances) return null;
                      return (
                        <View style={styles.effectsSection}>
                          <Text style={styles.effectsSectionLabel}>Faction Reactions</Text>
                          {stances.map(({ key: fkey, stance }) => (
                            <View key={fkey} style={styles.stanceRow}>
                              <Text style={styles.stanceFactionName}>
                                {factionInfoMap?.[fkey]?.displayName ?? fkey}
                              </Text>
                              <Text style={[
                                styles.stanceLabel,
                                stance === 'opposed' && styles.stanceOpposed,
                                stance === 'in_favor' && styles.stanceInFavor,
                              ]}>
                                {stance === 'opposed' ? 'Opposed' : stance === 'in_favor' ? 'In Favor' : 'Neutral'}
                              </Text>
                            </View>
                          ))}
                        </View>
                      );
                    })()}

                    {r.followUpKey && (() => {
                      const followUp = CONTROVERSY_MAP[r.followUpKey];
                      if (!followUp) return null;
                      const ftColor = CONTROVERSY_TYPE_COLORS[followUp.type] ?? C.gray;
                      const ftLabel = CONTROVERSY_TYPE_LABELS[followUp.type] ?? followUp.type;
                      return (
                        <View style={[styles.followUpHint, { borderColor: ftColor + '40' }]}>
                          <Text style={[styles.followUpHintText, { color: ftColor }]}>
                            May lead to: {followUp.title} ({ftLabel})
                          </Text>
                        </View>
                      );
                    })()}
                  </View>
                );
              })}
            </View>
          )}

          {expanded && controversy.type === 'clash' && (() => {
            const sc = controversy.clashConfig.successOutcome;
            const fc = controversy.clashConfig.failureOutcome;
            const sAxisKeys = Object.keys(sc.axisEffects).filter((k) => sc.axisEffects[k as keyof typeof sc.axisEffects] !== 0);
            const fAxisKeys = Object.keys(fc.axisEffects).filter((k) => fc.axisEffects[k as keyof typeof fc.axisEffects] !== 0);
            return (
              <View style={styles.resolutionsSection}>
                <View style={styles.resolution}>
                  <Text style={styles.resolutionTitle}>Faction Commitment</Text>
                  <Text style={styles.resolutionDesc}>
                    Players bid influence on factions, then commit or withdraw.
                    Threshold: {Math.round(controversy.clashConfig.thresholdPercent * 100)}% of total faction power.
                  </Text>
                  {Object.entries(controversy.clashConfig.factionAmplifiers).filter(([, v]) => v && v > 1).map(([fkey, amp]) => (
                    <Text key={fkey} style={styles.resolutionDesc}>
                      {factionInfoMap?.[fkey]?.displayName ?? fkey}: {amp}x amplifier
                    </Text>
                  ))}
                </View>
                <View style={styles.resolution}>
                  <Text style={styles.resolutionTitle}>On Success</Text>
                  {sAxisKeys.length > 0 && (
                    <View style={styles.effectsSection}>
                      <Text style={styles.effectsSectionLabel}>Policy Effects</Text>
                      {sAxisKeys.map((axis) => (
                        <AxisEffectSlider key={axis} axis={axis} change={sc.axisEffects[axis as keyof typeof sc.axisEffects] ?? 0} currentValue={axisValues?.[axis] ?? 0} playerAgendas={playerAgendas} />
                      ))}
                    </View>
                  )}
                </View>
                <View style={styles.resolution}>
                  <Text style={styles.resolutionTitle}>On Failure</Text>
                  {fAxisKeys.length > 0 && (
                    <View style={styles.effectsSection}>
                      <Text style={styles.effectsSectionLabel}>Policy Effects</Text>
                      {fAxisKeys.map((axis) => (
                        <AxisEffectSlider key={axis} axis={axis} change={fc.axisEffects[axis as keyof typeof fc.axisEffects] ?? 0} currentValue={axisValues?.[axis] ?? 0} playerAgendas={playerAgendas} />
                      ))}
                    </View>
                  )}
                </View>
              </View>
            );
          })()}

          {expanded && controversy.type === 'endeavour' && (() => {
            const ec = controversy.endeavourConfig;
            const sAxisKeys = Object.keys(ec.successOutcome.axisEffects).filter((k) => ec.successOutcome.axisEffects[k as keyof typeof ec.successOutcome.axisEffects] !== 0);
            const fAxisKeys = Object.keys(ec.failureOutcome.axisEffects).filter((k) => ec.failureOutcome.axisEffects[k as keyof typeof ec.failureOutcome.axisEffects] !== 0);
            return (
              <View style={styles.resolutionsSection}>
                <View style={styles.resolution}>
                  <Text style={styles.resolutionTitle}>Collective Investment</Text>
                  <Text style={styles.resolutionDesc}>
                    All players secretly invest influence. Difficulty: {Math.round(ec.difficultyPercent * 100)}%.
                    Top investor earns up to {ec.firstPlaceReward} VP.
                  </Text>
                </View>
                {sAxisKeys.length > 0 && (
                  <View style={styles.resolution}>
                    <Text style={styles.resolutionTitle}>On Success</Text>
                    <View style={styles.effectsSection}>
                      <Text style={styles.effectsSectionLabel}>Policy Effects</Text>
                      {sAxisKeys.map((axis) => (
                        <AxisEffectSlider key={axis} axis={axis} change={ec.successOutcome.axisEffects[axis as keyof typeof ec.successOutcome.axisEffects] ?? 0} currentValue={axisValues?.[axis] ?? 0} playerAgendas={playerAgendas} />
                      ))}
                    </View>
                  </View>
                )}
                {fAxisKeys.length > 0 && (
                  <View style={styles.resolution}>
                    <Text style={styles.resolutionTitle}>On Failure</Text>
                    <View style={styles.effectsSection}>
                      <Text style={styles.effectsSectionLabel}>Policy Effects</Text>
                      {fAxisKeys.map((axis) => (
                        <AxisEffectSlider key={axis} axis={axis} change={ec.failureOutcome.axisEffects[axis as keyof typeof ec.failureOutcome.axisEffects] ?? 0} currentValue={axisValues?.[axis] ?? 0} playerAgendas={playerAgendas} />
                      ))}
                    </View>
                  </View>
                )}
              </View>
            );
          })()}

          {expanded && controversy.type === 'schism' && (
            <View style={styles.resolutionsSection}>
              {controversy.schismConfig.sides.map((side) => (
                <View key={side.key} style={styles.resolution}>
                  <Text style={styles.resolutionTitle}>{side.title}</Text>
                  <Text style={styles.resolutionDesc}>{side.description}</Text>
                  <Text style={[styles.resolutionDesc, { color: C.gold, fontWeight: '600' }]}>
                    Support: {side.supportVP} VP · Betray: {side.betrayVP} VP · All betray: {side.allBetrayVP} VP
                  </Text>
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: brownBg(0.92),
    borderWidth: 1,
    borderColor: goldBg(0.3),
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardActive: {
    borderColor: C.gold,
    borderWidth: 2,
  },
  cardResolved: {
    opacity: 0.75,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 8,
  },
  title: {
    color: C.paleGold,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'serif',
    flex: 1,
  },
  illustration: {
    width: '100%',
    height: 100,
    borderRadius: 6,
    marginBottom: 8,
  },
  categoryBadge: {
    borderRadius: 4,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  flavor: {
    color: C.paleGold,
    fontSize: 12,
    fontStyle: 'italic',
    opacity: 0.65,
    marginBottom: 10,
    lineHeight: 17,
  },
  enactedLabel: {
    color: C.gold,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginTop: 4,
  },
  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: goldBg(0.08),
    borderWidth: 1,
    borderColor: goldBg(0.2),
  },
  detailsButtonActive: {
    backgroundColor: goldBg(0.12),
    borderColor: goldBg(0.35),
    marginBottom: 10,
  },
  detailsButtonText: {
    color: C.gold,
    fontSize: 12,
    fontWeight: '600',
  },
  detailsChevron: {
    color: C.gold,
    fontSize: 12,
  },
  resolutionsSection: {
    gap: 10,
  },
  resolution: {
    backgroundColor: goldBg(0.06),
    borderRadius: 8,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: goldBg(0.4),
    gap: 6,
  },
  resolutionTitle: {
    color: C.gold,
    fontSize: 13,
    fontWeight: '700',
  },
  resolutionDesc: {
    color: C.paleGold,
    fontSize: 12,
    opacity: 0.75,
    lineHeight: 16,
  },
  effectsSection: {
    gap: 6,
    marginTop: 4,
  },
  effectsSectionLabel: {
    color: C.parchment,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    opacity: 0.4,
    marginBottom: 2,
  },
  stanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  stanceFactionName: {
    color: C.paleGold,
    fontSize: 12,
    flex: 1,
  },
  stanceLabel: {
    fontSize: 11,
    fontWeight: '600',
    opacity: 0.5,
    color: C.paleGold,
  },
  stanceOpposed: {
    color: C.negative,
    opacity: 1,
  },
  stanceInFavor: {
    color: C.positive,
    opacity: 1,
  },
  followUpHint: {
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 6,
    marginTop: 4,
  },
  followUpHintText: {
    fontSize: 9,
    fontWeight: '600',
    fontStyle: 'italic',
  },

  // Axis effect slider
  axisEffect: {
    gap: 4,
  },
  axisLabel: {
    color: C.parchment,
    fontSize: 9,
    opacity: 0.5,
    textAlign: 'center',
  },
  axisSliderContainer: {
    height: 14,
    position: 'relative',
    marginHorizontal: 4,
  },
  axisLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 6,
    height: 2,
    backgroundColor: parchmentBg(0.2),
    borderRadius: 1,
  },
  axisNotch: {
    position: 'absolute',
    top: -2,
    width: 1,
    height: 6,
    backgroundColor: parchmentBg(0.25),
    marginLeft: -0.5,
  },
  axisMovementLine: {
    position: 'absolute',
    top: 5,
    height: 4,
    borderRadius: 2,
  },
  axisMarker: {
    position: 'absolute',
    top: 0,
    marginLeft: -4,
    alignItems: 'center',
  },
  axisMarkerTriangle: {
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },

  // Power effect
  powerEffect: {
    gap: 4,
  },
  powerEffectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  powerFactionName: {
    color: C.paleGold,
    fontSize: 11,
    fontWeight: '600',
  },
  powerChangeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  powerPipsRow: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  powerPip: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: parchmentBg(0.4),
  },
  powerPipFilled: {
    backgroundColor: C.parchment,
    borderColor: C.parchment,
  },
});
