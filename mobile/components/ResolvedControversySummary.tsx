import { View, Text, StyleSheet, Image } from 'react-native';
import { Controversy, CATEGORY_LABELS } from '../lib/game-engine/controversies';
import { AXIS_LABELS, AxisKey } from '../lib/game-engine/axes';
import { ILLUSTRATION_MAP } from './ControversyCard';
import { C, goldBg, brownBg, CATEGORY_COLORS } from '../lib/theme';

const FALLBACK_ILLUSTRATION = require('../assets/images/controversies/roman_fields.png');

type ResolvedInfo = {
  winningResolutionKey: string;
  axisEffects: Record<string, number>;
  factionPowerEffects: Record<string, number>;
};

type Props = {
  controversy: Controversy;
  resolvedInfo: ResolvedInfo;
  factionDisplayNames?: Record<string, string>;
};

function effectLabel(axis: string, change: number): string {
  const labels = AXIS_LABELS[axis as AxisKey];
  if (!labels) return `${axis}: ${change > 0 ? '+' : ''}${change}`;
  return `${labels.negative} vs. ${labels.positive}: ${change > 0 ? '+' : ''}${change}`;
}

export default function ResolvedControversySummary({
  controversy,
  resolvedInfo,
  factionDisplayNames,
}: Props) {
  const catColor = CATEGORY_COLORS[controversy.category] ?? C.gray;
  const illustrationSource = ILLUSTRATION_MAP[controversy.illustration] ?? FALLBACK_ILLUSTRATION;
  const winningResolution = controversy.resolutions.find(
    (r) => r.key === resolvedInfo.winningResolutionKey,
  );

  const axisKeys = Object.keys(resolvedInfo.axisEffects).filter(
    (k) => resolvedInfo.axisEffects[k] !== 0,
  );
  const factionKeys = Object.keys(resolvedInfo.factionPowerEffects).filter(
    (k) => resolvedInfo.factionPowerEffects[k] !== 0 && factionDisplayNames?.[k],
  );

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{controversy.title}</Text>
        <View style={[styles.categoryBadge, { backgroundColor: catColor + '30', borderColor: catColor + '60' }]}>
          <Text style={[styles.categoryText, { color: catColor }]}>
            {CATEGORY_LABELS[controversy.category] ?? controversy.category}
          </Text>
        </View>
      </View>

      {/* Illustration */}
      <Image source={illustrationSource} style={styles.illustration} resizeMode="cover" />

      {/* Flavor text */}
      <Text style={styles.flavor}>{controversy.flavor}</Text>

      {/* Enacted resolution */}
      {winningResolution && (
        <>
          <Text style={styles.enactedLabel}>Enacted Resolution</Text>
          <View style={styles.resolution}>
            <Text style={styles.resolutionTitle}>{winningResolution.title}</Text>
            <Text style={styles.resolutionDesc}>{winningResolution.description}</Text>

            {/* Policy effects as simple text */}
            {axisKeys.length > 0 && (
              <View style={styles.effectsSection}>
                <Text style={styles.effectsSectionLabel}>Policy Effects</Text>
                {axisKeys.map((axis) => {
                  const change = resolvedInfo.axisEffects[axis];
                  return (
                    <Text key={axis} style={[styles.effectText, change > 0 ? styles.effectPositive : styles.effectNegative]}>
                      {effectLabel(axis, change)}
                    </Text>
                  );
                })}
              </View>
            )}

            {/* Faction power effects as simple text */}
            {factionKeys.length > 0 && (
              <View style={styles.effectsSection}>
                <Text style={styles.effectsSectionLabel}>Power Effects</Text>
                {factionKeys.map((fkey) => {
                  const change = resolvedInfo.factionPowerEffects[fkey];
                  const name = factionDisplayNames?.[fkey] ?? fkey;
                  return (
                    <Text key={fkey} style={[styles.effectText, change > 0 ? styles.effectPositive : styles.effectNegative]}>
                      {name}: {change > 0 ? '+' : ''}{change}
                    </Text>
                  );
                })}
              </View>
            )}
          </View>
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
  resolution: {
    backgroundColor: goldBg(0.06),
    borderRadius: 8,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: goldBg(0.4),
    gap: 6,
    marginTop: 6,
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
    gap: 2,
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
  effectText: {
    fontSize: 12,
    paddingLeft: 4,
  },
  effectPositive: {
    color: C.positive,
  },
  effectNegative: {
    color: C.negative,
  },
});
