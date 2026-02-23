import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, ImageSourcePropType, Animated } from 'react-native';
import { Controversy } from '../lib/game-engine/controversies';
import { AXIS_LABELS, AxisKey } from '../lib/game-engine/axes';

// Static require map for controversy illustrations (add new images here as they become available)
const ILLUSTRATION_MAP: Record<string, ImageSourcePropType> = {
  carthage_fleet: require('../assets/images/controversies/carthage_fleet.png'),
  gallic_raiders: require('../assets/images/controversies/gallic_raiders.png'),
  eastern_king: require('../assets/images/controversies/eastern_king.png'),
  greek_city: require('../assets/images/controversies/greek_city.png'),
  roman_fields: require('../assets/images/controversies/roman_fields.png'),
  slave_revolt: require('../assets/images/controversies/slave_revolt.png'),
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
  axisValues?: Record<string, number>;     // current axis values (key → -2..2)
  factionInfoMap?: Record<string, FactionInfo>; // key → { displayName, power }
};

const CATEGORY_COLORS: Record<string, string> = {
  military:  '#c0392b',
  social:    '#2980b9',
  economic:  '#c9a84c',
  political: '#8e44ad',
  religious: '#27ae60',
};

function effectSign(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

const NOTCH_POSITIONS = [0, 25, 50, 75, 100];

function AxisEffectSlider({ axis, change, currentValue }: {
  axis: string;
  change: number;
  currentValue: number;
}) {
  const labels = AXIS_LABELS[axis as AxisKey];
  if (!labels) return null;

  // Map value from -2..2 to 0..100%
  const clamp = (v: number) => Math.max(0, Math.min(100, ((v + 2) / 4) * 100));
  const fromPct = clamp(currentValue);
  const toPct = clamp(currentValue + change);
  const linePct = { left: Math.min(fromPct, toPct), right: Math.max(fromPct, toPct) };
  const isPositive = change > 0;

  return (
    <View style={styles.axisEffect}>
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
            backgroundColor: isPositive ? 'rgba(76,175,80,0.6)' : 'rgba(229,57,53,0.6)',
          },
        ]} />
        {/* Old position marker (dimmed) */}
        <View style={[styles.axisMarker, { left: `${fromPct}%` }]}>
          <View style={[styles.axisMarkerTriangle, { borderTopColor: 'rgba(201,168,76,0.35)' }]} />
        </View>
        {/* New position marker (bright) */}
        <View style={[styles.axisMarker, { left: `${toPct}%` }]}>
          <View style={[styles.axisMarkerTriangle, { borderTopColor: '#DAA520' }]} />
        </View>
      </View>
    </View>
  );
}

function PowerEffectRow({ factionName, currentPower, change }: {
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
        <Text style={[styles.powerChangeText, { color: isGain ? '#4caf50' : '#e53935' }]}>
          {effectSign(change)} Power
        </Text>
      </View>
      <View style={styles.powerPipsRow}>
        {Array.from({ length: maxPips }, (_, i) => {
          const pipNum = i + 1;
          const wasFilledBefore = pipNum <= currentPower;
          const isFilledAfter = pipNum <= newPower;

          if (isGain && !wasFilledBefore && isFilledAfter) {
            // New pip being gained — animate pulse
            return <PulsingPip key={i} color="#4caf50" />;
          } else if (!isGain && wasFilledBefore && !isFilledAfter) {
            // Pip being lost — animate fade
            return <PulsingPip key={i} color="#e53935" />;
          } else {
            // Normal pip
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
      {
        backgroundColor: color,
        borderColor: color,
        opacity: anim,
      },
    ]} />
  );
}

export default function ControversyCard({
  controversy,
  activeFactionKeys,
  isActive = false,
  axisValues,
  factionInfoMap,
}: Props) {
  const catColor = CATEGORY_COLORS[controversy.category] ?? '#888';
  const illustrationSource = ILLUSTRATION_MAP[controversy.illustration] ?? FALLBACK_ILLUSTRATION;

  return (
    <View style={[styles.card, isActive && styles.cardActive]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{controversy.title}</Text>
        <View style={[styles.categoryBadge, { backgroundColor: catColor }]}>
          <Text style={styles.categoryText}>{controversy.category}</Text>
        </View>
      </View>

      {/* Illustration */}
      <Image source={illustrationSource} style={styles.illustration} resizeMode="cover" />

      {/* Flavor text */}
      <Text style={styles.flavor} numberOfLines={3} ellipsizeMode="tail">
        {controversy.flavor}
      </Text>

      {/* Resolutions */}
      <View style={styles.resolutionsSection}>
        {controversy.resolutions.map((r) => {
          const axisKeys = Object.keys(r.axisEffects) as string[];
          const factionKeys = Object.keys(r.factionPowerEffects).filter((k) =>
            activeFactionKeys.includes(k)
          );

          return (
            <View key={r.key} style={styles.resolution}>
              <Text style={styles.resolutionTitle}>{r.title}</Text>
              <Text style={styles.resolutionDesc} numberOfLines={2}>{r.description}</Text>

              {axisKeys.length > 0 && (
                <View style={styles.effectsSection}>
                  {axisKeys.map((axis) => {
                    const change = r.axisEffects[axis as keyof typeof r.axisEffects] ?? 0;
                    const currentVal = axisValues?.[axis] ?? 0;
                    return (
                      <AxisEffectSlider
                        key={axis}
                        axis={axis}
                        change={change}
                        currentValue={currentVal}
                      />
                    );
                  })}
                </View>
              )}

              {factionKeys.length > 0 && (
                <View style={styles.effectsSection}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(20,14,5,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.3)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardActive: {
    borderColor: '#c9a84c',
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
    color: '#e8d5a3',
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
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  categoryText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  flavor: {
    color: '#e8d5a3',
    fontSize: 12,
    fontStyle: 'italic',
    opacity: 0.65,
    marginBottom: 12,
    lineHeight: 17,
  },
  resolutionsSection: {
    gap: 10,
  },
  resolution: {
    backgroundColor: 'rgba(201,168,76,0.06)',
    borderRadius: 8,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: 'rgba(201,168,76,0.4)',
    gap: 6,
  },
  resolutionTitle: {
    color: '#c9a84c',
    fontSize: 13,
    fontWeight: '700',
  },
  resolutionDesc: {
    color: '#e8d5a3',
    fontSize: 12,
    opacity: 0.75,
    lineHeight: 16,
  },
  effectsSection: {
    gap: 6,
    marginTop: 4,
  },

  // Axis effect slider
  axisEffect: {
    gap: 4,
  },
  axisLabel: {
    color: '#e0c097',
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
    backgroundColor: 'rgba(224, 192, 151, 0.2)',
    borderRadius: 1,
  },
  axisNotch: {
    position: 'absolute',
    top: -2,
    width: 1,
    height: 6,
    backgroundColor: 'rgba(224, 192, 151, 0.25)',
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
    color: '#e8d5a3',
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
    borderColor: 'rgba(224, 192, 151, 0.4)',
  },
  powerPipFilled: {
    backgroundColor: '#e0c097',
    borderColor: '#e0c097',
  },
});
