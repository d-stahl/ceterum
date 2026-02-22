import {
  View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator,
  Alert, ImageBackground, Image, BackHandler,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../../lib/supabase';
import { submitPlacement } from '../../../lib/game-actions';
import { getColorHex } from '../../../lib/player-colors';
import { getSenatorIcon, getSaboteurIcon } from '../../../lib/worker-icons';
import { WorkerType, Placement } from '../../../lib/game-engine/workers';
import { BalancedFaction } from '../../../lib/game-engine/balance';
import { WorkerEffect } from '../../../lib/game-engine/demagogery';
import { computeTooltipEffects, getEffectForWorker } from '../../../lib/tooltip-effects';
import FactionCard, { FactionPlacement } from '../../../components/FactionCard';
import WorkerSelector from '../../../components/WorkerSelector';
import WorkerTooltip from '../../../components/WorkerTooltip';
import { DragProvider, useDrag } from '../../../components/DragContext';
import SubRoundAnnouncement from '../../../components/SubRoundAnnouncement';
const gameBg = require('../../../assets/images/demagogery-bg.png');

type Faction = {
  id: string;
  faction_key: string;
  display_name: string;
  power_level: number;
  pref_centralization: number;
  pref_expansion: number;
  pref_commerce: number;
  pref_patrician: number;
  pref_tradition: number;
  pref_militarism: number;
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
  return (
    <DragProvider>
      <GameScreenInner />
    </DragProvider>
  );
}

function GameScreenInner() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id: gameId } = useLocalSearchParams<{ id: string }>();
  const drag = useDrag();

  const [loading, setLoading] = useState(true);
  const [factions, setFactions] = useState<Faction[]>([]);
  const [round, setRound] = useState<Round | null>(null);
  const [players, setPlayers] = useState<PlayerInfo[]>([]);
  const [placements, setPlacements] = useState<PlacementRow[]>([]);
  const [playerStates, setPlayerStates] = useState<PlayerState[]>([]);
  const [affinities, setAffinities] = useState<Affinity[]>([]);
  const [currentUserId, setCurrentUserId] = useState('');
  const [expandedFactions, setExpandedFactions] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [hasSubmittedThisSubRound, setHasSubmittedThisSubRound] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [resultInfluence, setResultInfluence] = useState<Record<string, number>>({});
  const [gameStatus, setGameStatus] = useState('in_progress');
  const [tooltipData, setTooltipData] = useState<{
    effect: WorkerEffect;
    playerName: string;
    playerColor: string;
    factionName: string;
    position: { x: number; y: number };
  } | null>(null);

  // Drag overlay position
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const dragVisible = useSharedValue(false);
  const [dragWorkerType, setDragWorkerType] = useState<WorkerType | null>(null);

  const prevRoundRef = useRef<{ roundNumber: number; subRound: number; phase: string } | null>(null);
  const preResolutionInfluenceRef = useRef<Record<string, number> | null>(null);

  const myPlayer = players.find((p) => p.player_id === currentUserId);
  const playerColor = myPlayer?.color ?? 'ivory';

  // Intercept hardware back button — lobby uses router.replace so the back
  // stack has Create Game behind Game; send users to home instead.
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      router.replace('/(app)/home');
      return true;
    });
    return () => handler.remove();
  }, [router]);

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

  useEffect(() => {
    if (!round) return;
    const prev = prevRoundRef.current;
    if (prev) {
      const subRoundAdvanced = prev.subRound !== round.sub_round;
      const roundAdvanced = prev.roundNumber !== round.round_number;

      if (subRoundAdvanced || roundAdvanced) {
        setHasSubmittedThisSubRound(false);
        drag.clearPreliminary();
      }

      if (roundAdvanced) {
        // New round means resolution just completed server-side — show results
        handleShowResolutionResults();
      }
    }
    prevRoundRef.current = {
      roundNumber: round.round_number,
      subRound: round.sub_round,
      phase: round.phase,
    };
  }, [round]);

  useEffect(() => {
    if (!round || !currentUserId) return;
    const alreadySubmitted = placements.some(
      (p) => p.player_id === currentUserId && p.sub_round === round.sub_round
    );
    if (alreadySubmitted) setHasSubmittedThisSubRound(true);
  }, [placements, round, currentUserId]);

  // Snapshot influence before resolution fires so we can show deltas afterwards
  useEffect(() => {
    if (round?.phase === 'completed') {
      const snapshot: Record<string, number> = {};
      playerStates.forEach((ps) => { snapshot[ps.player_id] = ps.influence; });
      preResolutionInfluenceRef.current = snapshot;
    }
  }, [round?.phase, playerStates]);

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
      .select('id, faction_key, display_name, power_level, pref_centralization, pref_expansion, pref_commerce, pref_patrician, pref_tradition, pref_militarism')
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

  // Submit the preliminary placement
  async function handleSubmitMove() {
    const prelim = drag.preliminaryPlacement;
    if (!prelim || !round || hasSubmittedThisSubRound) return;

    const faction = factions.find((f) => f.faction_key === prelim.factionKey);
    if (!faction) return;

    setSubmitting(true);
    try {
      await submitPlacement(
        gameId!,
        faction.id,
        prelim.workerType,
        prelim.oratorRole,
      );
      setHasSubmittedThisSubRound(true);
      drag.clearPreliminary();
      await loadPlacements();
    } catch (e: any) {
      Alert.alert('Placement Failed', e.message ?? 'Could not submit placement');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleShowResolutionResults() {
    setResolving(true);
    try {
      const preInfluence = preResolutionInfluenceRef.current ?? {};
      preResolutionInfluenceRef.current = null;

      const { data: postStates } = await supabase
        .from('game_player_state')
        .select('player_id, influence')
        .eq('game_id', gameId);

      await loadPlayerStates();
      await loadFactions();

      const deltas: Record<string, number> = {};
      (postStates ?? []).forEach((ps: any) => {
        deltas[ps.player_id] = ps.influence - (preInfluence[ps.player_id] ?? 0);
      });
      setResultInfluence(deltas);
      setShowResults(true);
    } catch {
      await loadRound();
      await loadPlayerStates();
    } finally {
      setResolving(false);
    }
  }

  function handleContinue() {
    setShowResults(false);
    setHasSubmittedThisSubRound(false);
    drag.clearPreliminary();
    loadPlacements();
  }

  // Drag handlers
  // Lift the icon above the finger so it's fully visible and the
  // hit-test / hover highlight uses the icon center, not the fingertip.
  const DRAG_LIFT = 48;

  const handleDragStart = useCallback((workerType: WorkerType, x: number, y: number) => {
    setDragWorkerType(workerType);
    setTooltipData(null); // dismiss tooltip on drag
    dragX.value = x;
    dragY.value = y - DRAG_LIFT;
    dragVisible.value = true;
    drag.startDrag(workerType, x, y - DRAG_LIFT);
  }, [drag]);

  const handleDragMove = useCallback((x: number, y: number) => {
    dragX.value = x;
    dragY.value = y - DRAG_LIFT;
    drag.updateDrag(x, y - DRAG_LIFT);
  }, [drag]);

  const handleDragEnd = useCallback((x: number, y: number) => {
    dragVisible.value = false;
    setDragWorkerType(null);
    drag.endDrag(x, y - DRAG_LIFT);
  }, [drag]);

  const handleWorkerTap = useCallback((fp: FactionPlacement, position: { x: number; y: number }) => {
    // Build engine-compatible placements from current state (including preliminary)
    const enginePlacements: Placement[] = placements.map((p) => {
      const faction = factions.find((f) => f.id === p.faction_id);
      return {
        playerId: p.player_id,
        factionKey: faction?.faction_key ?? '',
        workerType: p.worker_type as WorkerType,
        oratorRole: (p.orator_role as any) ?? undefined,
        subRound: p.sub_round,
      };
    });

    // Add preliminary placement if present
    const prelim = drag.preliminaryPlacement;
    if (prelim) {
      enginePlacements.push({
        playerId: currentUserId,
        factionKey: prelim.factionKey,
        workerType: prelim.workerType,
        oratorRole: prelim.oratorRole,
        subRound: round?.sub_round ?? 0,
      });
    }

    // Build engine factions
    const engineFactions: BalancedFaction[] = factions.map((f) => ({
      key: f.faction_key,
      displayName: f.display_name,
      latinName: f.display_name,
      description: '',
      power: f.power_level,
      preferences: {
        centralization: f.pref_centralization,
        expansion: f.pref_expansion,
        commerce: f.pref_commerce,
        patrician: f.pref_patrician,
        tradition: f.pref_tradition,
        militarism: f.pref_militarism,
      },
    }));

    // Build affinity map
    const affinityMap: Record<string, Record<string, number>> = {};
    for (const a of affinities) {
      const faction = factions.find((f) => f.id === a.faction_id);
      if (!faction) continue;
      if (!affinityMap[a.player_id]) affinityMap[a.player_id] = {};
      affinityMap[a.player_id][faction.faction_key] = a.affinity;
    }

    const effects = computeTooltipEffects(enginePlacements, engineFactions, affinityMap);

    // Find the faction key for this placement
    const tappedFaction = factions.find((f) =>
      f.faction_key === fp.workerType // won't match, need faction from context
    );
    // The placement has playerColor/workerType/oratorRole but we need factionKey
    // We get factionKey from the FactionCard context — it's embedded in the placement data
    // Actually FactionPlacement doesn't have factionKey, so let's find it from the placements list
    // or from the preliminary placement
    let factionKey = '';
    if (fp.isPreliminary && prelim) {
      factionKey = prelim.factionKey;
    } else {
      const matchingPlacement = placements.find((p) => {
        const player = players.find((pl) => pl.player_id === p.player_id);
        return p.player_id === fp.playerId &&
          p.worker_type === fp.workerType &&
          (p.orator_role ?? undefined) === fp.oratorRole &&
          p.sub_round === fp.subRound;
      });
      if (matchingPlacement) {
        const faction = factions.find((f) => f.id === matchingPlacement.faction_id);
        factionKey = faction?.faction_key ?? '';
      }
    }

    const effect = getEffectForWorker(
      effects,
      fp.playerId,
      factionKey,
      fp.workerType as WorkerType,
      fp.oratorRole as any,
    );

    if (effect) {
      const faction = factions.find((f) => f.faction_key === factionKey);
      setTooltipData({
        effect,
        playerName: fp.playerName,
        playerColor: fp.playerColor,
        factionName: faction?.display_name ?? '',
        position,
      });
    }
  }, [placements, factions, affinities, drag.preliminaryPlacement, currentUserId, round, players]);

  const dragOverlayStyle = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    left: dragX.value - 24,
    top: dragY.value - 24,
    width: 48,
    height: 48,
    opacity: dragVisible.value ? 0.8 : 0,
    zIndex: 9999,
    pointerEvents: 'none' as const,
  }));

  // Build faction placement data
  function getFactionPlacements(factionId: string): FactionPlacement[] {
    if (!round) return [];
    const result: FactionPlacement[] = placements
      .filter((p) => {
        if (p.faction_id !== factionId) return false;
        if (p.sub_round < round.sub_round) return true;
        if (p.sub_round === round.sub_round && p.player_id === currentUserId) return true;
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

    // Add preliminary placement if it targets this faction
    const prelim = drag.preliminaryPlacement;
    if (prelim) {
      const faction = factions.find((f) => f.id === factionId);
      if (faction && faction.faction_key === prelim.factionKey) {
        result.push({
          playerId: currentUserId,
          playerName: myPlayer?.player_name ?? 'You',
          playerColor: playerColor,
          workerType: prelim.workerType,
          oratorRole: prelim.oratorRole,
          subRound: round?.sub_round ?? 0,
          isPreliminary: true,
        });
      }
    }

    return result;
  }

  function getAllPlayerAffinities(factionId: string) {
    return players.map((p) => {
      const aff = affinities.find(
        (a) => a.player_id === p.player_id && a.faction_id === factionId
      );
      return {
        playerId: p.player_id,
        playerName: p.player_name,
        playerColor: p.color,
        affinity: aff?.affinity ?? 0,
      };
    });
  }

  function getFactionPreferences(faction: Faction) {
    return {
      centralization: faction.pref_centralization,
      expansion: faction.pref_expansion,
      commerce: faction.pref_commerce,
      patrician: faction.pref_patrician,
      tradition: faction.pref_tradition,
      militarism: faction.pref_militarism,
    };
  }

  const myUsedWorkers = placements
    .filter((p) => p.player_id === currentUserId)
    .map((p) => ({
      workerType: p.worker_type as any,
      oratorRole: p.orator_role as any,
    }));

  const submittedCount = round
    ? new Set(placements.filter((p) => p.sub_round === round.sub_round).map((p) => p.player_id)).size
    : 0;

  const hasPreliminary = !!drag.preliminaryPlacement;

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
              Round {round?.round_number ?? '?'} / Demagogery Step {round?.sub_round ?? '?'}
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
          scrollEnabled={!drag.isDragging}
          onScroll={(e) => { drag.scrollOffset.current = e.nativeEvent.contentOffset.y; setTooltipData(null); }}
          scrollEventThrottle={16}
          renderItem={({ item: faction }) => (
            <FactionCard
              factionKey={faction.faction_key}
              displayName={faction.display_name}
              powerLevel={faction.power_level}
              placements={getFactionPlacements(faction.id)}
              expanded={expandedFactions.has(faction.faction_key)}
              onToggle={() => setExpandedFactions((prev) => {
                const next = new Set(prev);
                if (next.has(faction.faction_key)) {
                  next.delete(faction.faction_key);
                } else {
                  next.add(faction.faction_key);
                }
                return next;
              })}
              currentPlayerId={currentUserId}
              playerColor={playerColor}
              allPlayerAffinities={getAllPlayerAffinities(faction.id)}
              factionPreferences={getFactionPreferences(faction)}
              onDragStart={handleDragStart}
              onDragMove={handleDragMove}
              onDragEnd={handleDragEnd}
              onWorkerTap={handleWorkerTap}
            />
          )}
        />

        {/* Submit Move button */}
        {hasPreliminary && !hasSubmittedThisSubRound && round?.phase === 'demagogery' && (
          <Pressable
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={handleSubmitMove}
            disabled={submitting}
          >
            <Text style={styles.submitButtonText}>
              {submitting ? 'Submitting...' : 'Submit Move'}
            </Text>
          </Pressable>
        )}

        {/* Worker selector */}
        {round?.phase === 'demagogery' && !hasSubmittedThisSubRound && (
          <WorkerSelector
            usedWorkers={myUsedWorkers}
            preliminaryWorkerType={drag.preliminaryPlacement?.workerType ?? null}
            playerColor={playerColor}
            disabled={submitting}
            onDragStart={handleDragStart}
            onDragMove={handleDragMove}
            onDragEnd={handleDragEnd}
          />
        )}

        {/* Drag overlay */}
        <Animated.View style={dragOverlayStyle}>
          <DragOverlayIcon workerType={dragWorkerType} playerColor={playerColor} />
        </Animated.View>

        {/* Worker tooltip */}
        {tooltipData && (
          <WorkerTooltip
            effect={tooltipData.effect}
            playerName={tooltipData.playerName}
            playerColor={tooltipData.playerColor}
            factionName={tooltipData.factionName}
            position={tooltipData.position}
            onDismiss={() => setTooltipData(null)}
          />
        )}

        {/* Sub-round announcement */}
        {round && round.phase === 'demagogery' && (
          <SubRoundAnnouncement subRound={round.sub_round} roundNumber={round.round_number} />
        )}
      </View>
    </ImageBackground>
  );
}

function DragOverlayIcon({ workerType, playerColor }: { workerType: WorkerType | null; playerColor: string }) {
  if (!workerType) return null;
  const colorHex = getColorHex(playerColor);

  if (workerType === 'orator') {
    return (
      <Image
        source={getSenatorIcon(playerColor)}
        style={{ width: 48, height: 48 }}
        resizeMode="contain"
      />
    );
  }
  if (workerType === 'promoter') {
    return (
      <View style={{ width: 34, height: 34, backgroundColor: colorHex, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(0,0,0,0.2)' }} />
    );
  }
  if (workerType === 'saboteur') {
    return (
      <Image
        source={getSaboteurIcon(playerColor)}
        style={{ width: 48, height: 48 }}
        resizeMode="contain"
      />
    );
  }
  return null;
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
  submitButton: {
    backgroundColor: 'rgba(218, 165, 32, 0.25)',
    borderWidth: 1,
    borderColor: '#DAA520',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginHorizontal: 4,
    marginBottom: 8,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#DAA520',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
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
