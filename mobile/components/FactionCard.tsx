import { View, Text, StyleSheet, Pressable } from 'react-native';
import { getColorHex } from '../lib/player-colors';
import { WorkerSelection } from './WorkerSelector';

export type FactionPlacement = {
  playerId: string;
  playerName: string;
  playerColor: string;
  workerType: string;
  oratorRole?: string;
  subRound: number;
};

type Props = {
  factionKey: string;
  displayName: string;
  powerLevel: number;
  placements: FactionPlacement[];
  expanded: boolean;
  onToggle: () => void;
  onPlace: (factionKey: string) => void;
  selectedWorker: WorkerSelection | null;
  currentPlayerId: string;
  myAffinity: number;
};

export default function FactionCard({
  factionKey,
  displayName,
  powerLevel,
  placements,
  expanded,
  onToggle,
  onPlace,
  selectedWorker,
  currentPlayerId,
  myAffinity,
}: Props) {
  const demagogs = placements.filter((p) => p.oratorRole === 'demagog');
  const allies = placements.filter((p) => p.oratorRole === 'ally');
  const agitators = placements.filter((p) => p.oratorRole === 'agitator');
  const promoters = placements.filter((p) => p.workerType === 'promoter');
  const saboteurs = placements.filter((p) => p.workerType === 'saboteur');
  const totalWorkers = placements.length;

  // Power pips
  const powerPips = Array.from({ length: 5 }, (_, i) => i < powerLevel);

  return (
    <View style={styles.card}>
      <Pressable style={styles.header} onPress={onToggle}>
        <View style={styles.headerLeft}>
          <Text style={styles.factionName}>{displayName}</Text>
          <View style={styles.powerRow}>
            {powerPips.map((filled, i) => (
              <View key={i} style={[styles.powerPip, filled && styles.powerPipFilled]} />
            ))}
          </View>
        </View>
        <View style={styles.headerRight}>
          {totalWorkers > 0 && (
            <View style={styles.workerCountBadge}>
              <Text style={styles.workerCountText}>{totalWorkers}</Text>
            </View>
          )}
          <Text style={styles.expandIcon}>{expanded ? '▾' : '▸'}</Text>
        </View>
      </Pressable>

      {expanded && (
        <Pressable
          style={styles.body}
          onPress={() => selectedWorker && onPlace(factionKey)}
        >
          {selectedWorker && (
            <Text style={styles.tapHint}>Tap to place worker here</Text>
          )}

          <View style={styles.grid}>
            <SlotRow label="Demagogs" placements={demagogs} />
            <View style={styles.splitRow}>
              <SlotRow label="Allies" placements={allies} half />
              <SlotRow label="Agitators" placements={agitators} half />
            </View>
            <View style={styles.splitRow}>
              <SlotRow label="Promoters" placements={promoters} half />
              <SlotRow label="Saboteurs" placements={saboteurs} half />
            </View>
          </View>

          <View style={styles.affinityRow}>
            <Text style={styles.affinityLabel}>Your affinity</Text>
            <Text style={[
              styles.affinityValue,
              myAffinity > 0 && styles.affinityPositive,
              myAffinity < 0 && styles.affinityNegative,
            ]}>
              {myAffinity > 0 ? `+${myAffinity}` : myAffinity.toString()}
            </Text>
          </View>
        </Pressable>
      )}
    </View>
  );
}

function SlotRow({ label, placements, half }: { label: string; placements: FactionPlacement[]; half?: boolean }) {
  return (
    <View style={[styles.slotRow, half && styles.slotRowHalf]}>
      <Text style={styles.slotLabel}>{label}</Text>
      <View style={styles.dotsRow}>
        {placements.length === 0 && <Text style={styles.emptySlot}>-</Text>}
        {placements.map((p, i) => (
          <View
            key={i}
            style={[styles.dot, { backgroundColor: getColorHex(p.playerColor) }]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(224, 192, 151, 0.06)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(224, 192, 151, 0.15)',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  factionName: {
    color: '#e0c097',
    fontSize: 16,
    fontWeight: '600',
  },
  powerRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
  },
  powerPip: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(224, 192, 151, 0.4)',
  },
  powerPipFilled: {
    backgroundColor: '#e0c097',
    borderColor: '#e0c097',
  },
  workerCountBadge: {
    backgroundColor: 'rgba(224, 192, 151, 0.2)',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  workerCountText: {
    color: '#e0c097',
    fontSize: 12,
    fontWeight: '600',
  },
  expandIcon: {
    color: '#e0c097',
    fontSize: 14,
    opacity: 0.5,
  },
  body: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(224, 192, 151, 0.1)',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  tapHint: {
    color: '#e0c097',
    fontSize: 11,
    opacity: 0.5,
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  grid: {
    gap: 6,
  },
  slotRow: {
    backgroundColor: 'rgba(224, 192, 151, 0.04)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  slotRowHalf: {
    flex: 1,
  },
  splitRow: {
    flexDirection: 'row',
    gap: 6,
  },
  slotLabel: {
    color: '#e0c097',
    fontSize: 11,
    opacity: 0.5,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  emptySlot: {
    color: '#e0c097',
    opacity: 0.2,
    fontSize: 12,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  affinityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(224, 192, 151, 0.08)',
  },
  affinityLabel: {
    color: '#e0c097',
    fontSize: 11,
    opacity: 0.4,
  },
  affinityValue: {
    color: '#e0c097',
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.6,
  },
  affinityPositive: {
    color: '#2E8B57',
    opacity: 1,
  },
  affinityNegative: {
    color: '#ff6b6b',
    opacity: 1,
  },
});
