import { View, Text, StyleSheet } from 'react-native';
import { AXIS_KEYS, AXIS_LABELS, AxisKey, AxisPreferences } from '../lib/game-engine/axes';

type Props = {
  factionPreferences: AxisPreferences | null;
};

export default function FactionAlignmentTab({ factionPreferences }: Props) {
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
        />
      ))}
    </View>
  );
}

const NOTCH_POSITIONS = [0, 25, 50, 75, 100];

function AxisRow({ axis, value }: { axis: AxisKey; value: number }) {
  const labels = AXIS_LABELS[axis];
  // value ranges from -2 to 2, map to 0-100% position
  const position = ((value + 2) / 4) * 100;

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

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  empty: {
    color: '#e0c097',
    fontSize: 11,
    opacity: 0.3,
    textAlign: 'center',
    paddingVertical: 8,
  },
  axisContainer: {
    gap: 8,
  },
  axisName: {
    color: '#e0c097',
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
    backgroundColor: 'rgba(224, 192, 151, 0.2)',
    borderRadius: 1,
  },
  notch: {
    position: 'absolute',
    top: -3,
    width: 1,
    height: 8,
    backgroundColor: 'rgba(224, 192, 151, 0.3)',
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
    borderTopColor: '#DAA520',
  },
});
