import {
  View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator,
  Alert, ImageBackground, Image, BackHandler,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, runOnJS } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../../lib/supabase';
import { submitPlacement } from '../../../lib/game-actions';
import { getColorHex } from '../../../lib/player-colors';
import { getSenatorIcon, getSaboteurIcon, getPromoterIcon } from '../../../lib/worker-icons';
import { WorkerType, Placement } from '../../../lib/game-engine/workers';
import { BalancedFaction } from '../../../lib/game-engine/balance';
import { WorkerEffect } from '../../../lib/game-engine/demagogery';
import { computeTooltipEffects, getEffectForWorker } from '../../../lib/tooltip-effects';
import FactionCard, { FactionPlacement } from '../../../components/FactionCard';
import WorkerSelector from '../../../components/WorkerSelector';
import WorkerTooltip from '../../../components/WorkerTooltip';
import { DragProvider, useDrag } from '../../../components/DragContext';
import { HelpProvider, useHelp } from '../../../components/HelpContext';
import SubRoundAnnouncement from '../../../components/SubRoundAnnouncement';
import SenateLeaderSelection from '../../../components/SenateLeaderSelection';
import LeaderElection from '../../../components/LeaderElection';
import PlayersPanel from '../../../components/PlayersPanel';
import SenateLeaderPoolManager from '../../../components/SenateLeaderPoolManager';
import ControversyVoting from '../../../components/ControversyVoting';
import RoundEndSummary from '../../../components/RoundEndSummary';
import OnTheHorizon from '../../../components/OnTheHorizon';
import { C, parchmentBg, navyBg } from '../../../lib/theme';
import HomeIcon from '../../../components/icons/HomeIcon';
import HelpIcon from '../../../components/icons/HelpIcon';
import HelpModal from '../../../components/HelpModal';
import { ILLUSTRATION_MAP } from '../../../components/ControversyCard';
import { CONTROVERSY_MAP } from '../../../lib/game-engine/controversies';
const gameBg = require('../../../assets/images/demagogery-bg.png');
const leaderElectionBg = require('../../../assets/images/leader-election-bg.png');
const rulingBg = require('../../../assets/images/ruling-bg.png');

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
  senate_leader_id: string | null;
  controversy_pool: string[];
  controversies_resolved: string[];
  upcoming_pool: string[];
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
  agenda: Record<string, number> | null;
};

type Affinity = {
  player_id: string;
  faction_id: string;
  affinity: number;
};

type AxisState = {
  axis_key: string;
  current_value: number;
};

type ControversyStateRow = {
  controversy_key: string;
  status: string;
};

export default function GameScreen() {
  return (
    <DragProvider>
      <HelpProvider>
        <GameScreenInner />
      </HelpProvider>
    </DragProvider>
  );
}

