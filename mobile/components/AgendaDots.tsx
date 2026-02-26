import { View, Text, StyleSheet } from 'react-native';
import { getColorHex } from '../lib/player-colors';

export type PlayerAgendaInfo = {
  playerId: string;
  name: string;
  color: string;
  agenda: Record<string, number>;
};

/**
 * Renders player agenda dots on an axis slider line, with name labels below.
 * Dots at the same position "explode" horizontally; close names are staggered vertically.
 *
 * @param axis - axis key to read from each player's agenda
 * @param playerAgendas - list of players with their agenda values
 * @param clamp - function mapping axis value (-2..2) to 0..100 percentage
 */
export default function AgendaDots({ axis, playerAgendas, clamp }: {
  axis: string;
  playerAgendas: PlayerAgendaInfo[];
  clamp: (v: number) => number;
}) {
  const entries: { pa: PlayerAgendaInfo; pct: number }[] = [];
  for (const pa of playerAgendas) {
    const val = pa.agenda[axis];
    if (val == null) continue;
    entries.push({ pa, pct: clamp(val) });
  }

  if (entries.length === 0) return null;

  // Group by position for horizontal explosion
  const groups = new Map<number, PlayerAgendaInfo[]>();
  for (const { pa, pct } of entries) {
    const list = groups.get(pct) ?? [];
    list.push(pa);
    groups.set(pct, list);
  }
  const dots: { pa: PlayerAgendaInfo; pct: number; offset: number }[] = [];
  for (const [pct, players] of groups) {
    const n = players.length;
    players.forEach((pa, i) => {
      dots.push({ pa, pct, offset: (i - (n - 1) / 2) * 10 });
    });
  }

  // Stagger name labels when close
  const sorted = [...entries].sort((a, b) => a.pct - b.pct);
  const rows: number[] = [];
  let maxRow = 0;
  for (let i = 0; i < sorted.length; i++) {
    let row = 0;
    for (let j = 0; j < i; j++) {
      if (Math.abs(sorted[j].pct - sorted[i].pct) < 12 && rows[j] === row) {
        row++;
      }
    }
    rows.push(row);
    if (row > maxRow) maxRow = row;
  }

  return (
    <>
      {dots.map(({ pa, pct, offset }) => (
        <View key={pa.playerId} style={[styles.dotOnLine, { left: `${pct}%`, marginLeft: -4 + offset }]}>
          <View style={[styles.dot, { backgroundColor: getColorHex(pa.color) }]} />
        </View>
      ))}
      <View style={[styles.labelsRow, { top: '100%', height: 10 + maxRow * 9 }]}>
        {sorted.map(({ pa, pct }, i) => (
          <View key={pa.playerId} style={[styles.labelPositioned, { left: `${pct}%`, top: rows[i] * 9 }]}>
            <Text style={[styles.dotName, { color: getColorHex(pa.color) }]} numberOfLines={1}>
              {pa.name.split(' ')[0]}
            </Text>
          </View>
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  dotOnLine: {
    position: 'absolute',
    top: 3,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.5)',
  },
  labelsRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    marginTop: 2,
  },
  labelPositioned: {
    position: 'absolute',
    transform: [{ translateX: -15 }],
    width: 30,
    alignItems: 'center',
  },
  dotName: {
    fontSize: 7,
    fontWeight: '600',
    textAlign: 'center',
  },
});
