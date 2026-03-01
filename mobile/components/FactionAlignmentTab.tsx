import { View, Text, StyleSheet } from 'react-native';
import { AXIS_KEYS, AXIS_LABELS, AxisKey, AxisPreferences } from '../lib/game-engine/axes';
import { C, parchmentBg } from '../lib/theme';
import AgendaDots, { PlayerAgendaInfo } from './AgendaDots';

type Props = {
  factionPreferences: AxisPreferences | null;
  playerAgendas?: PlayerAgendaInfo[];
};

export default function FactionAlignmentTab({ factionPreferences, playerAgendas }: Props) {
  if (!factionPreferences) {
    return <Text style={styles.empty}>No alignment data</Text>;
  }

  return (
    <View style={styles.container}>
      {AXIS_KEYS.map((axis) => (
        <AxisRow
          key={axis}
          axis={axis}
          value={factionPreferences[axis]}
          playerAgendas={playerAgendas}
        />
      ))}
    </View>
  );
}

const NOTCH_POSITIONS = [0, 25, 50, 75, 100];

const clamp = (v: number) => Math.max(0, Math.min(100, ((v + 2) / 4) * 100));

function AxisRow({ axis, value, playerAgendas }: { axis: AxisKey; value: number; playerAgendas?: PlayerAgendaInfo[] }) {
  const labels = AXIS_LABELS[axis];
  const position = clamp(value);

  // Extra bottom margin when agenda dots + labels are present
  const hasAgendas = playerAgendas && playerAgendas.some((pa) => pa.agenda[axis] != null);

  return (
    <View style={[styles.axisContainer, hasAgendas && { marginBottom: 12 }]}>
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
        {playerAgendas && playerAgendas.length > 0 && (
          <AgendaDots axis={axis} playerAgendas={playerAgendas} clamp={clamp} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  empty: {
    color: C.parchment,
    fontSize: 11,
    opacity: 0.3,
    textAlign: 'center',
    paddingVertical: 8,
  },
  axisContainer: {
    gap: 8,
  },
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
});
