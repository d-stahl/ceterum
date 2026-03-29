import { View, Text, StyleSheet, ActivityIndicator, ScrollView, Pressable } from 'react-native';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { declareResolution, submitControversyVote } from '../lib/game-actions';
import { CONTROVERSY_MAP, isVoteControversy } from '../lib/game-engine/controversies';
import VoteControls from './VoteControls';
import ResolutionOutcome from './ResolutionOutcome';
import EndeavourVoting from './EndeavourVoting';
import ClashVoting from './ClashVoting';
import SchismVoting from './SchismVoting';
import { AxisEffectSlider, PowerEffectRow, getFactionStances } from './ControversyCard';
import ControversyHeader from './ControversyHeader';
import { PlayerAgendaInfo } from './AgendaDots';
import { getColorHex } from '../lib/player-colors';
import { C, goldBg, navyBg, CONTROVERSY_TYPE_COLORS, CONTROVERSY_TYPE_LABELS } from '../lib/theme';

type PlayerInfo = {
  player_id: string;
  player_name: string;
  color: string;
};

type FactionInfo = {
  key: string;
  displayName: string;
  power: number;
  preferences: Record<string, number>;
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
  totalInitialInfluence?: number;
  playerAffinities?: Record<string, number>;
  onContinue: () => void;
};

