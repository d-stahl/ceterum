import {
  View, Text, StyleSheet, Pressable, ScrollView, Animated,
  Dimensions, PanResponder,
} from 'react-native';
import { useEffect, useRef, useMemo, useState } from 'react';
import { getColorHex } from '../lib/player-colors';
import { AXIS_KEYS, AXIS_LABELS, AxisKey, computeAxisScore } from '../lib/game-engine/axes';
import { C, goldBg, darkBrownBg } from '../lib/theme';
import { CONTROVERSY_MAP } from '../lib/game-engine/controversies';
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
  victory_points: number;
};

type OutcomeRow = {
  controversy_key: string;
  controversy_type: string;
  type_data: any;
};

type Props = {
  players: PlayerInfo[];
  playerStates: PlayerState[];
  playerAgendas: PlayerAgendaInfo[];
  axes: Record<string, number>;
  currentUserId: string;
  visible: boolean;
  onClose: () => void;
  hideTab?: boolean;
  allOutcomes?: OutcomeRow[];
};

export default function PlayersPanel({
  players,
  playerStates,
  playerAgendas,
  axes,
  currentUserId,
  visible,
  onClose,
  hideTab,
  allOutcomes = [],
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

  const [showPolicyDetail, setShowPolicyDetail] = useState(false);
  const [showResolutionDetail, setShowResolutionDetail] = useState(false);

  // Compute scores
  const agendaScores: Record<string, number> = {};
  const perAxisScores: Record<string, Record<string, number>> = {};
  for (const pa of playerAgendas) {
    let total = 0;
    const perAxis: Record<string, number> = {};
    for (const axis of AXIS_KEYS) {
      const agendaPos = pa.agenda[axis];
      if (agendaPos == null) continue;
      const score = computeAxisScore(axes[axis] ?? 0, agendaPos);
      perAxis[axis] = score;
      total += score;
    }
    agendaScores[pa.playerId] = total;
    perAxisScores[pa.playerId] = perAxis;
  }

  const resolutionVPs: Record<string, number> = {};
  for (const oc of allOutcomes) {
    const td = oc.type_data;
    if (!td) continue;
    if (oc.controversy_type === 'clash' && td.succeeded && td.victoryPoints) {
      for (const ps of playerStates) {
        resolutionVPs[ps.player_id] = (resolutionVPs[ps.player_id] ?? 0) + td.victoryPoints;
      }
    } else if (oc.controversy_type === 'schism' && td.rewards) {
      for (const r of td.rewards) {
        if (r.vpAwarded > 0) resolutionVPs[r.playerId] = (resolutionVPs[r.playerId] ?? 0) + r.vpAwarded;
      }
      if (td.betResults) {
        for (const br of td.betResults) {
          if (br.vpAwarded > 0) resolutionVPs[br.playerId] = (resolutionVPs[br.playerId] ?? 0) + br.vpAwarded;
        }
      }
    } else if (oc.controversy_type === 'endeavour' && td.succeeded && td.rankings) {
      for (const r of td.rankings) {
        if (r.vpAwarded > 0) resolutionVPs[r.playerId] = (resolutionVPs[r.playerId] ?? 0) + r.vpAwarded;
      }
    }
  }

  // Sort players by total score desc
  const sortedPlayers = [...players].sort((a, b) => {
    const scoreA = (agendaScores[a.player_id] ?? 0) + (resolutionVPs[a.player_id] ?? 0);
    const scoreB = (agendaScores[b.player_id] ?? 0) + (resolutionVPs[b.player_id] ?? 0);
    if (scoreB !== scoreA) return scoreB - scoreA;
    const infA = playerStates.find((ps) => ps.player_id === a.player_id)?.influence ?? 0;
    const infB = playerStates.find((ps) => ps.player_id === b.player_id)?.influence ?? 0;
    return infB - infA;
  });

  return (
    <>
      {/* Tab trigger */}
      {!hideTab && (
        <Pressable style={styles.tabTrigger} onPress={onClose}>
          <Text style={styles.tabText}>P</Text>
          <Text style={styles.tabText}>L</Text>
          <Text style={styles.tabText}>A</Text>
          <Text style={styles.tabText}>Y</Text>
          <Text style={styles.tabText}>E</Text>
          <Text style={styles.tabText}>R</Text>
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
            <Text style={styles.panelTitle}>Players</Text>
            <Text style={styles.panelSubtitle}>Score, influence & agendas</Text>
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
              const ps = playerStates.find((s) => s.player_id === p.player_id);
              const inf = ps?.influence ?? 0;
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

          {/* Current Standing */}
          {playerAgendas.length > 0 && (
            <View style={styles.standingSection}>
              <Text style={styles.sectionTitle}>Current Standing</Text>

              {/* Policy Agenda */}
              <View style={styles.standingBlock}>
                <Pressable
                  style={styles.standingToggle}
                  onPress={() => setShowPolicyDetail((v) => !v)}
                >
                  <Text style={styles.standingLabel}>Policy Agenda</Text>
                  <Text style={styles.chevron}>{showPolicyDetail ? '▲' : '▼'}</Text>
                </Pressable>
                <View style={styles.scoreSummary}>
                  {sortedPlayers.map((p) => (
                    <View key={p.player_id} style={styles.scoreRow}>
                      <View style={[styles.colorDot, { backgroundColor: getColorHex(p.color) }]} />
                      <Text style={styles.scorePlayerName}>{p.player_name}</Text>
                      <Text style={styles.scoreValue}>+{agendaScores[p.player_id] ?? 0}</Text>
                    </View>
                  ))}
                </View>
                {showPolicyDetail && (
                  <View style={styles.policyDetail}>
                    {AXIS_KEYS.map((axis) => {
                      const labels = AXIS_LABELS[axis as AxisKey];
                      const val = axes[axis] ?? 0;
                      const posLabel = val === 0
                        ? 'Neutral'
                        : `${Math.abs(val) >= 2 ? 'Extreme' : 'Moderate'} ${val > 0 ? labels.positive : labels.negative}`;
                      const scorers = playerAgendas
                        .map((pa) => {
                          const s = perAxisScores[pa.playerId]?.[axis];
                          if (!s) return null;
                          return { id: pa.playerId, name: pa.name, color: pa.color, score: s };
                        })
                        .filter(Boolean) as { id: string; name: string; color: string; score: number }[];
                      return (
                        <View key={axis} style={styles.axisBlock}>
                          <AxisEffectSlider axis={axis} change={0} currentValue={val} playerAgendas={playerAgendas} />
                          <Text style={styles.axisLabel}>{posLabel}</Text>
                          {scorers.map((s) => (
                            <View key={s.id} style={styles.scoreRow}>
                              <View style={[styles.colorDot, { backgroundColor: getColorHex(s.color) }]} />
                              <Text style={styles.scorePlayerName}>{s.name}</Text>
                              <Text style={styles.scoreValue}>+{s.score}</Text>
                            </View>
                          ))}
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>

              {/* Resolutions */}
              <View style={styles.standingBlock}>
                <Pressable
                  style={styles.standingToggle}
                  onPress={() => setShowResolutionDetail((v) => !v)}
                >
                  <Text style={styles.standingLabel}>Resolutions</Text>
                  <Text style={styles.chevron}>{showResolutionDetail ? '▲' : '▼'}</Text>
                </Pressable>
                <View style={styles.scoreSummary}>
                  {sortedPlayers.map((p) => (
                    <View key={p.player_id} style={styles.scoreRow}>
                      <View style={[styles.colorDot, { backgroundColor: getColorHex(p.color) }]} />
                      <Text style={styles.scorePlayerName}>{p.player_name}</Text>
                      <Text style={styles.scoreValue}>+{resolutionVPs[p.player_id] ?? 0}</Text>
                    </View>
                  ))}
                </View>
                {showResolutionDetail && (
                  <View style={styles.policyDetail}>
                    {allOutcomes.filter((oc) => {
                      const td = oc.type_data;
                      if (!td) return false;
                      if (oc.controversy_type === 'clash') return td.succeeded && td.victoryPoints;
                      if (oc.controversy_type === 'schism') return td.rewards?.some((r: any) => r.vpAwarded > 0) || td.betResults?.some((br: any) => br.vpAwarded > 0);
                      if (oc.controversy_type === 'endeavour') return td.succeeded && td.rankings?.some((r: any) => r.vpAwarded > 0);
                      return false;
                    }).map((oc) => {
                      const title = CONTROVERSY_MAP[oc.controversy_key]?.title ?? oc.controversy_key;
                      const td = oc.type_data;
                      const perPlayer: { pid: string; vp: number }[] = [];
                      if (oc.controversy_type === 'clash') {
                        for (const ps of playerStates) {
                          perPlayer.push({ pid: ps.player_id, vp: td.victoryPoints });
                        }
                      } else if (oc.controversy_type === 'schism') {
                        for (const r of (td.rewards ?? [])) {
                          if (r.vpAwarded > 0) perPlayer.push({ pid: r.playerId, vp: r.vpAwarded });
                        }
                        for (const br of (td.betResults ?? [])) {
                          if (br.vpAwarded > 0) perPlayer.push({ pid: br.playerId, vp: br.vpAwarded });
                        }
                      } else if (oc.controversy_type === 'endeavour') {
                        for (const r of td.rankings) {
                          if (r.vpAwarded > 0) perPlayer.push({ pid: r.playerId, vp: r.vpAwarded });
                        }
                      }
                      return (
                        <View key={oc.controversy_key} style={styles.axisBlock}>
                          <Text style={styles.resolutionTitle}>{title}</Text>
                          {perPlayer.map(({ pid, vp }) => {
                            const player = players.find((p) => p.player_id === pid);
                            return (
                              <View key={pid} style={styles.scoreRow}>
                                <View style={[styles.colorDot, { backgroundColor: getColorHex(player?.color ?? '') }]} />
                                <Text style={styles.scorePlayerName}>{player?.player_name ?? 'Unknown'}</Text>
                                <Text style={styles.scoreValue}>+{vp}</Text>
                              </View>
                            );
                          })}
                        </View>
                      );
                    })}
                    {allOutcomes.filter((oc) => {
                      const td = oc.type_data;
                      if (!td) return false;
                      if (oc.controversy_type === 'clash') return td.succeeded && td.victoryPoints;
                      if (oc.controversy_type === 'schism') return td.rewards?.some((r: any) => r.vpAwarded > 0) || td.betResults?.some((br: any) => br.vpAwarded > 0);
                      if (oc.controversy_type === 'endeavour') return td.succeeded && td.rankings?.some((r: any) => r.vpAwarded > 0);
                      return false;
                    }).length === 0 && (
                      <Text style={styles.axisLabel}>No VP-awarding resolutions yet</Text>
                    )}
                  </View>
                )}
              </View>
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
    top: '30%',
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
  // Standing section
  standingSection: {
    gap: 12,
  },
  sectionTitle: {
    color: C.gold,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
    opacity: 0.8,
  },
  standingBlock: {
    gap: 6,
  },
  standingToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  standingLabel: {
    color: C.paleGold,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  chevron: {
    color: C.gold,
    fontSize: 12,
    opacity: 0.6,
  },
  scoreSummary: {
    gap: 3,
    paddingLeft: 4,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scorePlayerName: {
    color: C.paleGold,
    fontSize: 12,
    flex: 1,
  },
  scoreValue: {
    color: C.gold,
    fontSize: 12,
    fontWeight: '700',
  },
  policyDetail: {
    marginTop: 6,
    gap: 8,
  },
  axisBlock: {
    gap: 2,
  },
  axisLabel: {
    color: C.paleGold,
    fontSize: 11,
    opacity: 0.55,
    fontStyle: 'italic',
    paddingLeft: 4,
  },
  resolutionTitle: {
    color: C.paleGold,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
});
