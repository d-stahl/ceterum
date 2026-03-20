import { View, Text, TextInput, StyleSheet, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { declareSchismAction, submitSchismVote, submitSchismBet, passSchismBet } from '../lib/game-actions';
import { CONTROVERSY_MAP } from '../lib/game-engine/controversies';
import type { SchismControversy, SchismSide } from '../lib/game-engine/controversies';
import { schismTeamSize } from '../lib/game-engine/schism';
import { VP_TO_INFLUENCE_RATE } from '../lib/game-engine/constants';
import { AxisEffectSlider, PowerEffectRow } from './ControversyCard';
import ControversyHeader from './ControversyHeader';
import { getColorHex } from '../lib/player-colors';
import { C, goldBg, navyBg, CONTROVERSY_TYPE_COLORS } from '../lib/theme';
import type { PlayerAgendaInfo } from './AgendaDots';

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
  players: PlayerInfo[];
  activeFactionKeys: string[];
  factionInfoMap: Record<string, FactionInfo>;
  axisValues?: Record<string, number>;
  playerAgendas?: PlayerAgendaInfo[];
  currentInfluence: number;
  onContinue: () => void;
};

type ControversyStateRow = {
  status: string;
  schism_declared_side: string | null;
  schism_team_members: string[] | null;
};

function formatReward(rawVP: number): string {
  const vp = Math.floor(rawVP);
  const inf = Math.round((rawVP - vp) * VP_TO_INFLUENCE_RATE);
  if (vp > 0 && inf > 0) return `${vp} VP + ${inf} Inf`;
  if (vp > 0) return `${vp} VP`;
  if (inf > 0) return `${inf} Inf`;
  return '0';
}