type ControversyStateRow = {
  status: string;
  senate_leader_declaration: string | null;
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
  totalInitialInfluence,
  playerAffinities,
  onContinue,
}: Props) {
  const [csState, setCsState] = useState<ControversyStateRow | null>(null);
  const [outcome, setOutcome] = useState<any>(null);
  const [declaringKey, setDeclaringKey] = useState<string | null>(null);
  const [declaring, setDeclaring] = useState(false);
  const [declareError, setDeclareError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const isSL = currentUserId === senateLeaderId;
  const controversy = CONTROVERSY_MAP[controversyKey];

  const fetchState = useCallback(async () => {
    const { data } = await supabase
      .from('game_controversy_state')
      .select('status, senate_leader_declaration')
      .eq('round_id', roundId)
      .eq('controversy_key', controversyKey)
      .single();
    if (data) setCsState(data as ControversyStateRow);
    setLoading(false);
  }, [roundId, controversyKey]);

  const fetchOutcome = useCallback(async () => {
    const { data } = await supabase
      .from('game_controversy_outcomes')
      .select('type_data, axis_outcomes, faction_power_outcomes, affinity_outcomes')
      .eq('round_id', roundId)
      .eq('controversy_key', controversyKey)
      .single();
    if (data) setOutcome(data);
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

    return () => {
      supabase.removeChannel(stateSub);
    };
  }, [fetchState, roundId, controversyKey]);

  useEffect(() => {
    if (csState?.status === 'resolved') {
      fetchOutcome();
    }
  }, [csState?.status, fetchOutcome]);

  async function handleDeclare() {
    const validKeys = (controversy && isVoteControversy(controversy)) ? controversy.resolutions.map((r) => r.key) : [];
    if (!declaringKey || declaring || !validKeys.includes(declaringKey)) return;
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

  // Dispatch non-vote types to dedicated components
  if (controversy.type === 'endeavour') {
    return (
      <EndeavourVoting
        gameId={gameId}
        roundId={roundId}
        controversyKey={controversyKey}
        currentUserId={currentUserId}
        senateLeaderId={senateLeaderId}
        currentInfluence={currentInfluence}
        players={players}
        activeFactionKeys={activeFactionKeys}
        factionInfoMap={factionInfoMap}
        axisValues={axisValues}
        playerAgendas={playerAgendas}
        totalInitialInfluence={totalInitialInfluence ?? 0}
        onContinue={onContinue}
      />
    );
  }

  if (controversy.type === 'clash') {
    return (
      <ClashVoting
        gameId={gameId}
        roundId={roundId}
        controversyKey={controversyKey}
        currentUserId={currentUserId}
        senateLeaderId={senateLeaderId}
        currentInfluence={currentInfluence}
        players={players}
        activeFactionKeys={activeFactionKeys}
        factionInfoMap={factionInfoMap}
        axisValues={axisValues}
        playerAgendas={playerAgendas}
        playerAffinities={playerAffinities}
        onContinue={onContinue}
      />
    );
  }

  if (controversy.type === 'schism') {
    return (
      <SchismVoting
        gameId={gameId}
        roundId={roundId}
        controversyKey={controversyKey}
        currentUserId={currentUserId}
        senateLeaderId={senateLeaderId}
        players={players}
        activeFactionKeys={activeFactionKeys}
        factionInfoMap={factionInfoMap}
        axisValues={axisValues}
        playerAgendas={playerAgendas}
        currentInfluence={currentInfluence}
        onContinue={onContinue}
      />
    );
  }

  if (!isVoteControversy(controversy)) {
    return <Text style={styles.errorText}>Unsupported controversy type: {(controversy as any).type}</Text>;
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
  if (status === 'resolved' && outcome) {
    const td = outcome.type_data;
    const voteRows = (td.votes ?? []).map((v: any) => {
      const player = players.find((p) => p.player_id === v.playerId);
      return {
        playerId: v.playerId,
        playerName: player?.player_name ?? 'Unknown',
        playerColor: player?.color ?? C.gray,
        resolutionKey: v.resolutionKey,
        influenceSpent: v.influenceSpent,
      };
    });

    const axisEffects: Record<string, number> = {};
    const outcomeAxisValues: Record<string, number> = {};
    for (const [axis, vals] of Object.entries(outcome.axis_outcomes as Record<string, { before: number; after: number }>)) {
      axisEffects[axis] = vals.after - vals.before;
      outcomeAxisValues[axis] = vals.before;
    }

    const factionPowerEffects: Record<string, number> = {};
    const factionPowerBefore: Record<string, number> = {};
    for (const [fkey, vals] of Object.entries(outcome.faction_power_outcomes as Record<string, { before: number; after: number }>)) {
      factionPowerEffects[fkey] = vals.after - vals.before;
      factionPowerBefore[fkey] = vals.before;
    }

    // Build factionInfoMap with pre-resolution power from stored outcomes
    const outcomeFactionInfoMap: Record<string, typeof factionInfoMap[string]> = {};
    for (const [fkey, info] of Object.entries(factionInfoMap)) {
      outcomeFactionInfoMap[fkey] = {
        ...info,
        power: factionPowerBefore[fkey] ?? info.power,
      };
    }

    const affinityEffects: Record<string, Record<string, number>> = {};
    for (const [pid, factions] of Object.entries(outcome.affinity_outcomes as Record<string, Record<string, { before: number; after: number }>>)) {
      affinityEffects[pid] = {};
      for (const [fkey, vals] of Object.entries(factions)) {
        affinityEffects[pid][fkey] = vals.after - vals.before;
      }
    }

    return (
      <ResolutionOutcome
        controversy={controversy}
        resolutionTotals={td.resolutionTotals}
        winningResolutionKey={td.winningResolutionKey}
        senateLeaderDeclaration={td.senateLeaderDeclaration ?? ''}
        senateLeaderBonus={td.senateLeaderBonus}
        votes={voteRows}
        axisEffects={axisEffects}
        factionPowerEffects={factionPowerEffects}
        affinityEffects={affinityEffects}
        axisValues={outcomeAxisValues}
        factionInfoMap={outcomeFactionInfoMap}
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
        <ControversyHeader controversy={controversy} />
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

                {(() => {
                  const stances = getFactionStances(r.axisEffects, activeFactionKeys, factionInfoMap, axisValues);
                  const hasStances = stances.some((s) => s.stance !== 'neutral');
                  if (!hasStances) return null;
                  return (
                    <View style={styles.effectsSection}>
                      <Text style={styles.effectsSectionLabel}>Faction Reactions</Text>
                      {stances.map(({ key: fkey, stance }) => (
                        <View key={fkey} style={styles.stanceRow}>
                          <Text style={styles.stanceFactionName}>
                            {factionInfoMap?.[fkey]?.displayName ?? fkey}
                          </Text>
                          <Text style={[
                            styles.stanceLabel,
                            stance === 'opposed' && styles.stanceOpposed,
                            stance === 'in_favor' && styles.stanceInFavor,
                          ]}>
                            {stance === 'opposed' ? 'Opposed' : stance === 'in_favor' ? 'In Favor' : 'Neutral'}
                          </Text>
                        </View>
                      ))}
                    </View>
                  );
                })()}

                {r.followUpKey && (() => {
                  const followUp = CONTROVERSY_MAP[r.followUpKey];
                  if (!followUp) return null;
                  const typeColor = CONTROVERSY_TYPE_COLORS[followUp.type] ?? C.gray;
                  const typeLabel = CONTROVERSY_TYPE_LABELS[followUp.type] ?? followUp.type;
                  return (
                    <View style={[styles.followUpHint, { borderColor: typeColor + '40' }]}>
                      <Text style={[styles.followUpHintText, { color: typeColor }]}>
                        May lead to: {followUp.title} ({typeLabel})
                      </Text>
                    </View>
                  );
                })()}
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
        <ControversyHeader controversy={controversy} />
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
      <ControversyHeader controversy={controversy} />

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
  instruction: {
    color: C.paleGold,
    fontSize: 14,
    opacity: 0.7,
    lineHeight: 20,
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
  stanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  stanceFactionName: {
    color: C.paleGold,
    fontSize: 12,
    flex: 1,
  },
  stanceLabel: {
    fontSize: 11,
    fontWeight: '600',
    opacity: 0.5,
    color: C.paleGold,
  },
  stanceOpposed: {
    color: C.negative,
    opacity: 1,
  },
  stanceInFavor: {
    color: C.positive,
    opacity: 1,
  },
  followUpHint: {
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginLeft: 28,
  },
  followUpHintText: {
    fontSize: 10,
    fontWeight: '600',
    fontStyle: 'italic',
  },
  errorText: {
    color: C.error,
    fontSize: 13,
    textAlign: 'center',
  },
});
