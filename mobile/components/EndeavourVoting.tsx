import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator, ScrollView } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { submitEndeavourInvestment } from '../lib/game-actions';
import { CONTROVERSY_MAP } from '../lib/game-engine/controversies';
import type { EndeavourControversy } from '../lib/game-engine/controversies';
import { computeRankRewards, VP_TO_INFLUENCE_RATE } from '../lib/game-engine/endeavour';
import { AxisEffectSlider, PowerEffectRow } from './ControversyCard';
import ControversyHeader from './ControversyHeader';
import type { PlayerAgendaInfo } from './AgendaDots';
import { C, goldBg, whiteBg, navyBg, CONTROVERSY_TYPE_COLORS } from '../lib/theme';

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
  totalInitialInfluence: number;
  onContinue: () => void;
};

type ControversyStateRow = {
  status: string;
};

export default function EndeavourVoting({
  gameId,
  roundId,
  controversyKey,
  currentUserId,
  currentInfluence,
  players,
  activeFactionKeys,
  factionInfoMap,
  axisValues,
  playerAgendas,
  totalInitialInfluence,
  onContinue,
}: Props) {
  const [csState, setCsState] = useState<ControversyStateRow | null>(null);
  const [outcome, setOutcome] = useState<any>(null);
  const [influenceInput, setInfluenceInput] = useState('0');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const controversy = CONTROVERSY_MAP[controversyKey] as EndeavourControversy | undefined;

  const fetchState = useCallback(async () => {
    const { data } = await supabase
      .from('game_controversy_state')
      .select('status')
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
      .channel(`cs-end-${roundId}-${controversyKey}`)
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

  if (!controversy || controversy.type !== 'endeavour') {
    return <Text style={styles.errorText}>Unknown endeavour: {controversyKey}</Text>;
  }

  const config = controversy.endeavourConfig;
  const threshold = Math.ceil(totalInitialInfluence * config.difficultyPercent);

  const parsedInfluence = parseInt(influenceInput, 10);
  const isValid = influenceInput.trim() !== '' && !isNaN(parsedInfluence) && parsedInfluence >= 0 && parsedInfluence <= currentInfluence;
  const investAmount = isValid ? parsedInfluence : 0;

  async function handleSubmit() {
    if (submitting || submitted || !isValid) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitEndeavourInvestment(gameId, controversyKey, investAmount);
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

  const status = csState?.status ?? 'voting';

  // --- RESOLVED ---
  if (status === 'resolved' && outcome) {
    const td = outcome.type_data;
    const succeeded = td.succeeded;
    const outcomeConfig = succeeded ? config.successOutcome : config.failureOutcome;

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

    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <ControversyHeader controversy={controversy} showFlavor={false} />

        <View style={[styles.resultBanner, succeeded ? styles.resultSuccess : styles.resultFailure]}>
          <Text style={styles.resultLabel}>{succeeded ? 'Endeavour Succeeded' : 'Endeavour Failed'}</Text>
          <Text style={styles.resultDetail}>
            {td.totalInvested} / {td.threshold} influence invested
          </Text>
        </View>

        {/* Rankings */}
        {succeeded && td.rankings && td.rankings.length > 0 && (
          <View style={styles.rankingsSection}>
            <Text style={styles.sectionLabel}>Rankings</Text>
            {td.rankings.map((r: any, i: number) => {
              const player = players.find((p) => p.player_id === r.playerId);
              return (
                <View key={r.playerId} style={styles.rankingRow}>
                  <Text style={styles.rankNumber}>#{r.rank}</Text>
                  <Text style={styles.rankPlayer}>{player?.player_name ?? 'Unknown'}</Text>
                  <Text style={styles.rankInvested}>{r.invested} influence</Text>
                  {r.vpAwarded > 0 && <Text style={styles.rankVP}>+{r.vpAwarded} VP</Text>}
                  {r.influenceAwarded > 0 && <Text style={styles.rankInfluence}>+{r.influenceAwarded} influence</Text>}
                </View>
              );
            })}
          </View>
        )}

        {/* Axis effects */}
        {Object.keys(axisEffects).filter((k) => axisEffects[k] !== 0).length > 0 && (
          <View style={styles.effectsSection}>
            <Text style={styles.sectionLabel}>Policy Effects</Text>
            {Object.keys(axisEffects).filter((k) => axisEffects[k] !== 0).map((axis) => (
              <AxisEffectSlider
                key={axis}
                axis={axis}
                change={axisEffects[axis]}
                currentValue={outcomeAxisValues[axis]}
                playerAgendas={playerAgendas}
              />
            ))}
          </View>
        )}

        {/* Faction power effects */}
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

  // --- SUBMITTED (waiting) ---
  if (submitted) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator color={C.gold} size="small" />
        <Text style={styles.waitingText}>Investment submitted — waiting for others…</Text>
      </View>
    );
  }

  // --- VOTING ---
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ControversyHeader controversy={controversy} />

      <View style={styles.thresholdBanner}>
        <Text style={styles.thresholdLabel}>Collective Threshold</Text>
        <Text style={styles.thresholdValue}>{threshold} influence</Text>
        <Text style={styles.thresholdNote}>
          If the Senate collectively invests at least this much, the endeavour succeeds.
          Rewards are distributed by rank of investment.
        </Text>
      </View>

      {/* Success / failure outcomes preview */}
      {[
        { label: 'On Success', outcome: config.successOutcome, style: styles.outcomeSuccess, showVP: true },
        { label: 'On Failure', outcome: config.failureOutcome, style: styles.outcomeFailure, showVP: false },
      ].map(({ label, outcome, style, showVP }) => {
        const axisKeys = Object.keys(outcome.axisEffects).filter(
          (k) => (outcome.axisEffects[k as keyof typeof outcome.axisEffects] ?? 0) !== 0
        );
        const factionKeys = Object.keys(outcome.factionPowerEffects).filter(
          (k) => activeFactionKeys.includes(k) && (outcome.factionPowerEffects[k] ?? 0) !== 0
        );
        return (
          <View key={label} style={[styles.outcomeCard, style]}>
            <Text style={styles.outcomeLabel}>{label}</Text>
            {showVP && (() => {
              const n = players.length;
              const dummyIds = Array.from({ length: n }, (_, i) => `p${i}`);
              const dummyInvestments = Array.from({ length: n }, () => 1);
              const rewards = computeRankRewards(dummyIds, dummyInvestments, config.firstPlaceReward, n);
              return (
                <View style={styles.rewardTable}>
                  <Text style={styles.effectsSectionLabel}>Rewards by Rank</Text>
                  {rewards.map((r, i) => (
                    <View key={i} style={styles.rewardRow}>
                      <Text style={styles.rewardRank}>#{r.rank}</Text>
                      <Text style={styles.rewardValue}>
                        {r.vpAwarded > 0 ? `${r.vpAwarded} VP` : ''}
                        {r.vpAwarded > 0 && r.influenceAwarded > 0 ? ' + ' : ''}
                        {r.influenceAwarded > 0 ? `${r.influenceAwarded} influence` : ''}
                        {r.vpAwarded === 0 && r.influenceAwarded === 0 ? '—' : ''}
                      </Text>
                    </View>
                  ))}
                </View>
              );
            })()}
            {axisKeys.length > 0 && (
              <View style={styles.outcomeEffects}>
                <Text style={styles.effectsSectionLabel}>Policy Effects</Text>
                {axisKeys.map((axis) => (
                  <AxisEffectSlider
                    key={axis}
                    axis={axis}
                    change={outcome.axisEffects[axis as keyof typeof outcome.axisEffects] ?? 0}
                    currentValue={axisValues?.[axis] ?? 0}
                    playerAgendas={playerAgendas}
                  />
                ))}
              </View>
            )}
            {factionKeys.length > 0 && (
              <View style={styles.outcomeEffects}>
                <Text style={styles.effectsSectionLabel}>Power Effects</Text>
                {factionKeys.map((fkey) => (
                  <PowerEffectRow
                    key={fkey}
                    factionName={factionInfoMap?.[fkey]?.displayName ?? fkey}
                    currentPower={factionInfoMap?.[fkey]?.power ?? 3}
                    change={outcome.factionPowerEffects[fkey] ?? 0}
                  />
                ))}
              </View>
            )}
          </View>
        );
      })}

      {/* Investment input */}
      <View style={styles.investSection}>
        <Text style={styles.investLabel}>
          Influence to invest: <Text style={styles.investValue}>{investAmount}/{currentInfluence}</Text>
        </Text>
        <View style={styles.inputRow}>
          <Pressable
            style={styles.stepButton}
            onPress={() => setInfluenceInput(String(Math.max(0, investAmount - 1)))}
          >
            <Text style={styles.stepButtonText}>−</Text>
          </Pressable>
          <TextInput
            style={[styles.influenceInput, !isValid && influenceInput !== '0' && styles.inputInvalid]}
            value={influenceInput}
            onChangeText={setInfluenceInput}
            keyboardType="number-pad"
            maxLength={4}
          />
          <Pressable
            style={styles.stepButton}
            onPress={() => setInfluenceInput(String(Math.min(currentInfluence, investAmount + 1)))}
          >
            <Text style={styles.stepButtonText}>+</Text>
          </Pressable>
        </View>
        <Text style={styles.note}>Investing 0 is allowed but you won't rank for rewards</Text>
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <Pressable
        style={[styles.submitButton, (submitting || !isValid) && styles.submitDisabled]}
        onPress={handleSubmit}
        disabled={submitting || !isValid}
      >
        {submitting ? (
          <ActivityIndicator color={C.darkText} size="small" />
        ) : (
          <Text style={styles.submitButtonText}>Submit Investment</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const endeavourColor = CONTROVERSY_TYPE_COLORS.endeavour;

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
  thresholdBanner: {
    backgroundColor: endeavourColor + '18',
    borderWidth: 1,
    borderColor: endeavourColor + '50',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    gap: 4,
  },
  thresholdLabel: {
    color: endeavourColor,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  thresholdValue: {
    color: C.paleGold,
    fontSize: 22,
    fontWeight: '700',
  },
  thresholdNote: {
    color: C.paleGold,
    fontSize: 11,
    opacity: 0.5,
    textAlign: 'center',
    lineHeight: 15,
  },
  outcomeCard: {
    borderRadius: 10,
    padding: 12,
    gap: 8,
    borderWidth: 1,
  },
  outcomeSuccess: {
    backgroundColor: C.positive + '12',
    borderColor: C.positive + '30',
  },
  outcomeFailure: {
    backgroundColor: C.negative + '12',
    borderColor: C.negative + '30',
  },
  outcomeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  outcomeLabel: {
    color: C.paleGold,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  outcomeVP: {
    color: C.gold,
    fontSize: 13,
    fontWeight: '700',
  },
  outcomeEffects: {
    gap: 6,
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
  rewardTable: {
    gap: 4,
  },
  rewardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rewardRank: {
    color: C.gold,
    fontSize: 12,
    fontWeight: '700',
    width: 24,
  },
  rewardValue: {
    color: C.paleGold,
    fontSize: 12,
  },
  investSection: { gap: 6 },
  investLabel: { color: C.paleGold, fontSize: 13 },
  investValue: { color: C.gold, fontWeight: '700' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepButton: {
    width: 36,
    height: 36,
    backgroundColor: goldBg(0.15),
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepButtonText: {
    color: C.gold,
    fontSize: 20,
    lineHeight: 24,
  },
  influenceInput: {
    backgroundColor: whiteBg(0.06),
    borderWidth: 1,
    borderColor: goldBg(0.3),
    borderRadius: 8,
    color: C.paleGold,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    width: 70,
    height: 36,
    paddingVertical: 0,
  },
  inputInvalid: { borderColor: C.negative },
  note: {
    color: C.paleGold,
    fontSize: 11,
    opacity: 0.45,
  },
  submitButton: {
    backgroundColor: C.gold,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitDisabled: { opacity: 0.5 },
  submitButtonText: {
    color: C.darkText,
    fontSize: 16,
    fontWeight: '700',
  },
  waitingText: {
    color: C.gold,
    fontSize: 14,
    opacity: 0.8,
  },
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
  resultFailure: {
    backgroundColor: C.negative + '18',
    borderColor: C.negative + '50',
  },
  resultLabel: {
    color: C.paleGold,
    fontSize: 16,
    fontWeight: '700',
  },
  resultDetail: {
    color: C.paleGold,
    fontSize: 13,
    opacity: 0.7,
  },
  rankingsSection: { gap: 6 },
  sectionLabel: {
    color: C.parchment,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    opacity: 0.4,
    marginBottom: 2,
  },
  rankingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: goldBg(0.06),
    borderRadius: 6,
    padding: 8,
  },
  rankNumber: {
    color: C.gold,
    fontSize: 14,
    fontWeight: '700',
    width: 28,
  },
  rankPlayer: {
    color: C.paleGold,
    fontSize: 13,
    flex: 1,
  },
  rankInvested: {
    color: C.paleGold,
    fontSize: 11,
    opacity: 0.6,
  },
  rankVP: {
    color: C.positive,
    fontSize: 12,
    fontWeight: '700',
  },
  rankInfluence: {
    color: endeavourColor,
    fontSize: 12,
    fontWeight: '600',
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
});
