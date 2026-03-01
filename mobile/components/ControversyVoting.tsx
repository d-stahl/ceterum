import { View, Text, StyleSheet, ActivityIndicator, ScrollView, Pressable } from 'react-native';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { declareResolution, submitControversyVote } from '../lib/game-actions';
import { CONTROVERSY_MAP } from '../lib/game-engine/controversies';
import VoteControls from './VoteControls';
import ResolutionOutcome from './ResolutionOutcome';
import { AxisEffectSlider, PowerEffectRow } from './ControversyCard';
import { PlayerAgendaInfo } from './AgendaDots';
import { getColorHex } from '../lib/player-colors';
import { C, goldBg, navyBg } from '../lib/theme';

type PlayerInfo = {
  player_id: string;
  player_name: string;
  color: string;
};

type FactionInfo = {
  key: string;
  displayName: string;
  power: number;
};

type Props = {
  gameId: string;
  roundId: string;
  controversyKey: string;
  currentUserId: string;
  senateLeaderId: string;
  currentInfluence: number;
  players: PlayerInfo[];
  activeFactionKeys: string[];
  factionInfoMap: Record<string, FactionInfo>;
  axisValues?: Record<string, number>;
  playerAgendas?: PlayerAgendaInfo[];
  onContinue: () => void;
};

type ControversyStateRow = {
  status: string;
  senate_leader_declaration: string | null;
  winning_resolution_key: string | null;
  winning_total_influence: number | null;
  axis_effects_applied: Record<string, number> | null;
  faction_power_effects_applied: Record<string, number> | null;
  affinity_effects_applied: Record<string, Record<string, number>> | null;
};

type VoteRow = {
  player_id: string;
  resolution_key: string;
  influence_spent: number;
};

