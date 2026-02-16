import {
  View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator,
  Alert, ImageBackground,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../../lib/supabase';
import { submitPlacement, resolveCurrentPhase } from '../../../lib/game-actions';
import { getColorHex } from '../../../lib/player-colors';
import FactionCard, { FactionPlacement } from '../../../components/FactionCard';
import WorkerSelector, { WorkerSelection } from '../../../components/WorkerSelector';

const gameBg = require('../../../assets/images/lobby-bg.png');

type Faction = {
  id: string;
  faction_key: string;
  display_name: string;
  power_level: number;
};

type Round = {
  id: string;
  round_number: number;
  phase: string;
  sub_round: number;
};

type PlayerInfo = {
  player_id: string;
  player_name: string;
  color: string;
};

type PlacementRow = {
  id: string;
  player_id: string;
  faction_id: string;
  worker_type: string;
  orator_role: string | null;
  sub_round: number;
};

type PlayerState = {
  player_id: string;
  influence: number;
};

type Affinity = {
  player_id: string;
  faction_id: string;
  affinity: number;
};

export default function GameScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id: gameId } = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [factions, setFactions] = useState<Faction[]>([]);
  const [round, setRound] = useState<Round | null>(null);
  const [players, setPlayers] = useState<PlayerInfo[]>([]);
  const [placements, setPlacements] = useState<PlacementRow[]>([]);
  const [playerStates, setPlayerStates] = useState<PlayerState[]>([]);
  const [affinities, setAffinities] = useState<Affinity[]>([]);
  const [currentUserId, setCurrentUserId] = useState('');
  const [expandedFaction, setExpandedFaction] = useState<string | null>(null);
  const [selectedWorker, setSelectedWorker] = useState<WorkerSelection | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [hasSubmittedThisSubRound, setHasSubmittedThisSubRound] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [resultInfluence, setResultInfluence] = useState<Record<string, number>>({});
  const [gameStatus, setGameStatus] = useState('in_progress');

  // Track previous round state for detecting resolution
  const prevRoundRef = useRef<{ roundNumber: number; subRound: number; phase: string } | null>(null);

  useEffect(() => {
    loadGameState();

    const channel = supabase
      .channel(`game-${gameId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'game_rounds',
        filter: `game_id=eq.${gameId}`,
      }, () => { loadRound(); loadPlacements(); })
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'game_placements',
        filter: `game_id=eq.${gameId}`,
      }, () => { loadPlacements(); })
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'game_player_state',
        filter: `game_id=eq.${gameId}`,
      }, () => { loadPlayerStates(); })
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'game_factions',
        filter: `game_id=eq.${gameId}`,
      }, () => { loadFactions(); })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'games',
        filter: `id=eq.${gameId}`,
      }, (payload: any) => {
        if (payload.new?.status === 'finished') {
          setGameStatus('finished');
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [gameId]);

  // Detect round/sub-round changes to reset submission state
  useEffect(() => {
    if (!round) return;
    const prev = prevRoundRef.current;
    if (prev && (prev.roundNumber !== round.round_number || prev.subRound !== round.sub_round)) {
      setHasSubmittedThisSubRound(false);
      setSelectedWorker(null);
      // If phase changed to completed, trigger resolution
      if (round.phase === 'completed' && prev.phase === 'demagogery') {
        handleResolve();
      }
    }
    prevRoundRef.current = {
      roundNumber: round.round_number,
      subRound: round.sub_round,
      phase: round.phase,
    };
  }, [round]);

  // Check if current user already submitted this sub-round
  useEffect(() => {
    if (!round || !currentUserId) return;
    const alreadySubmitted = placements.some(
      (p) => p.player_id === currentUserId && p.sub_round === round.sub_round
    );
    if (alreadySubmitted) setHasSubmittedThisSubRound(true);
  }, [placements, round, currentUserId]);

  async function loadGameState() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);

      const { data: game } = await supabase
        .from('games')
        .select('status')
        .eq('id', gameId)
        .single();
      if (game) setGameStatus(game.status);

      await Promise.all([
        loadFactions(),
        loadRound(),
        loadPlayers(),
        loadPlacements(),
        loadPlayerStates(),
        loadAffinities(),
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function loadFactions() {
    const { data } = await supabase
      .from('game_factions')
      .select('id, faction_key, display_name, power_level')
      .eq('game_id', gameId)
      .order('display_name');
    if (data) setFactions(data);
  }

  async function loadRound() {
    const { data } = await supabase
      .from('game_rounds')
      .select('id, round_number, phase, sub_round')
      .eq('game_id', gameId)
      .order('round_number', { ascending: false })
      .limit(1)
      .single();
    if (data) setRound(data);
  }

  async function loadPlayers() {
    const { data } = await supabase
      .from('game_players')
      .select('player_id, player_name, color')
      .eq('game_id', gameId);
    if (data) setPlayers(data);
  }

  async function loadPlacements() {
    if (!gameId) return;
    const { data: currentRound } = await supabase
      .from('game_rounds')
      .select('id, sub_round')
      .eq('game_id', gameId)
      .order('round_number', { ascending: false })
      .limit(1)
      .single();
    if (!currentRound) return;

    // Show placements from completed sub-rounds (not the current one, unless you submitted)
    const { data } = await supabase
      .from('game_placements')
      .select('id, player_id, faction_id, worker_type, orator_role, sub_round')
      .eq('round_id', currentRound.id);
    if (data) setPlacements(data);
  }

  async function loadPlayerStates() {
    const { data } = await supabase
      .from('game_player_state')
      .select('player_id, influence')
      .eq('game_id', gameId);
    if (data) setPlayerStates(data);
  }

  async function loadAffinities() {
    const { data } = await supabase
      .from('game_player_faction_affinity')
      .select('player_id, faction_id, affinity')
      .eq('game_id', gameId);
    if (data) setAffinities(data);
  }

  async function handlePlace(factionKey: string) {
    if (!selectedWorker || !round || hasSubmittedThisSubRound) return;

    const faction = factions.find((f) => f.faction_key === factionKey);
    if (!faction) return;

    setSubmitting(true);
    try {
      await submitPlacement(
        gameId!,
        faction.id,
        selectedWorker.workerType,
        selectedWorker.oratorRole,
      );
      setHasSubmittedThisSubRound(true);
      setSelectedWorker(null);
      await loadPlacements();
    } catch (e: any) {
      Alert.alert('Placement Failed', e.message ?? 'Could not submit placement');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResolve() {
    setResolving(true);
    try {
      // Capture pre-resolution influence
      const preInfluence: Record<string, number> = {};
      playerStates.forEach((ps) => { preInfluence[ps.player_id] = ps.influence; });

      await resolveCurrentPhase(gameId!);

      // Reload to get post-resolution state
      await loadPlayerStates();
      await loadFactions();
      await loadRound();

      // Calculate deltas
      const { data: postStates } = await supabase
        .from('game_player_state')
        .select('player_id, influence')
        .eq('game_id', gameId);

      const deltas: Record<string, number> = {};
      (postStates ?? []).forEach((ps: any) => {
        deltas[ps.player_id] = ps.influence - (preInfluence[ps.player_id] ?? 0);
      });
      setResultInfluence(deltas);
      setShowResults(true);
    } catch (e: any) {
      // Another client may have already resolved
      await loadRound();
      await loadPlayerStates();
    } finally {
      setResolving(false);
    }
  }

  function handleContinue() {
    setShowResults(false);
    setHasSubmittedThisSubRound(false);
    setSelectedWorker(null);
    loadPlacements();
  }

  // Build faction placement data for display
  function getFactionPlacements(factionId: string): FactionPlacement[] {
    if (!round) return [];
    // Only show placements from completed sub-rounds (sub_round < current)
    // plus the current user's own placement for current sub-round
    return placements
      .filter((p) => {
        if (p.faction_id !== factionId) return false;
        if (p.sub_round < round.sub_round) return true;
        if (p.sub_round === round.sub_round && p.player_id === currentUserId) return true;
        // Show all if phase is completed
        if (round.phase === 'completed') return true;
        return false;
      })
      .map((p) => {
        const player = players.find((pl) => pl.player_id === p.player_id);
        return {
          playerId: p.player_id,
          playerName: player?.player_name ?? 'Unknown',
          playerColor: player?.color ?? 'ivory',
          workerType: p.worker_type,
          oratorRole: p.orator_role ?? undefined,
          subRound: p.sub_round,
        };
      });
  }

  function getMyAffinity(factionId: string): number {
    return affinities.find(
      (a) => a.player_id === currentUserId && a.faction_id === factionId
    )?.affinity ?? 0;
  }

  // Workers used this round by current player
  const myUsedWorkers = placements
    .filter((p) => p.player_id === currentUserId)
    .map((p) => ({
      workerType: p.worker_type as any,
      oratorRole: p.orator_role as any,
    }));

  const submittedCount = round
    ? new Set(placements.filter((p) => p.sub_round === round.sub_round).map((p) => p.player_id)).size
    : 0;

  if (loading) {
    return (
      <ImageBackground source={gameBg} style={styles.background} resizeMode="cover">
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#e0c097" />
        </View>
      </ImageBackground>
    );
  }

  // Game finished screen
  if (gameStatus === 'finished') {
    const sorted = [...playerStates].sort((a, b) => b.influence - a.influence);
    return (
      <ImageBackground source={gameBg} style={styles.background} resizeMode="cover">
        <View style={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
          <Text style={styles.phaseTitle}>GAME OVER</Text>
          <Text style={styles.subTitle}>Final Standings</Text>
          <View style={styles.resultsList}>
            {sorted.map((ps, i) => {
              const player = players.find((p) => p.player_id === ps.player_id);
              return (
                <View key={ps.player_id} style={styles.resultRow}>
                  <Text style={styles.resultRank}>{i + 1}.</Text>
                  <View style={[styles.resultDot, { backgroundColor: getColorHex(player?.color ?? 'ivory') }]} />
                  <Text style={styles.resultName}>{player?.player_name ?? 'Unknown'}</Text>
                  <Text style={styles.resultInfluence}>{ps.influence}</Text>
                </View>
              );
            })}
          </View>
          <Pressable style={styles.actionButton} onPress={() => router.replace('/(app)/home')}>
            <Text style={styles.actionButtonText}>Return Home</Text>
          </Pressable>
        </View>
      </ImageBackground>
    );
  }

  // Resolution results overlay
  if (showResults) {
    return (
      <ImageBackground source={gameBg} style={styles.background} resizeMode="cover">
        <View style={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
          <Text style={styles.phaseTitle}>DEMAGOGERY RESOLVED</Text>
          <Text style={styles.subTitle}>
            Round {round ? round.round_number - 1 : '?'} Results
          </Text>

          <View style={styles.resultsList}>
            <Text style={styles.resultSectionHeader}>Influence Gained</Text>
            {players.map((p) => {
              const delta = resultInfluence[p.player_id] ?? 0;
              const total = playerStates.find((ps) => ps.player_id === p.player_id)?.influence ?? 0;
              return (
                <View key={p.player_id} style={styles.resultRow}>
                  <View style={[styles.resultDot, { backgroundColor: getColorHex(p.color) }]} />
                  <Text style={styles.resultName}>{p.player_name}</Text>
                  <Text style={[styles.resultDelta, delta > 0 && styles.resultDeltaPositive]}>
                    {delta > 0 ? `+${delta}` : delta.toString()}
                  </Text>
                  <Text style={styles.resultTotal}>{total}</Text>
                </View>
              );
            })}
          </View>

          <Pressable style={styles.actionButton} onPress={handleContinue}>
            <Text style={styles.actionButtonText}>
              {gameStatus === 'finished' ? 'See Final Results' : 'Continue'}
            </Text>
          </Pressable>
        </View>
      </ImageBackground>
    );
  }

  return (
    <ImageBackground source={gameBg} style={styles.background} resizeMode="cover">
      <View style={[styles.container, { paddingTop: insets.top + 8, paddingBottom: 0 }]}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.phaseTitle}>DEMAGOGERY</Text>
            <Text style={styles.roundInfo}>
              Round {round?.round_number ?? '?'} / Sub-round {round?.sub_round ?? '?'}
            </Text>
          </View>
          <View style={styles.influenceBox}>
            <Text style={styles.influenceLabel}>Influence</Text>
            <Text style={styles.influenceValue}>
              {playerStates.find((ps) => ps.player_id === currentUserId)?.influence ?? 0}
            </Text>
          </View>
        </View>

        {/* Status bar */}
        {hasSubmittedThisSubRound && round?.phase === 'demagogery' && (
          <View style={styles.statusBar}>
            <Text style={styles.statusText}>
              {resolving ? 'Resolving...' :
               submittedCount < players.length
                ? `Submitted. Waiting for ${players.length - submittedCount} player${players.length - submittedCount === 1 ? '' : 's'}...`
                : 'All submitted!'}
            </Text>
          </View>
        )}

        {round?.phase === 'completed' && !resolving && (
          <View style={styles.statusBar}>
            <Text style={styles.statusText}>All placements in. Resolving...</Text>
          </View>
        )}

        {/* Faction list */}
        <FlatList
          data={factions}
          keyExtractor={(f) => f.id}
          contentContainerStyle={styles.factionList}
          renderItem={({ item: faction }) => (
            <FactionCard
              factionKey={faction.faction_key}
              displayName={faction.display_name}
              powerLevel={faction.power_level}
              placements={getFactionPlacements(faction.id)}
              expanded={expandedFaction === faction.faction_key}
              onToggle={() => setExpandedFaction(
                expandedFaction === faction.faction_key ? null : faction.faction_key
              )}
              onPlace={handlePlace}
              selectedWorker={hasSubmittedThisSubRound ? null : selectedWorker}
              currentPlayerId={currentUserId}
              myAffinity={getMyAffinity(faction.id)}
            />
          )}
        />

        {/* Worker selector (only show when player can act) */}
        {round?.phase === 'demagogery' && !hasSubmittedThisSubRound && (
          <WorkerSelector
            usedWorkers={myUsedWorkers}
            selected={selectedWorker}
            onSelect={setSelectedWorker}
            disabled={submitting}
          />
        )}
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },
  loadingContainer: {
    flex: 1,
    backgroundColor: 'rgba(26, 26, 46, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: 'rgba(26, 26, 46, 0.7)',
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 4,
    paddingBottom: 10,
  },
  phaseTitle: {
    color: '#e0c097',
    fontSize: 22,
    fontWeight: 'bold',
    letterSpacing: 4,
    textAlign: 'center',
  },
  subTitle: {
    color: '#e0c097',
    fontSize: 14,
    opacity: 0.6,
    textAlign: 'center',
    marginBottom: 20,
  },
  roundInfo: {
    color: '#e0c097',
    fontSize: 12,
    opacity: 0.5,
    marginTop: 2,
  },
  influenceBox: {
    alignItems: 'center',
    backgroundColor: 'rgba(224, 192, 151, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(224, 192, 151, 0.2)',
  },
  influenceLabel: {
    color: '#e0c097',
    fontSize: 10,
    opacity: 0.5,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  influenceValue: {
    color: '#e0c097',
    fontSize: 20,
    fontWeight: '700',
  },
  statusBar: {
    backgroundColor: 'rgba(224, 192, 151, 0.1)',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  statusText: {
    color: '#e0c097',
    fontSize: 13,
    textAlign: 'center',
    fontStyle: 'italic',
    opacity: 0.7,
  },
  factionList: {
    gap: 8,
    paddingBottom: 8,
  },
  // Results screen
  resultsList: {
    flex: 1,
    paddingVertical: 16,
  },
  resultSectionHeader: {
    color: '#e0c097',
    fontSize: 13,
    opacity: 0.5,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 12,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(224, 192, 151, 0.08)',
  },
  resultRank: {
    color: '#e0c097',
    fontSize: 16,
    fontWeight: '600',
    width: 28,
    opacity: 0.6,
  },
  resultDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  resultName: {
    color: '#e0c097',
    fontSize: 15,
    flex: 1,
  },
  resultDelta: {
    color: '#e0c097',
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.5,
    marginRight: 12,
  },
  resultDeltaPositive: {
    color: '#2E8B57',
    opacity: 1,
  },
  resultTotal: {
    color: '#e0c097',
    fontSize: 16,
    fontWeight: '700',
    minWidth: 30,
    textAlign: 'right',
  },
  resultInfluence: {
    color: '#e0c097',
    fontSize: 18,
    fontWeight: '700',
    minWidth: 40,
    textAlign: 'right',
  },
  actionButton: {
    backgroundColor: 'rgba(224, 192, 151, 0.15)',
    borderWidth: 1,
    borderColor: '#e0c097',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  actionButtonText: {
    color: '#e0c097',
    fontSize: 18,
    fontWeight: '600',
  },
});
