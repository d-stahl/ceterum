import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Image, ImageSourcePropType, Animated, Pressable } from 'react-native';
import { Controversy, CATEGORY_LABELS, CATEGORY_COLORS } from '../lib/game-engine/controversies';
import { AXIS_LABELS, AxisKey } from '../lib/game-engine/axes';
import { getColorHex } from '../lib/player-colors';
import AgendaDots, { PlayerAgendaInfo } from './AgendaDots';
import { C, goldBg, parchmentBg, brownBg } from '../lib/theme';

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
};
const FALLBACK_ILLUSTRATION = require('../assets/images/controversies/roman_fields.png');

type FactionInfo = {
  key: string;
  displayName: string;
  power: number;
};

type Props = {
  controversy: Controversy;
  activeFactionKeys: string[];
  isActive?: boolean;
  axisValues?: Record<string, number>;
  factionInfoMap?: Record<string, FactionInfo>;
  playerAgendas?: PlayerAgendaInfo[];
};


function effectSign(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
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
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const catColor = CATEGORY_COLORS[controversy.category] ?? '#888';
  const illustrationSource = ILLUSTRATION_MAP[controversy.illustration] ?? FALLBACK_ILLUSTRATION;

  return (
    <View style={[styles.card, isActive && styles.cardActive]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{controversy.title}</Text>
        <View style={[styles.categoryBadge, { backgroundColor: catColor + '30', borderColor: catColor + '60' }]}>
          <Text style={[styles.categoryText, { color: catColor }]}>{CATEGORY_LABELS[controversy.category] ?? controversy.category}</Text>
        </View>
      </View>

      {/* Illustration */}
      <Image source={illustrationSource} style={styles.illustration} resizeMode="cover" />

      {/* Flavor text */}
      <Text style={styles.flavor}>{controversy.flavor}</Text>

      {/* Expand/collapse toggle */}
      <Pressable
        style={[styles.detailsButton, expanded && styles.detailsButtonActive]}
        onPress={() => setExpanded((v) => !v)}
      >
        <Text style={styles.detailsButtonText}>
          {expanded ? 'Hide Resolutions' : 'Show Resolutions'}
        </Text>
        <Text style={styles.detailsChevron}>{expanded ? '▴' : '▾'}</Text>
      </Pressable>

      {/* Resolutions (expandable) */}
      {expanded && (
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
              </View>
            );
          })}
        </View>
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
