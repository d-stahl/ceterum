import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { AXIS_KEYS, AXIS_LABELS, AxisKey } from '../lib/game-engine/axes';
import { C, goldBg, parchmentBg } from '../lib/theme';

type AxisState = {
  axis_key: string;
  current_value: number;
};

type PlayerInfluence = {
  player_id: string;
  player_name: string;
  color: string;
  influenceBefore: number;
  influenceAfter: number;
};

type FactionPower = {
  faction_key: string;
  display_name: string;
  power_level: number;
  change: number; // power change during this round (0 if unknown)
};

type Props = {
  roundNumber: number;
  isGameOver: boolean;
  playerInfluences: PlayerInfluence[];
  axes: AxisState[];
  factionPowers: FactionPower[];
  onContinue: () => void;
};

const NOTCH_POSITIONS = [0, 25, 50, 75, 100];
const clamp = (v: number) => Math.max(0, Math.min(100, ((v + 2) / 4) * 100));

function AxisSlider({ axis, value }: { axis: AxisKey; value: number }) {
  const labels = AXIS_LABELS[axis];
  const position = clamp(value);

  return (
    <View style={styles.axisContainer}>
      <Text style={styles.axisName}>{labels.negative} — {labels.positive}</Text>
      <View style={styles.axisLineContainer}>
        <View style={styles.axisLine}>
          {NOTCH_POSITIONS.map((pct) => (
            <View key={pct} style={[styles.notch, { left: `${pct}%` }]} />
          ))}
        </View>
        <View style={[styles.marker, { left: `${position}%` }]}>
          <View style={styles.markerTriangle} />
        </View>
      </View>
    </View>
  );
}

function PowerPips({ level }: { level: number }) {
  return (
    <View style={styles.pipRow}>
      {Array.from({ length: 5 }, (_, i) => (
        <View
          key={i}
          style={[styles.pip, i < level && styles.pipFilled]}
        />
      ))}
    </View>
  );
}

export default function RoundEndSummary({
  roundNumber,
  isGameOver,
  playerInfluences,
  axes,
  factionPowers,
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

        {/* Faction powers */}
        {factionPowers.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Faction Powers</Text>
            <View style={styles.factionList}>
              {factionPowers.map((f) => (
                <View key={f.faction_key} style={styles.factionRow}>
                  <View style={styles.factionNameRow}>
                    <Text style={styles.factionName}>{f.display_name}</Text>
                    {f.change !== 0 && (
                      <Text style={[styles.factionChange, f.change > 0 ? styles.positive : styles.negative]}>
                        ({f.change > 0 ? `+${f.change}` : f.change})
                      </Text>
                    )}
                  </View>
                  <PowerPips level={f.power_level} />
                </View>
              ))}
            </View>
          </>
        )}

        {/* Influence summary */}
        <Text style={styles.sectionTitle}>Influence Carried Over</Text>
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
        <Text style={styles.sectionTitle}>Senate Positions</Text>
        <View style={styles.axesList}>
          {AXIS_KEYS.map((axis) => {
            const axisState = axes.find((a) => a.axis_key === axis);
            const value = axisState?.current_value ?? 0;
            return <AxisSlider key={axis} axis={axis} value={value} />;
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
    color: C.gold,
    fontSize: 26,
    fontWeight: '700',
    fontFamily: 'serif',
    textAlign: 'center',
    marginTop: 12,
  },
  gameOverBanner: {
    backgroundColor: goldBg(0.12),
    borderWidth: 1,
    borderColor: C.gold,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  gameOverText: {
    color: C.gold,
    fontSize: 16,
    fontStyle: 'italic',
  },
  sectionTitle: {
    color: C.gold,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionNote: {
    color: C.paleGold,
    fontSize: 12,
    opacity: 0.5,
    marginTop: -10,
  },
  // Faction powers
  factionList: { gap: 8 },
  factionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  factionNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  factionName: { color: C.paleGold, fontSize: 14 },
  factionChange: { fontSize: 13, fontWeight: '700' },
  positive: { color: C.positive },
  negative: { color: C.negative },
  pipRow: { flexDirection: 'row', gap: 4 },
  pip: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: parchmentBg(0.4),
  },
  pipFilled: {
    backgroundColor: C.parchment,
    borderColor: C.parchment,
  },
  // Influence
  influenceTable: { gap: 8 },
  influenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  colorDot: { width: 12, height: 12, borderRadius: 6 },
  playerName: { color: C.paleGold, fontSize: 14, flex: 1 },
  influenceBefore: {
    color: C.paleGold,
    fontSize: 14,
    opacity: 0.5,
    minWidth: 28,
    textAlign: 'right',
  },
  arrow: { color: C.gold, fontSize: 14, opacity: 0.6 },
  influenceAfter: {
    color: C.gold,
    fontSize: 15,
    fontWeight: '700',
    minWidth: 28,
    textAlign: 'right',
  },
  // Axis sliders (same pattern as FactionAlignmentTab)
  axesList: { gap: 12 },
  axisContainer: { gap: 4 },
  axisName: {
    color: C.parchment,
    fontSize: 10,
    opacity: 0.5,
    textAlign: 'center',
  },
  axisLineContainer: {
    height: 16,
    position: 'relative',
    marginHorizontal: 8,
  },
  axisLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 7,
    height: 2,
    backgroundColor: parchmentBg(0.2),
    borderRadius: 1,
  },
  notch: {
    position: 'absolute',
    top: -3,
    width: 1,
    height: 8,
    backgroundColor: parchmentBg(0.3),
    marginLeft: -0.5,
  },
  marker: {
    position: 'absolute',
    top: 0,
    marginLeft: -5,
    alignItems: 'center',
  },
  markerTriangle: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: C.accentGold,
  },
  decayNote: {
    color: C.paleGold,
    fontSize: 12,
    opacity: 0.45,
    textAlign: 'center',
    lineHeight: 17,
  },
  continueButton: {
    backgroundColor: C.gold,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  continueButtonText: {
    color: C.darkText,
    fontSize: 16,
    fontWeight: '700',
  },
});