function GameScreenInner() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id: gameId } = useLocalSearchParams<{ id: string }>();
  const drag = useDrag();
  const help = useHelp();

  const [loading, setLoading] = useState(true);
  const [factions, setFactions] = useState<Faction[]>([]);
  const [round, setRound] = useState<Round | null>(null);
  const [players, setPlayers] = useState<PlayerInfo[]>([]);
  const [placements, setPlacements] = useState<PlacementRow[]>([]);
  const [playerStates, setPlayerStates] = useState<PlayerState[]>([]);
  const [affinities, setAffinities] = useState<Affinity[]>([]);
  const [axes, setAxes] = useState<AxisState[]>([]);
  const [controversyStates, setControversyStates] = useState<ControversyStateRow[]>([]);
  const [currentUserId, setCurrentUserId] = useState('');
  const [expandedFactions, setExpandedFactions] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [hasSubmittedThisSubRound, setHasSubmittedThisSubRound] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [resultInfluence, setResultInfluence] = useState<Record<string, number>>({});
  const [gameStatus, setGameStatus] = useState('in_progress');
  const [onTheHorizonVisible, setOnTheHorizonVisible] = useState(false);
  const [playersVisible, setPlayersVisible] = useState(false);
  const [showElectionResults, setShowElectionResults] = useState(false);
  const [showRoundEnd, setShowRoundEnd] = useState(false);
  const [tooltipData, setTooltipData] = useState<{
    effect: WorkerEffect;
    playerName: string;
    playerColor: string;
    factionName: string;
    position: { x: number; y: number };
  } | null>(null);

  // Worker drag overlay position
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const dragVisible = useSharedValue(false);
  const [dragWorkerType, setDragWorkerType] = useState<WorkerType | null>(null);

  // Help icon drag overlay position
  const helpDragX = useSharedValue(0);
  const helpDragY = useSharedValue(0);
  const helpDragVisible = useSharedValue(false);

  const prevRoundRef = useRef<{ roundNumber: number; subRound: number; phase: string } | null>(null);
  const preResolutionInfluenceRef = useRef<Record<string, number> | null>(null);
  const preRoundEndInfluenceRef = useRef<Record<string, number>>({});
  const preRoundEndFactionPowerRef = useRef<Record<string, number>>({});

  const myPlayer = players.find((p) => p.player_id === currentUserId);
  const playerColor = myPlayer?.color ?? 'ivory';

  // Derived ruling-phase values
  const senateLeaderId = round?.senate_leader_id ?? '';
  const isSenateLeader = !!senateLeaderId && senateLeaderId === currentUserId;
  const activeFactionKeys = factions.map((f) => f.faction_key);
  const controversyPoolKeys = round?.controversy_pool ?? [];
  const myInfluence = playerStates.find((ps) => ps.player_id === currentUserId)?.influence ?? 0;
  // Prefer showing a resolved controversy (so the player sees the results screen)
  // before showing the next declared/voting one.
  const resolvedControversy = controversyStates.find((cs) => cs.status === 'resolved');
  const pendingControversy = controversyStates.find(
    (cs) => cs.status === 'declared' || cs.status === 'voting',
  );
  const [dismissedResolvedKey, setDismissedResolvedKey] = useState('');
  const activeControversyKey =
    (resolvedControversy && resolvedControversy.controversy_key !== dismissedResolvedKey
      ? resolvedControversy.controversy_key
      : pendingControversy?.controversy_key) ?? '';
  const maxInfluence = playerStates.length > 0 ? Math.max(...playerStates.map((ps) => ps.influence)) : 0;
  const pledgeContenders = !round?.senate_leader_id
    ? playerStates.filter((ps) => ps.influence === maxInfluence).map((ps) => ps.player_id)
    : [];

  // Derived values for controversy card visualizations
  const axisValuesMap: Record<string, number> = {};
  axes.forEach((a) => { axisValuesMap[a.axis_key] = a.current_value; });
  const factionInfoMap: Record<string, { key: string; displayName: string; power: number }> = {};
  factions.forEach((f) => { factionInfoMap[f.faction_key] = { key: f.faction_key, displayName: f.display_name, power: f.power_level }; });
  const playerAgendas: { playerId: string; name: string; color: string; agenda: Record<string, number> }[] = [];
  playerStates.forEach((ps) => {
    if (!ps.agenda) return;
    const p = players.find((pl) => pl.player_id === ps.player_id);
    if (p) playerAgendas.push({ playerId: ps.player_id, name: p.player_name, color: p.color, agenda: ps.agenda });
  });

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
        event: '*', schema: 'public', table: 'game_axes',
        filter: `game_id=eq.${gameId}`,
      }, () => { loadAxes(); })
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'game_controversy_state',
        filter: `game_id=eq.${gameId}`,
      }, () => { loadControversyStates(); })
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

  // Detect phase transitions
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

      // Demagogery just resolved → show demagogery results before ruling phase
      if (prev.phase === 'demagogery' && round.phase !== 'demagogery') {
        handleShowResolutionResults();
      }

      // Election just resolved → hold the results screen
      if (prev.phase === 'leader_election' && round.phase === 'ruling_pool') {
        setShowElectionResults(true);
      }

      // New round started → show round-end summary overlay and auto-open horizon
      if (roundAdvanced) {
        setShowRoundEnd(true);
        setOnTheHorizonVisible(true);
        setDismissedResolvedKey('');
      }
    }
    prevRoundRef.current = {
      roundNumber: round.round_number,
      subRound: round.sub_round,
      phase: round.phase,
    };
  }, [round]);

  // Close On the Horizon when phase changes (players can reopen manually)
  useEffect(() => {
    setOnTheHorizonVisible(false);
  }, [round?.phase]);

  // Reload controversy states when round or phase changes
  useEffect(() => {
    if (round?.id) {
      loadControversyStates();
    }
  }, [round?.id, round?.phase]);

  useEffect(() => {
    if (!round || !currentUserId) return;
    const alreadySubmitted = placements.some(
      (p) => p.player_id === currentUserId && p.sub_round === round.sub_round
    );
    if (alreadySubmitted) setHasSubmittedThisSubRound(true);
  }, [placements, round, currentUserId]);

  // Rolling snapshot of influence during demagogery — used for results delta
  useEffect(() => {
    if (round?.phase === 'demagogery') {
      const snapshot: Record<string, number> = {};
      playerStates.forEach((ps) => { snapshot[ps.player_id] = ps.influence; });
      preResolutionInfluenceRef.current = snapshot;
    }
  }, [playerStates, round?.phase]);

  // Snapshot influence + faction powers during ruling_voting_2 — used for round-end display
  useEffect(() => {
    if (round?.phase === 'ruling_voting_2') {
      const infSnapshot: Record<string, number> = {};
      playerStates.forEach((ps) => { infSnapshot[ps.player_id] = ps.influence; });
      preRoundEndInfluenceRef.current = infSnapshot;
      const powerSnapshot: Record<string, number> = {};
      factions.forEach((f) => { powerSnapshot[f.faction_key] = f.power_level; });
      preRoundEndFactionPowerRef.current = powerSnapshot;
    }
  }, [playerStates, factions, round?.phase]);

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
        loadAxes(),
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
      .select('id, round_number, phase, sub_round, senate_leader_id, controversy_pool, controversies_resolved, upcoming_pool')
      .eq('game_id', gameId)
      .order('round_number', { ascending: false })
      .limit(1)
      .single();
    if (data) setRound(data as Round);
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
      .select('player_id, influence, agenda')
      .eq('game_id', gameId);
    if (data) setPlayerStates(data as PlayerState[]);
  }

  async function loadAffinities() {
    const { data } = await supabase
      .from('game_player_faction_affinity')
      .select('player_id, faction_id, affinity')
      .eq('game_id', gameId);
    if (data) setAffinities(data);
  }

  async function loadAxes() {
    const { data } = await supabase
      .from('game_axes')
      .select('axis_key, current_value')
      .eq('game_id', gameId);
    if (data) setAxes(data);
  }

  async function loadControversyStates() {
    const { data: currentRound } = await supabase
      .from('game_rounds')
      .select('id')
      .eq('game_id', gameId)
      .order('round_number', { ascending: false })
      .limit(1)
      .single();
    if (!currentRound) return;

    const { data } = await supabase
      .from('game_controversy_state')
      .select('controversy_key, status')
      .eq('round_id', currentRound.id);
    if (data) setControversyStates(data as ControversyStateRow[]);
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
    setShowResults(true);
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

    let factionKey = '';
    if (fp.isPreliminary && prelim) {
      factionKey = prelim.factionKey;
    } else {
      const matchingPlacement = placements.find((p) => {
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

  const helpDragOverlayStyle = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    left: helpDragX.value - 16,
    top: helpDragY.value - 16,
    width: 32,
    height: 32,
    opacity: helpDragVisible.value ? 0.9 : 0,
    zIndex: 10000,
    pointerEvents: 'none' as const,
  }));

  const doOpenHelp = useCallback(() => help?.openGeneralHelp(), [help]);
  const doStartHelpDrag = useCallback((x: number, y: number) => help?.startHelpDrag(x, y), [help]);
  const doUpdateHelpDrag = useCallback((x: number, y: number) => help?.updateHelpDrag(x, y), [help]);
  const doEndHelpDrag = useCallback((x: number, y: number) => help?.endHelpDrag(x, y), [help]);

  // Lift the help icon above the finger so the icon center aligns with
  // where the user is pointing, matching the worker drag behaviour.
  const HELP_LIFT = 48;

  const helpIconGesture = Gesture.Exclusive(
    Gesture.Pan()
      .minDistance(8)
      .onStart((e) => {
        helpDragX.value = e.absoluteX;
        helpDragY.value = e.absoluteY - HELP_LIFT;
        helpDragVisible.value = true;
        runOnJS(doStartHelpDrag)(e.absoluteX, e.absoluteY - HELP_LIFT);
      })
      .onUpdate((e) => {
        helpDragX.value = e.absoluteX;
        helpDragY.value = e.absoluteY - HELP_LIFT;
        runOnJS(doUpdateHelpDrag)(e.absoluteX, e.absoluteY - HELP_LIFT);
      })
      .onEnd((e) => {
        helpDragVisible.value = false;
        runOnJS(doEndHelpDrag)(e.absoluteX, e.absoluteY - HELP_LIFT);
      }),
    Gesture.Tap().onEnd(() => {
      runOnJS(doOpenHelp)();
    }),
  );

  // Build faction placement data
  function getFactionPlacements(factionId: string): FactionPlacement[] {
    if (!round) return [];
    const result: FactionPlacement[] = placements
      .filter((p) => {
        if (p.faction_id !== factionId) return false;
        if (p.sub_round < round.sub_round) return true;
        if (p.sub_round === round.sub_round && p.player_id === currentUserId) return true;
        // Show all placements once demagogery phase is over
        if (round.phase !== 'demagogery') return true;
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
          <ActivityIndicator size="large" color={C.parchment} />
        </View>
      </ImageBackground>
    );
  }

  // Game finished screen
  if (gameStatus === 'finished' && !showRoundEnd) {
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

  // Demagogery resolution results overlay
  if (showResults) {
    return (
      <ImageBackground source={gameBg} style={styles.background} resizeMode="cover">
        <View style={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
          <Text style={styles.phaseTitle}>DEMAGOGERY RESOLVED</Text>
          <Text style={styles.subTitle}>
            Round {round?.round_number ?? '?'} Results
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
            <Text style={styles.actionButtonText}>Continue to Leader Election</Text>
          </Pressable>
        </View>
      </ImageBackground>
    );
  }

  // --- Phase routing ---
  const phase = round?.phase ?? 'demagogery';

  // During ruling phases, show the drawn controversy pool;
  // during demagogery, show the upcoming_pool preview from game state.
  const upcomingPoolKeys = round?.upcoming_pool ?? [];
  const horizonKeys = controversyPoolKeys.length > 0 ? controversyPoolKeys : upcomingPoolKeys;

  if (phase === 'leader_election' || showElectionResults) {
    return (
      <ImageBackground source={leaderElectionBg} style={styles.background} resizeMode="cover">
        <View style={[styles.container, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }]}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.phaseTitle}>ELECTION</Text>
              <Text style={styles.roundInfo}>Round {round?.round_number ?? '?'}</Text>
            </View>
            <View style={styles.headerRight}>
              <Pressable style={styles.helpButton} onPress={() => help?.openHelp('leader-election')}>
                <HelpIcon size={22} color={C.parchment} />
              </Pressable>
              <Pressable style={styles.homeButton} onPress={() => router.replace('/(app)/home')}>
                <HomeIcon size={22} color={C.parchment} />
              </Pressable>
              <View style={styles.influenceBox}>
                <Text style={styles.influenceLabel}>Influence</Text>
                <Text style={styles.influenceValue}>{myInfluence}</Text>
              </View>
            </View>
          </View>
          <LeaderElection
            gameId={gameId!}
            roundId={round!.id}
            currentUserId={currentUserId}
            players={players}
            playerStates={playerStates}
            senateLeaderId={senateLeaderId || null}
            onLeaderSelected={() => { setShowElectionResults(false); loadRound(); }}
          />
          <OnTheHorizon
            poolKeys={horizonKeys}
            activeFactionKeys={activeFactionKeys}
            visible={onTheHorizonVisible}
            onClose={() => setOnTheHorizonVisible((v) => !v)}
            axisValues={axisValuesMap}
            factionInfoMap={factionInfoMap}
            playerAgendas={playerAgendas}
          />
          <PlayersPanel
            players={players}
            playerStates={playerStates}
            playerAgendas={playerAgendas}
            axes={axisValuesMap}
            currentUserId={currentUserId}
            visible={playersVisible}
            onClose={() => setPlayersVisible((v) => !v)}
          />
          <HelpModal helpId={help?.activeHelpId ?? null} onDismiss={() => help?.dismissHelp()} />
        </View>
      </ImageBackground>
    );
  }

  if (phase === 'ruling_selection') {
    return (
      <ImageBackground source={gameBg} style={styles.background} resizeMode="cover">
        <View style={[styles.container, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }]}>
          <SenateLeaderSelection
            gameId={gameId!}
            roundId={round!.id}
            currentUserId={currentUserId}
            senateLeaderId={senateLeaderId || null}
            pledgeContenders={pledgeContenders}
            players={players}
            onLeaderSelected={loadRound}
          />
        </View>
      </ImageBackground>
    );
  }

  if (phase === 'ruling_pool') {
    return (
      <ImageBackground source={rulingBg} style={styles.background} resizeMode="cover">
        <View style={[styles.container, { paddingTop: insets.top + 8, paddingBottom: 0 }]}>
          <SenateLeaderPoolManager
            gameId={gameId!}
            poolKeys={controversyPoolKeys}
            activeFactionKeys={activeFactionKeys}
            isSenateLeader={isSenateLeader}
            senateLeaderName={players.find((p) => p.player_id === senateLeaderId)?.player_name}
            senateLeaderColor={players.find((p) => p.player_id === senateLeaderId)?.color}
            axisValues={axisValuesMap}
            factionInfoMap={factionInfoMap}
            playerAgendas={playerAgendas}
          />
          <OnTheHorizon
            poolKeys={horizonKeys}
            activeFactionKeys={activeFactionKeys}
            visible={onTheHorizonVisible}
            onClose={() => setOnTheHorizonVisible((v) => !v)}
            axisValues={axisValuesMap}
            factionInfoMap={factionInfoMap}
            playerAgendas={playerAgendas}
          />
          <PlayersPanel
            players={players}
            playerStates={playerStates}
            playerAgendas={playerAgendas}
            axes={axisValuesMap}
            currentUserId={currentUserId}
            visible={playersVisible}
            onClose={() => setPlayersVisible((v) => !v)}
          />
        </View>
      </ImageBackground>
    );
  }

  if (phase === 'ruling_voting_1' || phase === 'ruling_voting_2') {
    const controversyObj = activeControversyKey ? CONTROVERSY_MAP[activeControversyKey] : null;
    const controversyIllustration = controversyObj ? ILLUSTRATION_MAP[controversyObj.illustration] : null;
    const votingBg = controversyIllustration ?? rulingBg;

    return (
      <ImageBackground source={votingBg} style={styles.background} resizeMode="cover">
        <View style={[styles.container, { paddingTop: insets.top + 8, paddingBottom: 0 }]}>
          {activeControversyKey ? (
            <ControversyVoting
              gameId={gameId!}
              roundId={round!.id}
              controversyKey={activeControversyKey}
              currentUserId={currentUserId}
              senateLeaderId={senateLeaderId}
              currentInfluence={myInfluence}
              players={players}
              activeFactionKeys={activeFactionKeys}
              factionInfoMap={factionInfoMap}
              axisValues={axisValuesMap}
              playerAgendas={playerAgendas}
              onContinue={() => {
                setDismissedResolvedKey(activeControversyKey);
                loadRound();
              }}
            />
          ) : (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={C.gold} size="large" />
            </View>
          )}
          <OnTheHorizon
            poolKeys={horizonKeys}
            activeFactionKeys={activeFactionKeys}
            activeControversyKey={activeControversyKey}
            visible={onTheHorizonVisible}
            onClose={() => setOnTheHorizonVisible((v) => !v)}
            axisValues={axisValuesMap}
            factionInfoMap={factionInfoMap}
            playerAgendas={playerAgendas}
          />
          <PlayersPanel
            players={players}
            playerStates={playerStates}
            playerAgendas={playerAgendas}
            axes={axisValuesMap}
            currentUserId={currentUserId}
            visible={playersVisible}
            onClose={() => setPlayersVisible((v) => !v)}
          />
        </View>
      </ImageBackground>
    );
  }

  // --- Demagogery view (default) ---
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
          <View style={styles.headerRight}>
            <GestureDetector gesture={helpIconGesture}>
              <Animated.View style={styles.helpButton}>
                <HelpIcon size={22} color={C.parchment} />
              </Animated.View>
            </GestureDetector>
            <Pressable style={styles.homeButton} onPress={() => router.replace('/(app)/home')}>
              <HomeIcon size={22} color={C.parchment} />
            </Pressable>
            <View style={styles.influenceBox}>
              <Text style={styles.influenceLabel}>Influence</Text>
              <Text style={styles.influenceValue}>{myInfluence}</Text>
            </View>
          </View>
        </View>

        {/* Status bar */}
        {hasSubmittedThisSubRound && phase === 'demagogery' && (
          <View style={styles.statusBar}>
            <Text style={styles.statusText}>
              {resolving ? 'Resolving...' :
               submittedCount < players.length
                ? `Submitted. Waiting for ${players.length - submittedCount} player${players.length - submittedCount === 1 ? '' : 's'}...`
                : 'All submitted!'}
            </Text>
          </View>
        )}

        {phase === 'demagogery_resolved' && !resolving && (
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
              playerAgendas={playerAgendas}
              onDragStart={handleDragStart}
              onDragMove={handleDragMove}
              onDragEnd={handleDragEnd}
              onWorkerTap={handleWorkerTap}
            />
          )}
        />

        {/* Submit Move button */}
        {hasPreliminary && !hasSubmittedThisSubRound && phase === 'demagogery' && (
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
        {phase === 'demagogery' && !hasSubmittedThisSubRound && (
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

        {/* Worker drag overlay */}
        <Animated.View style={dragOverlayStyle}>
          <DragOverlayIcon workerType={dragWorkerType} playerColor={playerColor} />
        </Animated.View>

        {/* Help icon drag overlay */}
        <Animated.View style={helpDragOverlayStyle}>
          <HelpIcon size={32} color={C.parchment} />
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
        {phase === 'demagogery' && round && (
          <SubRoundAnnouncement subRound={round.sub_round} roundNumber={round.round_number} />
        )}

        {/* On the Horizon slide-in panel */}
        <OnTheHorizon
          poolKeys={horizonKeys}
          activeFactionKeys={activeFactionKeys}
          visible={onTheHorizonVisible}
          onClose={() => setOnTheHorizonVisible((v) => !v)}
          axisValues={axisValuesMap}
          factionInfoMap={factionInfoMap}
          playerAgendas={playerAgendas}
        />

        {/* Players slide-in panel */}
        <PlayersPanel
          players={players}
          playerStates={playerStates}
          playerAgendas={playerAgendas}
          axes={axisValuesMap}
          currentUserId={currentUserId}
          visible={playersVisible}
          onClose={() => setPlayersVisible((v) => !v)}
        />

        {/* Round-end summary overlay (absolute, shown at start of new round) */}
        {showRoundEnd && round && (
          <RoundEndSummary
            roundNumber={round.round_number - 1}
            isGameOver={gameStatus === 'finished'}
            playerInfluences={players.map((p) => {
              const currentInf = playerStates.find((ps) => ps.player_id === p.player_id)?.influence ?? 0;
              const beforeInf = preRoundEndInfluenceRef.current[p.player_id] ?? currentInf * 2;
              return {
                player_id: p.player_id,
                player_name: p.player_name,
                color: getColorHex(p.color),
                influenceBefore: beforeInf,
                influenceAfter: currentInf,
              };
            })}
            axes={axes}
            factionPowers={factions.map((f) => ({
              faction_key: f.faction_key,
              display_name: f.display_name,
              power_level: f.power_level,
              change: f.power_level - (preRoundEndFactionPowerRef.current[f.faction_key] ?? f.power_level),
            }))}
            onContinue={() => setShowRoundEnd(false)}
          />
        )}
      </View>

      {/* Help modal */}
      <HelpModal helpId={help?.activeHelpId ?? null} onDismiss={() => help?.dismissHelp()} />
    </ImageBackground>
  );
}

function DragOverlayIcon({ workerType, playerColor }: { workerType: WorkerType | null; playerColor: string }) {
  if (!workerType) return null;

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
      <Image
        source={getPromoterIcon(playerColor)}
        style={{ width: 48, height: 48 }}
        resizeMode="contain"
      />
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
    backgroundColor: navyBg(0.7),
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: navyBg(0.7),
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
    color: C.parchment,
    fontSize: 22,
    fontWeight: 'bold',
    letterSpacing: 4,
    textAlign: 'center',
  },
  subTitle: {
    color: C.parchment,
    fontSize: 14,
    opacity: 0.6,
    textAlign: 'center',
    marginBottom: 20,
  },
  roundInfo: {
    color: C.parchment,
    fontSize: 12,
    opacity: 0.5,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  helpButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: parchmentBg(0.08),
  },
  homeButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: parchmentBg(0.08),
  },
  influenceBox: {
    alignItems: 'center',
    backgroundColor: parchmentBg(0.1),
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: parchmentBg(0.2),
  },
  influenceLabel: {
    color: C.parchment,
    fontSize: 10,
    opacity: 0.5,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  influenceValue: {
    color: C.parchment,
    fontSize: 20,
    fontWeight: '700',
  },
  statusBar: {
    backgroundColor: parchmentBg(0.1),
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  statusText: {
    color: C.parchment,
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
    borderColor: C.accentGold,
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
    color: C.accentGold,
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
    color: C.parchment,
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
    borderBottomColor: parchmentBg(0.08),
  },
  resultRank: {
    color: C.parchment,
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
    color: C.parchment,
    fontSize: 15,
    flex: 1,
  },
  resultDelta: {
    color: C.parchment,
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
    color: C.parchment,
    fontSize: 16,
    fontWeight: '700',
    minWidth: 30,
    textAlign: 'right',
  },
  resultInfluence: {
    color: C.parchment,
    fontSize: 18,
    fontWeight: '700',
    minWidth: 40,
    textAlign: 'right',
  },
  actionButton: {
    backgroundColor: parchmentBg(0.15),
    borderWidth: 1,
    borderColor: C.parchment,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  actionButtonText: {
    color: C.parchment,
    fontSize: 18,
    fontWeight: '600',
  },
});
