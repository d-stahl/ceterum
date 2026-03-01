import { View, Text, StyleSheet, ScrollView, Pressable, Image } from 'react-native';
import { Controversy } from '../lib/game-engine/controversies';
import { AXIS_KEYS, AXIS_LABELS, AxisKey } from '../lib/game-engine/axes';
import { getColorHex } from '../lib/player-colors';
import { ILLUSTRATION_MAP, AxisEffectSlider, PowerEffectRow } from './ControversyCard';
import { PlayerAgendaInfo } from './AgendaDots';
import { C, goldBg } from '../lib/theme';

type VoteRow = {
  playerId: string;
  playerName: string;
  playerColor: string;
  resolutionKey: string;
  influenceSpent: number;
};

type FactionInfo = {
  key: string;
  displayName: string;
  power: number;
};

type PlayerInfo = {
  player_id: string;
  player_name: string;
  color: string;
};

type Props = {
  controversy: Controversy;
  resolutionTotals: Record<string, number>;
  winningResolutionKey: string;
  senateLeaderDeclaration: string;
  senateLeaderBonus: number;
  votes: VoteRow[];
  axisEffects: Partial<Record<string, number>>;
  factionPowerEffects: Partial<Record<string, number>>;
  affinityEffects: Record<string, Record<string, number>>;
  axisValues: Record<string, number>;
  factionInfoMap: Record<string, FactionInfo>;
  players: PlayerInfo[];
  playerAgendas?: PlayerAgendaInfo[];
  onContinue: () => void;
};

