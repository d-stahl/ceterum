import { View, Text, StyleSheet } from 'react-native';
import type { Controversy } from '../lib/game-engine/controversies';
import { C, goldBg, CONTROVERSY_TYPE_COLORS, CONTROVERSY_TYPE_LABELS } from '../lib/theme';

type Props = {
  controversy: Controversy;
  /** Show flavor text below title+badge. Defaults to true. */
  showFlavor?: boolean;
};

export default function ControversyHeader({ controversy, showFlavor = true }: Props) {
  const typeColor = CONTROVERSY_TYPE_COLORS[controversy.type] ?? C.gray;
  const typeLabel = CONTROVERSY_TYPE_LABELS[controversy.type] ?? controversy.type;

  return (
    <View style={styles.wrapper}>
      <Text style={styles.title}>{controversy.title}</Text>
      <View style={[styles.typeBadge, { backgroundColor: typeColor + '30', borderColor: typeColor + '60' }]}>
        <Text style={[styles.typeBadgeText, { color: typeColor }]}>{typeLabel}</Text>
      </View>
      {showFlavor && (
        <Text style={styles.flavor}>{controversy.flavor}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    gap: 6,
  },
  title: {
    color: C.gold,
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'serif',
    textAlign: 'center',
  },
  typeBadge: {
    borderRadius: 4,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  flavor: {
    color: C.paleGold,
    fontSize: 13,
    fontStyle: 'italic',
    opacity: 0.6,
    lineHeight: 18,
    textAlign: 'center',
  },
});
