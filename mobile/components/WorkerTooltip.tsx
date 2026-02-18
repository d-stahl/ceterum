import React from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions } from 'react-native';
import { WorkerEffect } from '../lib/game-engine/demagogery';
import { getColorHex } from '../lib/player-colors';

const SCREEN_WIDTH = Dimensions.get('window').width;
const TOOLTIP_WIDTH = 240;
const TOOLTIP_MARGIN = 12;

type Props = {
  effect: WorkerEffect;
  playerName: string;
  playerColor: string;
  factionName: string;
  position: { x: number; y: number };
  onDismiss: () => void;
};

function getRoleLabel(effect: WorkerEffect): string {
  if (effect.workerType === 'promoter') return 'Promoter';
  if (effect.workerType === 'saboteur') return 'Saboteur';
  if (effect.oratorRole === 'demagog') return 'Demagog';
  if (effect.oratorRole === 'ally') return 'Ally';
  if (effect.oratorRole === 'agitator') return 'Agitator';
  return 'Senator';
}

export default function WorkerTooltip({
  effect,
  playerName,
  playerColor,
  factionName,
  position,
  onDismiss,
}: Props) {
  const colorHex = getColorHex(playerColor);
  const roleLabel = getRoleLabel(effect);

  // Position tooltip above the tapped icon, clamped to screen edges
  let left = position.x - TOOLTIP_WIDTH / 2;
  left = Math.max(TOOLTIP_MARGIN, Math.min(left, SCREEN_WIDTH - TOOLTIP_WIDTH - TOOLTIP_MARGIN));
  const top = position.y - 16; // anchor above the icon

  const hasTotalLine = effect.totalInfluence > 0 || effect.totalPowerChange !== 0;
  const totalLabel = effect.totalPowerChange !== 0
    ? `= Power ${effect.totalPowerChange > 0 ? '+' : ''}${effect.totalPowerChange}`
    : `= ${effect.totalInfluence} influence`;

  return (
    <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss}>
      <View style={[styles.tooltip, { left, bottom: Dimensions.get('window').height - top }]}>
        <View style={styles.header}>
          <View style={[styles.colorDot, { backgroundColor: colorHex }]} />
          <Text style={[styles.playerName, { color: colorHex }]} numberOfLines={1}>
            {playerName}
          </Text>
          <Text style={styles.roleLabel}>{roleLabel}</Text>
        </View>
        <Text style={styles.factionName}>{factionName}</Text>

        <View style={styles.divider} />

        {effect.lineItems.map((item, i) => (
          <View key={i} style={styles.lineItemRow}>
            <Text style={styles.lineItemLabel} numberOfLines={1}>{item.label}</Text>
            <Text style={[
              styles.lineItemValue,
              item.value < 0 && styles.negativeValue,
              item.value > 0 && item.displayValue.startsWith('+') && styles.positiveValue,
            ]}>
              {item.displayValue}
            </Text>
          </View>
        ))}

        {hasTotalLine && (
          <>
            <View style={styles.totalDivider} />
            <Text style={styles.totalLine}>{totalLabel}</Text>
          </>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tooltip: {
    position: 'absolute',
    width: TOOLTIP_WIDTH,
    backgroundColor: 'rgba(20, 20, 36, 0.95)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(224, 192, 151, 0.4)',
    padding: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  playerName: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  roleLabel: {
    fontSize: 11,
    color: '#e0c097',
    opacity: 0.7,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  factionName: {
    fontSize: 11,
    color: '#e0c097',
    opacity: 0.5,
    marginBottom: 4,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(224, 192, 151, 0.15)',
    marginVertical: 6,
  },
  lineItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  lineItemLabel: {
    fontSize: 12,
    color: '#c4a882',
    flex: 1,
    marginRight: 8,
  },
  lineItemValue: {
    fontSize: 12,
    color: '#e0c097',
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  positiveValue: {
    color: '#6ec87a',
  },
  negativeValue: {
    color: '#e07070',
  },
  totalDivider: {
    height: 1,
    backgroundColor: 'rgba(224, 192, 151, 0.25)',
    marginTop: 6,
    marginBottom: 4,
  },
  totalLine: {
    fontSize: 13,
    color: '#e0c097',
    fontWeight: '700',
    textAlign: 'right',
  },
});