export default function ResolutionOutcome({
  controversy,
  resolutionTotals,
  winningResolutionKey,
  senateLeaderDeclaration,
  senateLeaderBonus,
  votes,
  axisEffects,
  factionPowerEffects,
  affinityEffects,
  axisValues,
  factionInfoMap,
  players,
  playerAgendas,
  onContinue,
}: Props) {
  const winningResolution = controversy.resolutions.find((r) => r.key === winningResolutionKey);
  const illustration = ILLUSTRATION_MAP[controversy.illustration];

  // Build vote bars per resolution (stacked bars showing who voted)
  const maxTotal = Math.max(...Object.values(resolutionTotals), 1);
  const resolutionBars = controversy.resolutions.map((r) => {
    const total = resolutionTotals[r.key] ?? 0;
    const isWinner = r.key === winningResolutionKey;
    const isSLDeclaration = r.key === senateLeaderDeclaration;
    const segments: { playerId: string; color: string; weight: number; name: string }[] = [];
    for (const v of votes) {
      if (v.resolutionKey === r.key && v.influenceSpent > 0) {
        segments.push({
          playerId: v.playerId,
          color: v.playerColor,
          weight: v.influenceSpent,
          name: v.playerName,
        });
      }
    }
    // Add SL bonus as a separate gold segment
    if (isSLDeclaration && senateLeaderBonus > 0) {
      segments.push({
        playerId: '_sl_bonus',
        color: 'gold',
        weight: senateLeaderBonus,
        name: 'Senate Leader Bonus',
      });
    }
    return { resolution: r, total, isWinner, segments };
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Illustration */}
      {illustration && (
        <Image
          source={illustration}
          style={styles.illustration}
          resizeMode="cover"
        />
      )}

      {/* Controversy title */}
      <Text style={styles.controversyTitle}>{controversy.title}</Text>

      {/* Winning resolution */}
      <View style={styles.winnerCard}>
        <Text style={styles.winnerLabel}>RESOLUTION PASSED</Text>
        <Text style={styles.winnerTitle}>{winningResolution?.title ?? winningResolutionKey}</Text>
        {winningResolution && (
          <Text style={styles.winnerDesc}>{winningResolution.description}</Text>
        )}
      </View>

      {/* Vote visualization — stacked bars */}
      <Text style={styles.sectionTitle}>Votes</Text>
      <View style={styles.barsSection}>
        {resolutionBars.map(({ resolution, total, isWinner, segments }) => {
          const barWidth = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
          return (
            <View key={resolution.key} style={styles.barRow}>
              <View style={styles.barLabel}>
                <Text style={[styles.barResTitle, isWinner && styles.barResTitleWinner]} numberOfLines={1}>
                  {resolution.title}
                </Text>
                <Text style={styles.barTotal}>{total}</Text>
              </View>
              <View style={styles.barContainer}>
                <View style={[styles.barTrack, { width: `${barWidth}%` }]}>
                  {segments.map((seg, i) => {
                    const segWidth = total > 0 ? (seg.weight / total) * 100 : 0;
                    const isSLBonus = seg.playerId === '_sl_bonus';
                    const bgColor = isSLBonus ? '#B8963E' : getColorHex(seg.color);
                    return (
                      <View
                        key={seg.playerId}
                        style={[
                          styles.barSegment,
                          {
                            width: `${segWidth}%`,
                            backgroundColor: bgColor,
                            borderTopLeftRadius: i === 0 ? 4 : 0,
                            borderBottomLeftRadius: i === 0 ? 4 : 0,
                            borderTopRightRadius: i === segments.length - 1 ? 4 : 0,
                            borderBottomRightRadius: i === segments.length - 1 ? 4 : 0,
                          },
                        ]}
                      >
                        {isSLBonus && <Text style={styles.slBarStar}>★</Text>}
                      </View>
                    );
                  })}
                </View>
              </View>
              {isWinner && <Text style={styles.winnerBadge}>PASSED</Text>}
            </View>
          );
        })}
      </View>

      {/* Individual voter legend */}
      <View style={styles.voterLegend}>
        {senateLeaderDeclaration && senateLeaderBonus > 0 && (
          <View style={styles.voterRow}>
            <Text style={styles.slBonusIcon}>★</Text>
            <Text style={styles.voterName}>Senate Leader bonus</Text>
            <Text style={styles.voterRes} numberOfLines={1}>
              {controversy.resolutions.find((r) => r.key === senateLeaderDeclaration)?.title ?? senateLeaderDeclaration}
            </Text>
            <Text style={styles.voterInf}>{senateLeaderBonus}</Text>
          </View>
        )}
        {votes.map((v) => (
          <View key={v.playerId} style={styles.voterRow}>
            <View style={[styles.colorDot, { backgroundColor: getColorHex(v.playerColor) }]} />
            <Text style={styles.voterName}>{v.playerName}</Text>
            <Text style={styles.voterRes} numberOfLines={1}>
              {controversy.resolutions.find((r) => r.key === v.resolutionKey)?.title ?? v.resolutionKey}
            </Text>
            <Text style={styles.voterInf}>{v.influenceSpent > 0 ? v.influenceSpent : '—'}</Text>
          </View>
        ))}
      </View>

      {/* Policy axes — all axes, with deltas for affected ones */}
      {/* axisValues are post-resolution (already updated by realtime), so subtract
          the applied effect to recover the pre-resolution value for visualization. */}
      <Text style={styles.sectionTitle}>Policy Axes</Text>
      <View style={styles.effectsCard}>
        {AXIS_KEYS.map((axis) => {
          const change = axisEffects[axis] ?? 0;
          const preResolutionVal = (axisValues[axis] ?? 0) - change;
          return (
            <AxisEffectSlider
              key={axis}
              axis={axis}
              change={change}
              currentValue={preResolutionVal}
              playerAgendas={playerAgendas}
            />
          );
        })}
      </View>

      {/* Faction power — all factions, with deltas for affected ones */}
      {/* Same as axes: power levels are post-resolution, so subtract the change. */}
      <Text style={styles.sectionTitle}>Faction Power</Text>
      <View style={styles.effectsCard}>
        {Object.entries(factionInfoMap).map(([fkey, info]) => {
          const change = factionPowerEffects[fkey] ?? 0;
          return (
            <PowerEffectRow
              key={fkey}
              factionName={info.displayName}
              currentPower={info.power - change}
              change={change}
            />
          );
        })}
      </View>

      {/* Affinity changes — grouped by faction */}
      {Object.keys(affinityEffects).length > 0 && (() => {
        // Pivot: player→faction→malus  →  faction→player→malus
        const byFaction: Record<string, { playerId: string; malus: number }[]> = {};
        for (const [playerId, factionMalus] of Object.entries(affinityEffects)) {
          for (const [factionKey, malus] of Object.entries(factionMalus)) {
            if (!byFaction[factionKey]) byFaction[factionKey] = [];
            byFaction[factionKey].push({ playerId, malus });
          }
        }
        return (
          <>
            <Text style={styles.sectionTitle}>Affinity</Text>
            <View style={styles.effectsCard}>
              {Object.entries(byFaction).map(([factionKey, entries]) => (
                <View key={factionKey} style={styles.affinityFactionBlock}>
                  <Text style={styles.affinityFactionName}>
                    {factionInfoMap[factionKey]?.displayName ?? factionKey}
                  </Text>
                  {entries.map(({ playerId, malus }) => {
                    const player = players.find((p) => p.player_id === playerId);
                    return (
                      <View key={playerId} style={styles.affinityPlayerRow}>
                        <View style={[styles.colorDot, { backgroundColor: getColorHex(player?.color ?? 'ivory') }]} />
                        <Text style={styles.affinityPlayerName}>{player?.player_name ?? 'Unknown'}</Text>
                        <Text style={[styles.affinityMalus, malus > 0 ? styles.affinityPositive : styles.affinityNegative]}>
                          {malus > 0 ? `+${malus}` : `${malus}`}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          </>
        );
      })()}

      <Pressable style={styles.continueButton} onPress={onContinue}>
        <Text style={styles.continueButtonText}>Continue</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 60, gap: 14 },

  // Illustration
  illustration: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    marginBottom: -4,
  },

  // Title
  controversyTitle: {
    color: C.gold,
    fontSize: 22,
    fontWeight: '700',
    fontFamily: 'serif',
    textAlign: 'center',
  },

  // Winner card
  winnerCard: {
    backgroundColor: goldBg(0.15),
    borderWidth: 1.5,
    borderColor: C.gold,
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    gap: 6,
  },
  winnerLabel: {
    color: C.gold,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
  },
  winnerTitle: {
    color: C.paleGold,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  winnerDesc: {
    color: C.paleGold,
    fontSize: 12,
    opacity: 0.6,
    lineHeight: 16,
    textAlign: 'center',
  },

  // Section header
  sectionTitle: {
    color: C.gold,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
  },

  // Vote bars
  barsSection: { gap: 10 },
  barRow: { gap: 3 },
  barLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  barResTitle: { color: C.paleGold, fontSize: 13, flex: 1 },
  barResTitleWinner: { color: C.gold, fontWeight: '700' },
  barTotal: { color: C.paleGold, fontSize: 13, opacity: 0.6, minWidth: 28, textAlign: 'right' },
  barContainer: {
    height: 18,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barTrack: {
    height: '100%',
    flexDirection: 'row',
  },
  barSegment: {
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  slBarStar: {
    color: 'rgba(20,14,5,0.5)',
    fontSize: 12,
    lineHeight: 18,
  },
  winnerBadge: {
    color: C.gold,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },

  // Voter legend
  voterLegend: { gap: 4 },
  voterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  colorDot: { width: 10, height: 10, borderRadius: 5 },
  slBonusIcon: { color: C.gold, fontSize: 10, width: 10, textAlign: 'center' },
  voterName: { color: C.paleGold, fontSize: 12, width: 90 },
  voterRes: { color: C.paleGold, fontSize: 11, flex: 1, opacity: 0.6 },
  voterInf: { color: C.gold, fontSize: 12, fontWeight: '700', minWidth: 24, textAlign: 'right' },

  // Effects
  effectsCard: {
    backgroundColor: goldBg(0.08),
    borderRadius: 10,
    padding: 14,
    gap: 8,
  },

  // Affinity
  affinityFactionBlock: {
    gap: 4,
  },
  affinityFactionName: {
    color: C.paleGold,
    fontSize: 13,
    fontWeight: '700',
  },
  affinityPlayerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 8,
    paddingVertical: 2,
  },
  affinityPlayerName: {
    color: C.paleGold,
    fontSize: 12,
    flex: 1,
    opacity: 0.7,
  },
  affinityMalus: {
    fontSize: 13,
    fontWeight: '700',
    minWidth: 28,
    textAlign: 'right',
  },
  affinityPositive: {
    color: C.positive,
  },
  affinityNegative: {
    color: C.negative,
  },

  // Continue
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
