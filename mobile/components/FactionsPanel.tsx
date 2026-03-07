import {
  View, Text, StyleSheet, Pressable, ScrollView, Animated,
  Dimensions, PanResponder,
} from 'react-native';
import { useEffect, useRef, useMemo } from 'react';
import { getColorHex } from '../lib/player-colors';
import { AXIS_KEYS, AXIS_LABELS, AxisKey } from '../lib/game-engine/axes';
import { AxisEffectSlider } from './ControversyCard';
import { C, goldBg, darkBrownBg, blackBg } from '../lib/theme';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PANEL_WIDTH = Math.min(SCREEN_WIDTH * 0.88, 380);

type FactionInfo = {
  key: string;
  displayName: string;
  power: number;
  preferences: Record<string, number>;
};

type PlayerInfo = {
  player_id: string;
  player_name: string;
  color: string;
};

type Affinity = {
  player_id: string;
  faction_id: string;
  affinity: number;
};

type Props = {
  factions: FactionInfo[];
  players: PlayerInfo[];
  affinities: Affinity[];
  factionIdMap: Record<string, string>; // faction UUID → faction_key
  axisValues: Record<string, number>;
  visible: boolean;
  onClose: () => void;
  hideTab?: boolean;
};

/** Horizontal bar with player dots showing affinity for a single faction. Range -5..+5. */
function AffinityBar({ factionKey, players, affinities, factionIdMap }: {
  factionKey: string;
  players: PlayerInfo[];
  affinities: Affinity[];
  factionIdMap: Record<string, string>;
}) {
  // Collect entries for this faction
  const entries: { player: PlayerInfo; pct: number; value: number }[] = [];
  for (const a of affinities) {
    const fk = factionIdMap[a.faction_id];
    if (fk !== factionKey) continue;
    const player = players.find((p) => p.player_id === a.player_id);
    if (!player) continue;
    const pct = Math.max(0, Math.min(100, ((a.affinity + 5) / 10) * 100));
    entries.push({ player, pct, value: a.affinity });
  }

  if (entries.length === 0) return null;

  // Group by position for horizontal explosion
  const groups = new Map<number, typeof entries>();
  for (const e of entries) {
    const rounded = Math.round(e.pct);
    const list = groups.get(rounded) ?? [];
    list.push(e);
    groups.set(rounded, list);
  }
  const dots: { player: PlayerInfo; pct: number; offset: number }[] = [];
  for (const [pct, group] of groups) {
    const n = group.length;
    group.forEach((e, i) => {
      dots.push({ player: e.player, pct, offset: (i - (n - 1) / 2) * 10 });
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

  const NOTCH_POSITIONS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

  return (
    <View style={affinityStyles.container}>
      <Text style={affinityStyles.label}>Affinity</Text>
      <View style={affinityStyles.sliderContainer}>
        <View style={affinityStyles.line}>
          {NOTCH_POSITIONS.map((pct) => (
            <View key={pct} style={[affinityStyles.notch, { left: `${pct}%` }]} />
          ))}
        </View>
        {dots.map(({ player, pct, offset }) => (
          <View key={player.player_id} style={[affinityStyles.dotOnLine, { left: `${pct}%`, marginLeft: -4 + offset }]}>
            <View style={[affinityStyles.dot, { backgroundColor: getColorHex(player.color) }]} />
          </View>
        ))}
        <View style={[affinityStyles.labelsRow, { top: '100%', height: 10 + maxRow * 9 }]}>
          {sorted.map(({ player, pct }, i) => (
            <View key={player.player_id} style={[affinityStyles.labelPositioned, { left: `${pct}%`, top: rows[i] * 9 }]}>
              <Text style={[affinityStyles.dotName, { color: getColorHex(player.color) }]} numberOfLines={1}>
                {player.player_name.split(' ')[0]}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

/** Compute the max label stagger row count for faction dots on a given axis. */
function computeFactionDotsMaxRow(factions: FactionInfo[], axis: string, clamp: (v: number) => number): number {
  const pcts: number[] = [];
  for (const f of factions) {
    const val = f.preferences[axis];
    if (val == null) continue;
    pcts.push(clamp(val));
  }
  if (pcts.length === 0) return 0;
  pcts.sort((a, b) => a - b);
  const rows: number[] = [];
  let maxRow = 0;
  for (let i = 0; i < pcts.length; i++) {
    let row = 0;
    for (let j = 0; j < i; j++) {
      if (Math.abs(pcts[j] - pcts[i]) < 18 && rows[j] === row) row++;
    }
    rows.push(row);
    if (row > maxRow) maxRow = row;
  }
  return maxRow;
}

/** Dots for faction preference positions on a policy axis. */
function FactionDots({ factions, axis, clamp }: {
  factions: FactionInfo[];
  axis: string;
  clamp: (v: number) => number;
}) {
  const entries: { faction: FactionInfo; pct: number }[] = [];
  for (const f of factions) {
    const val = f.preferences[axis];
    if (val == null) continue;
    entries.push({ faction: f, pct: clamp(val) });
  }

  if (entries.length === 0) return null;

  // Group by position for horizontal explosion
  const groups = new Map<number, FactionInfo[]>();
  for (const { faction, pct } of entries) {
    const rounded = Math.round(pct);
    const list = groups.get(rounded) ?? [];
    list.push(faction);
    groups.set(rounded, list);
  }
  const dots: { faction: FactionInfo; pct: number; offset: number }[] = [];
  for (const [pct, group] of groups) {
    const n = group.length;
    group.forEach((f, i) => {
      dots.push({ faction: f, pct, offset: (i - (n - 1) / 2) * 10 });
    });
  }

  // Stagger name labels when close (wider threshold for faction name labels)
  const sorted = [...entries].sort((a, b) => a.pct - b.pct);
  const rows: number[] = [];
  let maxRow = 0;
  for (let i = 0; i < sorted.length; i++) {
    let row = 0;
    for (let j = 0; j < i; j++) {
      if (Math.abs(sorted[j].pct - sorted[i].pct) < 18 && rows[j] === row) {
        row++;
      }
    }
    rows.push(row);
    if (row > maxRow) maxRow = row;
  }

  return (
    <>
      {dots.map(({ faction, pct, offset }) => (
        <View key={faction.key} style={[affinityStyles.dotOnLine, { left: `${pct}%`, marginLeft: -4 + offset }]}>
          <View style={[affinityStyles.dot, { backgroundColor: C.gold }]}>
            <Text style={factionDotStyles.letter}>{faction.displayName[0]}</Text>
          </View>
        </View>
      ))}
      <View style={[affinityStyles.labelsRow, { top: '100%', height: 10 + maxRow * 9 }]}>
        {sorted.map(({ faction, pct }, i) => (
          <View key={faction.key} style={[factionDotStyles.labelPositioned, { left: `${pct}%`, top: rows[i] * 9 }]}>
            <Text style={[affinityStyles.dotName, { color: C.gold }]}>
              {faction.displayName.split(' ')[1] ?? faction.displayName.split(' ')[0]}
            </Text>
          </View>
        ))}
      </View>
    </>
  );
}

export default function FactionsPanel({
  factions,
  players,
  affinities,
  factionIdMap,
  axisValues,
  visible,
  onClose,
  hideTab,
}: Props) {
  const slideAnim = useRef(new Animated.Value(PANEL_WIDTH)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: visible ? 0 : PANEL_WIDTH,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gs) => gs.dx > 10 && Math.abs(gs.dy) < Math.abs(gs.dx),
    onPanResponderMove: (_, gs) => {
      if (gs.dx > 0) slideAnim.setValue(gs.dx);
    },
    onPanResponderRelease: (_, gs) => {
      if (gs.dx > 60 || gs.vx > 0.5) {
        Animated.timing(slideAnim, { toValue: PANEL_WIDTH, duration: 200, useNativeDriver: true }).start(() => onClose());
      } else {
        Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
      }
    },
  }), [onClose]);

  // Sort factions by power descending
  const sortedFactions = [...factions].sort((a, b) => b.power - a.power);

  // Clamp for axis slider: maps -2..+2 to 0..100
  const clamp = (v: number) => Math.max(0, Math.min(100, ((v + 2) / 4) * 100));

  return (
    <>
      {/* Tab trigger */}
      {!hideTab && (
        <Pressable style={styles.tabTrigger} onPress={onClose}>
          <Text style={styles.tabText}>F</Text>
          <Text style={styles.tabText}>A</Text>
          <Text style={styles.tabText}>C</Text>
          <Text style={styles.tabText}>T</Text>
          <Text style={styles.tabText}>I</Text>
          <Text style={styles.tabText}>O</Text>
          <Text style={styles.tabText}>N</Text>
          <Text style={styles.tabText}>S</Text>
        </Pressable>
      )}

      {/* Backdrop */}
      {visible && (
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      )}

      {/* Slide-in panel */}
      <Animated.View
        style={[styles.panel, { transform: [{ translateX: slideAnim }] }]}
        pointerEvents={visible ? 'box-none' : 'none'}
        {...panResponder.panHandlers}
      >
        <View style={styles.panelHeader}>
          <View>
            <Text style={styles.panelTitle}>Factions</Text>
            <Text style={styles.panelSubtitle}>Power & affinities</Text>
          </View>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Faction list */}
          <View style={styles.factionList}>
            {sortedFactions.map((f) => (
              <View key={f.key} style={styles.factionBlock}>
                <View style={styles.factionHeader}>
                  <Text style={styles.factionName}>{f.displayName}</Text>
                  <View style={styles.powerPipsRow}>
                    {Array.from({ length: 5 }, (_, i) => (
                      <View key={i} style={[
                        styles.powerPip,
                        i < f.power && styles.powerPipFilled,
                      ]} />
                    ))}
                  </View>
                </View>
                <AffinityBar
                  factionKey={f.key}
                  players={players}
                  affinities={affinities}
                  factionIdMap={factionIdMap}
                />
              </View>
            ))}
          </View>

          {/* Faction positions on policy axes */}
          <View style={styles.axesSection}>
            <Text style={styles.sectionTitle}>Faction Positions</Text>
            {AXIS_KEYS.map((axis) => {
              const maxRow = computeFactionDotsMaxRow(sortedFactions, axis, clamp);
              const extraHeight = 10 + maxRow * 9;
              return (
                <View key={axis} style={[styles.axisBlock, { marginBottom: 12 + extraHeight }]}>
                  <AxisEffectSlider
                    axis={axis}
                    change={0}
                    currentValue={axisValues[axis] ?? 0}
                  />
                  <View style={styles.factionDotsOverlay}>
                    <FactionDots factions={sortedFactions} axis={axis} clamp={clamp} />
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </Animated.View>
    </>
  );
}

const affinityStyles = StyleSheet.create({
  container: {
    marginTop: 6,
  },
  label: {
    color: C.paleGold,
    fontSize: 9,
    opacity: 0.5,
    marginBottom: 4,
  },
  sliderContainer: {
    height: 14,
    position: 'relative',
    marginBottom: 16,
  },
  line: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 6,
    height: 2,
    backgroundColor: goldBg(0.2),
    borderRadius: 1,
  },
  notch: {
    position: 'absolute',
    top: -2,
    width: 1,
    height: 6,
    backgroundColor: goldBg(0.3),
    marginLeft: -0.5,
  },
  dotOnLine: {
    position: 'absolute',
    top: 3,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: blackBg(0.5),
    alignItems: 'center',
    justifyContent: 'center',
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

const factionDotStyles = StyleSheet.create({
  letter: {
    color: C.black,
    fontSize: 5,
    fontWeight: '800',
    lineHeight: 7,
  },
  labelPositioned: {
    position: 'absolute',
    transform: [{ translateX: -28 }],
    width: 56,
    alignItems: 'center',
  },
});

const styles = StyleSheet.create({
  tabTrigger: {
    position: 'absolute',
    right: -1,
    top: '60%',
    backgroundColor: goldBg(0.15),
    borderWidth: 1,
    borderColor: goldBg(0.4),
    borderRightWidth: 0,
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 3,
    alignItems: 'center',
    zIndex: 10,
  },
  tabText: {
    color: C.gold,
    fontSize: 9,
    fontWeight: '700',
    lineHeight: 11,
  },
  panel: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: PANEL_WIDTH,
    backgroundColor: darkBrownBg(0.97),
    borderLeftWidth: 1,
    borderLeftColor: goldBg(0.4),
    zIndex: 20,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: goldBg(0.2),
  },
  panelTitle: {
    color: C.gold,
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'serif',
  },
  panelSubtitle: {
    color: C.paleGold,
    fontSize: 11,
    opacity: 0.5,
    marginTop: 2,
  },
  closeButton: {
    padding: 4,
  },
  closeText: {
    color: C.paleGold,
    fontSize: 18,
    opacity: 0.6,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 12,
    paddingBottom: 40,
  },
  // Faction list
  factionList: {
    gap: 4,
    marginBottom: 20,
  },
  factionBlock: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: goldBg(0.06),
    borderRadius: 8,
  },
  factionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  factionName: {
    color: C.paleGold,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  powerPipsRow: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  powerPip: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: goldBg(0.4),
  },
  powerPipFilled: {
    backgroundColor: C.gold,
    borderColor: C.gold,
  },
  // Axes section
  axesSection: {
    gap: 4,
  },
  sectionTitle: {
    color: C.gold,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    opacity: 0.8,
  },
  axisBlock: {
    position: 'relative',
    marginBottom: 12,
  },
  factionDotsOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 20,
    height: 14,
  },
});
