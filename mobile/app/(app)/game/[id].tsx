import {
  View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator,
  Alert, ImageBackground, Image, BackHandler, ScrollView,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, runOnJS } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../../lib/supabase';
import { submitPlacement, advanceRound, fetchPreviewEffects, PreliminaryPlacementRequest } from '../../../lib/game-actions';
import { getColorHex } from '../../../lib/player-colors';
import { getSenatorIcon, getSaboteurIcon, getPromoterIcon } from '../../../lib/worker-icons';
import { WorkerType, OratorRole } from '../../../lib/game-engine/workers';
import { WorkerEffect } from '../../../lib/game-engine/demagogery';
import { getEffectForWorker } from '../../../lib/tooltip-effects';
import FactionCard, { FactionPlacement } from '../../../components/FactionCard';
import WorkerSelector from '../../../components/WorkerSelector';
import WorkerTooltip from '../../../components/WorkerTooltip';
import { DragProvider, useDrag } from '../../../components/DragContext';
import { HelpProvider, useHelp } from '../../../components/HelpContext';
import SubRoundAnnouncement from '../../../components/SubRoundAnnouncement';
import SenateLeaderSelection from '../../../components/SenateLeaderSelection';
import LeaderElection from '../../../components/LeaderElection';
import PlayersPanel from '../../../components/PlayersPanel';
import FactionsPanel from '../../../components/FactionsPanel';
import SenateLeaderPoolManager from '../../../components/SenateLeaderPoolManager';
import ControversyVoting from '../../../components/ControversyVoting';
import RoundEndSummary from '../../../components/RoundEndSummary';
import OnTheHorizon from '../../../components/OnTheHorizon';
import { C, parchmentBg, navyBg, goldBg, accentGoldBg } from '../../../lib/theme';
import HelpIcon from '../../../components/icons/HelpIcon';
import HelpModal from '../../../components/HelpModal';
import { ILLUSTRATION_MAP, AxisEffectSlider } from '../../../components/ControversyCard';
import ResolvedControversySummary from '../../../components/ResolvedControversySummary';
import RoundHeader from '../../../components/RoundHeader';
import { CONTROVERSY_MAP } from '../../../lib/game-engine/controversies';
import { AXIS_KEYS, AXIS_LABELS, AxisKey, computeAxisScore } from '../../../lib/game-engine/axes';
const gameBg = require('../../../assets/images/demagogery-bg.png');
const leaderElectionBg = require('../../../assets/images/leader-election-bg.png');
const rulingBg = require('../../../assets/images/ruling-bg.png');
const gameOverBg = require('../../../assets/images/game-over-bg.png');

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
  initial_faction_powers: Record<string, number> | null;
  initial_influence: Record<string, number> | null;
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
  winning_resolution_key: string | null;
  axis_effects_applied: Record<string, number> | null;
  faction_power_effects_applied: Record<string, number> | null;
  resolved_at?: string | null;
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
  const [factionsVisible, setFactionsVisible] = useState(false);
  const [showElectionResults, setShowElectionResults] = useState(false);
  const [showRoundEnd, setShowRoundEnd] = useState(false);
  const [allResolvedStates, setAllResolvedStates] = useState<ControversyStateRow[]>([]);
  const [showResolutions, setShowResolutions] = useState(false);
  const [tooltipData, setTooltipData] = useState<{
    effect?: WorkerEffect;
    loading?: boolean;
    playerName: string;
    playerColor: string;
    factionName: string;
    position: { x: number; y: number };
    pendingPlayerId?: string;
    pendingFactionKey?: string;
    pendingWorkerType?: WorkerType;
    pendingOratorRole?: OratorRole;
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
  const placementsRoundIdRef = useRef<string | null>(null);
  const showElectionResultsRef = useRef(false);
  const preResolutionInfluenceRef = useRef<Record<string, number> | null>(null);
  const workerEffectsRef = useRef<WorkerEffect[]>([]);
  const previewFetchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchGenerationRef = useRef(0);

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
  const [dismissedResolvedKeys, setDismissedResolvedKeys] = useState<Set<string>>(new Set());
  const activeControversyKey =
    (resolvedControversy && !dismissedResolvedKeys.has(resolvedControversy.controversy_key)
      ? resolvedControversy.controversy_key
      : pendingControversy?.controversy_key) ?? '';
  const maxInfluence = playerStates.length > 0 ? Math.max(...playerStates.map((ps) => ps.influence)) : 0;
  const pledgeContenders = !round?.senate_leader_id
    ? playerStates.filter((ps) => ps.influence === maxInfluence).map((ps) => ps.player_id)
    : [];

  // Derived values for controversy card visualizations
  const axisValuesMap: Record<string, number> = {};
  axes.forEach((a) => { axisValuesMap[a.axis_key] = a.current_value; });
  const factionInfoMap: Record<string, { key: string; displayName: string; power: number; preferences: Record<string, number> }> = {};
  factions.forEach((f) => { factionInfoMap[f.faction_key] = { key: f.faction_key, displayName: f.display_name, power: f.power_level, preferences: { centralization: f.pref_centralization, expansion: f.pref_expansion, commerce: f.pref_commerce, patrician: f.pref_patrician, tradition: f.pref_tradition, militarism: f.pref_militarism } }; });
  const factionIdMap: Record<string, string> = {};
  factions.forEach((f) => { factionIdMap[f.id] = f.faction_key; });
  const factionInfoList = Object.values(factionInfoMap);
  const playerAgendas: { playerId: string; name: string; color: string; agenda: Record<string, number> }[] = [];
  playerStates.forEach((ps) => {
    if (!ps.agenda) return;
    const p = players.find((pl) => pl.player_id === ps.player_id);
    if (p) playerAgendas.push({ playerId: ps.player_id, name: p.player_name, color: p.color, agenda: ps.agenda });
  });
  const resolvedMap: Record<string, { winningResolutionKey: string; axisEffects: Record<string, number>; factionPowerEffects: Record<string, number> }> = {};
  controversyStates.forEach((cs) => {
    if (cs.status === 'resolved' && cs.winning_resolution_key) {
      resolvedMap[cs.controversy_key] = {
        winningResolutionKey: cs.winning_resolution_key,
        axisEffects: cs.axis_effects_applied ?? {},
        factionPowerEffects: cs.faction_power_effects_applied ?? {},
      };
    }
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
        event: '*', schema: 'public', table: 'game_player_faction_affinity',
        filter: `game_id=eq.${gameId}`,
      }, () => { loadAffinities(); })
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
          loadAllResolvedControversies();
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
        setTooltipData(null);
      }

      // Demagogery just resolved → show demagogery results before ruling phase
      if (prev.phase === 'demagogery' && round.phase !== 'demagogery') {
        setTooltipData(null);
        handleShowResolutionResults();
      }

      // New round started → clear stale state
      if (roundAdvanced) {
        placementsRoundIdRef.current = null;
        setPlacements([]);  // Clear stale placements from previous round
        setOnTheHorizonVisible(true);
        setDismissedResolvedKeys(new Set());
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
    if (!round || !currentUserId || round.phase !== 'demagogery') return;
    // Only check placements that belong to the current round to avoid stale data races
    if (placementsRoundIdRef.current !== round.id) return;
    const alreadySubmitted = placements.some(
      (p) => p.player_id === currentUserId && p.sub_round === round.sub_round
    );
    if (alreadySubmitted) setHasSubmittedThisSubRound(true);
  }, [placements, round, currentUserId]);

  // Snapshot influence on first render in demagogery phase — used for results delta.
  // Only capture once (when ref is null) to avoid overwriting with post-resolution values
  // that arrive before the phase change propagates via realtime.
  useEffect(() => {
    if (round?.phase === 'demagogery' && !preResolutionInfluenceRef.current && playerStates.length > 0) {
      const snapshot: Record<string, number> = {};
      playerStates.forEach((ps) => { snapshot[ps.player_id] = ps.influence; });
      preResolutionInfluenceRef.current = snapshot;
    }
  }, [playerStates, round?.phase]);

  const fetchAndCacheEffects = useCallback(async (preliminary?: PreliminaryPlacementRequest) => {
    const myGeneration = ++fetchGenerationRef.current;
    try {
      const effects = await fetchPreviewEffects(gameId, preliminary);
      if (fetchGenerationRef.current !== myGeneration) return; // stale response, discard
      workerEffectsRef.current = effects;

      // If there's a loading tooltip open, populate it now that data arrived
      setTooltipData((prev) => {
        if (!prev || !prev.loading) return prev;
        const effect = getEffectForWorker(
          effects,
          prev.pendingPlayerId!,
          prev.pendingFactionKey!,
          prev.pendingWorkerType!,
          prev.pendingOratorRole,
        );
        if (!effect) return null;
        return {
          effect,
          playerName: prev.playerName,
          playerColor: prev.playerColor,
          factionName: prev.factionName,
          position: prev.position,
        };
      });
    } catch (e) {
      console.warn('[preview-effects] fetch failed:', e);
      // Dismiss any open loading tooltip (spinner would be stuck forever otherwise)
      setTooltipData((prev) => (prev?.loading ? null : prev));
    }
  }, [gameId]);

  // Debounced re-fetch of preview effects when preliminary placement changes
  useEffect(() => {
    const phase = round?.phase;
    if (phase !== 'demagogery') return;

    if (previewFetchDebounceRef.current) {
      clearTimeout(previewFetchDebounceRef.current);
    }

    const prelim = drag.preliminaryPlacement;

    if (prelim) {
      previewFetchDebounceRef.current = setTimeout(() => {
        fetchAndCacheEffects({
          factionKey: prelim.factionKey,
          workerType: prelim.workerType,
          oratorRole: prelim.oratorRole,
        });
      }, 300);
    } else {
      fetchAndCacheEffects();
    }

    return () => {
      if (previewFetchDebounceRef.current) {
        clearTimeout(previewFetchDebounceRef.current);
      }
    };
  }, [drag.preliminaryPlacement, round?.phase, gameId, fetchAndCacheEffects]);

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
      if (game) {
        setGameStatus(game.status);
        if (game.status === 'finished') loadAllResolvedControversies();
      }

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
      .select('id, round_number, phase, sub_round, senate_leader_id, controversy_pool, controversies_resolved, upcoming_pool, initial_faction_powers, initial_influence')
      .eq('game_id', gameId)
      .order('round_number', { ascending: false })
      .limit(1)
      .single();
    if (data) {
      const prev = prevRoundRef.current;
      // Detect election→ruling_pool transition before setRound to prevent flash
      if (prev?.phase === 'leader_election' && data.phase === 'ruling_pool') {
        showElectionResultsRef.current = true;
        setShowElectionResults(true);
      }
      // Hold round-end screen when entering round_end phase
      if (prev && prev.phase !== 'round_end' && data.phase === 'round_end') {
        setShowRoundEnd(true);
      }
      setRound(data as Round);
    }
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
    if (data) {
      placementsRoundIdRef.current = currentRound.id;
      setPlacements(data);
    }
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
      .select('controversy_key, status, winning_resolution_key, axis_effects_applied, faction_power_effects_applied')
      .eq('round_id', currentRound.id);
    if (data) setControversyStates(data as ControversyStateRow[]);
  }

  async function loadAllResolvedControversies() {
    const { data } = await supabase
      .from('game_controversy_state')
      .select('controversy_key, status, winning_resolution_key, axis_effects_applied, faction_power_effects_applied, resolved_at')
      .eq('game_id', gameId)
      .eq('status', 'resolved')
      .order('resolved_at', { ascending: true });
    if (data) setAllResolvedStates(data as ControversyStateRow[]);
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
    let factionKey = '';
    if (fp.isPreliminary && drag.preliminaryPlacement) {
      factionKey = drag.preliminaryPlacement.factionKey;
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

    const factionDisplay = factions.find((f) => f.faction_key === factionKey);
    const baseTooltip = {
      playerName: fp.playerName,
      playerColor: fp.playerColor,
      factionName: factionDisplay?.display_name ?? '',
      position,
    };

    const effect = getEffectForWorker(
      workerEffectsRef.current,
      fp.playerId,
      factionKey,
      fp.workerType as WorkerType,
      fp.oratorRole as OratorRole | undefined,
    );

    if (effect) {
      setTooltipData({ ...baseTooltip, effect });
    } else {
      // Cache miss — show loading state and fire immediate fetch
      setTooltipData({
        ...baseTooltip,
        loading: true,
        pendingPlayerId: fp.playerId,
        pendingFactionKey: factionKey,
        pendingWorkerType: fp.workerType as WorkerType,
        pendingOratorRole: fp.oratorRole as OratorRole | undefined,
      });

      const prelim = drag.preliminaryPlacement;
      fetchAndCacheEffects(
        prelim ? {
          factionKey: prelim.factionKey,
          workerType: prelim.workerType,
          oratorRole: prelim.oratorRole,
        } : undefined,
      );
    }
  }, [placements, factions, drag.preliminaryPlacement, fetchAndCacheEffects]);

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
  if (gameStatus === 'finished') {
    // Compute agenda scores per player per axis
    const playerScores: Record<string, { perAxis: Record<string, number>; total: number }> = {};
    for (const pa of playerAgendas) {
      const perAxis: Record<string, number> = {};
      let total = 0;
      for (const axis of AXIS_KEYS) {
        const agendaPos = pa.agenda[axis];
        if (agendaPos == null) continue;
        const policyPos = axisValuesMap[axis] ?? 0;
        const score = computeAxisScore(policyPos, agendaPos);
        perAxis[axis] = score;
        total += score;
      }
      playerScores[pa.playerId] = { perAxis, total };
    }

    const sorted = [...playerStates]
      .map((ps) => ({ ...ps, score: playerScores[ps.player_id]?.total ?? 0 }))
      .sort((a, b) => b.score - a.score);

    const allResolvedMap: Record<string, { winningResolutionKey: string; axisEffects: Record<string, number>; factionPowerEffects: Record<string, number> }> = {};
    allResolvedStates.forEach((cs) => {
      if (cs.winning_resolution_key) {
        allResolvedMap[cs.controversy_key] = {
          winningResolutionKey: cs.winning_resolution_key,
          axisEffects: cs.axis_effects_applied ?? {},
          factionPowerEffects: cs.faction_power_effects_applied ?? {},
        };
      }
    });
    const resolvedControversies = allResolvedStates
      .map((cs) => CONTROVERSY_MAP[cs.controversy_key])
      .filter(Boolean);

    return (
      <ImageBackground source={gameOverBg} style={styles.background} resizeMode="cover">
        <ScrollView
          style={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}
          contentContainerStyle={styles.gameOverContent}
        >
          <Text style={styles.phaseTitle}>GAME OVER</Text>
          <Text style={styles.subTitle}>Final Standings</Text>

          {/* Scores */}
          <View style={styles.resultsList}>
            {sorted.map((ps, i) => {
              const player = players.find((p) => p.player_id === ps.player_id);
              return (
                <View key={ps.player_id} style={styles.resultRow}>
                  <Text style={styles.resultRank}>{i + 1}.</Text>
                  <View style={[styles.resultDot, { backgroundColor: getColorHex(player?.color ?? 'ivory') }]} />
                  <Text style={styles.resultName}>{player?.player_name ?? 'Unknown'}</Text>
                  <Text style={styles.resultInfluence}>{ps.score}</Text>
                </View>
              );
            })}
          </View>

          {/* Score Breakdown */}
          {playerAgendas.length > 0 && (
            <View style={styles.gameOverSection}>
              <Text style={styles.gameOverSectionTitle}>Score Breakdown</Text>
              {AXIS_KEYS.map((axis) => {
                const labels = AXIS_LABELS[axis as AxisKey];
                // Collect scores for players who have an agenda on this axis
                const axisScorers = playerAgendas
                  .map((pa) => {
                    const score = playerScores[pa.playerId]?.perAxis[axis];
                    if (score == null || score === 0) return null;
                    return { playerId: pa.playerId, name: pa.name, color: pa.color, score };
                  })
                  .filter(Boolean) as { playerId: string; name: string; color: string; score: number }[];

                const val = axisValuesMap[axis] ?? 0;
                const positionLabel = val === 0
                  ? 'Neutral'
                  : `${Math.abs(val) >= 2 ? 'Extreme' : 'Moderate'} ${val > 0 ? labels.positive : labels.negative}`;

                return (
                  <View key={axis} style={styles.axisBreakdownBlock}>
                    <AxisEffectSlider
                      axis={axis}
                      change={0}
                      currentValue={val}
                      playerAgendas={playerAgendas}
                    />
                    <Text style={styles.axisPositionLabel}>{positionLabel}</Text>
                    {axisScorers.length > 0 && (
                      <View style={styles.axisScores}>
                        {axisScorers.map((s) => (
                          <View key={s.playerId} style={styles.axisScoreRow}>
                            <View style={[styles.resultDot, { backgroundColor: getColorHex(s.color) }]} />
                            <Text style={styles.axisScorePlayerName}>{s.name}</Text>
                            <Text style={styles.axisScoreValue}>+{s.score}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {/* Resolutions expandable */}
          {resolvedControversies.length > 0 && (
            <View style={styles.gameOverSection}>
              <Pressable
                style={styles.resolutionsToggle}
                onPress={() => setShowResolutions((v) => !v)}
              >
                <Text style={styles.gameOverSectionTitle}>
                  {showResolutions ? 'Hide' : 'Show'} Resolutions ({resolvedControversies.length})
                </Text>
                <Text style={styles.resolutionsChevron}>{showResolutions ? '▲' : '▼'}</Text>
              </Pressable>
              {showResolutions && (() => {
                const factionNames: Record<string, string> = {};
                factions.forEach((f) => { factionNames[f.faction_key] = f.display_name; });
                return (
                  <View style={styles.resolutionsList}>
                    {resolvedControversies.map((c) => {
                      const info = allResolvedMap[c.key];
                      if (!info) return null;
                      return (
                        <ResolvedControversySummary
                          key={c.key}
                          controversy={c}
                          resolvedInfo={info}
                          factionDisplayNames={factionNames}
                        />
                      );
                    })}
                  </View>
                );
              })()}
            </View>
          )}

          <Pressable style={styles.actionButton} onPress={() => router.replace('/(app)/home')}>
            <Text style={styles.actionButtonText}>Return Home</Text>
          </Pressable>
        </ScrollView>
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

  const sidePanels = (
    <>
      <View style={styles.sideTabStrip}>
        <Pressable style={styles.sideTab} onPress={() => setPlayersVisible((v) => !v)}>
          {'PLAYERS'.split('').map((ch, i) => (
            <Text key={i} style={styles.sideTabText}>{ch}</Text>
          ))}
        </Pressable>
        <Pressable style={styles.sideTab} onPress={() => setOnTheHorizonVisible((v) => !v)}>
          {'ON'.split('').map((ch, i) => (
            <Text key={`a${i}`} style={styles.sideTabText}>{ch}</Text>
          ))}
          <View style={styles.sideTabDot} />
          {'THE'.split('').map((ch, i) => (
            <Text key={`b${i}`} style={styles.sideTabText}>{ch}</Text>
          ))}
          <View style={styles.sideTabDot} />
          {'HORIZON'.split('').map((ch, i) => (
            <Text key={`c${i}`} style={styles.sideTabText}>{ch}</Text>
          ))}
        </Pressable>
        <Pressable style={styles.sideTab} onPress={() => setFactionsVisible((v) => !v)}>
          {'FACTIONS'.split('').map((ch, i) => (
            <Text key={i} style={styles.sideTabText}>{ch}</Text>
          ))}
        </Pressable>
      </View>
      <OnTheHorizon
        poolKeys={horizonKeys}
        activeFactionKeys={activeFactionKeys}
        activeControversyKey={activeControversyKey}
        visible={onTheHorizonVisible}
        onClose={() => setOnTheHorizonVisible((v) => !v)}
        axisValues={axisValuesMap}
        factionInfoMap={factionInfoMap}
        playerAgendas={playerAgendas}
        resolvedMap={resolvedMap}
        hideTab
      />
      <PlayersPanel
        players={players}
        playerStates={playerStates}
        playerAgendas={playerAgendas}
        axes={axisValuesMap}
        currentUserId={currentUserId}
        visible={playersVisible}
        onClose={() => setPlayersVisible((v) => !v)}
        hideTab
      />
      <FactionsPanel
        factions={factionInfoList}
        players={players}
        affinities={affinities}
        factionIdMap={factionIdMap}
        axisValues={axisValuesMap}
        visible={factionsVisible}
        onClose={() => setFactionsVisible((v) => !v)}
        hideTab
      />
    </>
  );

  if (phase === 'leader_election' || showElectionResults || showElectionResultsRef.current) {
    return (
      <ImageBackground source={leaderElectionBg} style={styles.background} resizeMode="cover">
        <View style={[styles.container, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }]}>
          <RoundHeader
            phaseTitle="ELECTION"
            roundInfo={`Round ${round?.round_number ?? '?'}`}
            influence={myInfluence}
            onHome={() => router.replace('/(app)/home')}
            helpNode={
              <Pressable style={styles.helpButton} onPress={() => help?.openHelp('leader-election')}>
                <HelpIcon size={22} color={C.parchment} />
              </Pressable>
            }
          />
          <LeaderElection
            gameId={gameId!}
            roundId={round!.id}
            currentUserId={currentUserId}
            players={players}
            playerStates={playerStates}
            senateLeaderId={senateLeaderId || null}
            onLeaderSelected={() => { showElectionResultsRef.current = false; setShowElectionResults(false); loadRound(); }}
          />
          {sidePanels}
          <HelpModal helpId={help?.activeHelpId ?? null} onDismiss={() => help?.dismissHelp()} />
        </View>
      </ImageBackground>
    );
  }

  if (phase === 'ruling_selection') {
    return (
      <ImageBackground source={gameBg} style={styles.background} resizeMode="cover">
        <View style={[styles.container, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }]}>
          <RoundHeader
            phaseTitle="RULING PHASE"
            roundInfo={`Round ${round?.round_number ?? '?'}`}
            influence={myInfluence}
            onHome={() => router.replace('/(app)/home')}
          />
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
          <RoundHeader
            phaseTitle="RULING PHASE"
            roundInfo={`Round ${round?.round_number ?? '?'}`}
            influence={myInfluence}
            onHome={() => router.replace('/(app)/home')}
          />
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
          {sidePanels}
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
          <RoundHeader
            phaseTitle="CONTROVERSY"
            roundInfo={`Round ${round?.round_number ?? '?'}`}
            influence={myInfluence}
            onHome={() => router.replace('/(app)/home')}
          />
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
                setDismissedResolvedKeys((prev) => new Set(prev).add(activeControversyKey));
                loadRound();
              }}
            />
          ) : (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={C.gold} size="large" />
            </View>
          )}
          {sidePanels}
        </View>
      </ImageBackground>
    );
  }

  // --- Round end phase (held locally until player dismisses) ---
  if (phase === 'round_end' || showRoundEnd) {
    // If there's a resolved controversy the player hasn't dismissed yet, show it first
    const undismissedResolved = controversyStates.find(
      (cs) => cs.status === 'resolved' && !dismissedResolvedKeys.has(cs.controversy_key),
    );

    if (undismissedResolved) {
      const controversyObj = CONTROVERSY_MAP[undismissedResolved.controversy_key];
      const controversyIllustration = controversyObj ? ILLUSTRATION_MAP[controversyObj.illustration] : null;
      const votingBg = controversyIllustration ?? rulingBg;

      return (
        <ImageBackground source={votingBg} style={styles.background} resizeMode="cover">
          <View style={[styles.container, { paddingTop: insets.top + 8, paddingBottom: 0 }]}>
            <ControversyVoting
              gameId={gameId!}
              roundId={round!.id}
              controversyKey={undismissedResolved.controversy_key}
              currentUserId={currentUserId}
              senateLeaderId={senateLeaderId}
              currentInfluence={myInfluence}
              players={players}
              activeFactionKeys={activeFactionKeys}
              factionInfoMap={factionInfoMap}
              axisValues={axisValuesMap}
              playerAgendas={playerAgendas}
              onContinue={() => {
                setDismissedResolvedKeys((prev) => new Set(prev).add(undismissedResolved.controversy_key));
              }}
            />
          </View>
        </ImageBackground>
      );
    }

    // All controversies dismissed — show round-end summary
    const initialPowers = round?.initial_faction_powers ?? {};
    return (
      <ImageBackground source={gameBg} style={styles.background} resizeMode="cover">
        <View style={[styles.container, { paddingTop: insets.top + 8, paddingBottom: 0 }]}>
          <RoundEndSummary
            roundNumber={round!.round_number}
            isGameOver={round!.round_number >= 6}
            playerInfluences={players.map((p) => {
              const currentInf = playerStates.find((ps) => ps.player_id === p.player_id)?.influence ?? 0;
              return {
                player_id: p.player_id,
                player_name: p.player_name,
                color: getColorHex(p.color),
                influenceBefore: currentInf,
                influenceAfter: Math.ceil(currentInf / 2),
              };
            })}
            axes={axes}
            playerAgendas={playerAgendas}
            factionPowers={factions.map((f) => ({
              faction_key: f.faction_key,
              display_name: f.display_name,
              power_level: f.power_level,
              change: f.power_level - (initialPowers[f.faction_key] ?? f.power_level),
            }))}
            onContinue={async () => {
              try {
                await advanceRound(gameId!);
                setShowRoundEnd(false);
                setDismissedResolvedKeys(new Set());
                setPlacements([]);
                setHasSubmittedThisSubRound(false);
                await Promise.all([loadRound(), loadPlacements(), loadPlayerStates(), loadFactions(), loadAffinities()]);
              } catch (e: any) {
                Alert.alert('Error', e.message ?? 'Could not advance round');
              }
            }}
          />
        </View>
      </ImageBackground>
    );
  }

  // --- Demagogery view (default) ---
  return (
    <ImageBackground source={gameBg} style={styles.background} resizeMode="cover">
      <View style={[styles.container, { paddingTop: insets.top + 8, paddingBottom: 0 }]}>
        <RoundHeader
          phaseTitle="DEMAGOGERY"
          roundInfo={`Round ${round?.round_number ?? '?'} / Demagogery Step ${round?.sub_round ?? '?'}`}
          influence={myInfluence}
          onHome={() => router.replace('/(app)/home')}
          helpNode={
            <GestureDetector gesture={helpIconGesture}>
              <Animated.View style={styles.helpButton}>
                <HelpIcon size={22} color={C.parchment} />
              </Animated.View>
            </GestureDetector>
          }
        />

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
            loading={tooltipData.loading}
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

        {sidePanels}

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
  helpButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: parchmentBg(0.08),
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
    backgroundColor: accentGoldBg(0.25),
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
    color: C.emeraldGreen,
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
  sideTabStrip: {
    position: 'absolute',
    right: -1,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: 12,
    zIndex: 10,
  },
  sideTab: {
    backgroundColor: goldBg(0.15),
    borderWidth: 1,
    borderColor: goldBg(0.4),
    borderRightWidth: 0,
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 3,
    alignItems: 'center',
  },
  sideTabText: {
    color: C.gold,
    fontSize: 9,
    fontWeight: '700',
    lineHeight: 11,
  },
  sideTabDot: {
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: goldBg(0.4),
    marginVertical: 2,
  },
  gameOverContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 16,
  },
  gameOverSection: {
    gap: 12,
  },
  gameOverSectionTitle: {
    color: C.gold,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  resolutionsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resolutionsChevron: {
    color: C.gold,
    fontSize: 12,
    opacity: 0.6,
  },
  resolutionsList: {
    gap: 12,
  },
  axisBreakdownBlock: {
    marginBottom: 12,
  },
  axisPositionLabel: {
    color: C.paleGold,
    fontSize: 11,
    opacity: 0.55,
    fontStyle: 'italic',
    marginTop: 2,
    paddingLeft: 4,
  },
  axisScores: {
    gap: 3,
    marginTop: 4,
    paddingLeft: 4,
  },
  axisScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  axisScorePlayerName: {
    color: C.paleGold,
    fontSize: 11,
    opacity: 0.7,
  },
  axisScoreValue: {
    color: C.gold,
    fontSize: 11,
    fontWeight: '700',
  },
});
