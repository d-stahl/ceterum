import {
  View, Text, StyleSheet, Pressable, ScrollView, Animated,
  Dimensions, PanResponder,
} from 'react-native';
import { useEffect, useRef, useMemo } from 'react';
import { getColorHex } from '../lib/player-colors';
import { AXIS_KEYS } from '../lib/game-engine/axes';
import { C, goldBg, darkBrownBg } from '../lib/theme';
import { PlayerAgendaInfo } from './AgendaDots';
import { AxisEffectSlider } from './ControversyCard';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PANEL_WIDTH = Math.min(SCREEN_WIDTH * 0.88, 380);

type PlayerInfo = {
  player_id: string;
  player_name: string;
  color: string;
};

type PlayerState = {
  player_id: string;
  influence: number;
};

type Props = {
  players: PlayerInfo[];
  playerStates: PlayerState[];
  playerAgendas: PlayerAgendaInfo[];
  axes: Record<string, number>;
  currentUserId: string;
  visible: boolean;
  onClose: () => void;
};

export default function PlayersPanel({
  players,
  playerStates,
  playerAgendas,
  axes,
  currentUserId,
  visible,
  onClose,
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

  // Sort players by influence desc
  const sortedPlayers = [...players].sort((a, b) => {
    const infA = playerStates.find((ps) => ps.player_id === a.player_id)?.influence ?? 0;
    const infB = playerStates.find((ps) => ps.player_id === b.player_id)?.influence ?? 0;
    return infB - infA;
  });

  return (
    <>
      {/* Tab trigger */}
      <Pressable style={styles.tabTrigger} onPress={onClose}>
        <Text style={styles.tabText}>P</Text>
        <Text style={styles.tabText}>L</Text>
        <Text style={styles.tabText}>A</Text>
        <Text style={styles.tabText}>Y</Text>
        <Text style={styles.tabText}>E</Text>
        <Text style={styles.tabText}>R</Text>
        <Text style={styles.tabText}>S</Text>
      </Pressable>

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
            <Text style={styles.panelTitle}>Players</Text>
            <Text style={styles.panelSubtitle}>Influence & agendas</Text>
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
          {/* Player list */}
          <View style={styles.playerList}>
            {sortedPlayers.map((p) => {
              const inf = playerStates.find((ps) => ps.player_id === p.player_id)?.influence ?? 0;
              return (
                <View key={p.player_id} style={styles.playerRow}>
                  <View style={[styles.colorDot, { backgroundColor: getColorHex(p.color) }]} />
                  <Text style={styles.playerName}>
                    {p.player_name}{p.player_id === currentUserId ? <Text style={styles.youLabel}> (You)</Text> : null}
                  </Text>
                  <View style={styles.influenceBadge}>
                    <Text style={styles.influenceText}>{inf}</Text>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Agenda sliders */}
          {playerAgendas.length > 0 && (
            <View style={styles.agendasSection}>
              <Text style={styles.sectionTitle}>Agenda Positions</Text>
              {AXIS_KEYS.map((axis) => (
                <AxisEffectSlider
                  key={axis}
                  axis={axis}
                  change={0}
                  currentValue={axes[axis] ?? 0}
                  playerAgendas={playerAgendas}
                />
              ))}
            </View>
          )}
        </ScrollView>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  tabTrigger: {
    position: 'absolute',
    right: -1,
    top: '50%',
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
  // Player list
  playerList: {
    gap: 8,
    marginBottom: 20,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: goldBg(0.06),
    borderRadius: 8,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  playerName: {
    color: C.paleGold,
    fontSize: 14,
    flex: 1,
  },
  youLabel: {
    opacity: 0.5,
    fontSize: 12,
  },
  influenceBadge: {
    backgroundColor: goldBg(0.2),
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  influenceText: {
    color: C.gold,
    fontSize: 12,
    fontWeight: '700',
  },
  // Agendas section
  agendasSection: {
    gap: 4,
  },
  sectionTitle: {
    color: C.gold,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    opacity: 0.8,
  },
});
