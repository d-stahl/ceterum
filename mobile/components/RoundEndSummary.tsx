import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';

type AxisState = {
  axis_key: string;
  current_value: number;
};

type PlayerInfluence = {
  player_id: string;
  player_name: string;
  color: string;
  influenceBefore: number;   // before halving
  influenceAfter: number;    // after halving (ceil)
};

type Props = {
  roundNumber: number;
  isGameOver: boolean;
  playerInfluences: PlayerInfluence[];
  axes: AxisState[];
  onContinue: () => void;   // pure UI: dismisses overlay
};

const AXIS_LABELS: Record<string, string> = {
  centralization: 'Centralization',
  expansion:      'Expansion',
  commerce:       'Commerce',
  patrician:      'Patrician',
  tradition:      'Tradition',
  militarism:     'Militarism',
};

function axisBarColor(value: number): string {
  if (value > 0) return '#4caf50';
  if (value < 0) return '#e53935';
  return '#888';
}

export default function RoundEndSummary({
  roundNumber,
  isGameOver,
  playerInfluences,
  axes,
  onContinue,
}: Props) {
  return (
    <View style={styles.overlay}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Round {roundNumber} Complete</Text>

        {isGameOver && (
          <View style={styles.gameOverBanner}>
            <Text style={styles.gameOverText}>The Senate has concluded its work.</Text>
          </View>
        )}

        {/* Influence summary */}
        <Text style={styles.sectionTitle}>Influence After Halving</Text>
        <Text style={styles.sectionNote}>Unspent influence is halved at the end of each round.</Text>
        <View style={styles.influenceTable}>
          {playerInfluences.map((p) => (
            <View key={p.player_id} style={styles.influenceRow}>
              <View style={[styles.colorDot, { backgroundColor: p.color }]} />
              <Text style={styles.playerName}>{p.player_name}</Text>
              <Text style={styles.influenceBefore}>{p.influenceBefore}</Text>
              <Text style={styles.arrow}>→</Text>
              <Text style={styles.influenceAfter}>{p.influenceAfter}</Text>
            </View>
          ))}
        </View>

        {/* Axis positions */}
        <Text style={styles.sectionTitle}>Current Senate Positions</Text>
        <View style={styles.axesList}>
          {axes.map((a) => {
            const color = axisBarColor(a.current_value);
            const barWidth = Math.abs(a.current_value) * 16;
            return (
              <View key={a.axis_key} style={styles.axisRow}>
                <Text style={styles.axisLabel}>{AXIS_LABELS[a.axis_key] ?? a.axis_key}</Text>
                <View style={styles.axisBar}>
                  <View style={styles.axisBarCenter} />
                  <View
                    style={[
                      styles.axisBarFill,
                      {
                        width: barWidth,
                        backgroundColor: color,
                        [a.current_value >= 0 ? 'left' : 'right']: '50%',
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.axisValue, { color }]}>
                  {a.current_value > 0 ? `+${a.current_value}` : a.current_value}
                </Text>
              </View>
            );
          })}
        </View>

        <Text style={styles.decayNote}>
          All faction affinities have decayed by 1 toward neutral.
        </Text>

        <Pressable style={styles.continueButton} onPress={onContinue}>
          <Text style={styles.continueButtonText}>
            {isGameOver ? 'View Final Results' : `Begin Round ${roundNumber + 1} →`}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8,5,2,0.97)',
    zIndex: 30,
  },
  container: { flex: 1 },
  content: { padding: 24, paddingBottom: 60, gap: 16 },
  title: {
    color: '#c9a84c',
    fontSize: 26,
    fontWeight: '700',
    fontFamily: 'serif',
    textAlign: 'center',
    marginTop: 12,
  },
  gameOverBanner: {
    backgroundColor: 'rgba(201,168,76,0.12)',
    borderWidth: 1,
    borderColor: '#c9a84c',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  gameOverText: {
    color: '#c9a84c',
    fontSize: 16,
    fontStyle: 'italic',
  },
  sectionTitle: {
    color: '#c9a84c',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionNote: {
    color: '#e8d5a3',
    fontSize: 12,
    opacity: 0.5,
    marginTop: -10,
  },
  influenceTable: { gap: 8 },
  influenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  colorDot: { width: 12, height: 12, borderRadius: 6 },
  playerName: { color: '#e8d5a3', fontSize: 14, flex: 1 },
  influenceBefore: {
    color: '#e8d5a3',
    fontSize: 14,
    opacity: 0.5,
    minWidth: 28,
    textAlign: 'right',
  },
  arrow: { color: '#c9a84c', fontSize: 14, opacity: 0.6 },
  influenceAfter: {
    color: '#c9a84c',
    fontSize: 15,
    fontWeight: '700',
    minWidth: 28,
    textAlign: 'right',
  },
  axesList: { gap: 10 },
  axisRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  axisLabel: { color: '#e8d5a3', fontSize: 12, width: 110 },
  axisBar: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  axisBarCenter: {
    position: 'absolute',
    left: '50%',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  axisBarFill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRadius: 4,
  },
  axisValue: {
    fontSize: 13,
    fontWeight: '700',
    minWidth: 28,
    textAlign: 'right',
  },
  decayNote: {
    color: '#e8d5a3',
    fontSize: 12,
    opacity: 0.45,
    textAlign: 'center',
    lineHeight: 17,
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
