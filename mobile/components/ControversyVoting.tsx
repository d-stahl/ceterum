import { View, Text, StyleSheet, ActivityIndicator, ScrollView, Pressable } from 'react-native';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { declareResolution, submitControversyVote } from '../lib/game-actions';
import { CONTROVERSY_MAP } from '../lib/game-engine/controversies';
import VoteControls from './VoteControls';
import ResolutionOutcome from './ResolutionOutcome';

type PlayerInfo = {
  player_id: string;
  player_name: string;
  color: string;
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
  onContinue: () => void;
};

type ControversyStateRow = {
  status: string;
  senate_leader_declaration: string | null;
  winning_resolution_key: string | null;
  winning_total_influence: number | null;
  axis_effects_applied: Record<string, number> | null;
  faction_power_effects_applied: Record<string, number> | null;
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
      .select('status, senate_leader_declaration, winning_resolution_key, winning_total_influence, axis_effects_applied, faction_power_effects_applied')
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
        <ActivityIndicator color="#c9a84c" size="large" />
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
        controversyTitle={controversy.title}
        resolutions={controversy.resolutions}
        resolutionTotals={resolutionTotals}
        winningResolutionKey={csState!.winning_resolution_key!}
        senateLeaderDeclaration={slDeclaration ?? ''}
        senateLeaderBonus={players.length - 1}
        votes={voteRows}
        axisEffects={csState?.axis_effects_applied ?? {}}
        factionPowerEffects={csState?.faction_power_effects_applied ?? {}}
        affinityMalus={{}}
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
          {controversy.resolutions.map((r) => (
            <Pressable
              key={r.key}
              style={[styles.resCard, declaringKey === r.key && styles.resCardSelected]}
              onPress={() => setDeclaringKey(r.key)}
            >
              <View style={[styles.resCardRadio, declaringKey === r.key && styles.resCardRadioSelected]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.resCardTitle}>{r.title}</Text>
                <Text style={styles.resCardDesc} numberOfLines={2}>{r.description}</Text>
              </View>
            </Pressable>
          ))}
        </View>

        <Pressable
          style={[styles.declareButton, (!declaringKey || declaring) && { opacity: 0.4 }]}
          onPress={handleDeclare}
          disabled={!declaringKey || declaring}
        >
          {declaring ? (
            <ActivityIndicator color="#1a1209" size="small" />
          ) : (
            <Text style={styles.declareButtonText}>Declare Resolution</Text>
          )}
        </Pressable>
      </ScrollView>
    );
  }

  if (status === 'declared' && !isSL) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#c9a84c" size="large" />
        <Text style={styles.waitText}>Waiting for the Senate Leader to declare…</Text>
        <Text style={styles.controversySubtitle}>{controversy.title}</Text>
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
    color: '#c9a84c',
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'serif',
    textAlign: 'center',
  },
  controversySubtitle: {
    color: '#e8d5a3',
    fontSize: 14,
    opacity: 0.6,
    textAlign: 'center',
  },
  instruction: {
    color: '#e8d5a3',
    fontSize: 14,
    opacity: 0.7,
    lineHeight: 20,
    textAlign: 'center',
  },
  flavor: {
    color: '#e8d5a3',
    fontSize: 13,
    fontStyle: 'italic',
    opacity: 0.6,
    lineHeight: 18,
    textAlign: 'center',
  },
  resolutionCards: { gap: 10 },
  resCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(201,168,76,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.2)',
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  resCardSelected: {
    backgroundColor: 'rgba(201,168,76,0.18)',
    borderColor: '#c9a84c',
  },
  resCardRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: 'rgba(201,168,76,0.5)',
    marginTop: 2,
  },
  resCardRadioSelected: {
    backgroundColor: '#c9a84c',
    borderColor: '#c9a84c',
  },
  resCardTitle: {
    color: '#e8d5a3',
    fontSize: 15,
    fontWeight: '700',
  },
  resCardDesc: {
    color: '#e8d5a3',
    fontSize: 12,
    opacity: 0.65,
    lineHeight: 16,
    marginTop: 2,
  },
  declareButton: {
    backgroundColor: '#c9a84c',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  declareButtonText: {
    color: '#1a1209',
    fontSize: 16,
    fontWeight: '700',
  },
  slDeclarationBanner: {
    backgroundColor: 'rgba(201,168,76,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.4)',
    borderRadius: 8,
    padding: 12,
    gap: 2,
  },
  slDeclarationLabel: {
    color: '#c9a84c',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  slDeclarationValue: {
    color: '#e8d5a3',
    fontSize: 15,
    fontWeight: '600',
  },
  waitText: {
    color: '#c9a84c',
    fontSize: 14,
    opacity: 0.7,
    textAlign: 'center',
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 13,
    textAlign: 'center',
  },
});