function OutsiderBetPanel({ gameId, controversyKey, maxInfluence, onBetPlaced, onError }: {
  gameId: string;
  controversyKey: string;
  maxInfluence: number;
  onBetPlaced: () => void;
  onError: (msg: string) => void;
}) {
  const [prediction, setPrediction] = useState<boolean | null>(null);
  const [stakeInput, setStakeInput] = useState('0');
  const [submitting, setSubmitting] = useState(false);

  const parsed = parseInt(stakeInput, 10);
  const stake = isNaN(parsed) ? 0 : parsed;
  const isValid = stakeInput.trim() !== '' && !isNaN(parsed) && parsed >= 1 && parsed <= maxInfluence;

  async function handlePlaceBet() {
    if (prediction === null || !isValid || submitting) return;
    setSubmitting(true);
    try {
      await submitSchismBet(gameId, controversyKey, prediction, stake);
      onBetPlaced();
    } catch (e: any) {
      onError(e.message ?? 'Bet failed');
    } finally {
      setSubmitting(false);
    }
  }

  const potentialPayout = stake * 2;

  return (
    <View style={styles.betPanel}>
      <Text style={styles.sectionLabel}>Place a Bet (Optional)</Text>
      <Text style={styles.betHint}>
        Wager influence on the outcome. Win = 2× stake as VP. Lose = lose your stake.
      </Text>

      <View style={styles.betPredictionRow}>
        <Pressable
          style={[styles.betOption, prediction === true && styles.betOptionSelected]}
          onPress={() => setPrediction(true)}
        >
          <Text style={styles.betOptionText}>Support succeeds</Text>
        </Pressable>
        <Pressable
          style={[styles.betOption, prediction === false && styles.betOptionSelected]}
          onPress={() => setPrediction(false)}
        >
          <Text style={styles.betOptionText}>Sabotage happens</Text>
        </Pressable>
      </View>

      {prediction !== null && (
        <>
          <Text style={styles.betStakeLabel}>
            Stake: {stake} / {maxInfluence} influence
          </Text>
          <View style={styles.stakeInputRow}>
            <Pressable
              style={styles.stepButton}
              onPress={() => setStakeInput(String(Math.max(0, stake - 1)))}
            >
              <Text style={styles.stepButtonText}>−</Text>
            </Pressable>
            <TextInput
              style={styles.stakeInput}
              value={stakeInput}
              onChangeText={setStakeInput}
              keyboardType="number-pad"
              maxLength={4}
            />
            <Pressable
              style={styles.stepButton}
              onPress={() => setStakeInput(String(Math.min(maxInfluence, stake + 1)))}
            >
              <Text style={styles.stepButtonText}>+</Text>
            </Pressable>
          </View>
          {stake > 0 && (
            <Text style={styles.betPreview}>
              If correct: {formatReward(potentialPayout / VP_TO_INFLUENCE_RATE)}
            </Text>
          )}
          <Pressable
            style={[styles.declareButton, (!isValid || submitting) && styles.submitDisabled]}
            onPress={handlePlaceBet}
            disabled={!isValid || submitting}
          >
            <Text style={styles.declareButtonText}>
              {submitting ? 'Placing…' : `Bet ${stake} Influence`}
            </Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

export default function SchismVoting({
  gameId,
  roundId,
  controversyKey,
  currentUserId,
  senateLeaderId,
  players,
  activeFactionKeys,
  factionInfoMap,
  axisValues,
  playerAgendas,
  currentInfluence,
  onContinue,
}: Props) {
  const [csState, setCsState] = useState<ControversyStateRow | null>(null);
  const [outcome, setOutcome] = useState<any>(null);
  const [selectedSide, setSelectedSide] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string[]>([]);
  const [declaring, setDeclaring] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [betPlaced, setBetPlaced] = useState(false);
  const [betPassed, setBetPassed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const isSL = currentUserId === senateLeaderId;
  const controversy = CONTROVERSY_MAP[controversyKey] as SchismControversy | undefined;

  const fetchState = useCallback(async () => {
    const { data } = await supabase
      .from('game_controversy_state')
      .select('status, schism_declared_side, schism_team_members')
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
    const sub = supabase
      .channel(`cs-schism-${roundId}-${controversyKey}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'game_controversy_state',
        filter: `round_id=eq.${roundId}`,
      }, () => fetchState())
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [fetchState, roundId, controversyKey]);

  useEffect(() => {
    if (csState?.status === 'resolved') {
      fetchOutcome();
    }
  }, [csState?.status, fetchOutcome]);

  if (!controversy || controversy.type !== 'schism') {
    return <Text style={styles.errorText}>Unknown schism: {controversyKey}</Text>;
  }

  const config = controversy.schismConfig;
  const [sideA, sideB] = config.sides;
  const teamSize = schismTeamSize(players.length);

  // Initialize team with SL included
  useEffect(() => {
    if (isSL && selectedTeam.length === 0) {
      setSelectedTeam([currentUserId]);
    }
  }, [isSL, currentUserId]);

  function toggleTeamMember(pid: string) {
    if (pid === currentUserId && isSL) return; // SL can't remove self
    setSelectedTeam((prev) => {
      if (prev.includes(pid)) return prev.filter((id) => id !== pid);
      if (prev.length >= teamSize) return prev;
      return [...prev, pid];
    });
  }

  async function handleDeclare() {
    if (declaring || !selectedSide || selectedTeam.length !== teamSize) return;
    setDeclaring(true);
    setError(null);
    try {
      await declareSchismAction(gameId, controversyKey, selectedSide, selectedTeam);
    } catch (e: any) {
      setError(e.message ?? 'Declaration failed');
    } finally {
      setDeclaring(false);
    }
  }

  async function handleVote(supports: boolean) {
    if (submitting || submitted) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitSchismVote(gameId, controversyKey, supports);
      setSubmitted(true);
    } catch (e: any) {
      setError(e.message ?? 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator color={C.gold} size="large" />
      </View>
    );
  }

  const status = csState?.status ?? 'declared';

  // --- RESOLVED ---
  if (status === 'resolved' && outcome) {
    const td = outcome.type_data;
    const wasSabotaged = td.wasSabotaged;

    const axisEffects: Record<string, number> = {};
    const outcomeAxisValues: Record<string, number> = {};
    for (const [axis, vals] of Object.entries(outcome.axis_outcomes as Record<string, { before: number; after: number }>)) {
      axisEffects[axis] = vals.after - vals.before;
      outcomeAxisValues[axis] = vals.before;
    }

    const factionEffects: Record<string, number> = {};
    const factionPowerBefore: Record<string, number> = {};
    for (const [fkey, vals] of Object.entries(outcome.faction_power_outcomes as Record<string, { before: number; after: number }>)) {
      factionEffects[fkey] = vals.after - vals.before;
      factionPowerBefore[fkey] = vals.before;
    }

    const winningSide = sideA.key === td.winningSideKey ? sideA : sideB;

    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <ControversyHeader controversy={controversy} showFlavor={false} />

        <View style={[styles.resultBanner, wasSabotaged ? styles.resultSabotaged : styles.resultSuccess]}>
          <Text style={styles.resultLabel}>
            {wasSabotaged ? 'Sabotaged!' : 'Unanimous Support'}
          </Text>
          <Text style={styles.resultSideTitle}>{winningSide.title}</Text>
        </View>

        {/* Team reveal */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>The Team</Text>
          {(td.teamMembers ?? []).map((pid: string) => {
            const player = players.find((p) => p.player_id === pid);
            const isSupporter = (td.supporters ?? []).includes(pid);
            const isSaboteur = (td.saboteurs ?? []).includes(pid);
            return (
              <View key={pid} style={styles.teamRevealRow}>
                <View style={[styles.playerDot, { backgroundColor: getColorHex(player?.color ?? '') }]} />
                <Text style={styles.teamPlayerName}>{player?.player_name ?? 'Unknown'}</Text>
                {isSupporter && <Text style={styles.supportBadge}>Supported</Text>}
                {isSaboteur && <Text style={styles.sabotageBadge}>Sabotaged</Text>}
              </View>
            );
          })}
        </View>

        {/* Rewards */}
        {td.rewards && td.rewards.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Rewards</Text>
            {td.rewards.map((r: any) => {
              const player = players.find((p) => p.player_id === r.playerId);
              return (
                <View key={r.playerId} style={styles.teamRevealRow}>
                  <View style={[styles.playerDot, { backgroundColor: getColorHex(player?.color ?? '') }]} />
                  <Text style={styles.teamPlayerName}>{player?.player_name ?? 'Unknown'}</Text>
                  <Text style={styles.supportBadge}>{formatReward(r.vpAwarded + r.influenceAwarded / VP_TO_INFLUENCE_RATE)}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Bet outcomes */}
        {td.betResults && td.betResults.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Bets</Text>
            {td.betResults.map((br: any) => {
              const player = players.find((p) => p.player_id === br.playerId);
              return (
                <View key={br.playerId} style={styles.teamRevealRow}>
                  <View style={[styles.playerDot, { backgroundColor: getColorHex(player?.color ?? '') }]} />
                  <Text style={styles.teamPlayerName}>{player?.player_name ?? 'Unknown'}</Text>
                  {br.won ? (
                    <Text style={styles.supportBadge}>Won {formatReward(br.vpAwarded + br.influenceAwarded / VP_TO_INFLUENCE_RATE)}</Text>
                  ) : (
                    <Text style={styles.sabotageBadge}>Lost {br.stakeInfluence} Inf</Text>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Effects */}
        {Object.keys(axisEffects).filter((k) => axisEffects[k] !== 0).length > 0 && (
          <View style={styles.effectsSection}>
            <Text style={styles.sectionLabel}>Policy Effects</Text>
            {Object.keys(axisEffects).filter((k) => axisEffects[k] !== 0).map((axis) => (
              <AxisEffectSlider
                key={axis}
                axis={axis}
                change={axisEffects[axis]}
                currentValue={outcomeAxisValues[axis]}
              />
            ))}
          </View>
        )}

        {Object.keys(factionEffects).filter((k) => activeFactionKeys.includes(k) && factionEffects[k] !== 0).length > 0 && (
          <View style={styles.effectsSection}>
            <Text style={styles.sectionLabel}>Power Effects</Text>
            {Object.keys(factionEffects).filter((k) => activeFactionKeys.includes(k) && factionEffects[k] !== 0).map((fkey) => (
              <PowerEffectRow
                key={fkey}
                factionName={factionInfoMap?.[fkey]?.displayName ?? fkey}
                currentPower={factionPowerBefore[fkey] ?? (factionInfoMap?.[fkey]?.power ?? 3)}
                change={factionEffects[fkey] ?? 0}
              />
            ))}
          </View>
        )}

        <Pressable style={styles.continueButton} onPress={onContinue}>
          <Text style={styles.continueButtonText}>Continue</Text>
        </Pressable>
      </ScrollView>
    );
  }

  // --- DECLARED: SL picks side + team ---
  if (status === 'declared' && isSL) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <ControversyHeader controversy={controversy} />
        <Text style={styles.instruction}>
          Choose a side and pick {teamSize} team members (including yourself).
          Your team will secretly vote to support or sabotage.
        </Text>

        {/* Side picker */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Choose a Side</Text>
          {[sideA, sideB].map((side) => (
            <SideCard
              key={side.key}
              side={side}
              isSelected={selectedSide === side.key}
              onPress={() => setSelectedSide(side.key)}
              activeFactionKeys={activeFactionKeys}
              factionInfoMap={factionInfoMap}
              axisValues={axisValues}
              playerAgendas={playerAgendas}
            />
          ))}
        </View>

        {/* Team picker */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            Pick Team ({selectedTeam.length}/{teamSize})
          </Text>
          {players.map((p) => {
            const isOnTeam = selectedTeam.includes(p.player_id);
            const isSelf = p.player_id === currentUserId;
            return (
              <Pressable
                key={p.player_id}
                style={[styles.teamPickRow, isOnTeam && styles.teamPickRowActive]}
                onPress={() => toggleTeamMember(p.player_id)}
                disabled={isSelf}
              >
                <View style={[styles.playerDot, { backgroundColor: getColorHex(p.color) }]} />
                <Text style={styles.teamPickName}>{p.player_name}</Text>
                {isSelf && <Text style={styles.youBadge}>You (SL)</Text>}
                <View style={[styles.checkbox, isOnTeam && styles.checkboxActive]} />
              </Pressable>
            );
          })}
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}

        <Pressable
          style={[
            styles.declareButton,
            (!selectedSide || selectedTeam.length !== teamSize || declaring) && styles.submitDisabled,
          ]}
          onPress={handleDeclare}
          disabled={!selectedSide || selectedTeam.length !== teamSize || declaring}
        >
          {declaring ? (
            <ActivityIndicator color={C.darkText} size="small" />
          ) : (
            <Text style={styles.declareButtonText}>Declare & Send Team</Text>
          )}
        </Pressable>
      </ScrollView>
    );
  }

  // --- DECLARED: non-SL waits ---
  if (status === 'declared' && !isSL) {
    const slPlayer = players.find((p) => p.player_id === senateLeaderId);
    return (
      <View style={styles.centerContainer}>
        <ControversyHeader controversy={controversy} />
        <View style={styles.waitRow}>
          <Text style={styles.waitText}>Waiting for </Text>
          {slPlayer && <View style={[styles.playerDot, { backgroundColor: getColorHex(slPlayer.color) }]} />}
          <Text style={styles.waitTextBold}>{slPlayer?.player_name ?? 'Senate Leader'}</Text>
          <Text style={styles.waitText}> to choose a side and team…</Text>
        </View>
      </View>
    );
  }

  // --- VOTING (team_picking complete, now in voting) ---
  const teamMembers = csState?.schism_team_members ?? [];
  const declaredSideKey = csState?.schism_declared_side ?? '';
  const declaredSide = sideA.key === declaredSideKey ? sideA : sideB;
  const otherSide = sideA.key === declaredSideKey ? sideB : sideA;
  const isOnTeam = teamMembers.includes(currentUserId);

  // Submitted
  if (submitted) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator color={C.gold} size="small" />
        <Text style={styles.waitingText}>Vote cast — waiting for team…</Text>
      </View>
    );
  }

  // Not on team: show side previews and optional betting
  if (!isOnTeam) {
    const slPlayer = players.find((p) => p.player_id === senateLeaderId);
    const teamNames = teamMembers.map((id) => players.find((p) => p.player_id === id)?.player_name ?? 'Unknown');
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <ControversyHeader controversy={controversy} />
        <Text style={styles.waitText}>
          {slPlayer?.player_name ?? 'The Senate Leader'} declared: {declaredSide.title}
        </Text>
        <Text style={styles.teamListText}>
          Team: {teamNames.join(', ')}
        </Text>

        {/* Side previews for outsiders */}
        <View style={styles.section}>
          <SideCard side={declaredSide} isSelected={false} onPress={() => {}}
            activeFactionKeys={activeFactionKeys} factionInfoMap={factionInfoMap}
            axisValues={axisValues} label="If supported" playerAgendas={playerAgendas} />
          <SideCard side={otherSide} isSelected={false} onPress={() => {}}
            activeFactionKeys={activeFactionKeys} factionInfoMap={factionInfoMap}
            axisValues={axisValues} label="If sabotaged" playerAgendas={playerAgendas} />
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}

        {/* Betting UI */}
        {!submitted && !betPlaced && !betPassed && (
          <>
            <OutsiderBetPanel
              gameId={gameId}
              controversyKey={controversyKey}
              maxInfluence={currentInfluence}
              onBetPlaced={() => setBetPlaced(true)}
              onError={setError}
            />
            <Pressable
              style={styles.skipBetButton}
              onPress={async () => {
                try {
                  await passSchismBet(gameId, controversyKey);
                  setBetPassed(true);
                } catch (e: any) {
                  setError(e.message ?? 'Pass failed');
                }
              }}
            >
              <Text style={styles.skipBetText}>Skip Bet</Text>
            </Pressable>
          </>
        )}
        {(betPlaced || betPassed) && (
          <Text style={styles.waitingText}>
            {betPlaced ? 'Bet placed' : 'Bet skipped'} — waiting for others…
          </Text>
        )}
      </ScrollView>
    );
  }

  // On team: vote support/sabotage
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ControversyHeader controversy={controversy} />

      <View style={styles.declarationBanner}>
        <Text style={styles.declarationLabel}>Senate Leader declared:</Text>
        <Text style={styles.declarationValue}>{declaredSide.title}</Text>
        <Text style={styles.declarationDesc}>{declaredSide.description}</Text>
      </View>

      <Text style={styles.instruction}>
        You are on the team. Vote secretly — if all support, the declared side wins.
        Any sabotage flips the outcome.
      </Text>

      {/* Side previews */}
      <View style={styles.section}>
        <SideCard
          side={declaredSide}
          isSelected={false}
          onPress={() => {}}
          activeFactionKeys={activeFactionKeys}
          factionInfoMap={factionInfoMap}
          axisValues={axisValues}
          label="If supported"
          playerAgendas={playerAgendas}
        />
        <SideCard
          side={otherSide}
          isSelected={false}
          onPress={() => {}}
          activeFactionKeys={activeFactionKeys}
          factionInfoMap={factionInfoMap}
          axisValues={axisValues}
          label="If sabotaged"
          playerAgendas={playerAgendas}
        />
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <View style={styles.voteButtons}>
        <Pressable
          style={[styles.voteButton, styles.supportButton]}
          onPress={() => handleVote(true)}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={C.darkText} size="small" />
          ) : (
            <Text style={styles.voteButtonText}>Support</Text>
          )}
        </Pressable>
        <Pressable
          style={[styles.voteButton, styles.sabotageButton]}
          onPress={() => handleVote(false)}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={C.paleGold} size="small" />
          ) : (
            <Text style={[styles.voteButtonText, { color: C.paleGold }]}>Sabotage</Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

// --- Side Card subcomponent ---

function SideCard({ side, isSelected, onPress, activeFactionKeys, factionInfoMap, axisValues, label, playerAgendas }: {
  side: SchismSide;
  isSelected: boolean;
  onPress: () => void;
  activeFactionKeys: string[];
  factionInfoMap: Record<string, FactionInfo>;
  axisValues?: Record<string, number>;
  label?: string;
  playerAgendas?: PlayerAgendaInfo[];
}) {
  const axisKeys = Object.keys(side.axisEffects);
  const factionKeys = Object.keys(side.factionPowerEffects).filter((k) => activeFactionKeys.includes(k));

  return (
    <Pressable
      style={[styles.sideCard, isSelected && styles.sideCardSelected]}
      onPress={onPress}
    >
      {label && <Text style={styles.sideCardLabel}>{label}</Text>}
      <Text style={styles.sideCardTitle}>{side.title}</Text>
      <Text style={styles.sideCardDesc}>{side.description}</Text>
      <View style={styles.vpSummary}>
        <Text style={styles.vpRow}>All support: {formatReward(side.supportVP)} each</Text>
        <Text style={styles.vpRow}>Betrayers get: {formatReward(side.betrayVP)}</Text>
        <Text style={styles.vpRow}>All betray: {formatReward(side.allBetrayVP)} each</Text>
      </View>
      {axisKeys.length > 0 && (
        <View style={styles.sideEffects}>
          {axisKeys.map((axis) => (
            <AxisEffectSlider
              key={axis}
              axis={axis}
              change={side.axisEffects[axis as keyof typeof side.axisEffects] ?? 0}
              currentValue={axisValues?.[axis] ?? 0}
              playerAgendas={playerAgendas}
            />
          ))}
        </View>
      )}
      {factionKeys.length > 0 && (
        <View style={styles.sideEffects}>
          {factionKeys.map((fkey) => (
            <PowerEffectRow
              key={fkey}
              factionName={factionInfoMap?.[fkey]?.displayName ?? fkey}
              currentPower={factionInfoMap?.[fkey]?.power ?? 3}
              change={side.factionPowerEffects[fkey] ?? 0}
            />
          ))}
        </View>
      )}
    </Pressable>
  );
}

const schismColor = CONTROVERSY_TYPE_COLORS.schism;

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 60, gap: 14 },
  centerContainer: {
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
  section: { gap: 8 },
  sectionLabel: {
    color: C.parchment,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    opacity: 0.4,
    marginBottom: 2,
  },
  // Side card
  sideCard: {
    backgroundColor: navyBg(0.88),
    borderWidth: 1,
    borderColor: goldBg(0.25),
    borderRadius: 10,
    padding: 12,
    gap: 6,
  },
  sideCardSelected: {
    backgroundColor: navyBg(0.95),
    borderColor: schismColor,
    borderWidth: 2,
  },
  sideCardLabel: {
    color: schismColor,
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sideCardTitle: {
    color: C.paleGold,
    fontSize: 15,
    fontWeight: '700',
  },
  sideCardDesc: {
    color: C.paleGold,
    fontSize: 12,
    opacity: 0.65,
    lineHeight: 16,
  },
  sideEffects: { gap: 6, marginTop: 4 },
  // VP / PD payoff summary
  vpSummary: {
    gap: 2,
    marginTop: 2,
  },
  vpRow: {
    color: C.gold,
    fontSize: 11,
    opacity: 0.75,
  },
  // Team picker
  teamPickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: goldBg(0.06),
    borderWidth: 1,
    borderColor: goldBg(0.15),
    borderRadius: 8,
    padding: 10,
  },
  teamPickRowActive: {
    backgroundColor: schismColor + '20',
    borderColor: schismColor + '60',
  },
  teamPickName: {
    color: C.paleGold,
    fontSize: 14,
    flex: 1,
  },
  youBadge: {
    color: C.gold,
    fontSize: 10,
    fontWeight: '700',
    opacity: 0.6,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: goldBg(0.4),
  },
  checkboxActive: {
    backgroundColor: schismColor,
    borderColor: schismColor,
  },
  playerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 2,
  },
  // Declaration banner
  declarationBanner: {
    backgroundColor: schismColor + '18',
    borderWidth: 1,
    borderColor: schismColor + '50',
    borderRadius: 10,
    padding: 12,
    gap: 4,
  },
  declarationLabel: {
    color: schismColor,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  declarationValue: {
    color: C.paleGold,
    fontSize: 16,
    fontWeight: '700',
  },
  declarationDesc: {
    color: C.paleGold,
    fontSize: 12,
    opacity: 0.6,
    lineHeight: 16,
  },
  // Vote buttons
  voteButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  voteButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  supportButton: {
    backgroundColor: C.gold,
  },
  sabotageButton: {
    backgroundColor: C.negative + '80',
    borderWidth: 1,
    borderColor: C.negative,
  },
  voteButtonText: {
    color: C.darkText,
    fontSize: 16,
    fontWeight: '700',
  },
  // Waiting
  waitingText: { color: C.gold, fontSize: 14, opacity: 0.8 },
  waitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  waitText: { color: C.gold, fontSize: 14, opacity: 0.7 },
  waitTextBold: { color: C.gold, fontSize: 14, fontWeight: '700', opacity: 0.7 },
  teamListText: {
    color: C.paleGold,
    fontSize: 13,
    opacity: 0.6,
    textAlign: 'center',
  },
  // Declare button
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
  submitDisabled: { opacity: 0.5 },
  // Resolved
  resultBanner: {
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
  },
  resultSuccess: {
    backgroundColor: C.positive + '18',
    borderColor: C.positive + '50',
  },
  resultSabotaged: {
    backgroundColor: C.negative + '18',
    borderColor: C.negative + '50',
  },
  resultLabel: {
    color: C.paleGold,
    fontSize: 16,
    fontWeight: '700',
  },
  resultSideTitle: {
    color: C.gold,
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'serif',
  },
  teamRevealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: goldBg(0.06),
    borderRadius: 6,
    padding: 8,
  },
  teamPlayerName: {
    color: C.paleGold,
    fontSize: 13,
    flex: 1,
  },
  supportBadge: {
    color: C.positive,
    fontSize: 11,
    fontWeight: '700',
  },
  sabotageBadge: {
    color: C.negative,
    fontSize: 11,
    fontWeight: '700',
  },
  effectsSection: { gap: 6, marginTop: 4 },
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
  errorText: {
    color: C.error,
    fontSize: 13,
    textAlign: 'center',
  },
  // Outsider betting panel
  betPanel: {
    backgroundColor: navyBg(0.88),
    borderWidth: 1,
    borderColor: goldBg(0.25),
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  betHint: {
    color: C.paleGold,
    fontSize: 12,
    opacity: 0.6,
    lineHeight: 16,
  },
  betPredictionRow: {
    flexDirection: 'row' as const,
    gap: 8,
  },
  betOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: goldBg(0.3),
    alignItems: 'center' as const,
  },
  betOptionSelected: {
    backgroundColor: schismColor + '25',
    borderColor: schismColor,
  },
  betOptionText: {
    color: C.paleGold,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  betStakeLabel: {
    color: C.paleGold,
    fontSize: 12,
    opacity: 0.7,
  },
  betPreview: {
    color: C.gold,
    fontSize: 13,
    fontWeight: '600' as const,
    textAlign: 'center' as const,
  },
  stakeInputRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 12,
  },
  stepButton: {
    width: 36,
    height: 36,
    backgroundColor: goldBg(0.15),
    borderRadius: 8,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  stepButtonText: {
    color: C.gold,
    fontSize: 20,
    lineHeight: 24,
  },
  stakeInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: goldBg(0.3),
    borderRadius: 8,
    color: C.paleGold,
    fontSize: 18,
    fontWeight: '700' as const,
    textAlign: 'center' as const,
    width: 70,
    height: 36,
    paddingVertical: 0,
  },
  skipBetButton: {
    paddingVertical: 10,
    alignItems: 'center' as const,
  },
  skipBetText: {
    color: C.paleGold,
    fontSize: 13,
    opacity: 0.5,
  },
});
