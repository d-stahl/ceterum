import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';

type VoteRow = {
  playerId: string;
  playerName: string;
  playerColor: string;
  resolutionKey: string;
  influenceSpent: number;
};

type Resolution = {
  key: string;
  title: string;
};

type Props = {
  controversyTitle: string;
  resolutions: Resolution[];
  resolutionTotals: Record<string, number>;     // resolutionKey -> total
  winningResolutionKey: string;
  senateLeaderDeclaration: string;
  senateLeaderBonus: number;                     // totalPlayers - 1
  votes: VoteRow[];
  axisEffects: Partial<Record<string, number>>;
  factionPowerEffects: Partial<Record<string, number>>;
  affinityMalus: Record<string, number>;        // factionKey -> malus for current player
  onContinue: () => void;
};

const AXIS_LABELS: Record<string, string> = {
  centralization: 'Centralization',
  expansion:      'Expansion',
  commerce:       'Commerce',
  patrician:      'Patrician',
  tradition:      'Tradition',
  militarism:     'Militarism',
};

function effectSign(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

export default function ResolutionOutcome({
  controversyTitle,
  resolutions,
  resolutionTotals,
  winningResolutionKey,
  senateLeaderDeclaration,
  senateLeaderBonus,
  votes,
  axisEffects,
  factionPowerEffects,
  affinityMalus,
  onContinue,
}: Props) {
  const winningResolution = resolutions.find((r) => r.key === winningResolutionKey);
  const axisEntries = Object.entries(axisEffects).filter(([, v]) => v && v !== 0);
  const powerEntries = Object.entries(factionPowerEffects).filter(([, v]) => v && v !== 0);
  const malusEntries = Object.entries(affinityMalus).filter(([, v]) => v < 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.controversyTitle}>{controversyTitle}</Text>
      <Text style={styles.outcomeHeader}>Resolution</Text>

      {/* Winner */}
      <View style={styles.winnerCard}>
        <Text style={styles.winnerLabel}>PASSED</Text>
        <Text style={styles.winnerTitle}>{winningResolution?.title ?? winningResolutionKey}</Text>
      </View>

      {/* Vote breakdown */}
      <Text style={styles.sectionTitle}>Vote Breakdown</Text>
      <View style={styles.breakdownTable}>
        {resolutions.map((r) => {
          const total = resolutionTotals[r.key] ?? 0;
          const isWinner = r.key === winningResolutionKey;
          const isSLDeclaration = r.key === senateLeaderDeclaration;
          const baseTotal = total - (isSLDeclaration ? senateLeaderBonus : 0);
          return (
            <View key={r.key} style={[styles.breakdownRow, isWinner && styles.breakdownRowWinner]}>
              <Text style={[styles.breakdownTitle, isWinner && { color: '#c9a84c' }]}>
                {r.title}
              </Text>
              <View style={styles.breakdownTotals}>
                {isSLDeclaration && senateLeaderBonus > 0 && (
                  <Text style={styles.slBonusText}>+{senateLeaderBonus} SL</Text>
                )}
                <Text style={[styles.breakdownTotal, isWinner && { color: '#c9a84c', fontWeight: '700' }]}>
                  {total}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* Per-player votes */}
      <Text style={styles.sectionTitle}>Individual Votes</Text>
      <View style={styles.voteList}>
        {votes.map((v) => {
          const res = resolutions.find((r) => r.key === v.resolutionKey);
          return (
            <View key={v.playerId} style={styles.voteRow}>
              <View style={[styles.colorDot, { backgroundColor: v.playerColor }]} />
              <Text style={styles.voterName}>{v.playerName}</Text>
              <Text style={styles.votedFor}>{res?.title ?? v.resolutionKey}</Text>
              <Text style={styles.voteInfluence}>{v.influenceSpent > 0 ? `${v.influenceSpent}` : '—'}</Text>
            </View>
          );
        })}
      </View>

      {/* Axis effects */}
      {axisEntries.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Axis Shifts</Text>
          <View style={styles.effectsList}>
            {axisEntries.map(([axis, shift]) => {
              const positive = (shift ?? 0) > 0;
              return (
                <View key={axis} style={styles.effectRow}>
                  <Text style={styles.effectLabel}>{AXIS_LABELS[axis] ?? axis}</Text>
                  <Text style={[styles.effectValue, positive ? styles.positive : styles.negative]}>
                    {effectSign(shift ?? 0)}
                  </Text>
                </View>
              );
            })}
          </View>
        </>
      )}

      {/* Faction power effects */}
      {powerEntries.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Faction Power Changes</Text>
          <View style={styles.effectsList}>
            {powerEntries.map(([fkey, change]) => {
              const positive = (change ?? 0) > 0;
              return (
                <View key={fkey} style={styles.effectRow}>
                  <Text style={styles.effectLabel}>{fkey}</Text>
                  <Text style={[styles.effectValue, positive ? styles.positive : styles.negative]}>
                    {effectSign(change ?? 0)}
                  </Text>
                </View>
              );
            })}
          </View>
        </>
      )}

      {/* Affinity malus for current player */}
      {malusEntries.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Your Affinity Impact</Text>
          <View style={styles.effectsList}>
            {malusEntries.map(([fkey, malus]) => (
              <View key={fkey} style={styles.effectRow}>
                <Text style={styles.effectLabel}>{fkey}</Text>
                <Text style={[styles.effectValue, styles.negative]}>{malus}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.malusNote}>
            You supported the winning resolution which upset these factions.
          </Text>
        </>
      )}

      <Pressable style={styles.continueButton} onPress={onContinue}>
        <Text style={styles.continueButtonText}>Continue →</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 60, gap: 14 },
  controversyTitle: {
    color: '#c9a84c',
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'serif',
    textAlign: 'center',
  },
  outcomeHeader: {
    color: '#e8d5a3',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    textAlign: 'center',
    opacity: 0.5,
    marginTop: -8,
  },
  winnerCard: {
    backgroundColor: 'rgba(201,168,76,0.15)',
    borderWidth: 1.5,
    borderColor: '#c9a84c',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    gap: 4,
  },
  winnerLabel: {
    color: '#c9a84c',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
  },
  winnerTitle: {
    color: '#e8d5a3',
    fontSize: 18,
    fontWeight: '700',
  },
  sectionTitle: {
    color: '#c9a84c',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  breakdownTable: { gap: 4 },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  breakdownRowWinner: {
    backgroundColor: 'rgba(201,168,76,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.4)',
  },
  breakdownTitle: { color: '#e8d5a3', fontSize: 13, flex: 1 },
  breakdownTotals: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  slBonusText: { color: '#c9a84c', fontSize: 11, opacity: 0.7 },
  breakdownTotal: { color: '#e8d5a3', fontSize: 14, minWidth: 28, textAlign: 'right' },
  voteList: { gap: 4 },
  voteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  colorDot: { width: 12, height: 12, borderRadius: 6 },
  voterName: { color: '#e8d5a3', fontSize: 13, width: 100 },
  votedFor: { color: '#e8d5a3', fontSize: 12, flex: 1, opacity: 0.7 },
  voteInfluence: { color: '#c9a84c', fontSize: 13, fontWeight: '700', minWidth: 28, textAlign: 'right' },
  effectsList: { gap: 4 },
  effectRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  effectLabel: { color: '#e8d5a3', fontSize: 13 },
  effectValue: { fontSize: 14, fontWeight: '700' },
  positive: { color: '#4caf50' },
  negative: { color: '#e53935' },
  malusNote: {
    color: '#e8d5a3',
    fontSize: 12,
    opacity: 0.5,
    marginTop: -8,
  },
  continueButton: {
    backgroundColor: '#c9a84c',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  continueButtonText: {
    color: '#1a1209',
    fontSize: 16,
    fontWeight: '700',
  },
});
