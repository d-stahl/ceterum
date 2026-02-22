import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Controversy } from '../lib/game-engine/controversies';

type Props = {
  controversy: Controversy;
  activeFactionKeys: string[];   // faction keys present in this game (for filtering power effects)
  isActive?: boolean;            // highlight when this is the current voting controversy
};

const CATEGORY_COLORS: Record<string, string> = {
  military:  '#c0392b',
  social:    '#2980b9',
  economic:  '#c9a84c',
  political: '#8e44ad',
  religious: '#27ae60',
};

function effectSign(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

const AXIS_LABELS: Record<string, string> = {
  centralization: 'Centralization',
  expansion:      'Expansion',
  commerce:       'Commerce',
  patrician:      'Patrician',
  tradition:      'Tradition',
  militarism:     'Militarism',
};

export default function ControversyCard({ controversy, activeFactionKeys, isActive = false }: Props) {
  const catColor = CATEGORY_COLORS[controversy.category] ?? '#888';

  return (
    <View style={[styles.card, isActive && styles.cardActive]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{controversy.title}</Text>
        <View style={[styles.categoryBadge, { backgroundColor: catColor }]}>
          <Text style={styles.categoryText}>{controversy.category}</Text>
        </View>
      </View>

      {/* Flavor text */}
      <Text style={styles.flavor} numberOfLines={3} ellipsizeMode="tail">
        {controversy.flavor}
      </Text>

      {/* Resolutions */}
      <View style={styles.resolutionsSection}>
        {controversy.resolutions.map((r) => {
          const axisKeys = Object.keys(r.axisEffects) as string[];
          const factionKeys = Object.keys(r.factionPowerEffects).filter((k) =>
            activeFactionKeys.includes(k)
          );

          return (
            <View key={r.key} style={styles.resolution}>
              <Text style={styles.resolutionTitle}>{r.title}</Text>
              <Text style={styles.resolutionDesc} numberOfLines={2}>{r.description}</Text>

              {(axisKeys.length > 0 || factionKeys.length > 0) && (
                <View style={styles.tagsRow}>
                  {axisKeys.map((axis) => {
                    const val = r.axisEffects[axis as keyof typeof r.axisEffects] ?? 0;
                    const color = val > 0 ? '#4caf50' : '#e53935';
                    return (
                      <View key={axis} style={[styles.tag, { borderColor: color }]}>
                        <Text style={[styles.tagText, { color }]}>
                          {AXIS_LABELS[axis] ?? axis} {effectSign(val)}
                        </Text>
                      </View>
                    );
                  })}
                  {factionKeys.map((fkey) => {
                    const val = r.factionPowerEffects[fkey] ?? 0;
                    const color = val > 0 ? '#4caf50' : '#e53935';
                    return (
                      <View key={fkey} style={[styles.tag, { borderColor: color }]}>
                        <Text style={[styles.tagText, { color }]}>
                          {fkey} {effectSign(val)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(20,14,5,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.3)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardActive: {
    borderColor: '#c9a84c',
    borderWidth: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 8,
  },
  title: {
    color: '#e8d5a3',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'serif',
    flex: 1,
  },
  categoryBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  categoryText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  flavor: {
    color: '#e8d5a3',
    fontSize: 12,
    fontStyle: 'italic',
    opacity: 0.65,
    marginBottom: 12,
    lineHeight: 17,
  },
  resolutionsSection: {
    gap: 10,
  },
  resolution: {
    backgroundColor: 'rgba(201,168,76,0.06)',
    borderRadius: 8,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: 'rgba(201,168,76,0.4)',
    gap: 4,
  },
  resolutionTitle: {
    color: '#c9a84c',
    fontSize: 13,
    fontWeight: '700',
  },
  resolutionDesc: {
    color: '#e8d5a3',
    fontSize: 12,
    opacity: 0.75,
    lineHeight: 16,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  tag: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
