import { View, Text, StyleSheet } from 'react-native';
import { getColorHex } from '../lib/player-colors';
import { C } from '../lib/theme';

type PlayerAffinity = {
  playerId: string;
  playerName: string;
  playerColor: string;
  affinity: number;
};

type Props = {
  playerAffinities: PlayerAffinity[];
};

export default function FactionAffinityTab({ playerAffinities }: Props) {
  return (
    <View style={styles.container}>
      {playerAffinities.map((pa) => (
        <View key={pa.playerId} style={styles.row}>
          <View style={[styles.dot, { backgroundColor: getColorHex(pa.playerColor) }]} />
          <Text style={styles.name} numberOfLines={1}>{pa.playerName}</Text>
          <Text style={[
            styles.value,
            pa.affinity > 0 && styles.valuePositive,
            pa.affinity < 0 && styles.valueNegative,
          ]}>
            {pa.affinity > 0 ? `+${pa.affinity}` : pa.affinity.toString()}
          </Text>
        </View>
      ))}
      {playerAffinities.length === 0 && (
        <Text style={styles.empty}>No affinity data</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  name: {
    color: C.parchment,
    fontSize: 12,
    flex: 1,
    opacity: 0.7,
  },
  value: {
    color: C.parchment,
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.6,
    minWidth: 30,
    textAlign: 'right',
  },
  valuePositive: {
    color: '#2E8B57',
    opacity: 1,
  },
  valueNegative: {
    color: C.error,
    opacity: 1,
  },
  empty: {
    color: C.parchment,
    fontSize: 11,
    opacity: 0.3,
    textAlign: 'center',
    paddingVertical: 8,
  },
});