export default function ControversyVoting({
  gameId,
  roundId,
  controversyKey,
  currentUserId,
  senateLeaderId,
  currentInfluence,
  players,
  activeFactionKeys,
  factionInfoMap,
  axisValues,
  playerAgendas,
  onContinue,
}: Props) {
  const [csState, setCsState] = useState<ControversyStateRow | null>(null);
  const [votes, setVotes] = useState<VoteRow[]>([]);
  const [declaringKey, setDeclaringKey] = useState<string | null>(null);
  const [declaring, setDeclaring] = useState(false);
  const [declareError, setDeclareError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const isSL = currentUserId === senateLeaderId;
  const controversy = CONTROVERSY_MAP[controversyKey];

  const fetchState = useCallback(async () => {
    const { data } = await supabase
      .from('game_controversy_state')
      .select('status, senate_leader_declaration, winning_resolution_key, winning_total_influence, axis_effects_applied, faction_power_effects_applied, affinity_effects_applied')
      .eq('round_id', roundId)
      .eq('controversy_key', controversyKey)
      .single();
    if (data) setCsState(data as ControversyStateRow);
    setLoading(false);
  }, [roundId, controversyKey]);

  const fetchVotes = useCallback(async () => {
    const { data } = await supabase
      .from('game_controversy_votes')
      .select('player_id, resolution_key, influence_spent')
      .eq('round_id', roundId)
      .eq('controversy_key', controversyKey);
    if (data) setVotes(data as VoteRow[]);
  }, [roundId, controversyKey]);

  useEffect(() => {
    fetchState();

    // Realtime: controversy state updates
    const stateSub = supabase
      .channel(`cs-${roundId}-${controversyKey}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'game_controversy_state',
        filter: `round_id=eq.${roundId}`,
      }, () => fetchState())
      .subscribe();

    // Realtime: votes revealed after resolution
    const votesSub = supabase
      .channel(`cv-${roundId}-${controversyKey}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'game_controversy_votes',
        filter: `round_id=eq.${roundId}`,
      }, () => fetchVotes())
      .subscribe();

    return () => {
      supabase.removeChannel(stateSub);
      supabase.removeChannel(votesSub);
    };
  }, [fetchState, fetchVotes, roundId, controversyKey]);

  useEffect(() => {
    if (csState?.status === 'resolved') {
      fetchVotes();
    }
  }, [csState?.status, fetchVotes]);

  async function handleDeclare() {
    if (!declaringKey || declaring) return;
    setDeclaring(true);
    setDeclareError(null);
    try {
      await declareResolution(gameId, controversyKey, declaringKey);
    } catch (e: any) {
      setDeclareError(e.message ?? 'Declaration failed');
    } finally {
      setDeclaring(false);
    }
  }

  if (!controversy) {
    return <Text style={styles.errorText}>Unknown controversy: {controversyKey}</Text>;
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={C.gold} size="large" />
      </View>
    );
  }

  const status = csState?.status ?? 'declared';
  const slDeclaration = csState?.senate_leader_declaration ?? null;

  // --- RESOLVED ---
  if (status === 'resolved') {
    const voteRows = votes.map((v) => {
      const player = players.find((p) => p.player_id === v.player_id);
      return {
        playerId: v.player_id,
        playerName: player?.player_name ?? 'Unknown',
        playerColor: player?.color ?? '#888',
        resolutionKey: v.resolution_key,
        influenceSpent: v.influence_spent,
      };
    });

    // Affinity malus for current player (computed by engine in Edge Function, read from affinity table)
    // For display simplicity, we just show the axis/power effects from the state record
    const resolutionTotals: Record<string, number> = {};
    for (const r of controversy.resolutions) {
      resolutionTotals[r.key] = 0;
    }
    for (const v of votes) {
      resolutionTotals[v.resolution_key] = (resolutionTotals[v.resolution_key] ?? 0) + v.influence_spent;
    }
    if (slDeclaration) {
      resolutionTotals[slDeclaration] = (resolutionTotals[slDeclaration] ?? 0) + (players.length - 1);
    }

    return (
      <ResolutionOutcome
        controversy={controversy}
        resolutionTotals={resolutionTotals}
        winningResolutionKey={csState!.winning_resolution_key!}
        senateLeaderDeclaration={slDeclaration ?? ''}
        senateLeaderBonus={players.length - 1}
        votes={voteRows}
        axisEffects={csState?.axis_effects_applied ?? {}}
        factionPowerEffects={csState?.faction_power_effects_applied ?? {}}
        affinityEffects={csState?.affinity_effects_applied ?? {}}
        axisValues={axisValues ?? {}}
        factionInfoMap={factionInfoMap}
        players={players}
        playerAgendas={playerAgendas}
        onContinue={onContinue}
      />
    );
  }

  // --- DECLARED: Senate Leader needs to publicly declare ---
  if (status === 'declared' && isSL) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>{controversy.title}</Text>
        <Text style={styles.instruction}>
          As Senate Leader, publicly declare your preferred resolution. All players will see your
          choice before voting begins.
        </Text>

        {declareError && <Text style={styles.errorText}>{declareError}</Text>}

        <View style={styles.resolutionCards}>
          {controversy.resolutions.map((r) => {
            const axisKeys = Object.keys(r.axisEffects) as string[];
            const factionKeys = Object.keys(r.factionPowerEffects).filter((k) =>
              activeFactionKeys.includes(k)
            );
            const isSelected = declaringKey === r.key;

            return (
              <Pressable
                key={r.key}
                style={[styles.resCard, isSelected && styles.resCardSelected]}
                onPress={() => setDeclaringKey(r.key)}
              >
                <View style={styles.resCardHeader}>
                  <View style={[styles.resCardRadio, isSelected && styles.resCardRadioSelected]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resCardTitle}>{r.title}</Text>
                    <Text style={styles.resCardDesc} numberOfLines={2}>{r.description}</Text>
                  </View>
                </View>

                {axisKeys.length > 0 && (
                  <View style={styles.effectsSection}>
                    <Text style={styles.effectsSectionLabel}>Policy Effects</Text>
                    {axisKeys.map((axis) => {
                      const change = r.axisEffects[axis as keyof typeof r.axisEffects] ?? 0;
                      const currentVal = axisValues?.[axis] ?? 0;
                      return (
                        <AxisEffectSlider
                          key={axis}
                          axis={axis}
                          change={change}
                          currentValue={currentVal}
                          playerAgendas={playerAgendas}
                        />
                      );
                    })}
                  </View>
                )}

                {factionKeys.length > 0 && (
                  <View style={styles.effectsSection}>
                    <Text style={styles.effectsSectionLabel}>Power Effects</Text>
                    {factionKeys.map((fkey) => {
                      const change = r.factionPowerEffects[fkey] ?? 0;
                      const info = factionInfoMap?.[fkey];
                      return (
                        <PowerEffectRow
                          key={fkey}
                          factionName={info?.displayName ?? fkey}
                          currentPower={info?.power ?? 3}
                          change={change}
                        />
                      );
                    })}
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        <Pressable
          style={[styles.declareButton, (!declaringKey || declaring) && { opacity: 0.4 }]}
          onPress={handleDeclare}
          disabled={!declaringKey || declaring}
        >
          {declaring ? (
            <ActivityIndicator color={C.darkText} size="small" />
          ) : (
            <Text style={styles.declareButtonText}>Declare Resolution</Text>
          )}
        </Pressable>
      </ScrollView>
    );
  }

  if (status === 'declared' && !isSL) {
    const slPlayer = players.find((p) => p.player_id === senateLeaderId);
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.phaseTitle}>Senate Leader Phase</Text>
        <View style={styles.upcomingBlock}>
          <Text style={styles.upcomingLabel}>Upcoming controversy:</Text>
          <Text style={styles.upcomingName}>{controversy.title}</Text>
        </View>
        <View style={styles.waitRow}>
          <Text style={styles.waitText}>Waiting for </Text>
          {slPlayer && <View style={[styles.slDot, { backgroundColor: getColorHex(slPlayer.color) }]} />}
          <Text style={styles.waitTextBold}>{slPlayer?.player_name ?? 'Senate Leader'}</Text>
          <Text style={styles.waitText}> to declare…</Text>
        </View>
      </View>
    );
  }

  // --- VOTING ---
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{controversy.title}</Text>
      <Text style={styles.flavor} numberOfLines={2}>{controversy.flavor}</Text>

      {slDeclaration && (
        <View style={styles.slDeclarationBanner}>
          <Text style={styles.slDeclarationLabel}>Senate Leader declares:</Text>
          <Text style={styles.slDeclarationValue}>
            {controversy.resolutions.find((r) => r.key === slDeclaration)?.title ?? slDeclaration}
          </Text>
        </View>
      )}

      <VoteControls
        resolutions={controversy.resolutions}
        forcedResolutionKey={isSL ? slDeclaration : null}
        currentInfluence={currentInfluence}
        senateLeaderDeclaration={slDeclaration}
        activeFactionKeys={activeFactionKeys}
        factionInfoMap={factionInfoMap}
        axisValues={axisValues}
        playerAgendas={playerAgendas}
        onSubmit={(resKey, inf) => submitControversyVote(gameId, controversyKey, resKey, inf)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 60, gap: 14 },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 14,
    padding: 24,
  },
  title: {
    color: C.gold,
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'serif',
    textAlign: 'center',
  },
  controversySubtitle: {
    color: C.paleGold,
    fontSize: 14,
    opacity: 0.6,
    textAlign: 'center',
  },
  instruction: {
    color: C.paleGold,
    fontSize: 14,
    opacity: 0.7,
    lineHeight: 20,
    textAlign: 'center',
  },
  flavor: {
    color: C.paleGold,
    fontSize: 13,
    fontStyle: 'italic',
    opacity: 0.6,
    lineHeight: 18,
    textAlign: 'center',
  },
  resolutionCards: { gap: 10 },
  resCard: {
    backgroundColor: navyBg(0.88),
    borderWidth: 1,
    borderColor: goldBg(0.25),
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  resCardSelected: {
    backgroundColor: navyBg(0.95),
    borderColor: C.gold,
    borderWidth: 2,
  },
  resCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  resCardRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: goldBg(0.5),
    marginTop: 2,
  },
  resCardRadioSelected: {
    backgroundColor: C.gold,
    borderColor: C.gold,
  },
  resCardTitle: {
    color: C.paleGold,
    fontSize: 15,
    fontWeight: '700',
  },
  resCardDesc: {
    color: C.paleGold,
    fontSize: 12,
    opacity: 0.65,
    lineHeight: 16,
    marginTop: 2,
  },
  declareButton: {
    backgroundColor: C.gold,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  declareButtonText: {
    color: C.darkText,
    fontSize: 16,
    fontWeight: '700',
  },
  slDeclarationBanner: {
    backgroundColor: goldBg(0.12),
    borderWidth: 1,
    borderColor: goldBg(0.4),
    borderRadius: 8,
    padding: 12,
    gap: 2,
  },
  slDeclarationLabel: {
    color: C.gold,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  slDeclarationValue: {
    color: C.paleGold,
    fontSize: 15,
    fontWeight: '600',
  },
  phaseTitle: {
    color: C.gold,
    fontSize: 22,
    fontWeight: '700',
    fontFamily: 'serif',
    textAlign: 'center',
  },
  upcomingBlock: {
    alignItems: 'center',
    gap: 2,
  },
  upcomingLabel: {
    color: C.paleGold,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    opacity: 0.5,
  },
  upcomingName: {
    color: C.paleGold,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  waitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  slDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 5,
  },
  waitText: {
    color: C.gold,
    fontSize: 14,
    opacity: 0.7,
  },
  waitTextBold: {
    color: C.gold,
    fontSize: 14,
    fontWeight: '700',
    opacity: 0.7,
  },
  effectsSection: {
    gap: 6,
    marginTop: 4,
    paddingLeft: 28,
  },
  effectsSectionLabel: {
    color: C.parchment,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    opacity: 0.4,
    marginBottom: 2,
  },
  errorText: {
    color: C.error,
    fontSize: 13,
    textAlign: 'center',
  },
});
